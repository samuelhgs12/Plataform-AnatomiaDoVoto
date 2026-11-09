import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { nomeProprio } from "@/lib/abstencao";
import {
  cargosDoAno, contaGasto, contaGastoEstado, ehMunicipal, hrefMapaDinheiro, lerRecorte, valorCidade, valorDoEstado, valorDoPorte,
} from "@/lib/dinheiro";
import { NOME_UF } from "@/lib/financiamento";
import { inteiro, reais } from "@/lib/format";
import { disputaPrefeito, PORTES, type CandidatoLocal, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AvisoApi } from "@/components/AvisoApi";
import { ComparacoesDinheiro } from "@/components/ComparacoesDinheiro";
import { FiltrosDinheiro } from "@/components/FiltrosDinheiro";
import { AbasDinheiro } from "@/components/AbasDinheiro";
import { PropagandaGeral } from "@/components/PropagandaGeral";
import { ABA_PROPAGANDA, cargosPropaganda, recortePropaganda } from "@/lib/propaganda-geral";
import { METODOLOGIA } from "@/lib/metodologia";

export const metadata: Metadata = { title: "Dinheiro nas eleições" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Dinheiro nas eleições, a análise: o número do lugar (com o atalho para a camada Dinheiro do mapa da página inicial,
 * onde ficam o mapa, as cidades e os candidatos), as comparações (ComparacoesDinheiro, as mesmas do mapa) e a aba
 * Propaganda (pergunta 9).
 */
export default async function Dinheiro({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const abaPropaganda = um(sp.aba) === ABA_PROPAGANDA;   // aba Propaganda (pergunta 9): src/components/PropagandaGeral.tsx
  const dados = await lerAnalise("municipios", ["municipios", "resumo", "estados"]);
  if (!dados?.resumo || !dados.estados || !dados.municipios) {
    return (
      <>
        <header className="area-cab"><p className="rotulo">Dinheiro nas eleições</p><h1>Quanto as campanhas gastaram por vaga?</h1></header>
        <AvisoApi voltar="/analises/dinheiro" />
      </>
    );
  }
  const municipios = comoObjetos<LinhaMunicipio>(dados.municipios);
  const resumo = comoObjetos<LinhaResumo>(dados.resumo);
  const estados = comoObjetos<LinhaEstado>(dados.estados);
  const anos = [...new Set(estados.map((e) => e.ano))].filter((a) => a >= 2018).sort();
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const r = lerRecorte(sp, { anos, ufs, municipios });
  const { ano, cargo, uf, mun } = r;
  const prop = abaPropaganda ? recortePropaganda({ ...r, mun: mun && { nome: nomeProprio(mun.nome) } }, { cargo: um(sp.cargo), porte: um(sp.porte), nomeUf: (u) => NOME_UF[u] ?? u }) : null;
  const municipal = ehMunicipal(ano);
  const ver = um(sp.ver) === "publico" ? "publico" : "recursos";          // P2 (todo o dinheiro) ou P8 (só o público)
  const ordem = um(sp.ordem) === "nome" ? "nome" : "valor";
  const porteFiltro = municipal ? PORTES.find((p) => p.chave === um(sp.porte)) : undefined;   // recorte por porte da cidade
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Seis estados";
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;

  // o recorte na URL: trocar o estado solta a cidade
  const estado: Record<string, string | number | undefined> = {
    ano, cargo, uf, mun: mun?.id_municipio, vista: r.vista === "lista" ? "lista" : undefined,
    ordem: ordem === "nome" ? "nome" : undefined, ver: ver === "publico" ? "publico" : undefined, porte: porteFiltro?.chave,
  };
  const href = (novo: Record<string, string | number | null> = {}, ancora?: string) => {
    const atual = { ...estado, ...("uf" in novo ? { mun: undefined } : {}) };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v !== null && v !== undefined && v !== "") p.set(k, String(v));
    return `/analises/dinheiro?${p}${ancora ? `#${ancora}` : ""}`;
  };

  // ---------- P1: o gasto por vaga do lugar ----------
  // um estado (ou os seis): com um porte escolhido, só as cidades daquele porte (soma dos gastos ÷ soma das vagas)
  const gastoEm = (u: string | undefined) => (porteFiltro ? valorDoPorte(resumo, ano, u, porteFiltro.chave, "gasto", cargo) : null);
  const valorEstadoGasto = (u: string | undefined) => (porteFiltro ? gastoEm(u)!.valor : valorDoEstado(estados, ano, u, "gasto", cargo));
  const custo = mun ? valorCidade(linhaMun, "gasto", cargo) : valorEstadoGasto(uf);
  const conta = mun ? contaGasto(linhaMun, cargo) : porteFiltro ? gastoEm(uf)!.conta : contaGastoEstado(estados, ano, uf, cargo);
  const custoUf = mun ? valorEstadoGasto(uf) : uf ? valorEstadoGasto(undefined) : null;
  const comPorte = porteFiltro ? ` (cidades de ${porteFiltro.rotulo})` : "";

  // ---------- candidatos do recorte ----------
  // o prefeito eleito da cidade escolhida, para a frase do cartão do lugar (a lista de candidatos fica no mapa)
  const candidatos = mun && cargo === "Prefeito" ? await apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : null;
  const disputa = candidatos ? disputaPrefeito(candidatos) : null;
  const eleitoPrefeito = disputa?.candidatos.find((c) => c.eleito);
  const eleitoPrefeitoTexto = eleitoPrefeito ? `; o eleito, ${eleitoPrefeito.nome_urna} (${eleitoPrefeito.partido}), ${eleitoPrefeito.prestou === false ? "não entregou a prestação de contas final" : `gastou ${reais(eleitoPrefeito.gasto)}`}` : "";

  return (
    <>
      <header className="area-cab">
        <p className="rotulo">Dinheiro nas eleições · AP, ES, MG, PE, RJ e RR</p>
        <h1>{prop ? "Onde os candidatos investem em propaganda?" : "Quanto as campanhas gastaram por vaga?"}</h1>
        <p>{prop ? "Escolha a eleição, o cargo e o estado." : "Compare os estados e veja se quem teve mais dinheiro se elegeu mais. O mapa do gasto por vaga, com os candidatos de cada cidade, fica na camada Dinheiro do mapa."}</p>
      </header>

      <FiltrosDinheiro
        anos={anos.map((a) => [String(a), `${a} · ${ehMunicipal(a) ? "municipal" : "geral"}`])}
        cargos={prop ? cargosPropaganda(ano, cargosDoAno(ano)) : cargosDoAno(ano)} ufs={ufs.map((u) => [u, NOME_UF[u] ?? u])}
        // com um estado escolhido, só as cidades dele; sem estado, todas, agrupadas por estado
        cidades={municipal ? ufs.filter((u) => !uf || u === uf).map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, opcoes: municipios.filter((m) => m.uf === u).map((m) => [String(m.id_municipio), nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")) })) : null}
        portes={municipal ? PORTES.map((p) => [p.chave, p.rotulo] as [string, string]) : null}
        atual={{ ano: String(ano), cargo: prop?.cargo ?? cargo, uf: uf ?? "", mun: mun ? String(mun.id_municipio) : "", porte: porteFiltro?.chave ?? "" }}
        fixos={Object.fromEntries(Object.entries({ vista: estado.vista, ordem: estado.ordem, ver: estado.ver, aba: prop ? ABA_PROPAGANDA : undefined }).filter(([, v]) => v)) as Record<string, string>}
      />
      {!prop && (r.cargoTrocado || r.munIgnorado) && (
        <p className="aviso-linha">
          {r.cargoTrocado && `${r.cargoTrocado} não é eleito em ${ano}: mostrando ${cargo.toLowerCase()}. `}
          {r.munIgnorado && `Nas eleições gerais não há dados por município: mostrando ${lugar}.`}
        </p>
      )}
      <AbasDinheiro filtros={{ ano, cargo: prop?.cargo ?? cargo, uf: uf ?? null }} atual={prop ? "propaganda" : "gasto"} />
      {prop && prop.avisos.length > 0 && <p className="aviso-linha">{prop.avisos.join(" ")}</p>}

      {/* aba Propaganda (pergunta 9): o corpo troca; as seções abaixo são da aba padrão, "Gasto por vaga" */}
      {prop ? <PropagandaGeral ano={prop.ano} cargo={prop.cargo} uf={prop.uf} nomeUf={prop.uf ? NOME_UF[prop.uf] ?? prop.uf : null} ufNaUrl={uf ?? null} /> : (<>
      {/* O mapa do gasto por vaga mora na camada Dinheiro do mapa da página inicial (src/components/VisaoDinheiro.tsx):
          aqui fica só o número do lugar, com o atalho para vê-lo no mapa, e as comparações */}
      <section id="lugar" className="card area-lugar" aria-labelledby="h-lugar">
        <div>
          <p className="rotulo">{cargo} · {ano}{!mun && porteFiltro ? ` · cidades de ${porteFiltro.rotulo}` : ""}</p>
          <h2 id="h-lugar">{lugar}</h2>
          {cargo === "Prefeito" && mun ? (
            <p className="painel-resumo"><b>{custo === null ? "Não informado" : reais(custo)}</b> gastos por todas as campanhas a prefeito{eleitoPrefeitoTexto}</p>
          ) : (
            <p className="painel-resumo"><b>{custo === null ? "Não informado" : reais(custo)}</b> por vaga de {cargo.toLowerCase()}{conta ? <small> ({reais(conta.gasto)} ÷ {inteiro(conta.vagas)} {conta.vagas === 1 ? "vaga" : "vagas"})</small> : null}</p>
          )}
          {custoUf !== null && <p className="muted pequeno">{mun ? NOME_UF[uf!] : "Seis estados"}{comPorte}: {reais(custoUf)} por vaga.</p>}
        </div>
        <Link className="botao-mapa" href={hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.cod_ibge })}>
          {mun ? "Ver no mapa e os candidatos" : uf ? (municipal ? "Ver as cidades no mapa" : "Ver no mapa e os eleitos") : "Ver no mapa"} ›
        </Link>
      </section>

      {/* as comparações são as mesmas da camada Dinheiro do mapa da página inicial */}
      <ComparacoesDinheiro
        ano={ano} cargo={cargo} uf={uf} mun={mun} nomeMun={mun ? lugar : undefined} porte={porteFiltro?.chave} medir={ver}
        hrefMedir={(m) => href({ ver: m === "publico" ? "publico" : null }, "comparar")} hrefUf={(u) => href({ uf: u }, "estados")}
      />


      <details className="card analise-metodo">
        <summary>Como calculamos</summary>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          {METODOLOGIA.dinheiro.calculo.map((t) => <li key={t}>{t}</li>)}
          <li>Análises completas: {METODOLOGIA.dinheiro.ondeVer.slice(1).map((o, i, l) => (
            <span key={o.href}>{i ? (i === l.length - 1 ? " e " : ", ") : ""}<Link href={o.href}>{o.rotulo.toLowerCase()}</Link></span>
          ))}.</li>
        </ul>
      </details>
      </>)}
    </>
  );
}

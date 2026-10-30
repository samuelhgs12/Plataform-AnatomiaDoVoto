import type { ReactNode } from "react";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import {
  ANOS_DINHEIRO, contaGasto, contaGastoEstado, corCidade, corPorFaixas, ehMunicipal, escolhaMapaDinheiro, hrefMapaDinheiro, legendaCidade, legendaPorFaixas,
  ordenarLinhas, textoValor, valorCidade, valorDoEstado,
} from "@/lib/dinheiro";
import { naRegua, type FichaDica } from "@/lib/dica";
import { NOME_UF } from "@/lib/financiamento";
import { compacto, inteiro, reais } from "@/lib/format";
import { centrarLupa, TELA } from "@/lib/lupa";
import { disputaPrefeito, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { BarrasH } from "./BarrasH";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { LinhasCandidatos, type LinhaCandidato } from "./LinhasCandidatos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { MiniMapa } from "./MiniMapa";
import { Rolar } from "./Rolar";

type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
/** Candidatos de cada grupo à vista; o resto fica em "Ver todos" (até MAX_LISTA não eleitos, os mais votados). */
const INICIO_LISTA = 8;
const MAX_LISTA = 40;
const QUINTOS = ["q0", "q1", "q2", "q3", "q4"];

/**
 * Camada Dinheiro do mapa da página inicial (perguntas 1, 2 e 8): o mapa pinta o gasto das campanhas por vaga (estados;
 * nas eleições municipais, as cidades do estado aberto) e, embaixo, o painel do lugar: o gasto por vaga com a conta, os
 * candidatos da cidade (ou os eleitos do estado, nas gerais) com quanto gastaram e receberam, ou a comparação entre os
 * estados. As comparações de "quem teve mais dinheiro se elegeu mais?" e a propaganda ficam na análise completa
 * (/analises/dinheiro). Lê a análise `municipios` e os candidatos da API; as contas são de src/lib/dinheiro.ts.
 */
export async function VisaoDinheiro({ menu, sp }: { menu: ReactNode; sp: SP }) {
  const { ano, cargo } = escolhaMapaDinheiro(sp);
  const municipal = ehMunicipal(ano);
  const dados = await lerAnalise("municipios", ["municipios", "resumo", "estados"]);
  if (!dados?.resumo || !dados.estados || !dados.municipios) {
    return (
      <>
        <MapaVivo className="palco s12">
          {menu}
          <div className="palco-topo"><div><h1 id="h-mapa">Quanto as campanhas gastaram por vaga</h1></div></div>
          <div className="card aviso">
            <h2>Dinheiro indisponível</h2>
            <p>A API não devolveu a análise <code>municipios</code>. Confira se ela está rodando (<code>uvicorn app.main:app</code> em <code>api/</code>).</p>
          </div>
        </MapaVivo>
      </>
    );
  }
  const municipios = comoObjetos<LinhaMunicipio>(dados.municipios);
  const resumo = comoObjetos<LinhaResumo>(dados.resumo);
  const estados = comoObjetos<LinhaEstado>(dados.estados);
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === um(sp.uf));
  const mun = municipal && uf ? municipios.find((m) => m.uf === uf && String(m.id_municipio) === um(sp.mun)) : undefined;
  const href = (novo: Parameters<typeof hrefMapaDinheiro>[1]) => hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.id_municipio }, novo);
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Os seis estados";
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;
  const cargoMin = cargo.toLowerCase();

  // estados: gasto por vaga em quintos dos seis; a dica mostra o valor na régua das cores
  const valorUf = (u?: string) => valorDoEstado(estados, ano, u, "gasto", cargo);
  const valoresUf = ufs.map((u) => valorUf(u));
  const faixasUf = quantis(valoresUf.flatMap((v) => v ?? []), 5);
  const conhecidos = valoresUf.flatMap((v) => v ?? []);
  const [minUf, maxUf] = [Math.min(...conhecidos), Math.max(...conhecidos)];
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => {
    const v = valoresUf[i];
    const ficha: FichaDica = { titulo: NOME_UF[u] ?? u, sub: `${cargo} · ${ano}`, medidas: v === null ? [] : [{ rotulo: "Gasto por vaga", valor: reais(v), cores: QUINTOS, p: naRegua(v, faixasUf, minUf, maxUf) }] };
    return {
      uf: u, classe: corPorFaixas(v, faixasUf), href: href({ uf: u === uf ? null : u }), sigla: u, valor: v === null ? "" : compacto(v),   // "222 mil", "5,1 mi": cabe no selo do estado
      descricao: `${NOME_UF[u] ?? u}: ${textoValor(v, "gasto", cargo)} por vaga de ${cargoMin} em ${ano}`, ficha,
    };
  });
  // cidades do estado aberto (só nas municipais): faixas fixas em reais, iguais em todos os estados
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !municipal || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const v = valorCidade(doAno.get(m.id_municipio), "gasto", cargo);
    return {
      ibge: m.cod_ibge, classe: corCidade(v, "gasto", cargo), href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, "gasto", cargo)}${cargo === "Prefeito" ? " gastos na disputa" : " por vaga"}`,
      atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100,
    };
  });
  const legenda = uf && municipal ? legendaCidade("gasto", cargo) : legendaPorFaixas(faixasUf, (v) => `R$ ${compacto(v)}`);
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const mapaPalco = (
    <MapaAbstencao
      titulo={`Gasto por vaga de ${cargoMin}: ${lugar}, ${ano}`} camera={camera} estados={noMapaUf} uf={uf} municipios={noMapaMun}
      destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined}
    />
  );
  const focoMini = mun && centro && caixa ? centrarLupa({ x: camera.x + centro[0] * camera.k, y: camera.y + centro[1] * camera.k }, 3) : undefined;

  // o número do lugar, com a conta, e o de cima para comparar
  const custo = mun ? valorCidade(linhaMun, "gasto", cargo) : valorUf(uf);
  const conta = mun ? contaGasto(linhaMun, cargo) : contaGastoEstado(estados, ano, uf, cargo);
  const custoCima = mun ? valorUf(uf) : uf ? valorUf(undefined) : null;

  // candidatos: os da cidade (eleições municipais) ou os eleitos do estado (gerais)
  const [candidatos, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    !municipal && uf ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${ano}`) : Promise.resolve(null),
  ]);
  const disputa = cargo === "Prefeito" && candidatos ? disputaPrefeito(candidatos) : null;
  const linhas: LinhaCandidato[] = disputa ? disputa.candidatos : candidatos ?? (eleitosUf ?? []).filter((e) => e.cargo === cargo).map((e) => ({ ...e, eleito: true }));
  const eleitos = linhas.filter((c) => c.eleito);
  const naoEleitos = linhas.filter((c) => !c.eleito);
  const maisGastou = disputa?.candidatos.find((c) => c.maisGastou);
  const eleitoPrefeito = disputa?.candidatos.find((c) => c.eleito);
  const temCandidatos = !!mun || (!municipal && !!uf);

  // sem candidatos à vista: os estados lado a lado (ou, com um estado aberto, as cidades que mais gastaram por vaga)
  const estadosGasto = ordenarLinhas(ufs.map((u, i) => ({ id: u, nome: NOME_UF[u] ?? u, valor: valoresUf[i], conta: contaGastoEstado(estados, ano, u, cargo) })), "valor");
  // ao lado do número: as cidades que mais gastaram (a escolhida entra no fim, se não estiver entre elas) ou os estados
  const cidadesUf = municipal && uf
    ? ordenarLinhas(municipios.filter((m) => m.uf === uf).map((m) => ({ id: m.id_municipio, nome: nomeMun.get(m.id_municipio)!, valor: valorCidade(doAno.get(m.id_municipio), "gasto", cargo), conta: contaGasto(doAno.get(m.id_municipio), cargo) })), "valor")
    : [];
  const posMun = mun ? cidadesUf.findIndex((c) => c.id === mun.id_municipio) : -1;
  const cidadesTopo = posMun >= 8 ? [...cidadesUf.slice(0, 7), cidadesUf[posMun]] : cidadesUf.slice(0, 8);
  const analise = `/analises/dinheiro?${new URLSearchParams(Object.entries({ ano: String(ano), cargo, uf: uf ?? "", mun: mun ? String(mun.id_municipio) : "" }).filter(([, v]) => v))}`;
  const paramsMun = Object.fromEntries(new URL(href({ mun: null }), "http://x").searchParams);

  return (
    <>
      <MapaVivo className="palco s12" estado={uf}>
        {menu}
        <div className="palco-topo">
          <div>
            <h1 id="h-mapa">Quanto as campanhas gastaram por vaga em {ano}</h1>
            <p className="palco-sobre">{cargo} · {municipal ? (uf ? "por cidade" : "por estado; clique para ver as cidades") : "eleição geral, por estado"}</p>
          </div>
          <nav className="trilha" aria-label="Onde você está no mapa">
            <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
            {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
            {mun && <><span aria-hidden="true">/</span><span aria-current="true">{lugar}</span></>}
          </nav>
        </div>

        <div className="palco-mapa">
          {mapaPalco}
          {!uf && <p className="palco-dica" aria-hidden="true">{municipal ? "Clique num estado para ver as cidades" : "Clique num estado para ver os eleitos"}</p>}
        </div>

        <div className="palco-base">
          <ul className="legenda-q" aria-label={uf && municipal ? "Cores: faixas fixas de gasto por vaga, em reais" : "Cores: cada uma reúne um quinto dos estados pelo gasto por vaga"}>
            {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
          </ul>
          <div className="anos" role="group" aria-label="Ano da eleição">
            {ANOS_DINHEIRO.map((a) => (
              <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                {a}<small>{ehMunicipal(a) ? "Municipal" : "Geral"}</small>
              </Link>
            ))}
          </div>
        </div>
      </MapaVivo>

      <div className="painel s12" key={`dinheiro-${uf}-${mun?.id_municipio}-${ano}-${cargo}`}>
        <div className="bloco noite painel-cab s4">
          <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}</p>
          <h2>{lugar}</h2>
          <p className="painel-num longo"><Rolar valor={custo === null ? "Não informado" : reais(custo)} /></p>
          {cargo === "Prefeito" && mun ? (
            <>
              <p>gastos por todas as campanhas a prefeito.</p>
              {eleitoPrefeito && <p className="pequeno">Prefeito eleito: <b>{eleitoPrefeito.nome_urna}</b> ({eleitoPrefeito.partido}), que {eleitoPrefeito.prestou === false ? "não entregou a prestação de contas final" : <>gastou <b>{reais(eleitoPrefeito.gasto)}</b></>}.</p>}
            </>
          ) : (
            <p>por vaga de {cargoMin}{conta ? `: ${reais(conta.gasto)} gastos pelas campanhas ÷ ${inteiro(conta.vagas)} ${conta.vagas === 1 ? "vaga" : "vagas"}` : ""}.</p>
          )}
          {custoCima !== null && <p className="pequeno">{mun ? NOME_UF[uf!] : "Seis estados juntos"}: <b>{reais(custoCima)}</b> por vaga.</p>}
          {municipal && uf && (
            <EscolhaMunicipio
              opcoes={municipios.filter((m) => m.uf === uf).map((m) => [m.id_municipio, nomeMun.get(m.id_municipio)!] as [number, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
              atual={mun?.id_municipio} params={paramsMun}
            />
          )}
        </div>

        {cidadesTopo.length > 0 ? (
          <div className="bloco noite s8 dinheiro-barras">
            <h3>Cidades de {NOME_UF[uf!]} que mais gastaram{cargo === "Prefeito" ? " na disputa a prefeito" : " por vaga"}</h3>
            <BarrasH compacto titulo={`Cidades de ${NOME_UF[uf!]} com maior gasto ${cargo === "Prefeito" ? "na disputa a prefeito" : `por vaga de ${cargoMin}`} em ${ano}`}
              linhas={cidadesTopo.map((c) => ({ chave: String(c.id), rotulo: `${cidadesUf.indexOf(c) + 1}º ${c.nome}`, valor: c.valor ?? 0, classe: c.id === mun?.id_municipio ? "pub" : "fx2", texto: textoValor(c.valor, "gasto", cargo),
                subtexto: c.conta && cargo !== "Prefeito" ? `${reais(c.conta.gasto)} ÷ ${inteiro(c.conta.vagas)} ${c.conta.vagas === 1 ? "vaga" : "vagas"}` : "", href: href({ mun: c.id }), atual: c.id === mun?.id_municipio }))} />
            <p className="muted pequeno">{mun ? `${lugar} é a ${posMun + 1}ª de ${inteiro(cidadesUf.length)} cidades.` : "Clique numa cidade, aqui ou no mapa, para ver os candidatos e quanto cada um gastou."}</p>
          </div>
        ) : (
          <div className="bloco noite s8 dinheiro-barras">
            <h3>Gasto por vaga em cada estado</h3>
            <BarrasH compacto titulo={`Gasto por vaga de ${cargoMin} em cada estado, ${ano}`}
              linhas={estadosGasto.map((e) => ({ chave: e.id, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.id ? "pub" : "fx2",
                texto: textoValor(e.valor, "gasto", cargo), subtexto: e.conta ? `${reais(e.conta.gasto)} ÷ ${inteiro(e.conta.vagas)} vagas` : "", href: href({ uf: e.id }), atual: uf === e.id }))} />
            <p className="muted pequeno">Gasto de todas as campanhas ao cargo ÷ vagas. Valores sem correção pela inflação.</p>
          </div>
        )}

        {temCandidatos && (
          <div className="bloco noite s12 dinheiro-cand">
            <h3>{mun ? `Candidatos a ${cargoMin} em ${lugar}` : `Eleitos: ${cargoMin} em ${NOME_UF[uf!]}`}</h3>
            {maisGastou && <p className="r-texto"><b>{maisGastou.nome_urna}</b> teve o maior gasto declarado e {maisGastou.eleito ? "foi eleito" : "não foi eleito"}.</p>}
            {mun && <p className="rotulo">Eleitos ({inteiro(eleitos.length)})</p>}
            <LinhasCandidatos linhas={eleitos.slice(0, INICIO_LISTA)} ano={ano}
              vazio={candidatos === null && eleitosUf === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum eleito registrado."} />
            {eleitos.length > INICIO_LISTA && (
              <details className="ver-todos"><summary>Ver todos os {inteiro(eleitos.length)} eleitos</summary>
                <LinhasCandidatos linhas={eleitos.slice(INICIO_LISTA)} ano={ano} vazio="" />
              </details>
            )}
            {naoEleitos.length > 0 && (
              <>
                <p className="rotulo">Não eleitos ({inteiro(naoEleitos.length)})</p>
                <LinhasCandidatos linhas={naoEleitos.slice(0, INICIO_LISTA)} ano={ano} vazio="" />
                {naoEleitos.length > INICIO_LISTA && (
                  <details className="ver-todos"><summary>Ver {naoEleitos.length > MAX_LISTA ? `os ${MAX_LISTA} mais votados` : `todos os ${inteiro(naoEleitos.length)} não eleitos`}</summary>
                    <LinhasCandidatos linhas={naoEleitos.slice(INICIO_LISTA, MAX_LISTA)} ano={ano} vazio="" />
                  </details>
                )}
              </>
            )}
            <p className="muted pequeno">{mun ? "Gasto e dinheiro recebido de cada campanha, da prestação de contas final." : "Por estado, só os eleitos."} Clique no nome para ver o perfil.</p>
          </div>
        )}

        <ul className="atalhos s12">
          <li><Link href={`${analise}#comparar`}>Quem teve mais dinheiro se elegeu mais?</Link></li>
          <li><Link href={`${analise}#estados`}>Comparar os estados</Link></li>
          <li><Link href={`${analise}${analise.includes("?") ? "&" : "?"}aba=propaganda`}>Onde investem em propaganda</Link></li>
        </ul>
      </div>
      <MiniMapa recorte={`Gasto por vaga · ${cargo} · ${lugar} · ${ano}`} foco={focoMini}>{mapaPalco}</MiniMapa>
    </>
  );
}

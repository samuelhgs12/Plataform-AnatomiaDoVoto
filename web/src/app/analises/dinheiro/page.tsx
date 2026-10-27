import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import {
  cargosDoAno, classeComPorte, contaGasto, contaGastoEstado, corCidade, corPorFaixas, ehMajoritario, ehMunicipal, emCada100, legendaCidade,
  legendaPorFaixas, lerRecorte, mediasPorResultado, ordenarLinhas, qualificacao, textoValor, tresGrupos, valorCidade, valorDoEstado, valorDoPorte, type GrupoTaxa,
} from "@/lib/dinheiro";
import { compararGrupos, pontosPercentuais } from "@/lib/estatistica";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import { inteiro, pct, reais } from "@/lib/format";
import { coberturaDisputas, daMedida, maiorGastador, respostaMaior, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto } from "@/lib/gastos";
import { TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AvisoApi } from "@/components/AvisoApi";
import { BarrasH } from "@/components/BarrasH";
import { FiltrosDinheiro } from "@/components/FiltrosDinheiro";
import { LinhasCandidatos, type LinhaCandidato } from "@/components/LinhasCandidatos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "@/components/MapaAbstencao";
import { MapaVivo } from "@/components/MapaVivo";

export const metadata: Metadata = { title: "Dinheiro nas eleições" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Vereadores não eleitos mostrados de uma vez (os mais votados); nas capitais passam de mil. */
const MAX_LISTA = 40;
/** Quantos candidatos de cada grupo aparecem de início; o resto fica em "Ver todos". */
const INICIO_LISTA = 8;
const pp = (a: number, b: number) => { const d = Math.abs(pontosPercentuais(a, b)); return `${d} ${d === 1 ? "ponto percentual" : "pontos percentuais"}`; };

/** Barras de taxa de eleição em três grupos, com eleitos e candidaturas abaixo de cada uma (para conferir). */
function BarrasGrupos({ titulo, grupos }: { titulo: string; grupos: [string, string, GrupoTaxa][] }) {
  return (
    <BarrasH compacto max={1} titulo={titulo}
      linhas={grupos.map(([k, t, g]) => ({ chave: k, rotulo: t, valor: g.taxa, classe: k === "mais" ? "pub" : "fx2", trilhoCheio: true,
        texto: g.candidaturas ? `${emCada100(g.taxa)}% eleitos` : "—", subtexto: `${inteiro(g.eleitos)} eleitos de ${inteiro(g.candidaturas)}` }))} />
  );
}

/**
 * Dinheiro nas eleições, numa página: a pergunta 1 conduz (mapa e lista do gasto por vaga, estado → município); as
 * perguntas 2 e 8 respondem juntas, embaixo, no mesmo recorte ("quem teve mais dinheiro se elegeu mais?", medindo por
 * todo o dinheiro ou só pelo público); os candidatos aparecem quando há um lugar escolhido.
 */
export default async function Dinheiro({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [dados, q2, q8] = await Promise.all([
    lerAnalise("municipios", ["municipios", "resumo", "estados"]),
    lerAnalise("q2", ["faixas", "maior_gasto"]),
    lerAnalise("q8", ["sucesso", "fontes"]),
  ]);
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
  const municipal = ehMunicipal(ano);
  const majoritario = ehMajoritario(cargo);
  const ver = um(sp.ver) === "publico" ? "publico" : "recursos";          // P2 (todo o dinheiro) ou P8 (só o público)
  const ordem = um(sp.ordem) === "nome" ? "nome" : "valor";
  const porteFiltro = municipal ? PORTES.find((p) => p.chave === um(sp.porte)) : undefined;   // recorte por porte da cidade
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Seis estados";
  const emLugar = mun || uf ? `em ${lugar}` : "nos seis estados";
  const nomeUf = uf ? NOME_UF[uf] ?? uf : "seis estados";
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;
  const porte = porteDe(linhaMun?.eleitorado);

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
  const f = { ano, cargo, uf };

  // ---------- P1: o gasto por vaga do lugar ----------
  // um estado (ou os seis): com um porte escolhido, só as cidades daquele porte (soma dos gastos ÷ soma das vagas)
  const gastoEm = (u: string | undefined) => (porteFiltro ? valorDoPorte(resumo, ano, u, porteFiltro.chave, "gasto", cargo) : null);
  const valorEstadoGasto = (u: string | undefined) => (porteFiltro ? gastoEm(u)!.valor : valorDoEstado(estados, ano, u, "gasto", cargo));
  const custo = mun ? valorCidade(linhaMun, "gasto", cargo) : valorEstadoGasto(uf);
  const conta = mun ? contaGasto(linhaMun, cargo) : porteFiltro ? gastoEm(uf)!.conta : contaGastoEstado(estados, ano, uf, cargo);
  const custoUf = mun ? valorEstadoGasto(uf) : uf ? valorEstadoGasto(undefined) : null;
  const comPorte = porteFiltro ? ` (cidades de ${porteFiltro.rotulo})` : "";

  // mapa e lista: sempre o gasto por vaga, do cargo escolhido (e do porte, se escolhido)
  const valoresUf = ufs.map((u) => valorEstadoGasto(u));
  const faixasUf = quantis(valoresUf.flatMap((v) => v ?? []), 5);
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => ({
    uf: u, classe: corPorFaixas(valoresUf[i], faixasUf), href: href({ uf: u === uf ? null : u }, "mapa"), sigla: u,
    valor: valoresUf[i] === null ? "" : reais(valoresUf[i]!).replace("R$ ", ""), descricao: `${NOME_UF[u] ?? u}: ${textoValor(valoresUf[i], "gasto", cargo)} por vaga (${cargo.toLowerCase()}, ${ano})`,
  }));
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !municipal || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const linha = doAno.get(m.id_municipio);
    const v = valorCidade(linha, "gasto", cargo);
    return { ibge: m.cod_ibge, classe: classeComPorte(corCidade(v, "gasto", cargo), porteDe(linha?.eleitorado)?.chave, porteFiltro?.chave),
      href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }, "mapa"),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, "gasto", cargo)} por vaga`, atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100 };
  });
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const legenda = uf && municipal ? legendaCidade("gasto", cargo) : legendaPorFaixas(faixasUf, (v) => reais(v));
  const linhasLista = municipal && uf
    ? ordenarLinhas(municipios.filter((m) => m.uf === uf && (!porteFiltro || porteDe(doAno.get(m.id_municipio)?.eleitorado)?.chave === porteFiltro.chave)).map((m) => {
      const linha = doAno.get(m.id_municipio);
      return { id: m.id_municipio, nome: nomeMun.get(m.id_municipio)!, valor: valorCidade(linha, "gasto", cargo), conta: contaGasto(linha, cargo), porte: porteDe(linha?.eleitorado)?.rotulo };
    }), ordem)
    : ordenarLinhas(ufs.map((u, i) => ({ id: u, nome: NOME_UF[u] ?? u, valor: valoresUf[i], conta: porteFiltro ? gastoEm(u)!.conta : contaGastoEstado(estados, ano, u, cargo), porte: undefined as string | undefined })), ordem);

  // ---------- P2 e P8, juntas: quem teve mais dinheiro se elegeu mais? ----------
  const faixasQ2 = q2?.faixas ? daMedida(comoObjetos<LinhaGastoFaixa>(q2.faixas), "recursos") : [];
  const maiores = q2?.maior_gasto ? daMedida(comoObjetos<LinhaMaiorGasto>(q2.maior_gasto), "gasto") : [];
  const sucesso = q8?.sucesso ? comoObjetos<LinhaSucesso>(q8.sucesso) : [];
  const recUf = tresGrupos(sucessoPorGasto(faixasQ2, f));
  const pubUf = sucessoTresGrupos(sucesso, f);
  const respRec = recUf.mais.candidaturas && recUf.menos.candidaturas ? compararGrupos(recUf.mais, recUf.menos).resposta : null;
  const respPub = respostaSucesso(pubUf);
  const basePubNada = respPub.base === pubUf.nada;
  const maior = maiorGastador(maiores, f);
  const cobertura = coberturaDisputas(maior);
  const porPorte = PORTES.map((p) => {
    const sel = resumo.filter((x) => x.ano === ano && (!uf || x.uf === uf) && porteDe(x.eleitorado)?.chave === p.chave && x.maior_venceu != null);
    const venceu = sel.filter((x) => x.maior_venceu).length;
    return { ...p, n: sel.length, venceu, parte: sel.length ? venceu / sel.length : 0 };
  });
  // de onde veio o dinheiro do lugar (a outra metade da P8): parte pública das receitas das campanhas ao cargo
  const publico = mun ? valorCidade(linhaMun, "publico", cargo) : valorDoEstado(estados, ano, uf, "publico", cargo);

  // ---------- candidatos do recorte ----------
  const [candidatos, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    !municipal && uf ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${ano}`) : Promise.resolve(null),
  ]);
  const disputa = cargo === "Prefeito" && candidatos ? disputaPrefeito(candidatos) : null;
  const linhas: LinhaCandidato[] = disputa ? disputa.candidatos : candidatos ?? (eleitosUf ?? []).filter((e) => e.cargo === cargo).map((e) => ({ ...e, eleito: true }));
  const naoEleitos = linhas.filter((c) => !c.eleito);
  const eleitosLista = linhas.filter((c) => c.eleito);
  const maisGastou = disputa?.candidatos.find((c) => c.maisGastou);
  const eleitoPrefeito = disputa?.candidatos.find((c) => c.eleito);
  // média de dinheiro público e privado por candidato no estado (ou nos seis), eleitos × não eleitos
  const fontes = q8?.fontes ? comoObjetos<LinhaFontes>(q8.fontes) : [];
  const medias = mediasPorResultado(fontes, ano, cargo, uf);
  const temCandidatos = !!mun || (!municipal && !!uf);

  return (
    <>
      <header className="area-cab">
        <p className="rotulo">Dinheiro nas eleições · AP, ES, MG, PE, RJ e RR</p>
        <h1>Quanto as campanhas gastaram por vaga?</h1>
        <p>Escolha um estado no mapa ou busque o município.</p>
      </header>

      <FiltrosDinheiro
        anos={anos.map((a) => [String(a), `${a} · ${ehMunicipal(a) ? "municipal" : "geral"}`])}
        cargos={cargosDoAno(ano)} ufs={ufs.map((u) => [u, NOME_UF[u] ?? u])}
        // com um estado escolhido, só as cidades dele; sem estado, todas, agrupadas por estado
        cidades={municipal ? ufs.filter((u) => !uf || u === uf).map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, opcoes: municipios.filter((m) => m.uf === u).map((m) => [String(m.id_municipio), nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")) })) : null}
        portes={municipal ? PORTES.map((p) => [p.chave, p.rotulo] as [string, string]) : null}
        atual={{ ano: String(ano), cargo, uf: uf ?? "", mun: mun ? String(mun.id_municipio) : "", porte: porteFiltro?.chave ?? "" }}
        fixos={Object.fromEntries(Object.entries({ vista: estado.vista, ordem: estado.ordem, ver: estado.ver }).filter(([, v]) => v)) as Record<string, string>}
      />
      {(r.cargoTrocado || r.munIgnorado) && (
        <p className="aviso-linha">
          {r.cargoTrocado && `${r.cargoTrocado} não é eleito em ${ano}: mostrando ${cargo.toLowerCase()}. `}
          {r.munIgnorado && `Nas eleições gerais não há dados por município: mostrando ${lugar}.`}
        </p>
      )}

      {/* 1. Pergunta 1: o mapa (ou a lista) e um painel curto do lugar */}
      <section id="mapa" className="quadro observatorio area-mapa" aria-labelledby="h-mapa">
        {/* na lista não há zoom: sem estado, o MapaVivo não põe os botões da lupa por cima da tabela */}
        <MapaVivo className="palco s8 palco-area" estado={r.vista === "lista" ? undefined : uf}>
          <div className="palco-topo">
            <div>
              <h2 id="h-mapa">Gasto por vaga · {cargo} · {ano}</h2>
              <p className="palco-sobre">{municipal ? (uf ? "por cidade" : "por estado; clique para ver as cidades") : "eleição geral: por estado"}{porteFiltro ? ` · só cidades de ${porteFiltro.rotulo}` : ""}</p>
            </div>
            <nav className="trilha" aria-label="Onde você está">
              <a href={href({ uf: null }, "mapa")} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
              {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null }, "mapa")} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
              {mun && <><span aria-hidden="true">/</span><span aria-current="true">{lugar}</span></>}
            </nav>
          </div>
          {r.vista === "lista" ? (
            <div className="palco-lista">
              <p className="lista-ordem">Ordenar por:{" "}
                <Link href={href({ ordem: null }, "mapa")} scroll={false} aria-current={ordem === "valor" ? "true" : undefined}>gasto por vaga</Link>{" · "}
                <Link href={href({ ordem: "nome" }, "mapa")} scroll={false} aria-current={ordem === "nome" ? "true" : undefined}>nome</Link>
              </p>
              <table>
                <thead><tr><th>{municipal && uf ? "Cidade" : "Estado"}</th>{municipal && uf && <th>Porte</th>}<th className="num">Gasto por vaga</th><th className="num">Gasto total</th><th className="num">Vagas</th></tr></thead>
                <tbody>
                  {linhasLista.map((l) => (
                    <tr key={l.id} aria-current={l.id === (mun?.id_municipio ?? uf) ? "true" : undefined}>
                      <td><Link href={municipal && uf ? href({ mun: l.id }, "mapa") : href({ uf: String(l.id) }, "mapa")} scroll={false}>{l.nome}</Link></td>
                      {municipal && uf && <td>{l.porte?.replace(" eleitores", "") ?? "Não informado"}</td>}
                      <td className="num">{textoValor(l.valor, "gasto", cargo)}</td>
                      <td className="num">{l.conta ? reais(l.conta.gasto) : "Não informado"}</td>
                      <td className="num">{l.conta ? inteiro(l.conta.vagas) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="palco-mapa">
              <MapaAbstencao titulo={`Gasto por vaga de ${cargo.toLowerCase()}: ${lugar}, ${ano}`}
                camera={enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02)}
                estados={noMapaUf} uf={uf} municipios={noMapaMun}
                destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined} />
              {!uf && <p className="palco-dica" aria-hidden="true">Clique num estado{municipal ? " para ver as cidades" : ""} · os demais estão fora da base</p>}
            </div>
          )}
          <div className="palco-base">
            <ul className="legenda-q" aria-label="Cores do mapa: gasto por vaga">
              {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
            </ul>
            <div className="anos" role="group" aria-label="Mapa ou lista">
              <Link href={href({ vista: null }, "mapa")} scroll={false} className={`ano${r.vista === "mapa" ? " on" : ""}`}>Mapa</Link>
              <Link href={href({ vista: "lista" }, "mapa")} scroll={false} className={`ano${r.vista === "lista" ? " on" : ""}`}>Lista</Link>
            </div>
          </div>
        </MapaVivo>

        <div className="area-painel s4" key={`${uf}-${mun?.id_municipio}-${ano}-${cargo}`}>
          <div className="bloco noite painel-cab">
            <p className="palco-sobre">{cargo} · {ano}{!mun && porteFiltro ? ` · cidades de ${porteFiltro.rotulo}` : ""}</p>
            <h3>{lugar}</h3>
            {cargo === "Prefeito" && mun ? (
              <>
                <p className="painel-resumo"><b>{custo === null ? "Não informado" : reais(custo)}</b> gastos por todas as campanhas a prefeito</p>
                {eleitoPrefeito && <p className="pequeno">Prefeito eleito: <b>{eleitoPrefeito.nome_urna}</b> ({eleitoPrefeito.partido}) {eleitoPrefeito.prestou === false ? "não entregou a prestação de contas final" : <>gastou <b>{reais(eleitoPrefeito.gasto)}</b></>}.</p>}
              </>
            ) : (
              <>
                <p className="painel-resumo"><b>{custo === null ? "Não informado" : reais(custo)}</b> por vaga de {cargo.toLowerCase()}</p>
                <p className="pequeno">Gastos das campanhas divididos pelas vagas disponíveis{conta ? `: ${reais(conta.gasto)} ÷ ${inteiro(conta.vagas)} ${conta.vagas === 1 ? "vaga" : "vagas"}` : ""}.</p>
              </>
            )}
            {custoUf !== null && <p className="pequeno">{mun ? NOME_UF[uf!] : "Seis estados"}{comPorte}: <b>{reais(custoUf)}</b> <span className="muted-noite">(gasto total ÷ total de vagas)</span></p>}
            {!mun && porteFiltro && gastoEm(uf) && <p className="pequeno muted-noite">Soma de {inteiro(gastoEm(uf)!.n)} {gastoEm(uf)!.n === 1 ? "cidade" : "cidades"} deste porte.</p>}
            <p className="painel-links">
              {temCandidatos && <a href="#candidatos">Ver candidatos ↓</a>}
              <a href="#comparar">{uf ? `Comparar com ${mun ? nomeUf : "os outros estados"}` : "Quem teve mais dinheiro se elegeu mais?"} ↓</a>
            </p>
          </div>
        </div>
      </section>

      {/* 3. Candidatos do lugar escolhido: resultado, gasto e dinheiro público na mesma linha */}
      {temCandidatos && (
        <section id="candidatos" className="card area-candidatos" aria-labelledby="h-cand">
          <h2 id="h-cand">{mun ? `Candidatos a ${cargo.toLowerCase()} em ${lugar}` : `Eleitos: ${cargo.toLowerCase()} em ${nomeUf}`}</h2>
          {mun ? (
            <>
              {cargo === "Prefeito" && maisGastou && <p className="frase-comp"><b>{maisGastou.nome_urna}</b> teve o maior gasto declarado e {maisGastou.eleito ? "foi eleito" : "não foi eleito"}.</p>}
              <h3>Eleitos <span className="muted">({inteiro(eleitosLista.length)})</span></h3>
              <LinhasCandidatos linhas={eleitosLista.slice(0, INICIO_LISTA)} ano={ano}
                vazio={candidatos === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum eleito registrado."} />
              {eleitosLista.length > INICIO_LISTA && (
                <details className="ver-todos"><summary>Ver todos os {inteiro(eleitosLista.length)} eleitos</summary>
                  <LinhasCandidatos linhas={eleitosLista.slice(INICIO_LISTA)} ano={ano} vazio="" />
                </details>
              )}
              {naoEleitos.length > 0 && (
                <>
                  <h3>Não eleitos <span className="muted">({inteiro(naoEleitos.length)})</span></h3>
                  <LinhasCandidatos linhas={naoEleitos.slice(0, INICIO_LISTA)} ano={ano} vazio="" />
                  {naoEleitos.length > INICIO_LISTA && (
                    <details className="ver-todos"><summary>Ver {naoEleitos.length > MAX_LISTA ? `os ${MAX_LISTA} mais votados` : `todos os ${inteiro(naoEleitos.length)} não eleitos`}</summary>
                      <LinhasCandidatos linhas={naoEleitos.slice(INICIO_LISTA, MAX_LISTA)} ano={ano} vazio="" />
                    </details>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <LinhasCandidatos linhas={linhas} ano={ano} vazio={eleitosUf === null ? "Não foi possível carregar os eleitos agora." : "Nenhum eleito registrado."} />
              <p className="escala">Por estado, só os eleitos estão disponíveis.</p>
            </>
          )}
          <p className="escala">Gasto e dinheiro recebido de cada candidato; o gasto por vaga, no painel, é de todas as campanhas juntas.</p>
        </section>
      )}


      {/* 2. Perguntas 2 e 8 juntas: o mesmo gráfico, medindo por todo o dinheiro ou só pelo público.
          Com uma cidade escolhida, é a comparação do estado inteiro: fica recolhida, para não misturar com a cidade. */}
      <section id="comparar" className="card area-comparacao" aria-labelledby="h-comp">
        <details open={!mun}>
        <summary><h2 id="h-comp">{mun ? `Comparar com ${nomeUf}` : uf ? `Dinheiro e resultado em ${nomeUf}` : "Dinheiro e resultado nos seis estados"}</h2></summary>
        <p className="comparacao-sub">Dados de {uf ? nomeUf : "seis estados"} · {cargo.toLowerCase()} · {ano}: todos os candidatos{uf ? " do estado" : ""}, de todas as cidades.</p>
        <h3 id="resultado">Quem teve mais dinheiro se elegeu mais?</h3>
        <div className="chips" role="group" aria-label="Medir pelo">
          <Link href={href({ ver: null }, "comparar")} scroll={false} className={`chip${ver === "recursos" ? " on" : ""}`} aria-current={ver === "recursos" ? "true" : undefined}>Recursos considerados <small>P2</small></Link>
          <Link href={href({ ver: "publico" }, "comparar")} scroll={false} className={`chip${ver === "publico" ? " on" : ""}`} aria-current={ver === "publico" ? "true" : undefined}>Só o dinheiro público <small>P8</small></Link>
        </div>
        <p className="escala">{ver === "recursos" ? "Recursos considerados: o maior valor entre o que o candidato recebeu e o que gastou (considera também quem recebeu material de campanha)." : "Dinheiro público: o que veio do Fundo Eleitoral e do Fundo Partidário."}</p>

        {ver === "recursos" ? (majoritario ? (
          <>
            <p className="frase-comp">{maior.disputas ? <>Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)}</b> disputas comparáveis ({pct(maior.pct, 0)}).</> : "Sem disputas comparáveis."}
</p>
            {cargo === "Prefeito" && municipal && !mun && (
              <BarrasH compacto max={1} titulo={`Quem mais gastou para prefeito venceu, por porte da cidade, ${ano}`}
                linhas={porPorte.filter((p) => p.n > 0).map((p) => ({ chave: p.chave, rotulo: p.rotulo.replace(" eleitores", ""), valor: p.parte, classe: porte?.chave === p.chave ? "pub" : "fx2", trilhoCheio: true, texto: pct(p.parte, 0), subtexto: `${inteiro(p.venceu)} de ${inteiro(p.n)} cidades` }))} />
            )}
            <p className="escala">{qualificacao(respostaMaior(maior))} Análise de {inteiro(cobertura.analisadas)} disputas{cobertura.excluidas > 0 && `; ${inteiro(cobertura.excluidas)} excluídas por ${cobertura.motivos.map((m) => `${m.motivo} (${inteiro(m.n)})`).join(", ")}`}.</p>
          </>
        ) : (
          <>
            {recUf.mais.candidaturas > 0 && recUf.menos.candidaturas > 0 && (
              <p className="frase-comp">Grupo com mais recursos: <b>{emCada100(recUf.mais.taxa)}% de eleitos</b>. Demais candidatos com recursos: <b>{emCada100(recUf.menos.taxa)}%</b> — diferença de {pp(recUf.mais.taxa, recUf.menos.taxa)}.</p>
            )}
            <BarrasGrupos titulo={`Taxa de eleição por recursos de campanha, ${cargo}, ${ano}`}
              grupos={[["nada", "Declarou zero", recUf.nada], ["menos", "Demais candidatos com recursos", recUf.menos], ["mais", "Grupo com mais recursos", recUf.mais]]} />
            <p className="escala">{qualificacao(respRec)}
</p>
          </>
        )) : (
          <>
            {pubUf.muito.candidaturas > 0 && (
              <p className="frase-comp">Grupo com maiores recebimentos: <b>{emCada100(pubUf.muito.taxa)}% de eleitos</b>. Comparado com {basePubNada ? "quem não recebeu dinheiro público" : "os demais que receberam (todos receberam algum)"}: <b>{emCada100(respPub.base.taxa)}%</b> — diferença de {pp(pubUf.muito.taxa, respPub.base.taxa)}.</p>
            )}
            <BarrasGrupos titulo={`Taxa de eleição por dinheiro público recebido, ${cargo}, ${ano}`}
              grupos={[["nada", "Não recebeu dinheiro público", pubUf.nada], ["menos", "Demais candidatos que receberam", pubUf.pouco], ["mais", "Grupo com maiores recebimentos", pubUf.muito]]} />
            <p className="escala">{qualificacao(respPub.curta)} Os partidos costumam mandar mais dinheiro para quem já tem mais chance.
</p>
            {publico !== null && (
              <div className="origem">
                <p>De onde veio o dinheiro {emLugar}: <b>R$ {Math.round(publico * 100)} de cada R$ 100</b> recebidos pelas campanhas a {cargo.toLowerCase()} vieram de fundos públicos (Fundo Eleitoral e Fundo Partidário).</p>
                <span className="mini-divisao" role="img" aria-label={`${Math.round(publico * 100)}% público, ${100 - Math.round(publico * 100)}% privado`}>
                  <i className="pub" style={{ width: `${Math.round(publico * 100)}%` }} /><i className="priv" style={{ width: `${100 - Math.round(publico * 100)}%` }} />
                </span>
              </div>
            )}
          </>
        )}
        <p className="escala">Cada candidato é comparado só com os concorrentes da mesma disputa; o grupo com mais é cerca de 1/4 dos que declararam algum valor. Mostra associação, não que o dinheiro fez ganhar.</p>

        {(medias.eleitos.candidaturas > 0 || medias.naoEleitos.candidaturas > 0) && (
          <>
            <h3>Quanto cada candidato recebeu, em média</h3>
            <BarrasH compacto titulo={`Média de dinheiro público e privado por candidato a ${cargo} ${uf ? `em ${nomeUf}` : "nos seis estados"}, ${ano}`}
              linhas={[["eleitos", "Eleitos", medias.eleitos], ["nao", "Não eleitos", medias.naoEleitos]].filter(([, , g]) => (g as { candidaturas: number }).candidaturas > 0).map(([k, t, g]) => {
                const m = g as { candidaturas: number; publico: number; privado: number };
                return { chave: k as string, rotulo: t as string, detalhe: `${inteiro(m.candidaturas)} candidatos`, valor: m.publico + m.privado, classe: "pub",
                  pedacos: [{ rotulo: `Público: ${reais(m.publico)}`, valor: m.publico, classe: "pub" }, { rotulo: `Privado: ${reais(m.privado)}`, valor: m.privado, classe: "priv" }],
                  texto: reais(m.publico + m.privado), subtexto: `${reais(m.publico)} público\n${reais(m.privado)} privado` };
              })} />
            <div className="legend"><span><i className="pub" />Público (fundos eleitoral e partidário)</span><span><i className="priv" />Privado (doações e recursos próprios)</span></div>
            <p className="escala">Soma do que os candidatos do grupo receberam ÷ número de candidatos, inclusive os que não receberam nada.</p>
          </>
        )}
        </details>
      </section>


      <details className="card analise-metodo">
        <summary>Como calculamos</summary>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Gasto por vaga: soma dos gastos declarados por todas as campanhas ao cargo, inclusive as derrotadas, ÷ número de vagas. Não é salário nem o custo do mandato. Cidades de porte semelhante: a mediana das cidades com eleitorado parecido; estado: soma de todos os gastos ÷ soma de todas as vagas.</li>
          <li>Todo o dinheiro de campanha (P2): o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material. Só o dinheiro público (P8): o que veio do Fundo Eleitoral e do Fundo Partidário, inclusive por meio de outro candidato.</li>
          <li>Prefeito, governador e senador: se quem teve o maior gasto declarado venceu. Ficam de fora disputas com um só candidato, prestação de contas incompleta, sem gasto ou com empate no maior gasto.</li>
          <li>Teste estatístico: comparação de duas proporções com 95% de confiança; o projeto só destaca diferenças de pelo menos 20% (regra do projeto). Sem diferença estatística não quer dizer sem relação; com diferença, não quer dizer causa.</li>
          <li>Fonte: TSE (prestação de contas final ou regularização). Só titulares, eleições ordinárias e quem disputou; dinheiro de 2018 em diante. Quem não entregou a prestação final aparece como “Não informado”. Valores sem correção pela inflação: compare eleições do mesmo tipo (vereador 2020 × 2024; deputado 2018 × 2022).</li>
          <li>Análises completas: <Link href="/analises/custo-cadeira">pergunta 1</Link>, <Link href="/analises/gastos">pergunta 2</Link> e <Link href="/analises/financiamento">pergunta 8</Link>.</li>
        </ul>
      </details>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import {
  cargosDoAno, classeComPorte, contaGasto, contaGastoEstado, corCidade, corPorFaixas, ehMajoritario, ehMunicipal, emCada100, legendaCidade,
  legendaPorFaixas, lerRecorte, mediaPorCandidato, mediasPorResultado, ordenarLinhas, qualificacao, textoValor, tresGrupos, valorCidade, valorDoEstado, valorDoPorte,
} from "@/lib/dinheiro";
import { compararGrupos } from "@/lib/estatistica";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import { inteiro, reais } from "@/lib/format";
import { coberturaDisputas, daMedida, maiorGastador, respostaMaior, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto } from "@/lib/gastos";
import { TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AvisoApi } from "@/components/AvisoApi";
import { GradeCem } from "@/components/GradeCem";
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
  // comparar os estados: gasto por vaga (do maior para o menor) e média recebida por candidato
  const estadosGasto = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, valor: valorEstadoGasto(u), conta: porteFiltro ? gastoEm(u)!.conta : contaGastoEstado(estados, ano, u, cargo) }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const estadosMedia = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, m: mediaPorCandidato(fontes, ano, cargo, u) })).filter((e) => e.m.candidaturas > 0)
    .sort((a, b) => b.m.publico + b.m.privado - (a.m.publico + a.m.privado));
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
              <a href="#estados">Comparar os estados ↓</a>
              <a href="#comparar">Quem teve mais dinheiro se elegeu mais? ↓</a>
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


      {/* Comparar os estados: o gasto por vaga e quanto cada candidato recebeu, em média, lado a lado */}
      <section id="estados" className="card area-estados" aria-labelledby="h-est">
        <h2 id="h-est">Comparar os estados</h2>
        <p className="comparacao-sub">{cargo} · {ano}{porteFiltro ? ` · só cidades de ${porteFiltro.rotulo} no gasto por vaga` : ""}. Clique num estado para vê-lo no mapa.</p>
        <div className="comparacao-duas">
          <div>
            <h3>Gasto por vaga</h3>
            <BarrasH compacto titulo={`Gasto por vaga de ${cargo} em cada estado, ${ano}`}
              linhas={estadosGasto.map((e) => ({ chave: e.uf, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.uf ? "pub" : "fx2",
                texto: e.valor === null ? "Não informado" : reais(e.valor), subtexto: e.conta ? `${reais(e.conta.gasto)} ÷ ${inteiro(e.conta.vagas)} vagas` : "",
                href: href({ uf: e.uf }, "mapa"), atual: uf === e.uf }))} />
          </div>
          <div>
            <h3>Quanto cada candidato recebeu, em média</h3>
            <BarrasH compacto titulo={`Média de dinheiro público e privado recebido por candidato a ${cargo} em cada estado, ${ano}`}
              linhas={estadosMedia.map((e) => ({ chave: e.uf, rotulo: e.nome, detalhe: `${inteiro(e.m.candidaturas)} candidatos`, valor: e.m.publico + e.m.privado, classe: "pub",
                pedacos: [{ rotulo: `Público: ${reais(e.m.publico)}`, valor: e.m.publico, classe: "pub" }, { rotulo: `Privado: ${reais(e.m.privado)}`, valor: e.m.privado, classe: "priv" }],
                texto: reais(e.m.publico + e.m.privado), subtexto: `${reais(e.m.publico)} público\n${reais(e.m.privado)} privado`, href: href({ uf: e.uf }, "mapa"), atual: uf === e.uf }))} />
            <div className="legend"><span><i className="pub" />Público (fundos eleitoral e partidário)</span><span><i className="priv" />Privado (doações e recursos próprios)</span></div>
          </div>
        </div>
        <p className="escala">Gasto por vaga = gasto de todas as campanhas ÷ vagas. Média = tudo o que os candidatos receberam ÷ número de candidatos, eleitos ou não. Valores sem correção pela inflação.</p>
      </section>

      {/* Quem teve mais dinheiro se elegeu mais? Grades de 100: "de cada 100 candidatos do grupo, tantos se elegeram".
          Com uma cidade escolhida, são dados do estado inteiro: o bloco fica recolhido. */}
      <section id="comparar" className="card area-comparacao" aria-labelledby="h-comp">
        <details open={!mun}>
        <summary><h2 id="h-comp">Quem teve mais dinheiro se elegeu mais?</h2></summary>
        <p className="comparacao-sub">{uf ? nomeUf : "Seis estados"} · {cargo.toLowerCase()} · {ano} · todos os candidatos{uf ? " do estado" : ""}{mun ? ` (não só de ${lugar})` : ""}. Cada candidato é comparado com os concorrentes da mesma disputa.</p>
        <div className="chips" role="group" aria-label="Medir pelo">
          <Link href={href({ ver: null }, "comparar")} scroll={false} className={`chip${ver === "recursos" ? " on" : ""}`} aria-current={ver === "recursos" ? "true" : undefined}>Todo o dinheiro</Link>
          <Link href={href({ ver: "publico" }, "comparar")} scroll={false} className={`chip${ver === "publico" ? " on" : ""}`} aria-current={ver === "publico" ? "true" : undefined}>Só o dinheiro público</Link>
        </div>
        <p className="escala">{ver === "recursos" ? "Todo o dinheiro: o maior valor entre o que o candidato recebeu e o que gastou (considera também quem ganhou material de campanha)." : "Dinheiro público: o que veio do Fundo Eleitoral e do Fundo Partidário."}</p>

        {ver === "recursos" && majoritario ? (
          maior.disputas === 0 ? <p className="muted">Sem disputas comparáveis.</p> : (
            <>
              <p className="frase-comp">Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)}</b> {cargo === "Prefeito" ? "cidades" : "disputas"}: <b>{emCada100(maior.pct)} em cada 100</b>. Se o vencedor fosse escolhido ao acaso, seriam cerca de {emCada100(maior.pctSorteio)}.</p>
              <div className="grades">
                <figure><GradeCem parte={maior.pct} titulo="Quem mais gastou venceu" destaque /><figcaption><b>{emCada100(maior.pct)} em cada 100</b> {cargo === "Prefeito" ? "cidades" : "disputas"}: quem mais gastou venceu</figcaption></figure>
                <figure><GradeCem parte={maior.pctSorteio} titulo="Por acaso" /><figcaption><b>{emCada100(maior.pctSorteio)} em cada 100</b>: o esperado se fosse por acaso</figcaption></figure>
              </div>
              {cargo === "Prefeito" && municipal && !mun && (
                <details className="mais-dentro"><summary>Por porte da cidade</summary>
                  <BarrasH compacto max={1} titulo={`Quem mais gastou para prefeito venceu, por porte da cidade, ${ano}`}
                    linhas={porPorte.filter((pp) => pp.n > 0).map((pp) => ({ chave: pp.chave, rotulo: pp.rotulo.replace(" eleitores", ""), valor: pp.parte, classe: "pub", trilhoCheio: true, texto: `${emCada100(pp.parte)} em cada 100`, subtexto: `${inteiro(pp.venceu)} de ${inteiro(pp.n)} cidades` }))} />
                </details>
              )}
              <p className="escala">{qualificacao(respostaMaior(maior))} {cobertura.excluidas > 0 && `Ficaram de fora ${inteiro(cobertura.excluidas)} disputas (${cobertura.motivos.map((m) => `${m.motivo}: ${inteiro(m.n)}`).join("; ")}).`}</p>
            </>
          )
        ) : (() => {
          const g = ver === "recursos"
            ? { mais: recUf.mais, menos: recUf.menos, nada: recUf.nada, rotulos: ["Mais dinheiro", "Menos dinheiro", "Nenhum dinheiro declarado"], resp: respRec }
            : { mais: pubUf.muito, menos: pubUf.pouco, nada: pubUf.nada, rotulos: ["Mais dinheiro público", "Menos dinheiro público", "Nenhum dinheiro público"], resp: respPub.curta };
          const detalhes = ["os 25% com mais em cada disputa", "os demais que tiveram algum", ver === "recursos" ? "declararam zero" : "não receberam"];
          return g.mais.candidaturas === 0 ? <p className="muted">Sem dados para este recorte.</p> : (
            <>
              <p className="frase-comp">De cada 100 candidatos com {ver === "recursos" ? "mais dinheiro" : "mais dinheiro público"}, <b>{emCada100(g.mais.taxa)} se elegeram</b>. Entre os que tiveram menos, {emCada100(g.menos.taxa)}{g.nada.candidaturas > 0 && <>; entre os que {ver === "recursos" ? "não declararam dinheiro" : "não receberam dinheiro público"}, {emCada100(g.nada.taxa)}</>}.</p>
              <div className="grades tres">
                {([[g.mais, 0, true], [g.menos, 1, false], [g.nada, 2, false]] as const).filter(([x]) => x.candidaturas > 0).map(([x, i, d]) => (
                  <figure key={i}>
                    <figcaption className="grade-titulo"><b>{g.rotulos[i]}</b><small>{detalhes[i]}</small></figcaption>
                    <GradeCem parte={x.taxa} titulo={`${g.rotulos[i]}: se elegeram`} destaque={d} />
                    <figcaption><b>{emCada100(x.taxa)} em cada 100</b> se elegeram<small>{inteiro(x.eleitos)} de {inteiro(x.candidaturas)} candidatos</small></figcaption>
                  </figure>
                ))}
              </div>
              <p className="escala">{qualificacao(g.resp)}{ver === "publico" && " Os partidos costumam mandar mais dinheiro para quem já tem mais chance."}</p>
              {ver === "publico" && publico !== null && <p className="escala">De onde veio o dinheiro {emLugar}: R$ {Math.round(publico * 100)} de cada R$ 100 recebidos pelas campanhas a {cargo.toLowerCase()} foram públicos.</p>}
            </>
          );
        })()}

        {(medias.eleitos.candidaturas > 0 || medias.naoEleitos.candidaturas > 0) && (
          <>
            <h3>Eleitos e não eleitos: quanto receberam, em média</h3>
            <BarrasH compacto titulo={`Média de dinheiro público e privado por candidato a ${cargo} ${uf ? `em ${nomeUf}` : "nos seis estados"}, ${ano}`}
              linhas={[["eleitos", "Eleitos", medias.eleitos], ["nao", "Não eleitos", medias.naoEleitos]].filter(([, , x]) => (x as { candidaturas: number }).candidaturas > 0).map(([k, t, x]) => {
                const m = x as { candidaturas: number; publico: number; privado: number };
                return { chave: k as string, rotulo: t as string, detalhe: `${inteiro(m.candidaturas)} candidatos`, valor: m.publico + m.privado, classe: "pub",
                  pedacos: [{ rotulo: `Público: ${reais(m.publico)}`, valor: m.publico, classe: "pub" }, { rotulo: `Privado: ${reais(m.privado)}`, valor: m.privado, classe: "priv" }],
                  texto: reais(m.publico + m.privado), subtexto: `${reais(m.publico)} público\n${reais(m.privado)} privado` };
              })} />
          </>
        )}
        <p className="escala">Mostra que dinheiro e vitória andam juntos, não que o dinheiro fez ganhar: quem já tem mais chance também arrecada mais.</p>
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

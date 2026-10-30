import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { nomeProprio } from "@/lib/abstencao";
import {
  cargosDoAno, contaGasto, contaGastoEstado, ehMajoritario, ehMunicipal, emCada100, hrefMapaDinheiro, lerRecorte, mediaPorCandidato, mediasPorResultado,
  qualificacao, tresGrupos, valorCidade, valorDoEstado, valorDoPorte,
} from "@/lib/dinheiro";
import { compararGrupos } from "@/lib/estatistica";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import { inteiro, reais } from "@/lib/format";
import { coberturaDisputas, daMedida, maiorGastador, respostaMaior, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto } from "@/lib/gastos";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AvisoApi } from "@/components/AvisoApi";
import { GradeCem } from "@/components/GradeCem";
import { BarrasH } from "@/components/BarrasH";
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
 * Dinheiro nas eleições, numa página: a pergunta 1 conduz (mapa e lista do gasto por vaga, estado → município); as
 * perguntas 2 e 8 respondem juntas, embaixo, no mesmo recorte ("quem teve mais dinheiro se elegeu mais?", medindo por
 * todo o dinheiro ou só pelo público); os candidatos aparecem quando há um lugar escolhido.
 */
export default async function Dinheiro({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const abaPropaganda = um(sp.aba) === ABA_PROPAGANDA;   // aba Propaganda (pergunta 9): src/components/PropagandaGeral.tsx
  const [dados, q2, q8] = await Promise.all([
    lerAnalise("municipios", ["municipios", "resumo", "estados"]),
    abaPropaganda ? Promise.resolve(null) : lerAnalise("q2", ["faixas", "maior_gasto"]),
    abaPropaganda ? Promise.resolve(null) : lerAnalise("q8", ["sucesso", "fontes"]),
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
  const prop = abaPropaganda ? recortePropaganda({ ...r, mun: mun && { nome: nomeProprio(mun.nome) } }, { cargo: um(sp.cargo), porte: um(sp.porte), nomeUf: (u) => NOME_UF[u] ?? u }) : null;
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
  // o prefeito eleito da cidade escolhida, para a frase do cartão do lugar (a lista de candidatos fica no mapa)
  const candidatos = mun && cargo === "Prefeito" ? await apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : null;
  const disputa = candidatos ? disputaPrefeito(candidatos) : null;
  const eleitoPrefeito = disputa?.candidatos.find((c) => c.eleito);
  const eleitoPrefeitoTexto = eleitoPrefeito ? `; o eleito, ${eleitoPrefeito.nome_urna} (${eleitoPrefeito.partido}), ${eleitoPrefeito.prestou === false ? "não entregou a prestação de contas final" : `gastou ${reais(eleitoPrefeito.gasto)}`}` : "";
  // média de dinheiro público e privado por candidato no estado (ou nos seis), eleitos × não eleitos
  const fontes = q8?.fontes ? comoObjetos<LinhaFontes>(q8.fontes) : [];
  const medias = mediasPorResultado(fontes, ano, cargo, uf);
  // comparar os estados: gasto por vaga (do maior para o menor) e média recebida por candidato
  const estadosGasto = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, valor: valorEstadoGasto(u), conta: porteFiltro ? gastoEm(u)!.conta : contaGastoEstado(estados, ano, u, cargo) }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const estadosMedia = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, m: mediaPorCandidato(fontes, ano, cargo, u) })).filter((e) => e.m.candidaturas > 0)
    .sort((a, b) => b.m.publico + b.m.privado - (a.m.publico + a.m.privado));

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
        <Link className="botao-mapa" href={hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.id_municipio })}>
          {mun ? "Ver no mapa e os candidatos" : uf ? (municipal ? "Ver as cidades no mapa" : "Ver no mapa e os eleitos") : "Ver no mapa"} ›
        </Link>
      </section>

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

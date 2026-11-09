import Link from "next/link";
import { lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import {
  contaGastoEstado, ehMajoritario, ehMunicipal, emCada100, mediaPorCandidato, mediasPorResultado, qualificacao, tresGrupos, valorCidade, valorDoEstado, valorDoPorte,
} from "@/lib/dinheiro";
import { compararGrupos } from "@/lib/estatistica";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import { inteiro, reais } from "@/lib/format";
import { coberturaDisputas, daMedida, maiorGastador, respostaMaior, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto } from "@/lib/gastos";
import { porteDe, PORTES, type LinhaEstado, type LinhaMunicipio, type LinhaResumo, type Porte } from "@/lib/territorio";
import { BarrasH } from "./BarrasH";
import { GradeCem } from "./GradeCem";

type Medir = "recursos" | "publico";

interface Props {
  ano: number;
  cargo: string;
  uf?: string;
  /** cidade escolhida: as comparações seguem sendo do estado, e o bloco de "quem teve mais dinheiro" vem recolhido */
  mun?: LinhaMunicipio;
  /** nome da cidade escolhida (já com a grafia do site) */
  nomeMun?: string;
  porte?: Porte;
  medir: Medir;
  /** endereços da página onde o componente está (mapa ou análise): a medida e cada estado */
  hrefMedir: (m: Medir) => string;
  hrefUf: (uf: string) => string;
  /** no painel escuro do mapa da página inicial (blocos "noite") ou em cartões claros (análise) */
  noite?: boolean;
  /** sem o gráfico do gasto por vaga (quem chama já o mostra), só a média recebida por candidato */
  semGasto?: boolean;
}

/**
 * As comparações da área de dinheiro, iguais no mapa da página inicial (camada Dinheiro) e em /analises/dinheiro:
 * "Comparar os estados" (gasto por vaga e média recebida por candidato, público e privado) e "Quem teve mais dinheiro
 * se elegeu mais?" (perguntas 2 e 8 juntas, medindo por todo o dinheiro ou só pelo público). Lê as análises
 * municipios, q2 e q8 (em cache); as contas são de src/lib/dinheiro.ts, gastos.ts e financiamento.ts.
 */
export async function ComparacoesDinheiro({ ano, cargo, uf, mun, nomeMun, porte, medir, hrefMedir, hrefUf, noite, semGasto }: Props) {
  const [dados, q2, q8] = await Promise.all([
    lerAnalise("municipios", ["resumo", "estados"]),
    lerAnalise("q2", ["faixas", "maior_gasto"]),
    lerAnalise("q8", ["sucesso", "fontes"]),
  ]);
  if (!dados?.resumo || !dados.estados) return null;
  const resumo = comoObjetos<LinhaResumo>(dados.resumo);
  const estados = comoObjetos<LinhaEstado>(dados.estados);
  const ufs = [...new Set(estados.map((e) => e.uf).filter((u) => NOME_UF[u]))].sort();
  const municipal = ehMunicipal(ano);
  const majoritario = ehMajoritario(cargo);
  const porteInfo = porte ? PORTES.find((p) => p.chave === porte) : undefined;
  const nomeUf = uf ? NOME_UF[uf] ?? uf : "seis estados";
  const lugar = mun ? nomeMun ?? "a cidade" : uf ? nomeUf : "Seis estados";
  const emLugar = mun || uf ? `em ${lugar}` : "nos seis estados";
  const f = { ano, cargo, uf };

  // comparar os estados: gasto por vaga (com o porte, só as cidades dele) e média recebida por candidato
  const gastoEm = (u: string) => (porte ? valorDoPorte(resumo, ano, u, porte, "gasto", cargo) : null);
  const estadosGasto = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, valor: porte ? gastoEm(u)!.valor : valorDoEstado(estados, ano, u, "gasto", cargo), conta: porte ? gastoEm(u)!.conta : contaGastoEstado(estados, ano, u, cargo) }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1));
  const fontes = q8?.fontes ? comoObjetos<LinhaFontes>(q8.fontes) : [];
  const estadosMedia = ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, m: mediaPorCandidato(fontes, ano, cargo, u) })).filter((e) => e.m.candidaturas > 0)
    .sort((a, b) => b.m.publico + b.m.privado - (a.m.publico + a.m.privado));

  // quem teve mais dinheiro se elegeu mais? (pergunta 2: todo o dinheiro; pergunta 8: só o público)
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
  const linhaMun = mun ? resumo.find((x) => x.ano === ano && x.id_municipio === mun.id_municipio) : undefined;
  const publico = mun ? valorCidade(linhaMun, "publico", cargo) : valorDoEstado(estados, ano, uf, "publico", cargo);
  const medias = mediasPorResultado(fontes, ano, cargo, uf);

  const classe = (claro: string) => (noite ? "bloco noite s12 dinheiro-comp" : `card ${claro}`);
  const Titulo = noite ? "h3" : "h2";

  return (
    <>
      <section id="estados" className={classe("area-estados")} aria-labelledby="h-est">
        <Titulo id="h-est">Comparar os estados</Titulo>
        <p className="comparacao-sub">{cargo} · {ano}{porteInfo ? ` · só cidades de ${porteInfo.rotulo} no gasto por vaga` : ""}. Clique num estado para vê-lo{noite ? " no mapa" : ""}.</p>
        <div className={semGasto ? undefined : "comparacao-duas"}>
          {!semGasto && <div className="dinheiro-barras">
            <h4>Gasto por vaga</h4>
            <BarrasH compacto titulo={`Gasto por vaga de ${cargo} em cada estado, ${ano}`}
              linhas={estadosGasto.map((e) => ({ chave: e.uf, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.uf ? "pub" : "fx2",
                texto: e.valor === null ? "Não informado" : reais(e.valor), subtexto: e.conta ? `${reais(e.conta.gasto)} ÷ ${inteiro(e.conta.vagas)} vagas` : "",
                href: hrefUf(e.uf), atual: uf === e.uf }))} />
          </div>}
          <div className="dinheiro-barras">
            <h4>Quanto cada candidato recebeu, em média</h4>
            <BarrasH compacto titulo={`Média de dinheiro público e privado recebido por candidato a ${cargo} em cada estado, ${ano}`}
              linhas={estadosMedia.map((e) => ({ chave: e.uf, rotulo: e.nome, detalhe: `${inteiro(e.m.candidaturas)} candidatos`, valor: e.m.publico + e.m.privado, classe: "pub",
                pedacos: [{ rotulo: `Público: ${reais(e.m.publico)}`, valor: e.m.publico, classe: "pub" }, { rotulo: `Privado: ${reais(e.m.privado)}`, valor: e.m.privado, classe: "priv" }],
                texto: reais(e.m.publico + e.m.privado), subtexto: `${reais(e.m.publico)} público\n${reais(e.m.privado)} privado`, href: hrefUf(e.uf), atual: uf === e.uf }))} />
            <div className="legend"><span><i className="pub" />Público (fundos eleitoral e partidário)</span><span><i className="priv" />Privado (doações e recursos próprios)</span></div>
          </div>
        </div>
        <p className="escala">Gasto por vaga = gasto de todas as campanhas ÷ vagas. Média = tudo o que os candidatos receberam ÷ número de candidatos, eleitos ou não. Valores sem correção pela inflação.</p>
      </section>

      {/* Grades de 100: "de cada 100 candidatos do grupo, tantos se elegeram". Com uma cidade escolhida, são dados do
          estado inteiro: o bloco vem recolhido. */}
      <section id="comparar" className={classe("area-comparacao")} aria-labelledby="h-comp">
        <details open={!mun} className="area-comparacao">
          <summary><Titulo id="h-comp">Quem teve mais dinheiro se elegeu mais?</Titulo></summary>
          <p className="comparacao-sub">{uf ? nomeUf : "Seis estados"} · {cargo.toLowerCase()} · {ano} · todos os candidatos{uf ? " do estado" : ""}{mun ? ` (não só de ${lugar})` : ""}. Cada candidato é comparado com os concorrentes da mesma disputa.</p>
          <div className="chips" role="group" aria-label="Medir pelo">
            <Link href={hrefMedir("recursos")} scroll={false} className={`chip${medir === "recursos" ? " on" : ""}`} aria-current={medir === "recursos" ? "true" : undefined}>Todo o dinheiro</Link>
            <Link href={hrefMedir("publico")} scroll={false} className={`chip${medir === "publico" ? " on" : ""}`} aria-current={medir === "publico" ? "true" : undefined}>Só o dinheiro público</Link>
          </div>
          <p className="escala">{medir === "recursos" ? "Todo o dinheiro: o maior valor entre o que o candidato recebeu e o que gastou (considera também quem ganhou material de campanha)." : "Dinheiro público: o que veio do Fundo Eleitoral e do Fundo Partidário."}</p>

          {medir === "recursos" && majoritario ? (
            maior.disputas === 0 ? <p className="muted">Sem disputas comparáveis.</p> : (
              <>
                <p className="frase-comp">Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)}</b> {cargo === "Prefeito" ? "cidades" : "disputas"}: <b>{emCada100(maior.pct)} em cada 100</b>. Se o vencedor fosse escolhido ao acaso, seriam cerca de {emCada100(maior.pctSorteio)}.</p>
                <div className="grades">
                  <figure><GradeCem parte={maior.pct} titulo="Quem mais gastou venceu" destaque /><figcaption><b>{emCada100(maior.pct)} em cada 100</b> {cargo === "Prefeito" ? "cidades" : "disputas"}: quem mais gastou venceu</figcaption></figure>
                  <figure><GradeCem parte={maior.pctSorteio} titulo="Por acaso" /><figcaption><b>{emCada100(maior.pctSorteio)} em cada 100</b>: o esperado se fosse por acaso</figcaption></figure>
                </div>
                {cargo === "Prefeito" && municipal && !mun && (
                  <details className="mais-dentro dinheiro-barras"><summary>Por porte da cidade</summary>
                    <BarrasH compacto max={1} titulo={`Quem mais gastou para prefeito venceu, por porte da cidade, ${ano}`}
                      linhas={porPorte.filter((pp) => pp.n > 0).map((pp) => ({ chave: pp.chave, rotulo: pp.rotulo.replace(" eleitores", ""), valor: pp.parte, classe: "pub", trilhoCheio: true, texto: `${emCada100(pp.parte)} em cada 100`, subtexto: `${inteiro(pp.venceu)} de ${inteiro(pp.n)} cidades` }))} />
                  </details>
                )}
                <p className="escala">{qualificacao(respostaMaior(maior))} {cobertura.excluidas > 0 && `Ficaram de fora ${inteiro(cobertura.excluidas)} disputas (${cobertura.motivos.map((m) => `${m.motivo}: ${inteiro(m.n)}`).join("; ")}).`}</p>
              </>
            )
          ) : (() => {
            const g = medir === "recursos"
              ? { mais: recUf.mais, menos: recUf.menos, nada: recUf.nada, rotulos: ["Mais dinheiro", "Menos dinheiro", "Nenhum dinheiro declarado"], resp: respRec }
              : { mais: pubUf.muito, menos: pubUf.pouco, nada: pubUf.nada, rotulos: ["Mais dinheiro público", "Menos dinheiro público", "Nenhum dinheiro público"], resp: respPub.curta };
            const detalhes = ["os 25% com mais em cada disputa", "os demais que tiveram algum", medir === "recursos" ? "declararam zero" : "não receberam"];
            return g.mais.candidaturas === 0 ? <p className="muted">Sem dados para este recorte.</p> : (
              <>
                <p className="frase-comp">De cada 100 candidatos com {medir === "recursos" ? "mais dinheiro" : "mais dinheiro público"}, <b>{emCada100(g.mais.taxa)} se elegeram</b>. Entre os que tiveram menos, {emCada100(g.menos.taxa)}{g.nada.candidaturas > 0 && <>; entre os que {medir === "recursos" ? "não declararam dinheiro" : "não receberam dinheiro público"}, {emCada100(g.nada.taxa)}</>}.</p>
                <div className="grades tres">
                  {([[g.mais, 0, true], [g.menos, 1, false], [g.nada, 2, false]] as const).filter(([x]) => x.candidaturas > 0).map(([x, i, d]) => (
                    <figure key={i}>
                      <figcaption className="grade-titulo"><b>{g.rotulos[i]}</b><small>{detalhes[i]}</small></figcaption>
                      <GradeCem parte={x.taxa} titulo={`${g.rotulos[i]}: se elegeram`} destaque={d} />
                      <figcaption><b>{emCada100(x.taxa)} em cada 100</b> se elegeram<small>{inteiro(x.eleitos)} de {inteiro(x.candidaturas)} candidatos</small></figcaption>
                    </figure>
                  ))}
                </div>
                <p className="escala">{qualificacao(g.resp)}{medir === "publico" && " Os partidos costumam mandar mais dinheiro para quem já tem mais chance."}</p>
                {medir === "publico" && publico !== null && <p className="escala">De onde veio o dinheiro {emLugar}: R$ {Math.round(publico * 100)} de cada R$ 100 recebidos pelas campanhas a {cargo.toLowerCase()} foram públicos.</p>}
              </>
            );
          })()}

          {(medias.eleitos.candidaturas > 0 || medias.naoEleitos.candidaturas > 0) && (
            <div className="dinheiro-barras">
              <h4>Eleitos e não eleitos: quanto receberam, em média</h4>
              <BarrasH compacto titulo={`Média de dinheiro público e privado por candidato a ${cargo} ${uf ? `em ${nomeUf}` : "nos seis estados"}, ${ano}`}
                linhas={([["eleitos", "Eleitos", medias.eleitos], ["nao", "Não eleitos", medias.naoEleitos]] as const).filter(([, , m]) => m.candidaturas > 0).map(([k, t, m]) => ({
                  chave: k, rotulo: t, detalhe: `${inteiro(m.candidaturas)} candidatos`, valor: m.publico + m.privado, classe: "pub",
                  pedacos: [{ rotulo: `Público: ${reais(m.publico)}`, valor: m.publico, classe: "pub" }, { rotulo: `Privado: ${reais(m.privado)}`, valor: m.privado, classe: "priv" }],
                  texto: reais(m.publico + m.privado), subtexto: `${reais(m.publico)} público\n${reais(m.privado)} privado`,
                }))} />
            </div>
          )}
          <p className="escala">Mostra que dinheiro e vitória andam juntos, não que o dinheiro fez ganhar: quem já tem mais chance também arrecada mais.</p>
        </details>
      </section>
    </>
  );
}

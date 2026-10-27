import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import {
  cargosDoAno, classeComPorte, contaGasto, contaGastoEstado, corCidade, corPorFaixas, ehMajoritario, ehMunicipal, emCada100, FAIXAS_PARTE_CIDADES,
  hrefDinheiro, legendaCidade, legendaPorFaixas, lerRecorte, maisRecebeuPublico, qualificacao, referenciaDoPorte, textoValor, tresGrupos, valorCidade,
  valorDoEstado, type Aba, type GrupoTaxa,
} from "@/lib/dinheiro";
import { compararGrupos, pontosPercentuais } from "@/lib/estatistica";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaSucesso } from "@/lib/financiamento";
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
/** Os três assuntos: escolhem o resumo em destaque, a explicação, a camada do mapa e a comparação. */
const ASSUNTOS: { chave: Aba; rotulo: string; numero: string }[] = [
  { chave: "gasto", rotulo: "Gastos por vaga", numero: "Pergunta 1" },
  { chave: "publico", rotulo: "Dinheiro público", numero: "Pergunta 8" },
  { chave: "resultado", rotulo: "Dinheiro e resultado", numero: "Perguntas 2 e 8" },
];
const grupoVazio: GrupoTaxa = { candidaturas: 0, eleitos: 0, taxa: 0 };
const grupoDe = (cand?: number | null, eleitos?: number | null): GrupoTaxa => (cand ? { candidaturas: cand, eleitos: eleitos ?? 0, taxa: (eleitos ?? 0) / cand } : grupoVazio);
const pp = (a: number, b: number) => { const d = Math.abs(pontosPercentuais(a, b)); return `${d} ${d === 1 ? "ponto percentual" : "pontos percentuais"}`; };

/** Barras de taxa de eleição em três grupos, com eleitos e candidaturas abaixo de cada uma (para conferir). */
function BarrasGrupos({ titulo, grupos }: { titulo: string; grupos: [string, string, GrupoTaxa][] }) {
  return (
    <BarrasH compacto max={1} titulo={titulo}
      linhas={grupos.map(([k, t, g]) => ({ chave: k, rotulo: t, valor: g.taxa, classe: k === "mais" ? "pub" : "fx2", trilhoCheio: true,
        texto: g.candidaturas ? `${emCada100(g.taxa)}% eleitos` : "—", subtexto: `${inteiro(g.eleitos)} eleitos de ${inteiro(g.candidaturas)}` }))} />
  );
}

export default async function Dinheiro({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [dados, q2, q8] = await Promise.all([
    lerAnalise("municipios", ["municipios", "resumo", "estados"]),
    lerAnalise("q2", ["faixas", "maior_gasto"]),
    lerAnalise("q8", ["sucesso"]),
  ]);
  if (!dados?.resumo || !dados.estados || !dados.municipios) {
    return (
      <>
        <header className="area-cab"><p className="rotulo">Dinheiro nas eleições</p><h1>Dinheiro nas eleições</h1></header>
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
  const { ano, cargo, aba: assunto, uf, mun } = r;
  const municipal = ehMunicipal(ano);
  const majoritario = ehMajoritario(cargo);
  const porteFiltro = municipal && PORTES.some((p) => p.chave === um(sp.porte)) ? um(sp.porte) : undefined;
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "nos seis estados";
  const emLugar = mun || uf ? `em ${lugar}` : lugar;
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;
  const porte = porteDe(linhaMun?.eleitorado);
  const href = (novo: Parameters<typeof hrefDinheiro>[1] = {}, ancora?: string) => {
    const h = hrefDinheiro(r, novo, ancora);
    return porteFiltro ? h.replace("?", `?porte=${porteFiltro}&`) : h;
  };
  const f = { ano, cargo, uf };
  const nomeUf = uf ? NOME_UF[uf] ?? uf : "Seis estados";

  // ---------- P2 e P8 no estado (ou nos seis), das análises q2 e q8 (com teste estatístico) ----------
  const faixasQ2 = q2?.faixas ? daMedida(comoObjetos<LinhaGastoFaixa>(q2.faixas), "recursos") : [];
  const maiores = q2?.maior_gasto ? daMedida(comoObjetos<LinhaMaiorGasto>(q2.maior_gasto), "gasto") : [];
  const sucesso = q8?.sucesso ? comoObjetos<LinhaSucesso>(q8.sucesso) : [];
  const recUf = tresGrupos(sucessoPorGasto(faixasQ2, f));    // P2 nos mesmos 3 grupos da P8
  const pubUf = sucessoTresGrupos(sucesso, f);                 // P8
  const respRec = recUf.mais.candidaturas && recUf.menos.candidaturas ? compararGrupos(recUf.mais, recUf.menos).resposta : null;
  const respPub = respostaSucesso(pubUf);
  const basePubNada = respPub.base === pubUf.nada;             // a P8 compara com quem não recebeu; se ninguém ficou sem, com os demais
  const maior = maiorGastador(maiores, f);
  const cobertura = coberturaDisputas(maior);
  const resultadoEm = (u: string | undefined): number | null => {
    if (majoritario) { const m = maiorGastador(maiores, { ano, cargo, uf: u }); return m.disputas ? m.pct : null; }
    const g = tresGrupos(sucessoPorGasto(faixasQ2, { ano, cargo, uf: u })).mais;
    return g.candidaturas ? g.taxa : null;
  };

  // ---------- candidatos do recorte ----------
  const [candidatos, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    !municipal && uf ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${ano}`) : Promise.resolve(null),
  ]);
  const disputa = cargo === "Prefeito" && candidatos ? disputaPrefeito(candidatos) : null;
  const linhas: LinhaCandidato[] = disputa ? disputa.candidatos : candidatos ?? (eleitosUf ?? []).filter((e) => e.cargo === cargo).map((e) => ({ ...e, eleito: true }));
  const naoEleitos = linhas.filter((c) => !c.eleito);
  const maisGastou = disputa?.candidatos.find((c) => c.maisGastou);
  const maisPublico = disputa ? maisRecebeuPublico(disputa.candidatos) : null;

  // ---------- os valores do lugar e as referências ----------
  const valorEm = (a: Aba): number | null => (mun ? valorCidade(linhaMun, a, cargo) : a === "resultado" ? resultadoEm(uf) : valorDoEstado(estados, ano, uf, a, cargo));
  const custo = valorEm("gasto"), publico = valorEm("publico");
  const conta = mun ? contaGasto(linhaMun, cargo) : contaGastoEstado(estados, ano, uf, cargo);
  // a cidade tem duas referências diferentes: a mediana das cidades de porte semelhante e o estado (somas)
  const refCusto = mun && porte ? referenciaDoPorte(resumo, ano, porte.chave, "gasto", cargo) : null;
  const refPublico = mun && porte ? referenciaDoPorte(resumo, ano, porte.chave, "publico", cargo) : null;
  const custoRef = mun ? valorDoEstado(estados, ano, uf, "gasto", cargo) : uf ? valorDoEstado(estados, ano, undefined, "gasto", cargo) : null;
  const publicoRef = mun ? valorDoEstado(estados, ano, uf, "publico", cargo) : uf ? valorDoEstado(estados, ano, undefined, "publico", cargo) : null;
  const nomeRef = mun ? nomeUf : "Seis estados";
  const receitaLugar = mun && linhaMun ? (cargo === "Prefeito" ? { rec: linhaMun.prefeito_receita, pub: linhaMun.prefeito_publica } : { rec: linhaMun.vereador_receita, pub: linhaMun.vereador_publica })
    : (() => { const sel = estados.filter((e) => e.ano === ano && e.cargo === cargo && e.uf !== "BR" && (!uf || e.uf === uf)); return { rec: sel.reduce((a, e) => a + e.receita, 0), pub: sel.reduce((a, e) => a + e.receita_publica, 0) }; })();
  // "Dinheiro e resultado" na cidade: descritivo (os grupos da cidade); fora dela, das análises (com teste)
  const recCidade = { mais: grupoDe(linhaMun?.rec_mais_cand, linhaMun?.rec_mais_eleitos), demais: grupoDe(linhaMun?.rec_demais_cand, linhaMun?.rec_demais_eleitos) };
  const pubCidade = { mais: grupoDe(linhaMun?.pub_mais_cand, linhaMun?.pub_mais_eleitos), demais: grupoDe(linhaMun?.pub_demais_cand, linhaMun?.pub_demais_eleitos) };

  // ---------- mapa e lista: o assunto escolhido, no cargo escolhido ----------
  const valoresUf = ufs.map((u) => (assunto === "resultado" ? resultadoEm(u) : valorDoEstado(estados, ano, u, assunto, cargo)));
  const faixasUf = assunto === "resultado" && majoritario ? FAIXAS_PARTE_CIDADES : quantis(valoresUf.flatMap((v) => v ?? []), 5);
  const textoUf = (v: number | null) => textoValor(v, assunto, assunto === "resultado" ? "parte" : cargo);
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => ({
    uf: u, classe: corPorFaixas(valoresUf[i], faixasUf), href: href({ uf: u === uf ? null : u }, "mapa"), sigla: u,
    valor: valoresUf[i] === null ? "" : textoUf(valoresUf[i]).replace("R$ ", ""), descricao: `${NOME_UF[u] ?? u}: ${textoUf(valoresUf[i])} (${cargo.toLowerCase()}, ${ano})`,
  }));
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !municipal || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const linha = doAno.get(m.id_municipio);
    const v = valorCidade(linha, assunto, cargo);
    return { ibge: m.cod_ibge, classe: classeComPorte(corCidade(v, assunto, cargo), porteDe(linha?.eleitorado)?.chave, porteFiltro),
      href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }, "mapa"),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, assunto, cargo)}`, atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100 };
  });
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  // legenda sempre com os limites escritos: nas cidades, faixas fixas; nos estados, as faixas dos seis
  const legenda = uf && municipal ? legendaCidade(assunto, cargo) : legendaPorFaixas(faixasUf, (v) => textoUf(v).replace(/^R\$ /, "R$ "));
  const tituloAssunto = assunto === "gasto" ? `Gasto por vaga de ${cargo.toLowerCase()}` : assunto === "publico" ? "Quanto das receitas veio de fundos públicos?"
    : majoritario ? `Quem mais gastou para ${cargo.toLowerCase()} venceu?` : `Eleitos entre os candidatos a ${cargo.toLowerCase()} com mais recursos`;
  const rotuloValor = (a: Aba) => (a === "gasto" ? "Gasto por vaga" : a === "publico" ? "Parte pública das receitas"
    : majoritario ? (mun ? "Quem mais gastou foi eleito?" : "Quem mais gastou venceu em") : "Eleitos no grupo com mais recursos");
  const valorPainel = (a: Aba) => (a === "resultado" && mun && majoritario ? (maisGastou ? (maisGastou.eleito ? "Sim" : "Não") : "Não comparável")
    : a === "resultado" && !mun ? textoValor(valorEm(a), a, "parte") : textoValor(valorEm(a), a, cargo));

  // P2 de prefeito por porte (a cidade escolhida destaca o porte dela)
  const porPorte = PORTES.map((p) => {
    const sel = resumo.filter((x) => x.ano === ano && (!uf || x.uf === uf) && porteDe(x.eleitorado)?.chave === p.chave && x.maior_venceu != null);
    const venceu = sel.filter((x) => x.maior_venceu).length;
    return { ...p, n: sel.length, venceu, parte: sel.length ? venceu / sel.length : 0 };
  });

  return (
    <>
      <header className="area-cab">
        <p className="rotulo">Perguntas 1, 2 e 8 · 2018 a 2024 · AP, ES, MG, PE, RJ e RR</p>
        <h1>Dinheiro nas eleições</h1>
      </header>

      <FiltrosDinheiro
        anos={anos.map((a) => [String(a), `${a} · ${ehMunicipal(a) ? "municipal" : "geral"}`])}
        cargos={cargosDoAno(ano)} ufs={ufs.map((u) => [u, NOME_UF[u] ?? u])}
        // com um estado escolhido, só as cidades dele; sem estado, todas, agrupadas por estado
        cidades={municipal ? ufs.filter((u) => !uf || u === uf).map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, opcoes: municipios.filter((m) => m.uf === u).map((m) => [String(m.id_municipio), nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")) })) : null}
        atual={{ ano: String(ano), cargo, uf: uf ?? "", mun: mun ? String(mun.id_municipio) : "" }}
        fixos={{ ...(assunto !== "gasto" ? { aba: assunto } : {}), ...(r.vista === "lista" ? { vista: "lista" } : {}) }}
      />
      {(r.cargoTrocado || r.munIgnorado) && (
        <p className="aviso-linha">
          {r.cargoTrocado && `${r.cargoTrocado} não é eleito em ${ano}: mostrando ${cargo.toLowerCase()}. `}
          {r.munIgnorado && `Nas eleições gerais não há dados por município: mostrando ${lugar}.`}
        </p>
      )}

      {/* 1. Resumo curto: os três indicadores; cada um escolhe o assunto */}
      <section className="resumo-recorte" aria-labelledby="h-resumo">
        <h2 id="h-resumo" className="resumo-titulo">Entenda o dinheiro das campanhas {emLugar}</h2>
        <p className="rotulo">{cargo} · Eleição de {ano}{porte ? ` · cidade de ${porte.rotulo}` : ""}</p>
        <nav className="resumo-tres" aria-label="Escolha o assunto">
          <Link href={href({ aba: null }, "assunto")} scroll={false} className="resumo-item" aria-current={assunto === "gasto" ? "true" : undefined}>
            <span className="resumo-pergunta">Gastos por vaga</span>
            <span className="resumo-num">{custo === null ? "Não informado" : reais(custo)}</span>
            <span className="resumo-unidade">por vaga de {cargo.toLowerCase()}</span>
          </Link>
          <Link href={href({ aba: "publico" }, "assunto")} scroll={false} className="resumo-item" aria-current={assunto === "publico" ? "true" : undefined}>
            <span className="resumo-pergunta">Dinheiro público</span>
            <span className="resumo-num">{publico === null ? "Não informado" : `R$ ${Math.round(publico * 100)}`}</span>
            <span className="resumo-unidade">de cada R$ 100 recebidos pelas campanhas</span>
          </Link>
          <Link href={href({ aba: "resultado" }, "assunto")} scroll={false} className="resumo-item" aria-current={assunto === "resultado" ? "true" : undefined}>
            <span className="resumo-pergunta">Dinheiro e resultado</span>
            {majoritario ? (
              <>
                <span className="resumo-num">{mun ? (maisGastou ? (maisGastou.eleito ? "Eleito" : "Não eleito") : "Não comparável") : maior.disputas ? `${inteiro(maior.venceu)} de ${inteiro(maior.disputas)}` : "Não informado"}</span>
                <span className="resumo-unidade">{mun ? "quem teve o maior gasto declarado" : `${cargo === "Prefeito" ? "cidades" : "disputas"} em que quem mais gastou venceu`}</span>
              </>
            ) : (
              <>
                <span className="resumo-num">{(mun ? recCidade.mais : recUf.mais).candidaturas ? `${emCada100((mun ? recCidade.mais : recUf.mais).taxa)}% × ${emCada100((mun ? recCidade.demais : recUf.menos).taxa)}%` : "Não informado"}</span>
                <span className="resumo-unidade">eleitos: grupo com mais recursos × {mun ? "demais candidatos" : "demais com recursos"}</span>
              </>
            )}
          </Link>
        </nav>
      </section>

      {/* 2. O assunto escolhido: o número, o que ele significa e a explicação */}
      <section id="assunto" className="card assunto" aria-labelledby="h-assunto">
        <p className="rotulo">{ASSUNTOS.find((a) => a.chave === assunto)!.rotulo}</p>
        {assunto === "gasto" && (
          <>
            <h2 id="h-assunto" className="destaque">{custo === null ? "Gasto por vaga não informado" : <><b>{reais(custo)}</b> por vaga de {cargo.toLowerCase()}</>}</h2>
            <p>Gastos declarados das campanhas divididos pelas vagas disponíveis{emLugar === lugar ? "" : ` ${emLugar}`}, eleição de {ano}.</p>
            {conta && <p className="conta"><span><b>{reais(conta.gasto)}</b><small>gastos das campanhas</small></span><i aria-hidden="true">÷</i><span><b>{inteiro(conta.vagas)}</b><small>{conta.vagas === 1 ? "vaga" : "vagas"}</small></span></p>}
            <p className="escala">Inclui quem perdeu. Não representa salário nem custo do mandato.
              {cargo === "Prefeito" && mun && " Como há uma vaga, é o total gasto pelas campanhas da disputa, e não o gasto do prefeito eleito."}</p>
            <dl className="referencias">
              {refCusto?.valor != null && <div><dt>Valor central entre cidades de porte semelhante <small>(mediana de {inteiro(refCusto.n)} cidades de {porte?.rotulo})</small></dt><dd>{reais(refCusto.valor)}</dd></div>}
              {custoRef !== null && <div><dt>{nomeRef} <small>(gasto total {mun ? "no estado" : "nos seis estados"} ÷ total de vagas)</small></dt><dd>{reais(custoRef)}</dd></div>}
            </dl>
          </>
        )}
        {assunto === "publico" && (
          <>
            <h2 id="h-assunto">Quanto das receitas veio de fundos públicos?</h2>
            <p className="destaque">{publico === null ? "Não informado" : <><b>R$ {Math.round(publico * 100)}</b> de cada R$ 100 recebidos</>}</p>
            {publico !== null && receitaLugar.rec > 0 && (
              <BarrasH compacto titulo={`Receitas das campanhas a ${cargo} ${emLugar}, públicas e privadas`}
                linhas={[{ chave: "rec", rotulo: "Receitas", valor: receitaLugar.rec, classe: "pub",
                  pedacos: [{ rotulo: `Fundos públicos: ${reais(receitaLugar.pub)}`, valor: receitaLugar.pub, classe: "pub" }, { rotulo: `Privado: ${reais(receitaLugar.rec - receitaLugar.pub)}`, valor: receitaLugar.rec - receitaLugar.pub, classe: "priv" }],
                  texto: reais(receitaLugar.rec), subtexto: `${reais(receitaLugar.pub)} de fundos públicos` }]} />
            )}
            <p className="escala">Fundos públicos: Fundo Eleitoral e Fundo Partidário. Mostra a origem do dinheiro; se quem recebeu mais se elegeu mais está em “Dinheiro e resultado”.</p>
            <dl className="referencias">
              {refPublico?.valor != null && <div><dt>Valor central entre cidades de porte semelhante <small>(mediana de {inteiro(refPublico.n)} cidades)</small></dt><dd>R$ {Math.round(refPublico.valor * 100)}</dd></div>}
              {publicoRef !== null && <div><dt>{nomeRef} <small>(somando todas as campanhas)</small></dt><dd>R$ {Math.round(publicoRef * 100)}</dd></div>}
            </dl>
          </>
        )}
        {assunto === "resultado" && (
          <>
            <h2 id="h-assunto">{majoritario ? `Quem mais gastou para ${cargo.toLowerCase()} venceu?` : "Quem teve mais recursos se elegeu mais?"}</h2>
            {majoritario ? (
              mun ? (
                <>
                  <p className="destaque">{maisGastou ? <><b>{maisGastou.nome_urna}</b> teve o maior gasto declarado e <b>{maisGastou.eleito ? "foi eleito" : "não foi eleito"}</b>.</> : "Não dá para comparar nesta disputa (candidato único, empate no maior gasto ou prestação de contas incompleta)."}</p>
                  {maisPublico && <p>{maisPublico.nome_urna} recebeu mais dinheiro público e {maisPublico.eleito ? "foi eleito" : "não foi eleito"}.</p>}
                </>
              ) : <p className="destaque">{maior.disputas ? <>Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)}</b> disputas comparáveis ({pct(maior.pct, 0)}).</> : "Sem disputas comparáveis."}</p>
            ) : mun ? (
              <dl className="referencias grandes">
                <div><dt>Grupo com mais recursos <small>({inteiro(recCidade.mais.candidaturas)} candidatos)</small></dt><dd>{recCidade.mais.candidaturas ? `${emCada100(recCidade.mais.taxa)}% de eleitos` : "—"}</dd></div>
                <div><dt>Demais candidatos <small>({inteiro(recCidade.demais.candidaturas)})</small></dt><dd>{recCidade.demais.candidaturas ? `${emCada100(recCidade.demais.taxa)}%` : "—"}</dd></div>
              </dl>
            ) : (
              <dl className="referencias grandes">
                <div><dt>Grupo com mais recursos</dt><dd>{recUf.mais.candidaturas ? `${emCada100(recUf.mais.taxa)}% de eleitos` : "—"}</dd></div>
                <div><dt>Demais candidatos com recursos</dt><dd>{recUf.menos.candidaturas ? `${emCada100(recUf.menos.taxa)}%` : "—"}</dd></div>
              </dl>
            )}
            <p className="escala">Descreve o que aconteceu; não mostra que o dinheiro determinou o resultado: quem já tem mais chance também arrecada mais.{mun && !majoritario && ` Em ${lugar}, os grupos são pequenos: é uma descrição da eleição local.`}</p>
          </>
        )}
        <details className="mais-dentro">
          <summary>Entenda este número</summary>
          {assunto === "gasto" && <p>Gasto por vaga = soma dos gastos declarados por todas as campanhas ao cargo, inclusive as derrotadas, ÷ número de vagas. Na cidade, a referência de porte é a mediana (o valor do meio) das cidades com eleitorado parecido; a do estado é a soma de todos os gastos ÷ a soma de todas as vagas. São contas diferentes.</p>}
          {assunto === "publico" && <p>Parte pública = receitas vindas do Fundo Eleitoral e do Fundo Partidário ÷ todas as receitas das campanhas ao cargo. Se as campanhas não declararam receita, a proporção fica “Não informado” (não é 0%).</p>}
          {assunto === "resultado" && <p>{majoritario ? "Em cada disputa, verificamos se o candidato com o maior gasto declarado foi o eleito. Disputas com um só candidato, empate no maior gasto ou prestação de contas incompleta ficam de fora." : "Recursos de campanha considerados: o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material. Em cada disputa, o grupo com mais recursos é cerca de 1/4 dos que declararam algum valor, os de maior valor; “declarou zero” fica separado."}</p>}
        </details>
      </section>

      {/* 3. O mapa e a lista: o mesmo assunto, no mesmo recorte */}
      <section id="mapa" className="quadro observatorio area-mapa" aria-labelledby="h-mapa">
        <MapaVivo className="palco s8 palco-area" estado={uf}>
          <div className="palco-topo">
            <div>
              <nav className="camadas-mapa" aria-label="Assunto do mapa">
                {ASSUNTOS.map((a) => <a key={a.chave} href={href({ aba: a.chave === "gasto" ? null : a.chave }, "mapa")} data-mapa="" aria-current={a.chave === assunto ? "true" : undefined}>{a.rotulo}</a>)}
              </nav>
              <h2 id="h-mapa">{tituloAssunto}</h2>
              <p className="palco-sobre">{municipal ? `Eleição municipal de ${ano}` : `Eleição geral de ${ano}: por estado`}</p>
            </div>
            <nav className="trilha" aria-label="Onde você está">
              <a href={href({ uf: null }, "mapa")} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
              {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null }, "mapa")} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
              {mun && <><span aria-hidden="true">/</span><span aria-current="true">{lugar}</span></>}
            </nav>
          </div>
          {r.vista === "lista" ? (
            <div className="palco-lista">
              {municipal && uf ? (
                <table>
                  <thead><tr><th>Cidade</th><th>Porte</th><th className="num">{rotuloValor(assunto)}</th><th>Prefeito eleito</th></tr></thead>
                  <tbody>
                    {municipios.filter((m) => m.uf === uf).sort((a, b) => nomeMun.get(a.id_municipio)!.localeCompare(nomeMun.get(b.id_municipio)!, "pt-BR")).map((m) => {
                      const linha = doAno.get(m.id_municipio);
                      return (
                        <tr key={m.id_municipio} aria-current={m.id_municipio === mun?.id_municipio ? "true" : undefined}>
                          <td><Link href={href({ mun: m.id_municipio }, "mapa")} scroll={false}>{nomeMun.get(m.id_municipio)}</Link></td>
                          <td>{porteDe(linha?.eleitorado)?.rotulo.replace(" eleitores", "") ?? "Não informado"}</td>
                          <td className="num">{textoValor(valorCidade(linha, assunto, cargo), assunto, cargo)}</td>
                          <td>{linha?.prefeito_nome ? `${linha.prefeito_nome} (${linha.prefeito_partido})` : "Não informado"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Estado</th><th className="num">{rotuloValor(assunto)}</th></tr></thead>
                  <tbody>{ufs.map((u, i) => <tr key={u}><td><Link href={href({ uf: u })} scroll={false}>{NOME_UF[u]}</Link></td><td className="num">{textoUf(valoresUf[i])}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="palco-mapa">
              <MapaAbstencao titulo={`${tituloAssunto}: ${lugar}, ${ano}`}
                camera={enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02)}
                estados={noMapaUf} uf={uf} municipios={noMapaMun}
                destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined} />
              {!uf && <p className="palco-dica" aria-hidden="true">Clique num estado{municipal ? " para ver as cidades" : ""} · os demais estão fora da base</p>}
            </div>
          )}
          <div className="palco-base">
            <ul className="legenda-q" aria-label="Cores do mapa">
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
            <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}</p>
            <h3>{mun || uf ? lugar : "Seis estados"}</h3>
            {porte && <p className="pequeno muted-noite">Cidade de {porte.rotulo}</p>}
            <dl className="painel-tres">
              {ASSUNTOS.map((a) => (
                <div key={a.chave} className={a.chave === assunto ? "ativo" : undefined}>
                  <dt>{rotuloValor(a.chave)}</dt>
                  <dd>{valorPainel(a.chave)}</dd>
                </div>
              ))}
            </dl>
            {municipal && uf && (
              <div className="portes" role="group" aria-label="Destacar cidades de um porte no mapa">
                <span className="palco-sobre">Comparar parecidas: destacar no mapa</span>
                <Link href={hrefDinheiro(r, {}, "mapa")} scroll={false} className={!porteFiltro ? "on" : undefined}>Todas</Link>
                {PORTES.map((p) => <Link key={p.chave} href={hrefDinheiro(r, {}, "mapa").replace("?", `?porte=${p.chave}&`)} scroll={false} className={porteFiltro === p.chave ? "on" : undefined}>{p.rotulo.replace(" eleitores", "")}</Link>)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Comparação do mesmo assunto, com o território escrito no título */}
      <section className="card area-comparacao" aria-labelledby="h-comp">
        {assunto === "gasto" ? (
          <>
            <h2 id="h-comp">{mun ? `Comparação: ${lugar}, cidades de porte semelhante e ${nomeUf}` : `Comparação entre os estados: gasto por vaga de ${cargo.toLowerCase()}`}</h2>
            <BarrasH compacto titulo={`Gasto por vaga de ${cargo}, ${ano}`}
              linhas={mun ? [
                { chave: "cidade", rotulo: lugar, valor: custo ?? 0, classe: "pub", texto: textoValor(custo, "gasto", cargo) },
                ...(refCusto?.valor != null ? [{ chave: "porte", rotulo: "Cidades de porte semelhante", detalhe: `valor central de ${inteiro(refCusto.n)} cidades`, valor: refCusto.valor, classe: "fx2", texto: reais(refCusto.valor) }] : []),
                ...(custoRef !== null ? [{ chave: "uf", rotulo: nomeUf, detalhe: "gasto total ÷ total de vagas", valor: custoRef, classe: "fx2", texto: reais(custoRef) }] : []),
              ] : ufs.map((u, i) => ({ chave: u, rotulo: NOME_UF[u] ?? u, valor: valoresUf[i] ?? 0, classe: !uf || uf === u ? "pub" : "fx2", texto: textoUf(valoresUf[i]), href: href({ uf: u }) }))} />
            <p className="escala">{mun ? "O gasto por vaga cresce muito com o tamanho da cidade: a comparação justa é com cidades de porte semelhante." : "Clique num estado para ver as cidades."} Valores sem correção pela inflação.</p>
          </>
        ) : (
          <>
            <h2 id="h-comp">Comparação em {uf ? nomeUf : "seis estados"}</h2>
            {mun && <p className="comparacao-sub">Os indicadores acima e a lista de candidatos mostram {lugar}; aqui, todos os candidatos a {cargo.toLowerCase()} de {nomeUf}, comparados dentro de cada disputa.</p>}
            {assunto === "publico" ? (
              <>
                <h3>Como variou a taxa de eleição conforme o dinheiro público recebido?</h3>
                {pubUf.muito.candidaturas > 0 && (
                  <p>Grupo com maiores recebimentos: <b>{emCada100(pubUf.muito.taxa)}% de eleitos</b>. Comparado com {basePubNada ? "quem não recebeu dinheiro público" : "os demais que receberam (todos receberam algum)"}: <b>{emCada100(respPub.base.taxa)}%</b> — diferença de {pp(pubUf.muito.taxa, respPub.base.taxa)}.</p>
                )}
                <BarrasGrupos titulo={`Taxa de eleição por dinheiro público recebido, ${cargo}, ${ano}`}
                  grupos={[["nada", "Não recebeu dinheiro público", pubUf.nada], ["menos", "Demais candidatos que receberam", pubUf.pouco], ["mais", "Grupo com maiores recebimentos", pubUf.muito]]} />
                <p className="escala">{qualificacao(respPub.curta)} Os partidos costumam mandar mais dinheiro para quem já tem mais chance.</p>
                {mun && cargo === "Vereador" && pubCidade.mais.candidaturas > 0 && <p className="escala">Só em {lugar} (descritivo): grupo com maiores recebimentos, {emCada100(pubCidade.mais.taxa)}% de eleitos ({inteiro(pubCidade.mais.eleitos)} de {inteiro(pubCidade.mais.candidaturas)}); demais, {emCada100(pubCidade.demais.taxa)}% ({inteiro(pubCidade.demais.eleitos)} de {inteiro(pubCidade.demais.candidaturas)}).</p>}
              </>
            ) : majoritario ? (
              <>
                <h3>Quem mais gastou venceu{cargo === "Prefeito" && municipal ? ", pelo porte da cidade" : ""}?</h3>
                <p>{maior.disputas ? <>Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)}</b> disputas comparáveis ({pct(maior.pct, 0)}).</> : "Sem disputas comparáveis."}</p>
                {cargo === "Prefeito" && municipal && (
                  <BarrasH compacto max={1} titulo={`Quem mais gastou para prefeito venceu, por porte da cidade, ${ano}`}
                    linhas={porPorte.filter((p) => p.n > 0).map((p) => ({ chave: p.chave, rotulo: p.rotulo.replace(" eleitores", ""), valor: p.parte, classe: porte?.chave === p.chave ? "pub" : "fx2", trilhoCheio: true, texto: pct(p.parte, 0), subtexto: `${inteiro(p.venceu)} de ${inteiro(p.n)} cidades` }))} />
                )}
                <p className="escala">{qualificacao(respostaMaior(maior))} Análise de {inteiro(cobertura.analisadas)} disputas{cobertura.excluidas > 0 && `; ${inteiro(cobertura.excluidas)} excluídas por ${cobertura.motivos.map((m) => `${m.motivo} (${inteiro(m.n)})`).join(", ")}`}.</p>
              </>
            ) : (
              <>
                <h3>Como variou a taxa de eleição conforme os recursos de campanha?</h3>
                {recUf.mais.candidaturas > 0 && recUf.menos.candidaturas > 0 && (
                  <p>Grupo com mais recursos: <b>{emCada100(recUf.mais.taxa)}% de eleitos</b>. Demais candidatos com recursos: <b>{emCada100(recUf.menos.taxa)}%</b> — diferença de {pp(recUf.mais.taxa, recUf.menos.taxa)}.</p>
                )}
                <BarrasGrupos titulo={`Taxa de eleição por recursos de campanha, ${cargo}, ${ano}`}
                  grupos={[["nada", "Declarou zero", recUf.nada], ["menos", "Demais candidatos com recursos", recUf.menos], ["mais", "Grupo com mais recursos", recUf.mais]]} />
                <p className="escala">{qualificacao(respRec)}</p>
                {mun && recCidade.mais.candidaturas > 0 && <p className="escala">Só em {lugar} (descritivo): grupo com mais recursos, {emCada100(recCidade.mais.taxa)}% de eleitos ({inteiro(recCidade.mais.eleitos)} de {inteiro(recCidade.mais.candidaturas)}); demais candidatos, {emCada100(recCidade.demais.taxa)}% ({inteiro(recCidade.demais.eleitos)} de {inteiro(recCidade.demais.candidaturas)}).</p>}
              </>
            )}
          </>
        )}
      </section>

      {/* 5. Candidatos: resultado, gasto e dinheiro público na mesma linha */}
      <section className="card area-candidatos" aria-labelledby="h-cand">
        <h2 id="h-cand">Candidatos{mun ? ` a ${cargo.toLowerCase()} em ${lugar}` : uf && !municipal ? ` eleitos: ${cargo.toLowerCase()} em ${nomeUf}` : ""}</h2>
        {mun ? (
          <>
            <LinhasCandidatos linhas={cargo === "Prefeito" ? linhas : linhas.filter((c) => c.eleito)} ano={ano}
              vazio={candidatos === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum candidato registrado."} />
            {cargo !== "Prefeito" && naoEleitos.length > 0 && (
              <details>
                <summary>Não eleitos ({inteiro(naoEleitos.length)}){naoEleitos.length > MAX_LISTA && `: os ${MAX_LISTA} mais votados`}</summary>
                <LinhasCandidatos linhas={naoEleitos.slice(0, MAX_LISTA)} ano={ano} vazio="" />
              </details>
            )}
          </>
        ) : !municipal && uf ? (
          <>
            <LinhasCandidatos linhas={linhas} ano={ano} vazio={eleitosUf === null ? "Não foi possível carregar os eleitos agora." : "Nenhum eleito registrado."} />
            <p className="escala">Por estado, só os eleitos estão disponíveis.</p>
          </>
        ) : <p className="muted">{municipal ? "Escolha um município (na lista acima ou no mapa) para ver os candidatos." : "Escolha um estado para ver os eleitos."}</p>}
      </section>

      <details className="card analise-metodo">
        <summary>Metodologia completa</summary>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Fonte: TSE (candidaturas, resultados e prestação de contas final ou regularização). Só titulares, eleições ordinárias e quem disputou. Dinheiro só existe de 2018 em diante.</li>
          <li>Dados ausentes: quem não entregou a prestação de contas final aparece como “Não informado”, não como R$ 0, e fica fora dos grupos. Receita zero torna a parte pública indefinida (“Não informado”).</li>
          <li>Porte da cidade: eleitores aptos no ano da eleição (TSE), em seis faixas. A referência de porte é a mediana das cidades da mesma faixa.</li>
          <li>Exclusões em “quem mais gastou venceu”: disputas com um só candidato, prestação de contas incompleta, sem gasto declarado ou empate no maior gasto (valor exato da base, antes de arredondar).</li>
          <li>Teste estatístico: comparação de duas proporções com 95% de confiança. O projeto só destaca uma diferença se, além disso, ela for de pelo menos 20% (regra do projeto). Ausência de diferença estatística não quer dizer que não haja relação; diferença estatística não mostra causa.</li>
          <li>Valores em reais da época, sem correção pela inflação.</li>
          <li>Análises completas de cada pergunta: <Link href="/analises/custo-cadeira">pergunta 1</Link>, <Link href="/analises/gastos">pergunta 2</Link> e <Link href="/analises/financiamento">pergunta 8</Link>.</li>
        </ul>
      </details>
    </>
  );
}

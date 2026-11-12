import { Fragment, type CSSProperties } from "react";
import Link from "next/link";
import { Rolar } from "@/components/Rolar";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "@/components/MapaAbstencao";
import { centrarLupa, TELA } from "@/lib/lupa";
import { MapaVivo } from "@/components/MapaVivo";
import { Dispersao } from "@/components/Dispersao";
import { EscolhaMunicipio } from "@/components/EscolhaMunicipio";
import { SubmenuMapa } from "@/components/SubmenuMapa";
import { CamadasMapa } from "@/components/CamadasMapa";
import { BuscaCandidatoMapa } from "@/components/BuscaCandidatoMapa";
import { Icone } from "@/components/Icone";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF } from "@/lib/financiamento";
import {
  CARGOS, anosDe as anosDaLegenda, cicloDoAno, compararCiclos, cortesTom, faixaEventos, filtrar, hrefLegenda, resolverSelecao, resumoCiclos, resumoSerie, serie as serieLegenda,
  sugestoes, type CargoCiclo, type EventoPartido, type LinhaLegenda, type Linhagem,
} from "@/lib/legenda";
import {
  anoNaLegenda, casasDosCortes, doCargo, escalaDoMaior, faixasFixas, medirLegenda, rankingPartidos, resumoCamadas, situacaoComparativo, type Visao,
} from "@/lib/mapa";
import {
  ANOS_CENSO, ANOS_POR_CENSO, INDICADORES_CENSO, anosDe, censoDoAno, indicadorNoCenso, indicadoresDoCenso, classe, compararComReferencia, composicaoEleitorado, corMunicipio, distribuicao, extremosAbstencao, reguaIndicador, correlacao, enquadrar, formatarIndicador, indicadoresPorMunicipio, lerCorrelacao,
  mediaPonderada, nomeProprio, quantis, rotulosFaixas, serieAbstencao, somarParticipacao, taxaDe, tendencia,
  type ChaveIndicador, type LinhaIndicador, type LinhaMunicipio, type LinhaParticipacao,
} from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { compacto, inteiro, pct } from "@/lib/format";
import { naRegua, type FichaDica } from "@/lib/dica";
import { VisaoCandidato } from "@/components/VisaoCandidato";
import { MiniMapa } from "@/components/MiniMapa";
import { CartaoDica } from "@/components/CartaoDica";
import { FaixaMunicipios } from "@/components/FaixaMunicipios";
import { ExtremosAbstencao } from "@/components/ExtremosAbstencao";
import { ComparaReferencia } from "@/components/ComparaReferencia";
import { IndicadoresCenso, type LinhaIndicadorCenso } from "@/components/IndicadoresCenso";
import { SerieLegenda } from "@/components/SerieLegenda";
import { ComparaCiclos } from "@/components/ComparaCiclos";
import { BarrasInstrucao } from "@/components/BarrasInstrucao";
import { EleitosInstrucao } from "@/components/EleitosInstrucao";
import { CREDITO_FOTOS } from "@/lib/foto-candidato";
import {
  ANOS_INSTRUCAO, MEDIDAS, MEDIDA_PADRAO, contarNaMedida, grauDoEleito, linhasNiveis, separarEleitos, type EleitoInstrucao, medidaDe, parteNaMedida, perfilEleitos, perfilPopulacao, porMunicipio, predominante, rotuloNivel,
  type LinhaEleitosInstrucao, type LinhaPopulacaoInstrucao, type LinhaPrefeito, type Municipio as MunicipioInstrucao,
} from "@/lib/instrucao";
import { abrangencia, candidaturasDe, noMapaEstatico, turnosDe, type CandidaturaMapa, type VotoMunicipio } from "@/lib/candidato-mapa";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ROTULO_CARGO: Record<CargoCiclo, string> = { ambos: "Os dois", federal: "Federal", estadual: "Estadual" };

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const pediuInstrucao = um(sp.ver) === "instrucao";
  const [q5, q4, dados] = await Promise.all([
    lerAnalise("q5", ["legenda", "eventos", "linhagem"]),
    pediuInstrucao ? lerAnalise("q4", ["eleitos", "prefeitos", "populacao"]) : Promise.resolve(null),   // só na sub-aba Instrução
    lerEstatico("mapa"),
  ]);
  const legenda = comoObjetos<LinhaLegenda>(q5?.legenda);
  const eventosLeg = comoObjetos<EventoPartido>(q5?.eventos);
  const linhagem = comoObjetos<Linhagem>(q5?.linhagem);
  const municipios = comoObjetos<LinhaMunicipio>(dados?.municipios);
  const participacao = comoObjetos<LinhaParticipacao>(dados?.participacao);
  const linhasInd = comoObjetos<LinhaIndicador>(dados?.indicadores);

  // filtros da URL, validados contra os dados: ano, estado, município, indicador e modo de cor
  const anos = anosDe(participacao);
  const anoPadrao = anos.includes(2012) ? 2012 : anos[anos.length - 1];
  const ano = anos.includes(Number(um(sp.ano))) ? Number(um(sp.ano)) : anoPadrao;
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === um(sp.uf));

  // visão do mapa: abstenção (padrão) ou voto de legenda, que só existe de 2018 em diante e só por estado
  const anosLeg = anosDaLegenda(legenda);
  const anoPedido = Number(um(sp.ano));
  const anoPadraoLeg = anoNaLegenda(anoPadrao, anosLeg);
  const anoLeg = anosLeg.includes(anoPedido) ? anoPedido : anoNaLegenda(anos.includes(anoPedido) ? anoPedido : anoPadrao, anosLeg);
  const pediuLegenda = um(sp.ver) === "legenda";
  const naCandidato = um(sp.ver) === "candidato";
  const ver: Visao = naCandidato ? "candidato" : pediuLegenda && anoLeg !== undefined ? "legenda"
    : pediuInstrucao && q4?.eleitos && q4.prefeitos && q4.populacao ? "instrucao" : "abstencao";
  const naLegenda = ver === "legenda";
  // Comparar › Instrução (pergunta 4): só as eleições municipais comparadas com o Censo 2022; sem ano na URL, a mais recente
  const naInstrucao = ver === "instrucao";
  const anoInst = ANOS_INSTRUCAO.includes(anoPedido) ? anoPedido : ANOS_INSTRUCAO[ANOS_INSTRUCAO.length - 1];
  const medida = medidaDe(um(sp.med));
  // a legenda pinta só os estados: sem zoom nem município
  const soEstados = naLegenda;
  const cargo = CARGOS.find((c) => c === um(sp.cargo)) ?? "ambos";
  // juntar: os votos dos partidos que se fundiram passam para o atual (DEM e PSL → UNIÃO), como na análise da pergunta 5
  const juntar = naLegenda && um(sp.juntar) === "1";
  const legendaVista = filtrar(legenda, { juntar, linhagem });
  const pedido = legenda.find((l) => l.partido === um(sp.p))?.partido;
  const partido = pedido && resolverSelecao([pedido], juntar, linhagem)[0];

  const mun = uf && !soEstados ? municipios.find((m) => m.uf === uf && String(m.id_municipio) === um(sp.mun)) : undefined;
  // cada eleição em volta de um Censo usa os indicadores dele (2008 a 2012: Censo 2010; 2020 a 2024: Censo 2022). O
  // indicador pedido fica na URL mesmo quando o Censo do ano não o tem (o IDHM em 2022): volta ao trocar de ano
  const censo = censoDoAno(ano);
  const comCenso = censo !== undefined;
  const censoUsado = censo ?? 2010;
  const indicadores = indicadoresPorMunicipio(linhasInd, censoUsado);
  const indPedido: ChaveIndicador = INDICADORES_CENSO.find((i) => i.chave === um(sp.ind))?.chave ?? "idhm";
  const ind = indicadorNoCenso(indPedido, censoUsado);
  const listaInd = indicadoresDoCenso(censoUsado);
  const infoInd = listaInd.find((i) => i.chave === ind)!;
  // a camada Comparativos ligada (cor=cruzar) fica na URL mesmo sem estado aberto; só pinta com um estado em zoom
  const pediuCruzar = um(sp.cor) === "cruzar";
  const cruzar = comCenso && !!uf && !naLegenda && pediuCruzar;

  type Estado = { ver?: Visao; ano?: number; uf?: string | null; mun?: number | null; ind?: string; cor?: string | null; p?: string | null; cargo?: CargoCiclo; juntar?: boolean; med?: string };
  const params = (nova: Estado) => {
    const n = {
      ver: ver === "candidato" ? "abstencao" : ver, ano: naLegenda ? anoLeg! : naInstrucao ? anoInst : ano, uf, mun: mun?.id_municipio, ind: indPedido,
      cor: pediuCruzar && ver === "abstencao" ? "cruzar" : null, p: partido, cargo, juntar, med: medida.chave, ...nova,
    };
    if (nova.uf !== undefined && nova.mun === undefined) n.mun = null;   // trocar de estado solta o município
    const leg = n.ver === "legenda", inst = n.ver === "instrucao";
    const p = new URLSearchParams();
    if (leg || inst) p.set("ver", n.ver);
    if (n.ano !== (leg ? anoPadraoLeg : inst ? ANOS_INSTRUCAO[ANOS_INSTRUCAO.length - 1] : anoPadrao)) p.set("ano", String(n.ano));
    if (n.uf) p.set("uf", n.uf);
    if (leg) {
      if (n.p) p.set("p", n.p);
      if (n.cargo !== "ambos") p.set("cargo", n.cargo);
      if (n.juntar) p.set("juntar", "1");
    } else if (inst) {
      if (n.uf && n.mun) p.set("mun", String(n.mun));
      if (n.med !== MEDIDA_PADRAO.chave) p.set("med", n.med);
    } else {
      if (n.uf && n.mun) p.set("mun", String(n.mun));
      if (n.ind !== "idhm") p.set("ind", n.ind);
      if (n.cor) p.set("cor", n.cor);
    }
    return p;
  };
  const href = (nova: Parameters<typeof params>[0]) => {
    const s = params(nova).toString();
    return `/${s ? `?${s}` : ""}#mapa`;
  };

  // abstenção do ano: cores em quintos (20% dos municípios dos seis estados em cada cor)
  const doAno = new Map(participacao.filter((l) => l.ano === ano).map((l) => [l.id_municipio, l]));
  const cortes = quantis([...doAno.values()].flatMap((l) => taxaDe(l) ?? []), 5);
  const idsDe = (u?: string) => municipios.filter((m) => !u || m.uf === u).map((m) => m.id_municipio);
  const totalDe = (ids: number[]) => somarParticipacao(ids.flatMap((id) => doAno.get(id) ?? []));
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  // a régua da dica vai do menor ao maior valor de cada escala, com uma faixa por cor do mapa
  const extremos = (v: number[]) => [Math.min(...v), Math.max(...v)] as const;
  const taxasAno = [...doAno.values()].flatMap((l) => taxaDe(l) ?? []);
  const [minAno, maxAno] = extremos(taxasAno);
  const QUINTOS = ["q0", "q1", "q2", "q3", "q4"];

  const estados: EstadoNoMapa[] = ufs.map((u) => {
    const t = totalDe(idsDe(u));
    const ficha: FichaDica = {
      titulo: NOME_UF[u] ?? u, sub: `${ano} · ${idsDe(u).length} municípios`,
      medidas: [{ rotulo: "Abstenção", valor: pct(t.taxa), cores: QUINTOS, p: naRegua(t.taxa, cortes, minAno, maxAno) }],
    };
    return { uf: u, classe: `q${classe(t.taxa, cortes)}`, href: href({ uf: u === uf ? null : u }), sigla: u, valor: pct(t.taxa, 0), descricao: `${NOME_UF[u] ?? u}: ${pct(t.taxa)} de abstenção em ${ano}`, ficha };
  });

  // municípios do estado em zoom; no modo "cruzar", 3 × 3 cores: terço da abstenção × terço do indicador, dentro do estado
  const idsUf = uf ? idsDe(uf) : [];
  const corte3Abst = quantis(idsUf.flatMap((id) => taxaDe(doAno.get(id)) ?? []), 3);
  const corte3Ind = quantis(idsUf.flatMap((id) => indicadores.get(id)?.[ind] ?? []), 3);
  const [minAbstUf, maxAbstUf] = extremos(idsUf.flatMap((id) => taxaDe(doAno.get(id)) ?? []));
  const [minIndUf, maxIndUf] = extremos(idsUf.flatMap((id) => indicadores.get(id)?.[ind] ?? []));
  const caixa = uf && !soEstados ? CAIXA_UF[uf] : undefined;   // na legenda, o mapa fica nos seis estados
  const noMapa: MunicipioNoMapa[] = !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const t = taxaDe(doAno.get(m.id_municipio));
    const v = indicadores.get(m.id_municipio)?.[ind];
    const cor = corMunicipio(t, v, { quintos: cortes, tercosAbst: corte3Abst, tercosInd: corte3Ind }, cruzar);
    const nome = nomeMun.get(m.id_municipio)!;
    const dica = t == null ? `${nome}: sem dado em ${ano}` : `${nome}: ${pct(t)} de abstenção${cruzar && v != null ? ` · ${infoInd.rotulo} ${formatarIndicador(ind, v)}` : ""}`;
    const atraso = (CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0]);   // os municípios surgem de oeste para leste
    // no cruzamento, cada régua é um eixo da legenda 3 × 3 (abstenção na base, indicador na coluna da esquerda)
    const ficha: FichaDica = t == null ? { titulo: nome, sub: `${NOME_UF[uf]} · sem dado em ${ano}`, medidas: [] } : cruzar && v != null ? {
      titulo: nome, sub: `${NOME_UF[uf]} · ${ano}`, celula: cor,
      medidas: [
        { rotulo: "Abstenção", valor: pct(t), cores: ["b00", "b01", "b02"], p: naRegua(t, corte3Abst, minAbstUf, maxAbstUf) },
        { rotulo: infoInd.rotulo, valor: formatarIndicador(ind, v), cores: ["b00", "b10", "b20"], p: naRegua(v, corte3Ind, minIndUf, maxIndUf) },
      ],
    } : { titulo: nome, sub: `${NOME_UF[uf]} · ${ano}`, medidas: [{ rotulo: "Abstenção", valor: pct(t), cores: QUINTOS, p: naRegua(t, cortes, minAno, maxAno) }] };
    return { ibge: m.cod_ibge, classe: cor, href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }), dica, atraso: Math.round(atraso * 100) / 100, ficha };
  });
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;

  // painel: a unidade escolhida (município, estado ou os seis estados) comparada com a de cima
  const idsTodos = idsDe();
  const ids = mun ? [mun.id_municipio] : uf ? idsUf : idsTodos;
  const total = totalDe(ids);
  const referencia = mun ? { nome: `da média de ${NOME_UF[uf!]}`, rotulo: `Média de ${NOME_UF[uf!]}`, t: totalDe(idsUf) }
    : uf ? { nome: "dos seis estados juntos", rotulo: "Seis estados juntos", t: totalDe(idsTodos) } : null;
  const comparacao = referencia && total.aptos > 0 ? compararComReferencia(total.taxa, referencia.t.taxa) : null;
  const composicao = composicaoEleitorado(total);
  const nomeUnidade = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] : "Os seis estados";
  const serie = serieAbstencao(participacao, new Set(ids));
  const maiorSerie = Math.max(...serie.map((s) => s.taxa));
  const universo = uf ? idsUf : idsTodos;   // com quem a unidade é comparada nos indicadores e na dispersão
  const valorInd = (chave: string) => (mun ? indicadores.get(mun.id_municipio)?.[chave] ?? null : mediaPonderada(ids, indicadores, chave));
  const pontos = universo.flatMap((id) => {
    const x = indicadores.get(id)?.[ind], y = taxaDe(doAno.get(id));
    return x == null || y == null ? [] : [{ id, x, y, on: id === mun?.id_municipio }];
  });
  const r = correlacao(pontos);
  // réguas do Censo: a unidade entre os municípios do recorte e a média de cima (do estado, para o município; dos seis
  // estados, para o estado), as duas ponderadas pela população
  const refCenso = mun ? { ids: idsUf, rotulo: `Média de ${NOME_UF[uf!]}` } : uf ? { ids: idsTodos, rotulo: "Média dos seis estados" } : null;
  const linhasCenso: LinhaIndicadorCenso[] = listaInd.map((i) => {
    const v = valorInd(i.chave);
    const todos = universo.flatMap((id) => indicadores.get(id)?.[i.chave] ?? []);
    const media = refCenso ? mediaPonderada(refCenso.ids, indicadores, i.chave) : null;
    const g = reguaIndicador(v, todos, media);
    const f = (x: number) => formatarIndicador(i.chave, x);
    return {
      chave: i.chave, rotulo: i.rotulo, valor: v == null ? "—" : f(v), min: todos.length ? f(g.min) : "", max: todos.length ? f(g.max) : "", p: g.p, pMedia: g.pMedia, tracos: todos.length ? g.tracos : "",
      descricao: `${i.rotulo}: ${nomeUnidade} ${v == null ? "sem dado" : f(v)}${media != null ? `; ${refCenso!.rotulo.toLowerCase()} ${f(media)}` : ""}; municípios de ${todos.length ? `${f(g.min)} a ${f(g.max)}` : "—"}`,
    };
  });
  const ranking = idsUf.flatMap((id) => { const t = taxaDe(doAno.get(id)); return t == null ? [] : [{ id, t }]; }).sort((a, b) => b.t - a.t);
  // ficha fixa do município escolhido: o mesmo cartão da dica do mapa, e a faixa com todos os municípios do estado
  const fichaMun = mun ? noMapa.find((m) => m.ibge === mun.cod_ibge)?.ficha : undefined;
  const faixa = mun ? distribuicao(ranking.map((x) => ({ id: x.id, v: x.t })), mun.id_municipio) : null;
  // os extremos do estado em barras, na cor do quinto de cada um, cortadas pela média do estado
  const extr = uf && !mun ? extremosAbstencao(ranking, 4, total.taxa) : null;
  const linhaExtremo = (x: { id: number; t: number; p: number }) => ({ id: x.id, nome: nomeMun.get(x.id)!, valor: pct(x.t, 1), p: x.p, classe: `q${classe(x.t, cortes)}`, href: href({ mun: x.id }) });
  const legendaQ = rotulosFaixas(cortes, (v) => pct(v, 0));
  // os cortes de cada terço do cruzamento, escritos na legenda 3 × 3 (o leitor vê o que cada cor quer dizer)
  const tercosAbst = rotulosFaixas(corte3Abst, (v) => pct(v, 0)).map((t) => t.replace("%–", "–"));
  const tercosInd = rotulosFaixas(corte3Ind, (v) => formatarIndicador(ind, v));

  // visão de legenda: a parte dos votos dada só à legenda (de todos ou de um partido), em faixas fixas por estado
  const linhasLeg = doCargo(legendaVista, cargo);
  const geral = anoLeg !== undefined && cicloDoAno(anoLeg) === "geral";
  const cargoTexto = !geral ? "vereador" : cargo === "ambos" ? "deputado" : `deputado ${cargo}`;
  const cargoTitulo = !geral ? "Vereadores" : cargo === "ambos" ? "Deputados federais e estaduais" : `Deputados ${cargo === "federal" ? "federais" : "estaduais"}`;
  const medir = (u?: string, a = anoLeg ?? 0) => medirLegenda(linhasLeg, { ano: a, uf: u, partido });
  const porUfLeg = ufs.map((u) => ({ uf: u, m: medir(u) }));
  const cortesLeg = faixasFixas(Math.max(0, ...porUfLeg.map((x) => x.m.valor ?? 0)));
  const fmtLeg = (v: number) => pct(v, Math.max((cortesLeg[0] ?? 0) < 0.02 ? 1 : 0, casasDosCortes(cortesLeg)));   // "5,8%", "24%"
  const estadosLeg: EstadoNoMapa[] = porUfLeg.map(({ uf: u, m }) => ({
    uf: u, classe: m.valor == null ? "sem" : `q${classe(m.valor, cortesLeg)}`, href: href({ uf: u === uf ? null : u }), sigla: u,
    valor: m.valor == null ? "—" : fmtLeg(m.valor),
    descricao: m.valor == null ? `${NOME_UF[u] ?? u}: sem votos de legenda${partido ? ` para o partido ${partido}` : ""} em ${anoLeg}`
      : partido ? `${NOME_UF[u] ?? u}: ${fmtLeg(m.valor)} dos votos de legenda para ${cargoTexto} em ${anoLeg} foram para o partido ${partido}`
      : `${NOME_UF[u] ?? u}: ${fmtLeg(m.valor)} dos votos para ${cargoTexto} em ${anoLeg} foram só na legenda`,
  }));
  const legendaLeg = rotulosFaixas(cortesLeg, fmtLeg).map((t) => t.replace("%–", "–"));   // "1,5–3,0%": cabe embaixo da cor
  const algumSem = porUfLeg.some((x) => x.m.valor == null);
  const medidaLeg = medir(uf);
  const medidaTodos = medir();
  const rankingLeg = anoLeg === undefined ? [] : rankingPartidos(linhasLeg, { ano: anoLeg, uf }).slice(0, 8);
  const partidosDoAno = anoLeg === undefined ? [] : rankingPartidos(linhasLeg, { ano: anoLeg }).map((r) => r.partido);
  const opcoesPartido = [...new Set([...partidosDoAno, ...(partido ? [partido] : [])])].sort((a, b) => a.localeCompare(b, "pt-BR")).map((x) => [x, x] as [string, string]);
  const hrefAnalise = `/analises/legenda${(() => { const q = new URLSearchParams(); if (uf) q.set("uf", uf); if (juntar) q.set("juntar", "1"); if (partido) q.set("p", partido); const t = q.toString(); return t ? `?${t}` : ""; })()}`;
  // trocar de visão mantém o estado; o ano vai para o mais perto que a outra visão tem
  const anoBase = naLegenda && anos.includes(anoLeg!) ? anoLeg! : naInstrucao ? anoInst : ano;   // o ano da abstenção ao sair da legenda ou da instrução
  const hrefAbst = naLegenda || naInstrucao ? href({ ver: "abstencao", ano: anoBase }) : href({});
  const hrefLeg = naLegenda ? href({}) : href({ ver: "legenda", ano: anoNaLegenda(anoBase, anosLeg) ?? anoBase });
  const hrefInst = naInstrucao ? href({}) : href({ ver: "instrucao", ano: anoNaLegenda(anoBase, [...ANOS_INSTRUCAO]) ?? anoInst });

  // Comparar › Instrução: o mapa pinta a parte da população de 18 anos ou mais (Censo 2022) com o grau escolhido, em
  // quintos dos municípios dos seis estados; a dica de cada município mostra também o grau do prefeito eleito no ano e o
  // grau mais comum na população. O painel põe os eleitos (prefeito e vereadores) ao lado da população
  const eleitosInst = comoObjetos<LinhaEleitosInstrucao>(q4?.eleitos);
  const prefeitosInst = comoObjetos<LinhaPrefeito>(q4?.prefeitos);
  const popInst = comoObjetos<LinhaPopulacaoInstrucao>(q4?.populacao);
  const munInst = naInstrucao ? porMunicipio(popInst, prefeitosInst, { ano: anoInst, medida }) : new Map<string, MunicipioInstrucao>();
  const taxasInst = [...munInst.values()].flatMap((m) => m.taxa ?? []);
  const cortesInst = quantis(taxasInst, 5);
  const [minInst, maxInst] = extremos(taxasInst);
  const rotuloTaxa = `${medida.rotulo} na população`;
  const reguaInst = (v: number) => ({ cores: QUINTOS, p: naRegua(v, cortesInst, minInst, maxInst) });
  const classeInst = (v: number | null | undefined) => (v == null ? "sem" : `q${classe(v, cortesInst)}`);
  const grauPrefeito = (p: LinhaPrefeito | null | undefined) => (!p ? "nenhum na eleição ordinária" : rotuloNivel(p.nivel) ?? "não informado");
  const estadosInst: EstadoNoMapa[] = ufs.map((u) => {
    const pop = perfilPopulacao(popInst, { uf: u });
    const taxa = parteNaMedida(pop, medida);
    const el = parteNaMedida(perfilEleitos(eleitosInst, { ano: anoInst, uf: u }), medida);
    const pred = rotuloNivel(predominante(pop));
    const nome = NOME_UF[u] ?? u;
    return {
      uf: u, classe: classeInst(taxa), href: href({ uf: u === uf ? null : u }), sigla: u, valor: taxa == null ? "—" : pct(taxa, 0),
      descricao: taxa == null ? `${nome}: sem dado do Censo 2022` : `${nome}: ${pct(taxa, 1)} da população de 18 anos ou mais ${medida.tem}${el != null ? `; entre os eleitos em ${anoInst}, ${pct(el, 1)}` : ""}`,
      ficha: {
        titulo: nome, sub: `${anoInst} · prefeitos e vereadores eleitos`,
        medidas: taxa == null ? [] : [
          { rotulo: rotuloTaxa, valor: pct(taxa, 1), ...reguaInst(taxa) },
          ...(el != null ? [{ rotulo: `${medida.rotulo} nos eleitos`, valor: pct(el, 1) }] : []),
          ...(pred ? [{ rotulo: "Mais comum na população", valor: pred }] : []),
        ],
      },
    };
  });
  const noMapaInst: MunicipioNoMapa[] = !naInstrucao || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const d = munInst.get(m.cod_ibge);
    const nome = nomeMun.get(m.id_municipio)!;
    const pred = rotuloNivel(d?.predominante);
    const atraso = (CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0]);
    const ficha: FichaDica = d?.taxa == null ? { titulo: nome, sub: `${NOME_UF[uf]} · sem dado do Censo 2022`, medidas: [] } : {
      titulo: nome, sub: `${NOME_UF[uf]} · ${anoInst}`,
      medidas: [
        { rotulo: rotuloTaxa, valor: pct(d.taxa, 1), ...reguaInst(d.taxa) },
        { rotulo: "Prefeito eleito", valor: d.prefeito ? rotuloNivel(d.prefeito.nivel) ?? "não informado" : "—" },
        { rotulo: "Mais comum na população", valor: pred ?? "—" },
      ],
    };
    const dica = d?.taxa == null ? `${nome}: sem dado do Censo 2022`
      : `${nome}: ${pct(d.taxa, 1)} da população de 18 anos ou mais ${medida.tem}; prefeito eleito em ${anoInst}: ${grauPrefeito(d.prefeito).toLowerCase()}; mais comum na população: ${(pred ?? "—").toLowerCase()}`;
    return { ibge: m.cod_ibge, classe: classeInst(d?.taxa), href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }), dica, atraso: Math.round(atraso * 100) / 100, ficha };
  });
  const legendaInst = rotulosFaixas(cortesInst, (v) => pct(v, 0)).map((t) => t.replace("%–", "–"));   // "12–15%": cabe embaixo da cor
  const algumSemInst = noMapaInst.some((x) => x.classe === "sem");
  const lugarInst = { uf, ibge: mun?.cod_ibge };
  const popUnidade = perfilPopulacao(popInst, lugarInst);
  const eleitosUnidade = perfilEleitos(eleitosInst, { ano: anoInst, ...lugarInst });
  const taxaUnidade = parteNaMedida(popUnidade, medida);
  const taxaEleitos = parteNaMedida(eleitosUnidade, medida);
  const predUnidade = rotuloNivel(predominante(popUnidade));
  // detalhes do município: o prefeito e os vereadores eleitos, com foto e grau (null = a API não respondeu)
  const eleitosMun = naInstrucao && mun ? await apiGetOpcional<EleitoInstrucao[]>(`/municipios/ibge/${mun.cod_ibge}/eleitos?ano=${anoInst}`) : null;
  const { prefeito: prefeitoMun, vereadores: vereadoresMun } = separarEleitos(eleitosMun ?? []);
  const vereadoresNaMedida = contarNaMedida(vereadoresMun, medida);
  const linhasInst = naInstrucao ? linhasNiveis(eleitosInst, popInst, { ano: anoInst, ...lugarInst }) : [];

  // a análise de voto de legenda (pergunta 5) no relatório embaixo do mapa: série por partido e comparação de ciclos,
  // no estado e no partido escolhidos no mapa
  const linhasSerie = filtrar(legendaVista, { uf });
  const escolhidosSerie = partido ? [partido] : sugestoes(linhasSerie, [], 3);
  const seriesLeg = serieLegenda(linhasSerie, escolhidosSerie);
  const resumoLeg = resumoSerie(seriesLeg);
  const cortesSerie = Object.fromEntries(escolhidosSerie.map((p) => [p, cortesTom(p, eventosLeg, juntar)]));
  const comparacaoLeg = anoLeg === undefined ? null : compararCiclos(linhasSerie, { ciclo: cicloDoAno(anoLeg), cargo, ordem: "soma" }, linhagem);
  const hrefTodosCiclos = hrefLegenda({ uf, juntar, p: escolhidosSerie, ciclo: anoLeg === undefined ? "geral" : cicloDoAno(anoLeg), cargo, ordem: "soma", todos: true });

  // visão candidato: cand e campanha validados contra os dados da API; inválidos (ou API fora) voltam à busca
  const idCand = naCandidato && /^\d+$/.test(um(sp.cand) ?? "") ? Number(um(sp.cand)) : undefined;
  const candidaturasMapa = idCand ? (await apiGetOpcional<CandidaturaMapa[]>(`/candidatos/${idCand}/mapa`)) ?? [] : [];
  const { padrao: campanhaPadrao, lista: campanhas } = candidaturasDe(candidaturasMapa, idCand ?? 0);
  const campanha = campanhas.find((c) => String(c.id_candidatura) === um(sp.campanha)) ?? campanhaPadrao;
  const votosCand = campanha && abrangencia(campanha.cargo) !== "fora"
    ? noMapaEstatico((await apiGetOpcional<VotoMunicipio[]>(`/candidaturas/${campanha.id_candidatura}/votos-municipio`)) ?? [], municipios) : [];
  const turnosCand = turnosDe(votosCand);
  const turnoCand = turnosCand.includes(Number(um(sp.turno))) ? Number(um(sp.turno)) : 1;
  const alcanceCand = campanha ? abrangencia(campanha.cargo) : "fora";
  // sem candidato, o estado clicado no mapa dá zoom nele e filtra a busca do menu (?uf=)
  const ufBusca = naCandidato && !campanha ? uf : undefined;
  const ufCand = alcanceCand === "uf" || alcanceCand === "municipio" ? campanha!.uf : alcanceCand === "seis" ? uf : ufBusca;
  const munCand = ufCand ? votosCand.find((v) => v.uf === ufCand && String(v.id_municipio) === um(sp.mun))?.id_municipio : undefined;

  const hrefCand = "/?ver=candidato#mapa";   // como as camadas: <a data-mapa>, que o MapaVivo navega sem recarregar

  // submenu do mapa: abas Candidato e Camadas; a abstenção é o mapa base, e as camadas vêm por cima dela
  const comparativo = situacaoComparativo({ ano: anoBase, anosPorCenso: ANOS_POR_CENSO, uf });
  const censoBase = censoDoAno(anoBase) ?? 2010;
  const indBase = indicadorNoCenso(indPedido, censoBase);
  const comparativoLigado = ver === "abstencao" && pediuCruzar;
  const camadas = (
    <CamadasMapa
      modo={naLegenda ? "legenda" : "comparar"}
      hrefs={{
        legenda: hrefLeg,
        comparar: href({ ver: "abstencao", ano: anoBase, cor: null }),   // a sub-aba Abstenção, sem indicador: a abstenção sozinha
      }}
      comparar={{
        sub: naInstrucao ? "instrucao" : "abstencao",
        hrefs: { abstencao: href({ ver: "abstencao", ano: anoBase, cor: null }), instrucao: hrefInst },
      }}
      instrucao={{
        anos: new Intl.ListFormat("pt-BR").format(ANOS_INSTRUCAO.map(String)),
        medidas: MEDIDAS.map((m) => ({ chave: m.chave, rotulo: m.rotulo, href: href({ med: m.chave }), on: m.chave === medida.chave })),
      }}
      legenda={{
        anos: anosLeg.length ? `${anosLeg[0]} a ${anosLeg[anosLeg.length - 1]}` : "sem dados",
        cargos: naLegenda && geral ? CARGOS.map((c) => ({ rotulo: ROTULO_CARGO[c], href: href({ cargo: c }), on: c === cargo })) : [],
        juntar: naLegenda ? { on: juntar, href: href({ juntar: !juntar }) } : undefined,
        partido: naLegenda ? { opcoes: opcoesPartido, atual: partido, params: Object.fromEntries(params({ p: null })) } : undefined,
      }}
      comparativos={{
        disponivel: comparativo.disponivel, motivo: comparativo.motivo,
        censo: censoDoAno(anoBase),
        itens: indicadoresDoCenso(censoBase).map((i) => {
          const on = comparativoLigado && i.chave === indBase;
          // clicar de novo no escolhido desmarca: volta à abstenção sozinha
          return { chave: i.chave, rotulo: i.rotulo, on, href: href(on ? { ver: "abstencao", ano: anoBase, cor: null } : { ver: "abstencao", ano: anoBase, ind: i.chave, cor: "cruzar" }) };
        }),
        anos: ANOS_CENSO.map((a) => ({ ano: a, href: href({ ver: "abstencao", ano: a }) })),
      }}
    />
  );
  const submenu = (
    <SubmenuMapa
      resumo={ufBusca ? `Busca só em ${NOME_UF[ufBusca]}` : resumoCamadas({ ver, partido, comparativo: comparativoLigado ? infoInd.rotulo : undefined, instrucao: medida.rotulo })}
      aba={naCandidato ? "candidato" : "camadas"} hrefCandidato={hrefCand} hrefCamadas={hrefAbst}
    >
      {naCandidato ? (
        <div className="aba-candidato">
          {ufBusca && (
            <p className="filtro-uf">
              <span>Só quem disputou em <b>{NOME_UF[ufBusca]}</b></span>
              <a href={hrefCand} data-mapa="" aria-label={`Tirar o filtro de ${NOME_UF[ufBusca]} e voltar aos seis estados`}><Icone nome="fechar" /></a>
            </p>
          )}
          <BuscaCandidatoMapa uf={ufBusca} rotulo={ufBusca ? `Buscar candidato de ${NOME_UF[ufBusca]}` : undefined} />
          {ufBusca && <p className="rotulo">Busque pelo nome de quem disputou em {NOME_UF[ufBusca]}.</p>}
        </div>
      ) : camadas}
    </SubmenuMapa>
  );

  // o mapa do palco, repetido pequeno no mini-mapa que acompanha a rolagem
  const destaqueMun = mun && centro ? { ibge: mun.cod_ibge, nome: nomeMun.get(mun.id_municipio)!, x: centro[0], y: centro[1] } : undefined;
  const mapaPalco = naLegenda ? (
    <MapaAbstencao
      titulo={`Voto de legenda${partido ? ` do partido ${partido}` : ""} em ${anoLeg} nos seis estados`}
      camera={camera} estados={estadosLeg} uf={uf} zoom={false} municipios={[]}
    />
  ) : naInstrucao ? (
    <MapaAbstencao
      titulo={`${medida.rotulo} na população de 18 anos ou mais, ${uf ? `municípios de ${NOME_UF[uf]}` : "nos seis estados"}`}
      camera={camera} estados={estadosInst} uf={uf} municipios={noMapaInst} destaque={destaqueMun}
    />
  ) : (
    <MapaAbstencao
      titulo={uf ? `Municípios de ${NOME_UF[uf]}: abstenção em ${ano}` : `Abstenção em ${ano} nos seis estados`}
      camera={camera} estados={estados} uf={uf} municipios={noMapa}
      destaque={destaqueMun}
    />
  );
  // o mini-mapa vai ao município escolhido: centro dele na tela do mapa, ampliado 3 ×
  const focoMini = mun && centro && caixa ? centrarLupa({ x: camera.x + centro[0] * camera.k, y: camera.y + centro[1] * camera.k }, 3) : undefined;

  const blocoDispersao = (
    <div className="bloco noite s8 bloco-dispersao">
      <div>
        <h3>Abstenção × {infoInd.rotulo}</h3>
        {pontos.length >= 3 ? (
          <>
            <p className="r-texto">{r != null && lerCorrelacao(r, /^[A-Z]{2}/.test(infoInd.rotulo) ? infoInd.rotulo : infoInd.rotulo[0].toLowerCase() + infoInd.rotulo.slice(1))}{r != null && <small> (r = {r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })})</small>}</p>
            <p className="muted pequeno">Cada ponto é um município {uf ? `de ${NOME_UF[uf]}` : "dos seis estados"}{mun ? "; o círculo grande é o escolhido" : ""}. Correlação não é causa.</p>
          </>
        ) : <p>Poucos municípios com os dois dados.</p>}
      </div>
      {pontos.length >= 3 && (
        <Dispersao
          pontos={pontos} tendencia={tendencia(pontos)} rotuloX={infoInd.rotulo}
          formatoX={(v) => formatarIndicador(ind, v)}
          descricao={`Cada ponto é um município ${uf ? `de ${NOME_UF[uf]}` : "dos seis estados"}: ${infoInd.rotulo} no Censo ${censoUsado} no eixo horizontal, abstenção em ${ano} no vertical.${r != null ? ` Correlação ${r.toFixed(2)}.` : ""}`}
        />
      )}
    </div>
  );
  const blocoExtremos = extr && extr.mais.length > 0 ? (
    <div className="bloco noite s8">
      <h3>Onde mais e menos se faltou</h3>
      <p className="muted pequeno">Abstenção em {ano} nos municípios de {NOME_UF[uf!]}; as barras vão de zero ao maior valor, na cor de cada um no mapa. Clique para ver o município.</p>
      <ExtremosAbstencao
        mais={extr.mais.map(linhaExtremo)} menos={extr.menos.map(linhaExtremo)}
        media={{ p: extr.pMedia, rotulo: `Média de ${NOME_UF[uf!]}, ${pct(total.taxa, 1)}` }}
        descricao={`Municípios de ${NOME_UF[uf!]} com mais e menos abstenção em ${ano}`}
      />
    </div>
  ) : null;
  const blocoFicha = mun && fichaMun ? (
    <div className="bloco noite s8 ficha-mun">
      <CartaoDica ficha={fichaMun} texto="" titulo="h3" />
      {faixa?.p != null && faixa.ordem != null && (
        <div className="ficha-mun-faixa">
          <p><b>{faixa.ordem}º</b> maior abstenção entre os {faixa.total} municípios de {NOME_UF[uf!]}</p>
          <FaixaMunicipios
            pontos={faixa.pontos} p={faixa.p}
            pontas={[`menor ${pct(ranking[ranking.length - 1].t, 1)}`, `maior ${pct(ranking[0].t, 1)}`]}
            descricao={`${nomeUnidade} tem a ${faixa.ordem}ª maior abstenção entre os ${faixa.total} municípios de ${NOME_UF[uf!]} em ${ano}`}
          />
        </div>
      )}
    </div>
  ) : null;
  const recorte = `${resumoCamadas({ ver, partido, comparativo: comparativoLigado ? infoInd.rotulo : undefined, instrucao: medida.rotulo })} · ${naLegenda ? (uf ?? "seis estados") : mun ? nomeMun.get(mun.id_municipio) : uf ?? "seis estados"} · ${naLegenda ? anoLeg : naInstrucao ? anoInst : ano}`;

  return (
    <>
      {!participacao.length ? (
        <div className="card aviso">
          <h2>Mapa indisponível</h2>
          <p>Os dados do mapa ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py mapa</code>.</p>
        </div>
      ) : (
        <section id="mapa" className="quadro observatorio" aria-labelledby="h-mapa">
          <div className="palco-trilho" aria-hidden="true" />
          {naCandidato ? (
            <VisaoCandidato
              menu={submenu} votos={votosCand} municipios={municipios} ufs={ufs}
              escolha={{ campanha, lista: campanhas, turno: turnoCand, turnos: turnosCand, uf: ufCand, mun: munCand }}
            />
          ) : (<>
          <MapaVivo className="palco s12" estado={soEstados ? undefined : uf}>
            {submenu}
            <div className="palco-topo">
              <div>
                {naLegenda ? (
                  <>
                    <h1 id="h-mapa">{partido ? `${partido}: voto de legenda em ${anoLeg}` : `Quem votou só no partido em ${anoLeg}`}</h1>
                    <p className="palco-sobre">{cargoTitulo} · 1º turno</p>
                    {partido && (
                      <a className="tirar-partido" href={href({ p: null })} data-mapa="">
                        Ver todos os partidos
                        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" /></svg>
                      </a>
                    )}
                  </>
                ) : naInstrucao ? (
                  <>
                    <h1 id="h-mapa">{medida.rotulo}: população e eleitos em {anoInst}</h1>
                    <p className="palco-sobre">Cor: população de 18 anos ou mais (Censo 2022) · eleitos: prefeito e vereador</p>
                  </>
                ) : (
                  <>
                    <h1 id="h-mapa">Quem não foi votar em {ano}</h1>
                    <p className="palco-sobre">1º turno{cruzar && ` · cruzada com ${infoInd.rotulo.toLowerCase()} (Censo ${censoUsado})`}</p>
                  </>
                )}
              </div>
              <nav className="trilha" aria-label="Onde você está no mapa">
                <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
                {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
                {mun && <><span aria-hidden="true">/</span><span aria-current="true">{nomeMun.get(mun.id_municipio)}</span></>}
              </nav>
            </div>

            <div className="palco-mapa">
              {mapaPalco}
              {!uf && <p className="palco-dica" aria-hidden="true">{soEstados ? "Clique num estado para ver os números dele" : "Clique num estado para ver os municípios"}</p>}
            </div>

            <div className="palco-base">
              {naLegenda ? (
                <ul className="legenda-q" aria-label={partido ? `Cores: faixas iguais da parte dos votos de legenda que foi para o partido ${partido}` : "Cores: faixas iguais da parte dos votos dada só à legenda"}>
                  {legendaLeg.map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
                  {algumSem && <li className="legenda-sem"><i className="sem" />sem votos</li>}
                </ul>
              ) : naInstrucao ? (
                <ul className="legenda-q" aria-label={`Cores: parte da população de 18 anos ou mais que ${medida.tem}; cada cor reúne um quinto dos municípios dos seis estados`}>
                  {legendaInst.map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
                  {algumSemInst && <li className="legenda-sem"><i className="sem" />sem dado</li>}
                </ul>
              ) : cruzar ? (
                <div className="legenda-bi" role="img" aria-label={`Cores: abstenção (colunas: ${tercosAbst.join(", ")}) e ${infoInd.rotulo} (linhas: ${tercosInd.join(", ")}), em terços dos municípios de ${NOME_UF[uf!]}`}>
                  <span className="bi-y">{infoInd.rotulo} ↑</span>
                  <div className="bi-tabela">
                    {[2, 1, 0].map((i) => (
                      <Fragment key={i}>
                        <span className="bi-rot-y">{tercosInd[i]}</span>
                        {[0, 1, 2].map((a) => <i key={a} className={`b${i}${a}`} />)}
                      </Fragment>
                    ))}
                    <span />
                    {tercosAbst.map((t) => <span key={t} className="bi-rot-x">{t}</span>)}
                  </div>
                  <span className="bi-x">Abstenção →</span>
                </div>
              ) : (
                <ul className="legenda-q" aria-label="Cores: cada uma reúne um quinto dos municípios dos seis estados">
                  {legendaQ.map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
                </ul>
              )}
              {naLegenda ? (
                <div className="anos" role="group" aria-label="Ano da eleição">
                  {anosLeg.map((a) => (
                    <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === anoLeg ? " on" : ""}`} aria-current={a === anoLeg ? "true" : undefined}>
                      {a}<small>{cicloDoAno(a) === "geral" ? "Deputados" : "Vereadores"}</small>
                    </Link>
                  ))}
                </div>
              ) : naInstrucao ? (
                <div className="anos" role="group" aria-label="Ano da eleição">
                  {ANOS_INSTRUCAO.map((a) => (
                    <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === anoInst ? " on" : ""}`} aria-current={a === anoInst ? "true" : undefined}>
                      {a}
                    </Link>
                  ))}
                </div>
              ) : (
              <div className="anos" role="group" aria-label="Ano da eleição">
                {anos.map((a) => (
                  <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}${ANOS_CENSO.includes(a) ? " censo" : ""}`} aria-current={a === ano ? "true" : undefined}>
                    {a}{ANOS_CENSO.includes(a) && <small>Censo</small>}
                  </Link>
                ))}
              </div>
              )}
            </div>
          </MapaVivo>

          {naLegenda ? (
          <div className="painel s12" key={`legenda-${uf}-${anoLeg}-${cargo}-${partido}-${juntar}`}>
            <div className="bloco noite painel-cab s4">
              <p className="palco-sobre">{uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"}</p>
              <h2>{uf ? NOME_UF[uf] : "Os seis estados"}</h2>
              {medidaLeg.valor != null ? (
                <>
                  <p className="painel-num"><Rolar valor={pct(medidaLeg.valor, 1)} /></p>
                  <p>
                    {partido ? <>dos {compacto(medidaLeg.total)} votos só na legenda para {cargoTexto} em {anoLeg} foram para o partido {partido}</> : <>dos {compacto(medidaLeg.total)} votos para {cargoTexto} em {anoLeg} foram só na legenda, sem escolher candidato</>}
.
                  </p>
                  {uf && medidaTodos.valor != null && (
                    <ComparaReferencia
                      comparacao={compararComReferencia(medidaLeg.valor, medidaTodos.valor)} nome="dos seis estados juntos"
                      unidade={{ rotulo: NOME_UF[uf], valor: pct(medidaLeg.valor, 1) }} referencia={{ rotulo: "Seis estados juntos", valor: pct(medidaTodos.valor, 1) }}
                    />
                  )}
                </>
              ) : <p>{partido ? `O partido ${partido} não teve votos para ${cargoTexto}${uf ? ` em ${NOME_UF[uf]}` : ""} em ${anoLeg}.` : `Sem votos para ${cargoTexto} em ${anoLeg}.`}</p>}
            </div>

            {rankingLeg.length > 0 && (
              <div className="bloco noite s8">
                <h3>Partidos com mais voto de legenda</h3>
                <p className="muted pequeno">Parte de cada partido nos votos só na legenda para {cargoTexto}{uf ? ` em ${NOME_UF[uf]}` : ""} em {anoLeg}. Escolha um para pintar o mapa com ele.</p>
                <ol className="ranking-leg">
                  {escalaDoMaior(rankingLeg).map((r, i) => (
                    <li key={r.partido}>
                      <Link scroll={false} href={href({ p: r.partido === partido ? null : r.partido })} className={r.partido === partido ? "on" : undefined}
                        aria-current={r.partido === partido ? "true" : undefined} style={{ "--p": r.p } as CSSProperties}>
                        <span className="rl-pos" aria-hidden="true">{i + 1}</span><span className="rl-sigla">{r.partido}</span><b>{pct(r.valor, 1)}</b>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="bloco noite s12">
              <h3>Eleição a eleição, por partido</h3>
              <p className="r-texto">{resumoLeg}</p>
              <SerieLegenda series={seriesLeg} cortes={cortesSerie} eventos={faixaEventos(escolhidosSerie, eventosLeg)} descricao={resumoLeg} />
              <p className="muted pequeno">{partido ? `A linha é o ${partido}` : `As linhas são os três partidos com mais votos de legenda${uf ? ` em ${NOME_UF[uf]}` : ""}`}; a área, todos os partidos. Proporção = votos de legenda ÷ (legenda + nominais), deputados e vereadores juntos; faixas = eleições municipais.{juntar ? " Com os partidos que se fundiram somados ao atual; tom mais claro = antes da fusão ou incorporação." : ""}</p>
            </div>

            {comparacaoLeg && (
              <div className="bloco noite s12">
                <h3>De um ciclo para o outro</h3>
                <p className="r-texto">{resumoCiclos(comparacaoLeg)}</p>
                <ComparaCiclos comparacao={comparacaoLeg} limite={8} todos={false} hrefAlternar={hrefTodosCiclos} />
              </div>
            )}

            <ul className="atalhos s12">
              <li><Link href={hrefAnalise}>Análise completa do voto de legenda</Link></li>
              <li><Link href={uf ? `/candidatos?uf=${uf}` : "/candidatos"}>Candidatos</Link></li>
            </ul>
          </div>
          ) : naInstrucao ? (
          <div className="painel s12" key={`instrucao-${uf}-${mun?.id_municipio}-${anoInst}-${medida.chave}`}>
            <div className="bloco noite painel-cab s4">
              <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"}</p>
              <h2>{nomeUnidade}</h2>
              {taxaUnidade != null ? (
                <>
                  <p className="painel-num"><Rolar valor={pct(taxaUnidade, 1)} /></p>
                  <p>da população de 18 anos ou mais {medida.tem} (Censo 2022). O grau mais comum nela: {predUnidade?.toLowerCase()}.</p>
                  {taxaEleitos != null && (
                    <>
                      <p>Entre os {inteiro(eleitosUnidade.total)} eleitos em {anoInst} (prefeito e vereadores), {pct(taxaEleitos, 1)}.</p>
                      <ComparaReferencia
                        comparacao={compararComReferencia(taxaEleitos, taxaUnidade)} nome="da população"
                        unidade={{ rotulo: `Eleitos em ${anoInst}`, valor: pct(taxaEleitos, 1) }} referencia={{ rotulo: "População de 18 anos ou mais", valor: pct(taxaUnidade, 1) }}
                      />
                    </>
                  )}
                </>
              ) : <p>Sem dado do Censo 2022.</p>}
              {uf && (
                <EscolhaMunicipio
                  opcoes={idsUf.map((id) => [id, nomeMun.get(id)!] as [number, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
                  atual={mun?.id_municipio}
                  params={Object.fromEntries(params({ mun: null }))}
                />
              )}
            </div>

            <div className="bloco noite s8">
              <h3>Os quatro graus de instrução</h3>
              <p className="muted pequeno">Cada barra soma 100%. Os graus contornados são os que pintam o mapa ({medida.rotulo.toLowerCase()}).</p>
              <BarrasInstrucao linhas={linhasInst} niveis={medida.niveis} />
            </div>

            {mun && (
              <div className="bloco noite s12">
                <h3>Quem se elegeu em {nomeUnidade} em {anoInst}</h3>
                {eleitosMun == null ? <p>Os eleitos não carregaram: a API não respondeu.</p> : (
                  <>
                    <p className="muted pequeno">
                      {prefeitoMun && `Prefeito: ${grauDoEleito(prefeitoMun).toLowerCase()}. `}
                      {vereadoresNaMedida.de > 0 && `${vereadoresNaMedida.n} dos ${vereadoresNaMedida.de} vereadores ${medida.tinham}. `}
                      Com contorno, quem está no grau que pinta o mapa ({medida.rotulo.toLowerCase()}).
                    </p>
                    <EleitosInstrucao prefeito={prefeitoMun} vereadores={vereadoresMun} niveis={medida.niveis} />
                    <p className="muted pequeno">{CREDITO_FOTOS}</p>
                  </>
                )}
              </div>
            )}

            <ul className="atalhos s12">
              <li><Link href="/sobre#p4">Como calculamos</Link></li>
              <li><Link href={uf ? `/candidatos?uf=${uf}` : "/candidatos"}>Candidatos</Link></li>
            </ul>
          </div>
          ) : (
          <div className="painel s12" key={`${uf}-${mun?.id_municipio}-${ano}-${ind}`}>
            {pediuInstrucao && (
              <div className="card aviso s12">
                <h2>Instrução indisponível</h2>
                <p>A API não devolveu a análise <code>q4</code>. Confira se ela está rodando (<code>uvicorn app.main:app</code> em <code>api/</code>).</p>
              </div>
            )}
            {pediuLegenda && (
              <div className="card aviso s12">
                <h2>Voto de legenda indisponível</h2>
                <p>A API não devolveu a análise <code>q5</code>. Confira se ela está rodando (<code>uvicorn app.main:app</code> em <code>api/</code>).</p>
              </div>
            )}
            <div className={`bloco noite painel-cab s4${uf ? " alto" : ""}`}>
              <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? `Estado · ${idsUf.length} municípios` : "AP, ES, MG, PE, RJ e RR"}</p>
              <h2>{nomeUnidade}</h2>
              {total.aptos > 0 ? (
                <>
                  <p className="painel-num"><Rolar valor={pct(total.taxa, 1)} /></p>
                  <p>dos {compacto(total.aptos)} eleitores aptos não foram votar em {ano}.</p>
                  {referencia && comparacao && (
                    <ComparaReferencia
                      comparacao={comparacao} nome={referencia.nome}
                      unidade={{ rotulo: nomeUnidade, valor: pct(total.taxa, 1) }} referencia={{ rotulo: referencia.rotulo, valor: pct(referencia.t.taxa, 1) }}
                    />
                  )}
                  <div className="composicao">
                    <p className="composicao-titulo">Para onde foram os {compacto(total.aptos)} eleitores</p>
                    <div className="composicao-barra" role="img" aria-label={`Dos eleitores aptos: ${composicao.map((c) => `${pct(c.p, 1)} ${c.rotulo.toLowerCase()}`).join(", ")}`}>
                      {composicao.filter((c) => c.p > 0).map((c) => <i key={c.chave} className={`cp-${c.chave}`} style={{ "--p": c.p } as CSSProperties} />)}
                    </div>
                    <ul className="composicao-legenda" aria-hidden="true">
                      {composicao.map((c) => (
                        <li key={c.chave}><i className={`cp-${c.chave}`} /><span>{c.rotulo}</span><b>{pct(c.p, 1)}</b><small>{compacto(c.n)}</small></li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : <p>Sem dado de participação em {ano}.</p>}
              {uf && (
                <EscolhaMunicipio
                  opcoes={idsUf.map((id) => [id, nomeMun.get(id)!] as [number, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
                  atual={mun?.id_municipio}
                  params={Object.fromEntries(params({ mun: null }))}
                />
              )}
            </div>

            <div className="bloco noite s8">
              <h3>Abstenção, eleição a eleição</h3>
              <ol className="serie-anos" aria-label={`Abstenção de ${nomeUnidade} por ano`}>
                {serie.map((s) => (
                  <li key={s.ano}>
                    <Link scroll={false} href={href({ ano: s.ano })} className={`${s.ano === ano ? "on" : ""}${ANOS_CENSO.includes(s.ano) ? " censo" : ""}`} aria-label={`${s.ano}: ${pct(s.taxa)}`}>
                      <span className="serie-valor">{pct(s.taxa, 0)}</span>
                      <span className="serie-barra"><i style={{ "--v": maiorSerie ? s.taxa / maiorSerie : 0 } as CSSProperties} /></span>
                      <span className="serie-ano">{String(s.ano).slice(2)}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <p className="muted pequeno">Anos gerais: governador; municipais: prefeito. As barras marcadas são as eleições comparadas com um Censo: 2008 a 2012 com o de 2010, 2020 a 2024 com o de 2022.</p>
            </div>

            {/* embaixo da série, ao lado do cabeçalho (mais alto): a ficha do município, ou, no estado, a dispersão
                (ou os extremos, fora dos anos do Censo) */}
            {mun ? blocoFicha : uf ? (comCenso ? blocoDispersao : blocoExtremos) : null}

            {comCenso ? (
              <>
                <div className="bloco noite s4">
                  <h3>Censo {censoUsado}</h3>
                  <p className="muted pequeno">{mun ? `O município entre os ${universo.length} de ${NOME_UF[uf!]}; a média do estado é ponderada pela população` : uf ? `O estado (média ponderada pela população) entre os ${universo.length} municípios dele` : "Os seis estados juntos (média ponderada pela população) entre os municípios deles"}. Para pintar o mapa com um deles, escolha-o em Camadas › Comparar, no menu do mapa.</p>
                  {censo === 2022 && <p className="muted pequeno">IBGE: os equivalentes aos do Atlas de 2010, com diferenças (renda em reais de 2022, pobres até ¼ de salário mínimo, analfabetismo desde os 15 anos, desocupação desde os 14). IDHM, Gini e outros não saem por município.</p>}
                  <IndicadoresCenso
                    destaque={linhasCenso.find((l) => l.chave === ind)!} outros={linhasCenso.filter((l) => l.chave !== ind)}
                    legenda={{ unidade: nomeUnidade, media: refCenso?.rotulo }}
                  />
                </div>
              </>
            ) : (
              <div className="bloco noite censo-aviso s12">
                <h3>E os indicadores sociais?</h3>
                <p>Os indicadores do Censo (renda, escolaridade, pobreza) só são comparados com a eleição do ano de cada Censo e com as municipais em volta dela: 2008, 2010 e 2012 com o Censo 2010; 2020, 2022 e 2024 com o Censo 2022.</p>
                <div className="chips">{ANOS_CENSO.map((a) => <Link key={a} scroll={false} className="chip" href={href({ ano: a })}>Ver {a}</Link>)}</div>
              </div>
            )}

            {comCenso && (mun || !uf) && blocoDispersao}
            {comCenso && uf && !mun && blocoExtremos}

          </div>
          )}
          <MiniMapa recorte={recorte} foco={focoMini}>{mapaPalco}</MiniMapa>
          </>)}
        </section>
      )}

    </>
  );
}

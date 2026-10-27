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
import type { Listagem } from "@/lib/types";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF } from "@/lib/financiamento";
import {
  CARGOS, anosDe as anosDaLegenda, cicloDoAno, compararCiclos, cortesTom, faixaEventos, filtrar, hrefLegenda, resumoCiclos, resumoSerie, serie as serieLegenda, sugestoes,
  type CargoCiclo, type EventoPartido, type LinhaLegenda,
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
import { compacto, pct } from "@/lib/format";
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
import { abrangencia, candidaturasDe, noMapaEstatico, sugestoesDe, turnosDe, type CandidaturaMapa, type VotoMunicipio } from "@/lib/candidato-mapa";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ANO_SUGESTOES = 2022;   // última eleição geral: as sugestões da visão Candidato são os governadores eleitos nela
const ROTULO_CARGO: Record<CargoCiclo, string> = { ambos: "Os dois", federal: "Federal", estadual: "Estadual" };

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [q5, dados] = await Promise.all([lerAnalise("q5", ["legenda", "eventos"]), lerEstatico("mapa")]);
  const legenda = comoObjetos<LinhaLegenda>(q5?.legenda);
  const eventosLeg = comoObjetos<EventoPartido>(q5?.eventos);
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
  const ver: Visao = naCandidato ? "candidato" : pediuLegenda && anoLeg !== undefined ? "legenda" : "abstencao";
  const naLegenda = ver === "legenda";
  const cargo = CARGOS.find((c) => c === um(sp.cargo)) ?? "ambos";
  const partido = legenda.some((l) => l.partido === um(sp.p)) ? um(sp.p) : undefined;

  const mun = uf && !naLegenda ? municipios.find((m) => m.uf === uf && String(m.id_municipio) === um(sp.mun)) : undefined;
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

  type Estado = { ver?: Visao; ano?: number; uf?: string | null; mun?: number | null; ind?: string; cor?: string | null; p?: string | null; cargo?: CargoCiclo };
  const params = (nova: Estado) => {
    const n = { ver: ver === "candidato" ? "abstencao" : ver, ano: naLegenda ? anoLeg! : ano, uf, mun: mun?.id_municipio, ind: indPedido, cor: pediuCruzar && !naLegenda ? "cruzar" : null, p: partido, cargo, ...nova };
    if (nova.uf !== undefined && nova.mun === undefined) n.mun = null;   // trocar de estado solta o município
    const leg = n.ver === "legenda";
    const p = new URLSearchParams();
    if (leg) p.set("ver", "legenda");
    if (n.ano !== (leg ? anoPadraoLeg : anoPadrao)) p.set("ano", String(n.ano));
    if (n.uf) p.set("uf", n.uf);
    if (leg) {
      if (n.p) p.set("p", n.p);
      if (n.cargo !== "ambos") p.set("cargo", n.cargo);
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
  const caixa = uf && !naLegenda ? CAIXA_UF[uf] : undefined;   // na legenda, o mapa fica nos seis estados
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
  const linhasLeg = doCargo(legenda, cargo);
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
  const hrefAnalise = `/analises/legenda${(() => { const q = new URLSearchParams(); if (uf) q.set("uf", uf); if (partido) q.set("p", partido); const t = q.toString(); return t ? `?${t}` : ""; })()}`;
  // trocar de visão mantém o estado; o ano vai para o mais perto que a outra visão tem
  const hrefAbst = naLegenda ? href({ ver: "abstencao", ano: anos.includes(anoLeg!) ? anoLeg : ano }) : href({});
  const hrefLeg = naLegenda ? href({}) : href({ ver: "legenda", ano: anoNaLegenda(ano, anosLeg) ?? ano });

  // a análise de voto de legenda (pergunta 5) no relatório embaixo do mapa: série por partido e comparação de ciclos,
  // no estado e no partido escolhidos no mapa
  const linhasSerie = filtrar(legenda, { uf });
  const escolhidosSerie = partido ? [partido] : sugestoes(linhasSerie, [], 3);
  const seriesLeg = serieLegenda(linhasSerie, escolhidosSerie);
  const resumoLeg = resumoSerie(seriesLeg);
  const cortesSerie = Object.fromEntries(escolhidosSerie.map((p) => [p, cortesTom(p, eventosLeg, false)]));
  const comparacaoLeg = anoLeg === undefined ? null : compararCiclos(linhasSerie, { ciclo: cicloDoAno(anoLeg), cargo, ordem: "soma" });
  const hrefTodosCiclos = hrefLegenda({ uf, juntar: false, p: escolhidosSerie, ciclo: anoLeg === undefined ? "geral" : cicloDoAno(anoLeg), cargo, ordem: "soma", todos: true });

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
  // sem candidato, o estado clicado no mapa dá zoom nele e filtra a busca e as sugestões do menu (?uf=)
  const ufBusca = naCandidato && !campanha ? uf : undefined;
  const ufCand = alcanceCand === "uf" || alcanceCand === "municipio" ? campanha!.uf : alcanceCand === "seis" ? uf : ufBusca;
  const munCand = ufCand ? votosCand.find((v) => v.uf === ufCand && String(v.id_municipio) === um(sp.mun))?.id_municipio : undefined;
  // sugestões sem candidato escolhido: governadores eleitos na última eleição geral (id_cargo 3); com um estado,
  // os mais votados entre os eleitos dele nessa eleição (governador, senador e deputados)
  const sugestoesCand = naCandidato && !campanha
    ? sugestoesDe((await apiGetOpcional<Listagem>(ufBusca
      ? `/candidaturas?uf=${ufBusca}&ano=${ANO_SUGESTOES}&eleito=true&tamanho=6`
      : `/candidaturas?cargo=3&ano=${ANO_SUGESTOES}&eleito=true&tamanho=6`))?.itens ?? [], 6) : [];

  const hrefCand = "/?ver=candidato#mapa";   // como as camadas: <a data-mapa>, que o MapaVivo navega sem recarregar

  // submenu do mapa: abas Candidato e Camadas; a abstenção é o mapa base, e as camadas vêm por cima dela
  const anoBase = naLegenda && anos.includes(anoLeg!) ? anoLeg! : ano;   // o ano da abstenção ao sair da legenda
  const comparativo = situacaoComparativo({ ano: anoBase, anosPorCenso: ANOS_POR_CENSO, uf });
  const censoBase = censoDoAno(anoBase) ?? 2010;
  const indBase = indicadorNoCenso(indPedido, censoBase);
  const comparativoLigado = !naLegenda && pediuCruzar;
  const camadas = (
    <CamadasMapa
      modo={naLegenda ? "legenda" : comparativoLigado ? "comparar" : "abstencao"}
      hrefs={{
        abstencao: href({ ver: "abstencao", ano: anoBase, cor: null }),
        legenda: hrefLeg,
        comparar: href({ ver: "abstencao", ano: anoBase, cor: "cruzar" }),
      }}
      legenda={{
        anos: anosLeg.length ? `${anosLeg[0]} a ${anosLeg[anosLeg.length - 1]}` : "sem dados",
        cargos: naLegenda && geral ? CARGOS.map((c) => ({ rotulo: ROTULO_CARGO[c], href: href({ cargo: c }), on: c === cargo })) : [],
        partido: naLegenda ? { opcoes: opcoesPartido, atual: partido, params: Object.fromEntries(params({ p: null })) } : undefined,
      }}
      comparativos={{
        disponivel: comparativo.disponivel, motivo: comparativo.motivo,
        censo: censoDoAno(anoBase),
        itens: indicadoresDoCenso(censoBase).map((i) => {
          const on = comparativoLigado && i.chave === indBase;
          return { chave: i.chave, rotulo: i.rotulo, on, href: href({ ver: "abstencao", ano: anoBase, ind: i.chave, cor: "cruzar" }) };
        }),
        anos: ANOS_CENSO.map((a) => ({ ano: a, href: href({ ver: "abstencao", ano: a }) })),
      }}
    />
  );
  const submenu = (
    <SubmenuMapa
      resumo={ufBusca ? `Busca só em ${NOME_UF[ufBusca]}` : resumoCamadas({ ver, partido, comparativo: comparativoLigado ? infoInd.rotulo : undefined })}
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
          {sugestoesCand.length > 0 && (
            <>
              <p className="rotulo">{ufBusca ? `Ou comece pelos eleitos mais votados de ${ufBusca} em ${ANO_SUGESTOES}` : `Ou comece por um dos governadores eleitos em ${sugestoesCand[0].ultimo_ano}`}</p>
              {/* outra chave a cada estado: a lista entra de novo */}
              <ul className="sugestoes-cand" key={ufBusca ?? "seis"}>
                {sugestoesCand.map((s, i) => (
                  <li key={s.id_candidato} style={{ "--i": i } as CSSProperties}><a href={`/?ver=candidato&cand=${s.id_candidato}#mapa`} data-mapa="">{nomeProprio(s.nome_urna ?? "")}<small>{s.ultimo_cargo} · {s.uf}</small></a></li>
                ))}
              </ul>
            </>
          )}
          {ufBusca && !sugestoesCand.length && <p className="rotulo">Busque pelo nome de quem disputou em {NOME_UF[ufBusca]}.</p>}
        </div>
      ) : camadas}
    </SubmenuMapa>
  );

  // o mapa do palco, repetido pequeno no mini-mapa que acompanha a rolagem
  const mapaPalco = naLegenda ? (
    <MapaAbstencao
      titulo={`Voto de legenda${partido ? ` do partido ${partido}` : ""} em ${anoLeg} nos seis estados`}
      camera={camera} estados={estadosLeg} uf={uf} zoom={false} municipios={[]}
    />
  ) : (
    <MapaAbstencao
      titulo={uf ? `Municípios de ${NOME_UF[uf]}: abstenção em ${ano}` : `Abstenção em ${ano} nos seis estados`}
      camera={camera} estados={estados} uf={uf} municipios={noMapa}
      destaque={mun && centro ? { ibge: mun.cod_ibge, nome: nomeMun.get(mun.id_municipio)!, x: centro[0], y: centro[1] } : undefined}
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
  const recorte = `${resumoCamadas({ ver, partido, comparativo: comparativoLigado ? infoInd.rotulo : undefined })} · ${naLegenda ? (uf ?? "seis estados") : mun ? nomeMun.get(mun.id_municipio) : uf ?? "seis estados"} · ${naLegenda ? anoLeg : ano}`;

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
          <MapaVivo className="palco s12" estado={naLegenda ? undefined : uf}>
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
              {!uf && <p className="palco-dica" aria-hidden="true">{naLegenda ? "Clique num estado para ver os números dele" : "Clique num estado para ver os municípios"}</p>}
            </div>

            <div className="palco-base">
              {naLegenda ? (
                <ul className="legenda-q" aria-label={partido ? `Cores: faixas iguais da parte dos votos de legenda que foi para o partido ${partido}` : "Cores: faixas iguais da parte dos votos dada só à legenda"}>
                  {legendaLeg.map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
                  {algumSem && <li className="legenda-sem"><i className="sem" />sem votos</li>}
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
          <div className="painel s12" key={`legenda-${uf}-${anoLeg}-${cargo}-${partido}`}>
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
              <p className="muted pequeno">{partido ? `A linha é o ${partido}` : `As linhas são os três partidos com mais votos de legenda${uf ? ` em ${NOME_UF[uf]}` : ""}`}; a área, todos os partidos. Proporção = votos de legenda ÷ (legenda + nominais), deputados e vereadores juntos; faixas = eleições municipais.</p>
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
          ) : (
          <div className="painel s12" key={`${uf}-${mun?.id_municipio}-${ano}-${ind}`}>
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

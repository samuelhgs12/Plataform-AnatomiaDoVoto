import type { ReactNode } from "react";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import {
  abaDe, ANOS_DINHEIRO, anoAnterior, cidadesDoPorte, classeComPorte, coberturaCurta, composicaoDespesas, contaGasto, contaGastoEstado, contasDaCidade, contasDoEstado, contasDoPorte, corCidade, corTerco,
  coberturaSelo, diferencaRelativa, ehMunicipal, fatias, larguraSelo, seloValor, seta, escolhaMapaDinheiro, foraDaDisputa, foraDaDisputaPorte, hrefMapaDinheiro, legendaCidade, legendaPorFaixas, ordemCandidatos, ordenarCandidatos,
  ORDENS_CANDIDATOS, ordenarLinhas, origemDoDinheiro, PINTAR, referenciaDoPorte, TERCOS, textoValor, unidade, valorCidade, valorDoEstado, valorDoPorte, variacaoNominal,
  anosDoCargo, COR_FAIXA, medidasNosAnos, partidosDeCandidatos, partidosDoRecorte, quartisDeCandidatos, quartisDoRecorte, totalPartidos,
  type Aba, type LinhaDespesa, type LinhaPartido, type LinhaQuartil, type RecorteTabela,
} from "@/lib/dinheiro";
import { METODOLOGIA } from "@/lib/metodologia";
import { naRegua, type FichaDica } from "@/lib/dica";
import { NOME_UF } from "@/lib/financiamento";
import { brlCentavos, compacto, inteiro, pct, reais } from "@/lib/format";
import { centrarLupa, TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AnosDoCargo } from "./AnosDoCargo";
import { BarraEmpilhada } from "./BarraEmpilhada";
import { BarrasH } from "./BarrasH";
import { ComparacoesDinheiro } from "./ComparacoesDinheiro";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { LinhasCandidatos, type LinhaCandidato } from "./LinhasCandidatos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { MiniMapa } from "./MiniMapa";
import { PartidosGasto } from "./PartidosGasto";
import { QuartisDoGasto } from "./QuartisDoGasto";
import { Rolar } from "./Rolar";

type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
/** Candidatos de cada grupo à vista; o resto fica em "Ver todos" (até MAX_LISTA não eleitos). */
const INICIO_LISTA = 8;
const MAX_LISTA = 40;

/**
 * Camada Dinheiro do mapa da página inicial (perguntas 1, 2 e 8), com tudo o que a área de dinheiro mostra. O mapa pinta
 * a medida escolhida (`pintar`: gasto por vaga, gasto por eleitor apto ou parte pública do dinheiro recebido) nos
 * estados (três faixas) e, nas eleições municipais, nas cidades do estado aberto (faixas fixas, iguais em todos os
 * estados), com o porte escolhido em destaque. Embaixo, o painel do lugar: o número com a conta, a cobertura das
 * prestações de contas, a referência das cidades de porte parecido e a eleição anterior; as cidades do estado (as de
 * maior valor e a tabela de todas); os candidatos da cidade (ou os eleitos do estado, nas gerais), em qualquer ordem;
 * onde o dinheiro foi gasto (grupos de categoria do TSE); e as comparações (ComparacoesDinheiro). A aba Propaganda
 * (pergunta 9) fica em /analises/dinheiro. Lê as análises `municipios` e `dinheiro` e os candidatos da API; as contas
 * são de src/lib/dinheiro.ts.
 */
export async function VisaoDinheiro({ menu, sp }: { menu: ReactNode; sp: SP }) {
  const { ano, cargo, porte, pintar, medir } = escolhaMapaDinheiro(sp);
  const aba: Aba = abaDe(pintar);
  const pintarInfo = PINTAR.find((p) => p.chave === pintar)!;
  const ord = ordemCandidatos(um(sp.ord));
  const porteInfo = porte ? PORTES.find((p) => p.chave === porte) : undefined;
  const municipal = ehMunicipal(ano);
  const [dados, dadosDespesas, dadosPerguntas] = await Promise.all([
    lerAnalise("municipios", ["municipios", "resumo", "estados"]), lerAnalise("dinheiro", ["despesas"]), lerAnalise("dinheiro", ["partidos", "quartis"]),
  ]);
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
  const despesas = dadosDespesas?.despesas ? comoObjetos<LinhaDespesa>(dadosDespesas.despesas) : null;
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === um(sp.uf));
  // a cidade vem pelo código do IBGE, que é o mesmo no mapa e na API (o id_municipio muda a cada carga do banco)
  const mun = municipal && uf ? municipios.find((m) => m.uf === uf && m.cod_ibge === um(sp.mun)) : undefined;
  const codDe = new Map(municipios.map((m) => [m.id_municipio, m.cod_ibge]));
  const href = (novo: Parameters<typeof hrefMapaDinheiro>[1], ancora?: string) => hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.cod_ibge, porte, pintar, medir, ord }, novo, ancora);
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Os seis estados";
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;
  const cargoMin = cargo.toLowerCase();
  const antes = anoAnterior(ano);

  // estados: a medida escolhida em três faixas (terços dos seis; com um porte, só as cidades dele); a dica mostra o valor na régua
  const valorUf = (u: string | undefined, a: Aba = aba, emAno = ano) => (porte ? valorDoPorte(resumo, emAno, u, porte, a, cargo).valor : valorDoEstado(estados, emAno, u, a, cargo));
  const contaUf = (u?: string) => (porte ? valorDoPorte(resumo, ano, u, porte, "gasto", cargo).conta : contaGastoEstado(estados, ano, u, cargo));
  const valoresUf = ufs.map((u) => valorUf(u));
  const conhecidos = valoresUf.flatMap((v) => v ?? []);
  const faixasUf = quantis(conhecidos, 3);
  const [minUf, maxUf] = [Math.min(...conhecidos), Math.max(...conhecidos)];
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => {
    const v = valoresUf[i];
    const ficha: FichaDica = { titulo: NOME_UF[u] ?? u, sub: `${cargo} · ${ano}${porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}`, medidas: v === null ? [] : [{ rotulo: pintarInfo.rotulo, valor: textoValor(v, aba, cargo), cores: TERCOS, p: naRegua(v, faixasUf, minUf, maxUf) }] };
    // o selo do estado é curto e sem "R$" (a unidade está no título e na legenda): "222 mil", "14", "62%"; a pílula cresce com ele
    const selo = seloValor(v, aba);
    return {
      uf: u, classe: corTerco(v, faixasUf), href: href({ uf: u === uf ? null : u }), sigla: u, valor: selo, largura: larguraSelo(selo),
      descricao: `${NOME_UF[u] ?? u}: ${textoValor(v, aba, cargo)} ${unidade(aba, cargo)} em ${ano}`, ficha,
    };
  });
  // cidades do estado aberto (só nas municipais): faixas fixas, iguais em todos os estados; fora do porte, apagadas
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !municipal || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const linha = doAno.get(m.id_municipio);
    const v = valorCidade(linha, aba, cargo);
    return {
      ibge: m.cod_ibge, classe: classeComPorte(corCidade(v, aba, cargo), porteDe(linha?.eleitorado)?.chave, porte), href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.cod_ibge }),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, aba, cargo)}${v === null ? "" : aba === "gasto" ? (cargo === "Prefeito" ? " gastos na disputa" : " por vaga") : aba === "eleitor" ? " por eleitor" : " público"}`,
      atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100,
    };
  });
  const legenda = uf && municipal ? legendaCidade(aba, cargo) : legendaPorFaixas(faixasUf, (v) => seloValor(v, aba), TERCOS);
  // com um estado aberto, o cartão do lugar fica na faixa da direita do mapa: o enquadramento ganha essa faixa vazia,
  // e o estado vai para a esquerda, sem ficar embaixo do cartão
  const quadro: [number, number, number, number] | undefined = caixa ? [caixa[0], caixa[1], caixa[2] + (caixa[2] - caixa[0]) * 0.8, caixa[3]] : undefined;
  const camera = enquadrar(quadro ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const mapaPalco = (
    <MapaAbstencao
      titulo={`${pintarInfo.rotulo} de ${cargoMin}: ${lugar}, ${ano}`} camera={camera} estados={noMapaUf} uf={uf} municipios={noMapaMun}
      destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined}
    />
  );
  const focoMini = mun && centro && caixa ? centrarLupa({ x: camera.x + centro[0] * camera.k, y: camera.y + centro[1] * camera.k }, 3) : undefined;

  // o número do lugar na medida escolhida, as outras duas medidas, a conta do gasto por vaga e o de cima para comparar
  const valorLugar = (a: Aba, emAno = ano) => (mun ? valorCidade(resumo.find((x) => x.ano === emAno && x.id_municipio === mun.id_municipio), a, cargo) : valorUf(uf, a, emAno));
  const principal = valorLugar(aba);
  const outras = PINTAR.filter((p) => p.chave !== pintar).map((p) => ({ ...p, valor: valorLugar(p.aba) })).filter((p) => p.valor !== null);
  const conta = mun ? contaGasto(linhaMun, cargo) : contaUf(uf);
  const cima = mun ? valorUf(uf) : uf ? valorUf(undefined) : null;
  // a leitura do número: a cobertura das prestações de contas, a referência das cidades de porte parecido e a eleição anterior
  const contas = mun ? contasDaCidade(linhaMun, cargo) : porte ? contasDoPorte(resumo, ano, uf, porte, cargo) : contasDoEstado(estados, ano, uf, cargo);
  const coberturaLinha = coberturaCurta(contas);
  const porteCidade = porteDe(linhaMun?.eleitorado);
  const referencia = mun && porteCidade ? referenciaDoPorte(resumo, ano, porteCidade.chave, aba, cargo) : null;
  const difReferencia = referencia ? diferencaRelativa(principal, referencia.valor) : null;
  const origem = origemDoDinheiro({ resumo, estados }, { ano, cargo, uf, mun: linhaMun, porte: mun ? undefined : porte });
  const valorAntes = antes !== null ? valorLugar(aba, antes) : null;
  const variacao = variacaoNominal(principal, valorAntes);
  // com um porte, o aviso conta só as cidades dele (o mesmo recorte do número)
  const fora = mun || aba !== "gasto" ? null : porte ? foraDaDisputaPorte(resumo, ano, uf, porte, cargo) : foraDaDisputa(estados, ano, uf, cargo);

  // candidatos: os da cidade (eleições municipais) ou os eleitos do estado (gerais), na ordem escolhida
  const [candidatos, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    !municipal && uf ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${ano}`) : Promise.resolve(null),
  ]);
  const disputa = cargo === "Prefeito" && candidatos ? disputaPrefeito(candidatos) : null;
  const linhas: LinhaCandidato[] = disputa ? disputa.candidatos : candidatos ?? (eleitosUf ?? []).filter((e) => e.cargo === cargo).map((e) => ({ ...e, eleito: true }));
  const eleitos = ordenarCandidatos(linhas.filter((c) => c.eleito), ord);
  const naoEleitos = ordenarCandidatos(linhas.filter((c) => !c.eleito), ord);
  const maisGastou = disputa?.candidatos.find((c) => c.maisGastou);
  const eleitoPrefeito = disputa?.candidatos.find((c) => c.eleito);
  const temCandidatos = !!mun || (!municipal && !!uf);
  const ordInfo = ORDENS_CANDIDATOS.find((o) => o.chave === ord)!;

  // as perguntas do painel: quanto cada partido gastou, quanto custou um voto e como o gasto se divide entre os candidatos
  // (quartis), no mesmo recorte do número. Numa cidade, da lista de candidatos dela; fora, das tabelas da análise dinheiro.
  const linhasPartido = dadosPerguntas?.partidos ? comoObjetos<LinhaPartido>(dadosPerguntas.partidos) : null;
  const linhasQuartil = dadosPerguntas?.quartis ? comoObjetos<LinhaQuartil>(dadosPerguntas.quartis) : null;
  const recorteTab = (a: number): RecorteTabela => ({ ano: a, cargo, uf, porte: mun ? undefined : porte });
  const anosCargo = anosDoCargo(cargo);
  const candsAnos = mun ? await Promise.all(anosCargo.map((a) => (a === ano ? Promise.resolve(candidatos)
    : apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${a}&cargo=${encodeURIComponent(cargo)}`)))) : null;
  const partidosEm = (a: number, cands: CandidatoLocal[] | null | undefined) => (mun ? (cands ? partidosDeCandidatos(cands) : null) : linhasPartido ? partidosDoRecorte(linhasPartido, recorteTab(a)) : null);
  const quartisEm = (a: number, cands: CandidatoLocal[] | null | undefined) => (mun ? (cands && cargo !== "Prefeito" ? quartisDeCandidatos(cands) : null) : linhasQuartil ? quartisDoRecorte(linhasQuartil, recorteTab(a)) : null);
  const partidos = partidosEm(ano, candidatos) ?? [];
  const totalVoto = partidos.length ? totalPartidos(partidos) : null;
  const quartis = quartisEm(ano, candidatos);
  // o mesmo cargo nas eleições com dados de dinheiro (vereador: 2020 e 2024), no mesmo lugar
  const porAno = anosCargo.map((a, i) => {
    const ps = partidosEm(a, candsAnos?.[i]);
    return { total: ps?.length ? totalPartidos(ps) : null, quartis: quartisEm(a, candsAnos?.[i]), vaga: valorLugar("gasto", a), eleitor: valorLugar("eleitor", a), publico: valorLugar("publico", a) };
  });
  const medidasAnos = anosCargo.length < 2 ? [] : medidasNosAnos([
    { chave: "gasto", rotulo: "Gasto total", valores: porAno.map((x) => x.total?.gasto ?? null), fmt: reais },
    ...(cargo === "Prefeito" && mun ? [] : [{ chave: "vaga", rotulo: "Gasto por vaga", valores: porAno.map((x) => x.vaga), fmt: reais }]),
    { chave: "voto", rotulo: "Cada voto", valores: porAno.map((x) => x.total?.porVoto ?? null), fmt: brlCentavos },
    { chave: "eleitor", rotulo: "Por eleitor apto", valores: porAno.map((x) => x.eleitor), fmt: brlCentavos },
    { chave: "publico", rotulo: "Parte pública do dinheiro", valores: porAno.map((x) => x.publico), fmt: (v: number) => pct(v, 0), pontos: true },
    { chave: "topo", rotulo: "Fatia dos 25% que mais gastaram", valores: porAno.map((x) => x.quartis?.concentracao ?? null), fmt: (v: number) => pct(v, 0), pontos: true },
    { chave: "cand", rotulo: "Candidatos", valores: porAno.map((x) => x.total?.candidatos ?? null), fmt: inteiro },
  ]);
  const votoAntes = antes !== null ? porAno[anosCargo.indexOf(antes)]?.total?.porVoto ?? null : null;
  const variacaoVoto = totalVoto ? variacaoNominal(totalVoto.porVoto, votoAntes) : null;

  // onde o dinheiro foi gasto: os grupos de categoria do TSE no recorte (cidade, estado ou os seis)
  // com um porte (e sem cidade escolhida), só as despesas das cidades dele: o mesmo universo das receitas ao lado
  const grupos = despesas ? composicaoDespesas(despesas, { ano, cargo, uf, mun: mun?.id_municipio, muns: !mun && porte ? cidadesDoPorte(resumo, ano, uf, porte) : undefined }) : [];
  const totalGrupos = grupos.reduce((a, g) => a + g.valor, 0);

  // sem candidatos à vista: os estados lado a lado (ou, com um estado aberto, as cidades de maior valor)
  const estadosLista = ordenarLinhas(ufs.map((u, i) => ({ id: u, nome: NOME_UF[u] ?? u, valor: valoresUf[i], conta: contaUf(u) })), "valor");
  const estadosConhecidos = estadosLista.filter((e) => e.valor !== null);
  const cidadesUf = municipal && uf
    ? ordenarLinhas(municipios.filter((m) => m.uf === uf && (!porte || porteDe(doAno.get(m.id_municipio)?.eleitorado)?.chave === porte || m.id_municipio === mun?.id_municipio)).map((m) => {
      const linha = doAno.get(m.id_municipio);
      return {
        id: m.id_municipio, nome: nomeMun.get(m.id_municipio)!, valor: valorCidade(linha, aba, cargo), conta: contaGasto(linha, cargo), porte: porteDe(linha?.eleitorado)?.rotulo,
        vaga: valorCidade(linha, "gasto", cargo), eleitor: valorCidade(linha, "eleitor", cargo), publico: valorCidade(linha, "publico", cargo), contas: contasDaCidade(linha, cargo),
      };
    }), "valor")
    : [];
  const posMun = mun ? cidadesUf.findIndex((c) => c.id === mun.id_municipio) : -1;
  const cidadesTopo = posMun >= 8 ? [...cidadesUf.slice(0, 7), cidadesUf[posMun]] : cidadesUf.slice(0, 8);
  // cartão do lugar escolhido, por cima do mapa: o número, a posição e o atalho para a seção dele embaixo
  const posUf = uf ? estadosLista.findIndex((e) => e.id === uf) : -1;
  const unidadeCurta = aba === "gasto" ? (cargo === "Prefeito" && mun ? "gastos por todas as campanhas a prefeito" : `por vaga de ${cargoMin}`) : aba === "eleitor" ? "por eleitor apto" : "do dinheiro recebido veio de fundos públicos";
  const semContas = contas && contas.com < contas.total ? `${inteiro(contas.total - contas.com)} de ${inteiro(contas.total)} candidaturas sem prestação final: total incompleto` : null;
  const seloContas = coberturaSelo(contas);
  // leitura de relance: a origem e o destino do dinheiro em barras 100%, com os grupos menores juntos em "Outros"
  const fatiasOrigem = !origem ? [] : fatias("naoPublico" in origem
    ? [{ chave: "pub", rotulo: "Público", valor: origem.publico, cor: "pub" }, { chave: "np", rotulo: "Não público", valor: origem.naoPublico, cor: "fx3" }]
    : [{ chave: "pub", rotulo: "Público", valor: origem.publico, cor: "pub" }, { chave: "priv", rotulo: "Privado", valor: origem.privado, cor: "priv" }, { chave: "nc", rotulo: "Sem fonte", valor: origem.naoClassificado, cor: "o" }], { fixo: true });
  const fatiasDestino = fatias(grupos.map((g) => ({ chave: g.grupo, rotulo: g.rotulo, valor: g.valor })), { max: 5 });
  const rotuloPrincipal = aba === "gasto" && cargo === "Prefeito" && mun ? "Gasto na disputa" : pintarInfo.rotulo;
  const subPrincipal = aba === "gasto" && conta && !(cargo === "Prefeito" && mun) ? `${reais(conta.gasto)} ÷ ${inteiro(conta.vagas)} ${conta.vagas === 1 ? "vaga" : "vagas"}`
    : aba === "gasto" ? "todas as campanhas a prefeito" : aba === "eleitor" ? "gasto ÷ eleitores aptos" : "do dinheiro recebido";
  const tituloRanking = aba === "gasto" ? (cargo === "Prefeito" && cidadesTopo.length ? "Onde a disputa custou mais" : "Onde se gastou mais por vaga")
    : aba === "eleitor" ? "Onde se gastou mais por eleitor" : "Onde o dinheiro público pesa mais";
  const cartao = mun ? {
    rotulo: `Município · ${uf} · ${cargo}`, nome: lugar,
    valor: textoValor(principal, aba, cargo), unidade: unidadeCurta,
    posicao: posMun >= 0 ? `${posMun + 1}ª de ${inteiro(cidadesUf.length)} cidades` : null,
    extra: eleitoPrefeito ? `Eleito: ${eleitoPrefeito.nome_urna} (${eleitoPrefeito.partido}), ${eleitoPrefeito.prestou === false ? "sem prestação de contas final" : `gastou ${reais(eleitoPrefeito.gasto)}`}`
      : candidatos ? `${inteiro(linhas.length)} candidatos, ${inteiro(eleitos.length)} eleitos` : null,
    ir: { href: "#dinheiro-cand", texto: "Ver os candidatos ↓" },
  } : uf ? {
    rotulo: `Estado · ${cargo}${porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}`, nome: lugar,
    valor: textoValor(principal, aba, cargo), unidade: unidadeCurta,
    posicao: posUf >= 0 ? `${posUf + 1}º de ${ufs.length} estados` : null,
    extra: null,
    ir: municipal ? { href: "#dinheiro-painel", texto: "Detalhes ↓" } : { href: "#dinheiro-cand", texto: `${inteiro(eleitos.length)} eleitos ↓` },
  } : null;
  const propaganda = `/analises/dinheiro?${new URLSearchParams(Object.entries({ ano: String(ano), cargo, uf: uf ?? "", aba: "propaganda" }).filter(([, v]) => v))}`;
  const paramsMun = Object.fromEntries(new URL(href({ mun: null }), "http://x").searchParams);

  return (
    <>
      <MapaVivo className="palco s12 palco-dinheiro" estado={uf}>
        {menu}
        <div className="palco-topo">
          <div>
            <h1 id="h-mapa">{pintarInfo.titulo} em {ano}</h1>
            <p className="palco-sobre">{cargo}{porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}</p>
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
          <p className="carregando-mapa" aria-hidden="true">Carregando…</p>
          {cartao && (
            <aside className="cartao-lugar" aria-label={`Resumo: ${cartao.nome}`}>
              <a className="cartao-fechar" href={href(mun ? { mun: null } : { uf: null })} data-mapa="" aria-label={mun ? "Voltar ao estado" : "Voltar aos seis estados"}>×</a>
              <p className="cartao-rotulo">{cartao.rotulo} · {ano}</p>
              <h2>{cartao.nome}</h2>
              <p className="cartao-valor"><b>{cartao.valor}</b> {cartao.unidade}</p>
              <p className="cartao-selos">
                {cartao.posicao && <span>{cartao.posicao}</span>}
                {semContas && <span className="cartao-aviso" title={semContas}>Contas incompletas</span>}
              </p>
              {cartao.extra && <p className="cartao-linha">{cartao.extra}</p>}
              <a className="cartao-ir" href={cartao.ir.href}>{cartao.ir.texto}</a>
            </aside>
          )}
        </div>

        <div className="palco-base">
          <div className="legenda-dinheiro">
            <p className="legenda-titulo">
              {pintarInfo.rotulo}{aba === "publico" ? "" : " (R$)"}
              <span title={uf && municipal ? "As mesmas faixas em todos os estados e anos." : "Os seis estados em três faixas, recalculadas a cada ano e cargo. Para comparar anos, use os números."}>
                {uf && municipal ? "faixas fixas" : "3 faixas entre os estados"}
              </span>
            </p>
            <ul className="legenda-q" aria-label={uf && municipal ? `Cores: faixas fixas de ${pintarInfo.rotulo.toLowerCase()}` : `Cores: três faixas dos estados por ${pintarInfo.rotulo.toLowerCase()}, relativas ao ano e ao cargo`}>
              {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
            </ul>
          </div>
          <div className="anos" role="group" aria-label="Ano da eleição">
            {ANOS_DINHEIRO.map((a) => (
              <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                {a}<small>{ehMunicipal(a) ? "Municipal" : "Geral"}</small>
              </Link>
            ))}
          </div>
        </div>
      </MapaVivo>

      <div id="dinheiro-painel" className="painel s12 din" key={`dinheiro-${uf}-${mun?.id_municipio}-${ano}-${cargo}-${pintar}`}>
        {/* cabeçalho: onde estamos, a troca de cidade e os atalhos das seções (quanto → origem e destino → quem → comparar) */}
        <header className="din-cab s12">
          <div>
            <p className="din-kicker">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}{!mun && porteInfo ? ` · ${porteInfo.rotulo}` : ""}</p>
            <h2>{lugar}</h2>
          </div>
          {municipal && uf && (
            <EscolhaMunicipio
              opcoes={municipios.filter((m) => m.uf === uf).map((m) => [m.cod_ibge, nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
              atual={mun?.cod_ibge} params={paramsMun}
            />
          )}
        </header>
        <nav className="painel-nav s12" aria-label="Seções do painel">
          <a href="#dinheiro-painel">Resumo</a>
          {partidos.length > 0 && <a href="#dinheiro-partidos">Partidos</a>}
          {totalVoto?.porVoto != null && <a href="#dinheiro-voto">Custo do voto</a>}
          {(fatiasOrigem.length > 0 || fatiasDestino.length > 0) && <a href="#dinheiro-origem">Origem e destino</a>}
          {quartis && <a href="#dinheiro-quartis">Quartis</a>}
          {medidasAnos.length > 0 && <a href="#dinheiro-anos">{anosCargo.join(" × ")}</a>}
          <a href="#dinheiro-ranking">{cidadesTopo.length ? "Cidades" : "Estados"}</a>
          {temCandidatos && <a href="#dinheiro-cand">{mun ? "Candidatos" : "Eleitos"}</a>}
          <a href="#comparar">Dinheiro e voto</a>
          <a href="#dinheiro-metodo">Método</a>
        </nav>

        {/* os números do lugar, para ler de relance: o principal grande e, ao lado, as outras medidas e as comparações */}
        <section className="din-kpis s12" aria-label={`${lugar} em números`}>
          <div className="din-kpi din-kpi-principal">
            <small>{rotuloPrincipal}</small>
            <b><Rolar valor={textoValor(principal, aba, cargo)} /></b>
            <span>{subPrincipal}</span>
          </div>
          {outras.map((o) => (
            <a key={o.chave} className="din-kpi din-kpi-link" href={href({ pintar: o.chave }, "dinheiro-painel")} data-mapa="" title={`Pintar o mapa por ${o.rotulo.toLowerCase()}`}>
              <small>{o.rotulo}</small>
              <b>{textoValor(o.valor, o.aba, cargo)}</b>
              <span>Pintar o mapa →</span>
            </a>
          ))}
          {antes !== null && valorAntes !== null && (
            aba !== "publico" && seta(variacao) ? (
              <div className="din-kpi">
                <small>Desde {antes}</small>
                <b className={`delta${variacao! > 0 ? " sobe" : variacao! < 0 ? " desce" : ""}`}>{seta(variacao)}</b>
                <span>era {textoValor(valorAntes, aba, cargo)} · sem inflação</span>
              </div>
            ) : (
              <div className="din-kpi"><small>Em {antes}</small><b>{textoValor(valorAntes, aba, cargo)}</b><span>mesma medida</span></div>
            )
          )}
          {referencia && referencia.valor !== null && seta(difReferencia) ? (
            <div className="din-kpi" title={`Mediana de ${inteiro(referencia.n)} cidades de ${porteCidade!.rotulo}`}>
              <small>Vs. cidades do mesmo porte</small>
              <b className={`delta${difReferencia! > 0 ? " sobe" : difReferencia! < 0 ? " desce" : ""}`}>{seta(difReferencia)}</b>
              <span>mediana {textoValor(referencia.valor, aba, cargo)}</span>
            </div>
          ) : cima === null ? (estadosConhecidos.length > 1 && (
            <div className="din-kpi">
              <small>Maior e menor</small>
              <b>{estadosConhecidos[0].nome}</b>
              <span>{textoValor(estadosConhecidos[0].valor, aba, cargo)} · {estadosConhecidos.at(-1)!.nome}: {textoValor(estadosConhecidos.at(-1)!.valor, aba, cargo)}</span>
            </div>
          )) : (
            <div className="din-kpi">
              <small>{mun ? NOME_UF[uf!] : "Seis estados"}</small>
              <b>{textoValor(cima, aba, cargo)}</b>
              <span>{posUf >= 0 && !mun ? `${lugar} é o ${posUf + 1}º de ${ufs.length}` : "mesma medida"}</span>
            </div>
          )}
        </section>
        {(seloContas || fora || (!mun && porte)) && (
          <ul className="din-notas s12" aria-label="Notas sobre os números">
            {seloContas && <li className={seloContas.incompleta ? "aviso" : "ok"} title={coberturaLinha?.texto}>{seloContas.incompleta ? "⚠ " : "✓ "}{seloContas.texto}</li>}
            {fora && <li title="A Pergunta 1 soma também essas campanhas; aqui conta só quem disputou.">Fora da conta: {reais(fora.gasto)} de {inteiro(fora.n)} {fora.n === 1 ? "campanha que não disputou" : "campanhas que não disputaram"}</li>}
            {!mun && porte && <li>Soma de {inteiro(valorDoPorte(resumo, ano, uf, porte, aba, cargo).n)} cidades</li>}
            {eleitoPrefeito && <li>Eleito: {eleitoPrefeito.nome_urna} ({eleitoPrefeito.partido}){eleitoPrefeito.prestou === false ? ", sem prestação final" : ` · gastou ${reais(eleitoPrefeito.gasto)}`}</li>}
          </ul>
        )}

        {/* 1: quanto cada partido gastou; 2 e 3, lado a lado: quanto custou um voto e de onde veio e para onde foi o dinheiro */}
        {partidos.length > 0 && (
          <section id="dinheiro-partidos" className="bloco noite s12 din-partidos">
            <header className="din-sec">
              <h3><span className="din-num" aria-hidden="true">1</span>Quanto cada partido gastou</h3>
              <p><b>{partidos[0].partido}</b> gastou mais: {reais(partidos[0].gasto)}, {pct(partidos[0].parte, 0)} do total de {cargoMin} {mun ? `em ${lugar}` : uf ? `em ${NOME_UF[uf]}` : "nos seis estados"}</p>
            </header>
            <PartidosGasto partidos={partidos} titulo={`Gasto de cada partido com as campanhas a ${cargoMin}, ${lugar}, ${ano}`} inicio={mun ? 8 : 10} />
          </section>
        )}
        {totalVoto?.porVoto != null && (
          <section id="dinheiro-voto" className={`bloco noite ${(fatiasOrigem.length > 0 || fatiasDestino.length > 0) ? "s6" : "s12"} din-voto`}>
            <header className="din-sec">
              <h3><span className="din-num" aria-hidden="true">2</span>Quanto custou um voto</h3>
              <p>Gasto de todas as campanhas ÷ votos no 1º turno</p>
            </header>
            <p className="voto-grande"><b>{brlCentavos(totalVoto.porVoto)}</b><span>por voto</span></p>
            <p className="voto-conta">{reais(totalVoto.gasto)} ÷ {compacto(totalVoto.votos)} votos
              {antes !== null && votoAntes !== null && seta(variacaoVoto) && <> · <span className={`delta${variacaoVoto! > 0 ? " sobe" : variacaoVoto! < 0 ? " desce" : ""}`}>{seta(variacaoVoto)}</span> desde {antes} ({brlCentavos(votoAntes)})</>}
            </p>
            {quartis && quartis.grupos.some((g) => g.faixa >= 1 && g.porVoto !== null) && (
              <>
                <p className="rotulo">Cada voto, por grupo de gasto</p>
                <BarrasH compacto titulo={`Custo de cada voto em cada grupo de gasto dos candidatos a ${cargoMin}, ${ano}`}
                  linhas={quartis.grupos.filter((g) => g.faixa >= 1 && g.porVoto !== null).map((g) => ({ chave: String(g.faixa), rotulo: g.rotulo, valor: g.porVoto!, classe: COR_FAIXA[g.faixa], texto: brlCentavos(g.porVoto!), subtexto: "" }))} />
              </>
            )}
            <p className="din-rodape">Votos nominais: o voto só na legenda do partido não entra</p>
          </section>
        )}

        {(fatiasOrigem.length > 0 || fatiasDestino.length > 0) && (
          <section id="dinheiro-origem" className={`bloco noite ${totalVoto?.porVoto != null ? "s6" : "s12"} din-origem`}>
            <header className="din-sec">
              <h3><span className="din-num" aria-hidden="true">3</span>De onde veio, para onde foi o dinheiro</h3>
              <p>Todas as campanhas a {cargoMin} · {ano}</p>
            </header>
            {fatiasOrigem.length > 0 && <BarraEmpilhada titulo="Recebido" total={reais(origem!.total)} fatias={fatiasOrigem} valor={reais} />}
            {fatiasDestino.length > 0 && <BarraEmpilhada titulo="Gasto" total={reais(totalGrupos)} fatias={fatiasDestino} valor={reais} />}
            {grupos.length > 0 && (
              <details className="ver-todos dinheiro-grupos">
                <summary>Todos os {grupos.length} grupos de despesa</summary>
                <BarrasH compacto titulo={`Despesas das campanhas a ${cargoMin} por grupo, ${ano}`}
                  linhas={grupos.map((g) => ({ chave: g.grupo, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, classe: g.grupo.startsWith("propaganda") ? "pub" : "fx2", texto: pct(g.parte, 0), subtexto: reais(g.valor) }))} />
              </details>
            )}
            <p className="din-rodape">Sem repasses entre candidatos · valores sem correção pela inflação · <Link href={propaganda}>Propaganda em detalhe</Link></p>
          </section>
        )}

        {/* 4: os candidatos em quatro grupos de gasto (quartis) */}
        {quartis && (
          <section id="dinheiro-quartis" className="bloco noite s12 din-quartis">
            <header className="din-sec">
              <h3><span className="din-num" aria-hidden="true">4</span>Quem gastou quanto</h3>
              <p>Os candidatos que declararam gasto em 4 grupos do mesmo tamanho (quartis), do que menos ao que mais gastou</p>
            </header>
            <QuartisDoGasto q={quartis} />
            <p className="din-rodape">Grupos de tamanho aproximado: valores iguais ficam no mesmo grupo{!mun ? ` · candidatos comparados com todos os ${cargoMin === "prefeito" ? "candidatos a prefeito" : "candidatos"} do recorte${porte ? "" : " (use o porte para comparar cidades parecidas)"}` : ""}</p>
          </section>
        )}

        {/* 5: o mesmo cargo nas eleições com dados de dinheiro, no mesmo lugar */}
        {medidasAnos.length > 0 && (
          <section id="dinheiro-anos" className="bloco noite s12 din-anos">
            <header className="din-sec">
              <h3><span className="din-num" aria-hidden="true">5</span>{cargo}: {anosCargo.join(" × ")}</h3>
              <p>{lugar}{!mun && porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""} · as eleições para {cargoMin} com dados de dinheiro, lado a lado</p>
            </header>
            <AnosDoCargo anos={anosCargo} atual={ano} medidas={medidasAnos} hrefAno={(a) => href({ ano: a }, "dinheiro-anos")} titulo={`${cargo} em ${lugar}: ${anosCargo.join(" e ")}`} />
            <p className="din-rodape">Valores da época, sem correção pela inflação · porcentagens comparadas em pontos percentuais (p.p.)</p>
          </section>
        )}

        {/* as cidades do estado (ou os seis estados) na medida do mapa */}
        <section id="dinheiro-ranking" className="bloco noite s12 dinheiro-barras">
          <header className="din-sec">
            <h3>{tituloRanking}</h3>
            <p>{cidadesTopo.length ? `${Math.min(8, cidadesTopo.length)} de ${inteiro(cidadesUf.length)} cidades de ${NOME_UF[uf!]}${porteInfo ? ` · ${porteInfo.rotulo}` : ""}` : `Os seis estados · ${cargo} · ${ano}`}</p>
          </header>
          {cidadesTopo.length > 0 ? (
            <>
              <BarrasH compacto titulo={`${tituloRanking}: cidades de ${NOME_UF[uf!]}, ${ano}`}
                linhas={cidadesTopo.map((c) => ({ chave: String(c.id), rotulo: `${cidadesUf.indexOf(c) + 1}º ${c.nome}`, valor: c.valor ?? 0, classe: c.id === mun?.id_municipio ? "pub" : "fx2", texto: textoValor(c.valor, aba, cargo), subtexto: "", href: href({ mun: codDe.get(c.id)! }), atual: c.id === mun?.id_municipio }))} />
              <details className="ver-todos">
                <summary>Todas as {inteiro(cidadesUf.length)} cidades</summary>
                <div className="tabela-rolar">
                  <table className="dinheiro-tabela">
                    <thead><tr><th>Cidade</th><th>Porte</th><th className="num">{cargo === "Prefeito" ? "Gasto na disputa" : "Por vaga"}</th><th className="num">Por eleitor</th><th className="num">Público</th><th className="num">Gasto total</th><th className="num" title="Candidaturas com prestação de contas final, do total que disputou">Contas</th></tr></thead>
                    <tbody>
                      {cidadesUf.map((c) => (
                        <tr key={c.id} aria-current={c.id === mun?.id_municipio ? "true" : undefined}>
                          <td><Link href={href({ mun: codDe.get(c.id)! })} scroll={false}>{c.nome}</Link></td>
                          <td>{c.porte?.replace(" eleitores", "") ?? "—"}</td>
                          <td className="num">{textoValor(c.vaga, "gasto", cargo)}</td>
                          <td className="num">{textoValor(c.eleitor, "eleitor", cargo)}</td>
                          <td className="num">{textoValor(c.publico, "publico", cargo)}</td>
                          <td className="num">{c.conta ? reais(c.conta.gasto) : "—"}</td>
                          <td className="num">{c.contas ? `${inteiro(c.contas.com)}/${inteiro(c.contas.total)}` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          ) : (
            <BarrasH compacto titulo={`${pintarInfo.rotulo} de ${cargoMin} em cada estado, ${ano}`}
              linhas={estadosLista.map((e) => ({ chave: e.id, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.id ? "pub" : "fx2",
                texto: textoValor(e.valor, aba, cargo), subtexto: "", href: href({ uf: e.id }), atual: uf === e.id }))} />
          )}
        </section>

        {temCandidatos && (
          <section id="dinheiro-cand" className="bloco noite s12 dinheiro-cand">
            <header className="din-sec">
              <h3>{mun ? `Quem disputou em ${lugar}` : `Quem se elegeu em ${NOME_UF[uf!]}`}</h3>
              <p>{maisGastou ? <><b>{maisGastou.nome_urna}</b> gastou mais e {maisGastou.eleito ? "venceu" : "não venceu"}</> : `${cargo} · ${ano}`}</p>
            </header>
            {linhas.length > 1 && (
              <nav className="chips ord-cand" aria-label="Ordem dos candidatos">
                {ORDENS_CANDIDATOS.map((o) => (
                  <Link key={o.chave} href={href({ ord: o.chave }, "dinheiro-cand")} scroll={false} className={`chip${o.chave === ord ? " on" : ""}`} aria-current={o.chave === ord ? "true" : undefined}>{o.rotulo}</Link>
                ))}
              </nav>
            )}
            {mun && <p className="rotulo">Eleitos ({inteiro(eleitos.length)})</p>}
            <LinhasCandidatos linhas={eleitos.slice(0, INICIO_LISTA)} ano={ano}
              vazio={candidatos === null && eleitosUf === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum eleito registrado."} />
            {eleitos.length > INICIO_LISTA && (
              <details className="ver-todos"><summary>Todos os {inteiro(eleitos.length)} eleitos</summary>
                <LinhasCandidatos linhas={eleitos.slice(INICIO_LISTA)} ano={ano} vazio="" />
              </details>
            )}
            {naoEleitos.length > 0 && (
              <>
                <p className="rotulo">Não eleitos ({inteiro(naoEleitos.length)})</p>
                <LinhasCandidatos linhas={naoEleitos.slice(0, INICIO_LISTA)} ano={ano} vazio="" />
                {naoEleitos.length > INICIO_LISTA && (
                  <details className="ver-todos"><summary>{naoEleitos.length > MAX_LISTA ? `Os ${MAX_LISTA} primeiros (${ordInfo.rotulo.toLowerCase()})` : `Todos os ${inteiro(naoEleitos.length)} não eleitos`}</summary>
                    <LinhasCandidatos linhas={naoEleitos.slice(INICIO_LISTA, MAX_LISTA)} ano={ano} vazio="" />
                  </details>
                )}
              </>
            )}
            <p className="din-rodape">Prestação de contas final na base (não quer dizer aprovada) · clique no nome para ver o perfil</p>
          </section>
        )}

        <ComparacoesDinheiro
          noite ano={ano} cargo={cargo} uf={uf} mun={mun} nomeMun={mun ? lugar : undefined} porte={porte} medir={medir} semGasto={!uf}
          hrefMedir={(m) => href({ medir: m === "publico" ? "publico" : null }, "comparar")} hrefUf={(u) => href({ uf: u })}
        />

        <details id="dinheiro-metodo" className="bloco noite s12 dinheiro-metodo">
          <summary>Como calculamos</summary>
          <ul>{METODOLOGIA.dinheiro.calculo.map((t) => <li key={t}>{t}</li>)}</ul>
        </details>

        <ul className="atalhos s12">
          <li><Link href={propaganda}>Onde os candidatos investem em propaganda</Link></li>
          <li><Link href={uf ? `/candidatos?uf=${uf}` : "/candidatos"}>Candidatos</Link></li>
        </ul>
      </div>
      <MiniMapa recorte={`${pintarInfo.rotulo} · ${cargo} · ${lugar} · ${ano}`} foco={focoMini}>{mapaPalco}</MiniMapa>
    </>
  );
}

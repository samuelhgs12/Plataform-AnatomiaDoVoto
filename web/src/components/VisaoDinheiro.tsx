import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import {
  abaDe, ANOS_DINHEIRO, anoAnterior, cidadesDoPorte, classeComPorte, composicaoDespesas, contaGasto, contaGastoEstado, contasDaCidade, corCidade, corPorFaixas,
  diferencaRelativa, ehMunicipal, fatias, seloValor, seta, escolhaMapaDinheiro, hrefMapaDinheiro, legendaCidade, legendaPorFaixas, ordemCandidatos, ordenarCandidatos,
  MEDIDAS_ANOS, MEIAS, medidaDe, SECOES, type Secao, ORDENS_CANDIDATOS, ordenarLinhas, origemDoDinheiro, opcoesMunicipio, ufDoMunicipio, referenciaDoPorte, telaDe, TITULO_TELA, textoValor, unidade, valorCidade, valorDoEstado, valorDoPorte, variacaoNominal,
  anosDoCargo, COR_FAIXA, medidasNosAnos, partidosDeCandidatos, partidosDoRecorte, quartisDeCandidatos, quartisDoRecorte, totalPartidos,
  caminhoPecas, cargoDeCandidatos, cargosComForaDaDisputa, cargosDoRecorte, cargosDoAno, foraDoRecorte, hrefLegislativoCusto, deCada100, fraseDependeram, parteDependeu, maioresDeCandidatos, maioresDoRecorte, MINIMO_CADA_100, parteDoTotal, QUEM, quemDe, textoDependeram, totalFundos,
  type Aba, type LinhaCargo, type LinhaDespesa, type LinhaMaior, type LinhaPartido, type LinhaQuartil, type RecorteTabela,
} from "@/lib/dinheiro";
import { montarNuvem, type TermoNuvem } from "@/lib/nuvem";
import { mostrarNuvem } from "@/lib/propaganda";
import { CALCULO_MAPA_DINHEIRO, CALCULO_P8_MAPA } from "@/lib/metodologia";
import { naRegua, type FichaDica } from "@/lib/dica";
import {
  colunasSucessoP8, fontesPorResultado, fraseP8, GRUPOS_P8, gruposP8, maioriaPublica, NOME_UF, partePublica, partePublicaNosAnos, setaPP, tipicosP8,
  type LinhaFaixa as LinhaFaixaQ8, type LinhaFontes, type LinhaMediana, type LinhaSucesso,
} from "@/lib/financiamento";
import { brlCentavos, compacto, inteiro, pct, reais } from "@/lib/format";
import { TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { AnosDoCargo } from "./AnosDoCargo";
import { BarraEmpilhada } from "./BarraEmpilhada";
import { BarrasH } from "./BarrasH";
import { CadeirasCargos } from "./CadeirasCargos";
import { CemCandidatos } from "./CemCandidatos";
import { ComparacoesDinheiro } from "./ComparacoesDinheiro";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { LinhasCandidatos, type LinhaCandidato } from "./LinhasCandidatos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MaioresGastos } from "./MaioresGastos";
import { MapaVivo } from "./MapaVivo";
import { NuvemPalavras } from "./NuvemPalavras";
import { PartidosGasto } from "./PartidosGasto";
import { PublicoPrivado, type DadosP8 } from "./PublicoPrivado";
import { QuartisDoGasto } from "./QuartisDoGasto";

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
 * onde o dinheiro foi gasto (grupos de categoria do TSE); e as comparações (ComparacoesDinheiro). Cada pergunta do menu
 * (PINTAR) mostra só os blocos que a respondem (SECOES, em src/lib/dinheiro.ts): a 1, a 8 e a 9; a 2 ("Patrimônio
 * elege?") é a VisaoPatrimonio, escolhida em app/page.tsx. A aba Propaganda
 * (pergunta 9) fica em /analises/dinheiro. Lê as análises `municipios` e `dinheiro` e os candidatos da API; as contas
 * são de src/lib/dinheiro.ts.
 */
const QUINTOS = ["q0", "q1", "q2", "q3", "q4"];

export async function VisaoDinheiro({ menu, sp }: { menu: ReactNode; sp: SP }) {
  const { ano, cargo, porte, pintar } = escolhaMapaDinheiro(sp);
  // a tela: a pergunta 1, a 8 (dinheiro público e privado) ou a 9 (em que se gastou); a 2 é a VisaoPatrimonio
  const tela = telaDe(pintar);
  const aba: Aba = abaDe(tela);
  // a medida que pinta o mapa (só o público pinta a parte pública; o resto, o gasto por vaga) e os blocos da tela
  const medidaInfo = medidaDe(tela);
  const secoes = new Set<Secao>(SECOES[tela]);
  const tem = (x: Secao) => secoes.has(x);
  // na tela larga, alguns blocos dividem a linha com o vizinho (MEIAS)
  const meia = (x: Secao) => (MEIAS[tela].includes(x) ? " meia" : "");
  const ord = ordemCandidatos(um(sp.ord));
  const quem = quemDe(sp.quem);
  const porteInfo = porte ? PORTES.find((p) => p.chave === porte) : undefined;
  const municipal = ehMunicipal(ano);
  const [dados, dadosDespesas, dadosPerguntas, dadosQ8] = await Promise.all([
    lerAnalise("municipios", ["municipios", "resumo", "estados"]),
    lerAnalise("dinheiro", ["despesas"]),
    lerAnalise("dinheiro", ["partidos", "quartis", "cargos", "maiores"]),
    // a pergunta 8 (eleitos × não eleitos, no público e no privado) lê o q8, só na tela dela
    tem("p8") ? lerAnalise("q8", ["fontes", "faixas", "medianas", "sucesso"]) : Promise.resolve(null),
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
  // a cidade escolhida na lista dos seis estados chega sem o estado: abre o estado dela
  const ufDaCidade = municipal && !uf ? ufDoMunicipio(municipios, um(sp.mun)) : undefined;
  if (ufDaCidade) redirect(hrefMapaDinheiro({ ano, cargo, porte, pintar }, { uf: ufDaCidade, mun: um(sp.mun)! }));
  const codDe = new Map(municipios.map((m) => [m.id_municipio, m.cod_ibge]));
  const href = (novo: Parameters<typeof hrefMapaDinheiro>[1], ancora?: string) => hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.cod_ibge, porte, pintar, ord, quem }, novo, ancora);
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
  const faixasUf = quantis(conhecidos, 5);
  const [minUf, maxUf] = [Math.min(...conhecidos), Math.max(...conhecidos)];
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => {
    const v = valoresUf[i];
    const ficha: FichaDica = { titulo: NOME_UF[u] ?? u, sub: `${cargo} · ${ano}${porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}`, medidas: v === null ? [] : [{ rotulo: medidaInfo.rotulo, valor: textoValor(v, aba, cargo), cores: QUINTOS, p: naRegua(v, faixasUf, minUf, maxUf) }] };
    // o selo do estado é curto e sem "R$" (a unidade está no título e na legenda): "222 mil", "14", "62%"; a pílula cresce com ele
    const selo = uf ? seloValor(v, aba) : "";
    return {
      uf: u, classe: uf ? corPorFaixas(v, faixasUf) : "dinheiro-neutro", href: href({ uf: u === uf ? null : u }), sigla: u, valor: uf ? selo || "—" : "",   // o selo do estado alarga para caber (seloUf)
      descricao: uf ? `${NOME_UF[u] ?? u}: ${textoValor(v, aba, cargo)} ${unidade(aba, cargo)} em ${ano}` : `Selecionar ${NOME_UF[u] ?? u}`,
      ficha: uf ? ficha : undefined,
    };
  });
  // ao entrar num estado, o mapa aproxima dele e mostra as cidades: nas municipais, cada uma com o seu valor (faixas
  // fixas, iguais em todos os estados; fora do porte, apagadas); nas gerais o dinheiro é só por estado, então as cidades
  // aparecem só como desenho, todas na cor da faixa do estado, e a dica diz o nome e o valor do estado
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const vUf = uf ? valoresUf[ufs.indexOf(uf)] : null;
  const noMapaMun: MunicipioNoMapa[] = !uf || !caixa ? [] : !municipal ? municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => ({
    ibge: m.cod_ibge, classe: corPorFaixas(vUf, faixasUf), href: href({}),
    dica: `${nomeMun.get(m.id_municipio)} · valor do estado: ${textoValor(vUf, aba, cargo)}${vUf === null ? "" : aba === "gasto" ? " por vaga" : aba === "eleitor" ? " por eleitor" : " público"}`,
    atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100,
  })) : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const linha = doAno.get(m.id_municipio);
    const v = valorCidade(linha, aba, cargo);
    return {
      ibge: m.cod_ibge, classe: classeComPorte(corCidade(v, aba, cargo), porteDe(linha?.eleitorado)?.chave, porte), href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.cod_ibge }),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, aba, cargo)}${v === null ? "" : aba === "gasto" ? (cargo === "Prefeito" ? " gastos na disputa" : " por vaga") : aba === "eleitor" ? " por eleitor" : " público"}`,
      atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100,
    };
  });
  // "Não informado" só entra na legenda quando algum lugar à vista está sem dado, como "sem votos" nas outras camadas
  const algumSem = uf && municipal ? noMapaMun.some((m) => m.classe.split(" ").includes("sem")) : valoresUf.includes(null);
  const legenda = (uf && municipal ? legendaCidade(aba, cargo) : legendaPorFaixas(faixasUf, (v) => seloValor(v, aba), aba === "gasto" ? "R$ " : "")).filter((l) => l.classe !== "sem" || algumSem);
  // com um estado aberto, o cartão do lugar fica na faixa da direita do mapa: o enquadramento ganha essa faixa vazia,
  // e o lugar vai para a esquerda, sem ficar embaixo do cartão
  const base: [number, number, number, number] = caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA];
  const quadro: [number, number, number, number] | undefined = uf ? [base[0], base[1], base[2] + (base[2] - base[0]) * (caixa ? 0.8 : 0.7), base[3]] : undefined;
  const camera = enquadrar(quadro ?? base, TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const mapaPalco = (
    <MapaAbstencao
      titulo={`${medidaInfo.rotulo} de ${cargoMin}: ${lugar}, ${ano}`} camera={camera} estados={noMapaUf} uf={uf} municipios={noMapaMun}
      destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined}
    />
  );

  // o número do lugar na medida escolhida, as outras duas medidas, a conta do gasto por vaga e o de cima para comparar
  const valorLugar = (a: Aba, emAno = ano) => (mun ? valorCidade(resumo.find((x) => x.ano === emAno && x.id_municipio === mun.id_municipio), a, cargo) : valorUf(uf, a, emAno));
  const principal = valorLugar(aba);
  const conta = mun ? contaGasto(linhaMun, cargo) : contaUf(uf);
  const cima = mun ? valorUf(uf) : uf ? valorUf(undefined) : null;
  // a leitura do número: a cobertura das prestações de contas, a referência das cidades de porte parecido e a eleição anterior
  const porteCidade = porteDe(linhaMun?.eleitorado);
  const referencia = mun && porteCidade ? referenciaDoPorte(resumo, ano, porteCidade.chave, aba, cargo) : null;
  const difReferencia = referencia ? diferencaRelativa(principal, referencia.valor) : null;
  const origem = origemDoDinheiro({ resumo, estados }, { ano, cargo, uf, mun: linhaMun, porte: mun ? undefined : porte });
  const valorAntes = antes !== null ? valorLugar(aba, antes) : null;
  const variacao = variacaoNominal(principal, valorAntes);
  // o gasto de quem não chegou a disputar, que o custo da cadeira inclui (como na P1); com um porte, só as cidades dele
  const foraDe = (c: string) => foraDoRecorte({ resumo, estados }, { ano, cargo: c, uf, mun: mun?.id_municipio, porte: mun ? undefined : porte });
  const fora = aba === "gasto" ? foraDe(cargo) : null;

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
  const medidasAnos = anosCargo.length < 2 || !tem("anos") ? [] : medidasNosAnos([
    { chave: "gasto", rotulo: "Gasto total", valores: porAno.map((x) => x.total?.gasto ?? null), fmt: reais },
    ...(cargo === "Prefeito" && mun ? [] : [{ chave: "vaga", rotulo: "Gasto por vaga", valores: porAno.map((x) => x.vaga), fmt: reais }]),
    { chave: "voto", rotulo: "Cada voto", valores: porAno.map((x) => x.total?.porVoto ?? null), fmt: brlCentavos },
    { chave: "eleitor", rotulo: "Por eleitor apto", valores: porAno.map((x) => x.eleitor), fmt: brlCentavos },
    { chave: "publico", rotulo: "Parte pública do dinheiro", valores: porAno.map((x) => x.publico), fmt: (v: number) => pct(v, 0), pontos: true },
    { chave: "topo", rotulo: "Fatia dos 25% que mais gastaram", valores: porAno.map((x) => x.quartis?.concentracao ?? null), fmt: (v: number) => pct(v, 0), pontos: true },
    { chave: "cand", rotulo: "Candidatos", valores: porAno.map((x) => x.total?.candidatos ?? null), fmt: inteiro },
  ].filter((m) => MEDIDAS_ANOS[tela].includes(m.chave)));
  const votoAntes = antes !== null ? porAno[anosCargo.indexOf(antes)]?.total?.porVoto ?? null : null;

  // quem mais gastou (todos ou só os eleitos), quanto custou cada cadeira em cada cargo da eleição, quantos de cada 100
  // dependeram do dinheiro público e o que se comprou em propaganda: tabelas cargos e maiores ou, numa cidade, as listas
  // de candidatos dos dois cargos dela
  const linhasCargo = dadosPerguntas?.cargos ? comoObjetos<LinhaCargo>(dadosPerguntas.cargos) : null;
  const linhasMaior = dadosPerguntas?.maiores ? comoObjetos<LinhaMaior>(dadosPerguntas.maiores) : null;
  const outroCargo = mun ? cargosDoAno(ano).find((c) => c !== cargo) : undefined;
  const [candsOutro, recebidasPecas] = await Promise.all([
    mun && outroCargo ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(outroCargo)}`) : Promise.resolve(null),
    tem("propaganda") ? apiGetOpcional<unknown>(caminhoPecas({ ano, cargo, uf, mun: mun?.id_municipio }, quem)) : Promise.resolve(null),
  ]);
  const vagasMun = (c: string) => (c === "Prefeito" ? 1 : linhaMun?.vereador_vagas ?? 0);
  // com o gasto de quem não chegou a disputar, para o custo da cadeira de cada cargo bater com o da P1
  const cargosLugar = cargosComForaDaDisputa(mun
    ? cargosDoAno(ano).flatMap((c) => { const cs = c === cargo ? candidatos : candsOutro; return cs?.length ? [cargoDeCandidatos(c, cs, vagasMun(c))] : []; })
    : linhasCargo ? cargosDoRecorte(linhasCargo, { ano, uf, porte }) : [], foraDe);
  const legislativo = hrefLegislativoCusto(ano, cargo, uf);
  const cargoAqui = cargosLugar.find((c) => c.cargo === cargo);
  const maiores = mun ? (candidatos ? maioresDeCandidatos(candidatos, quem) : []) : linhasMaior ? maioresDoRecorte(linhasMaior, recorteTab(ano), quem) : [];
  const cem = cargoAqui && totalFundos(cargoAqui.todos) >= MINIMO_CADA_100 ? deCada100(cargoAqui.todos) : null;
  const cemEleitos = cargoAqui && totalFundos(cargoAqui.soEleitos) >= MINIMO_CADA_100 ? deCada100(cargoAqui.soEleitos) : null;
  const pecas = Array.isArray(recebidasPecas) ? montarNuvem(recebidasPecas as Partial<TermoNuvem>[]) : null;
  const pecasPreparando = recebidasPecas !== null && !Array.isArray(recebidasPecas);
  const comNuvem = !!pecas && mostrarNuvem(pecas.todos);
  const quemTexto = quem === "eleitos" ? "só os eleitos" : "todos os candidatos";
  const chipsQuem = (ancora: string) => (
    <nav className="chips din-quem" aria-label="Quem entra na conta">
      {QUEM.map((q) => (
        <Link key={q.chave} href={href({ quem: q.chave === "todos" ? null : q.chave }, ancora)} scroll={false} className={`chip${q.chave === quem ? " on" : ""}`} aria-current={q.chave === quem ? "true" : undefined}>{q.rotulo}</Link>
      ))}
    </nav>
  );
  const variacaoVoto = totalVoto ? variacaoNominal(totalVoto.porVoto, votoAntes) : null;

  // pergunta 8: eleitos × não eleitos, no público e no privado (q8 não tem município: numa cidade, os números do estado)
  const dadosP8: DadosP8 | null = (() => {
    if (!tem("p8") || !dadosQ8?.fontes || !dadosQ8.faixas || !dadosQ8.medianas || !dadosQ8.sucesso) return null;
    const fontes = comoObjetos<LinhaFontes>(dadosQ8.fontes);
    const f = { ano, cargo, uf };
    const somas = fontesPorResultado(fontes, f);
    const tipicos = tipicosP8(comoObjetos<LinhaMediana>(dadosQ8.medianas), f);
    const partes = { eleitos: partePublica(somas.eleitos), naoEleitos: partePublica(somas.naoEleitos) };
    const nosAnos = antes !== null ? partePublicaNosAnos(fontes, { cargo, uf }, [antes, ano]) : null;
    const grupos = nosAnos ? ([["Eleitos", nosAnos.eleitos], ["Não eleitos", nosAnos.naoEleitos]] as const) : [];
    const temAnos = grupos.length > 0 && grupos.every(([, g]) => g.antes !== null && g.depois !== null);
    const sucesso = colunasSucessoP8(comoObjetos<LinhaSucesso>(dadosQ8.sucesso), f);
    return {
      resposta: fraseP8(tipicos, partes),
      barras: [{ titulo: "Eleitos", s: somas.eleitos }, { titulo: "Não eleitos", s: somas.naoEleitos }].map((b) => ({ titulo: b.titulo, total: reais(b.s.total), fatias: gruposP8(b.s) })),
      legenda: GRUPOS_P8.map((g) => ({ chave: g.chave, rotulo: g.rotulo, cor: g.cor })),
      tipicos,
      maioria: maioriaPublica(comoObjetos<LinhaFaixaQ8>(dadosQ8.faixas), f),
      anos: temAnos ? {
        antes: antes!, depois: ano,
        grupos: grupos.map(([rotulo, g]) => ({ rotulo, antes: pct(g.antes!, 0), depois: pct(g.depois!, 0), seta: setaPP(g.antes, g.depois)! })),
      } : null,
      colunas: sucesso.colunas, max: sucesso.max,
      recorte: `${cargoMin}, ${uf ? NOME_UF[uf] ?? uf : "seis estados"}, ${ano}`,
    };
  })();

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
  const posUf = uf ? estadosLista.findIndex((e) => e.id === uf) : -1;   // posição do estado, no painel
  // leitura de relance: a origem e o destino do dinheiro em barras 100%, com os grupos menores juntos em "Outros"
  const fatiasOrigem = !origem ? [] : fatias("naoPublico" in origem
    ? [{ chave: "pub", rotulo: "Público", valor: origem.publico, cor: "pub" }, { chave: "np", rotulo: "Não público", valor: origem.naoPublico, cor: "fx3" }]
    : [{ chave: "pub", rotulo: "Público", valor: origem.publico, cor: "pub" }, { chave: "priv", rotulo: "Privado", valor: origem.privado, cor: "priv" }, { chave: "nc", rotulo: "Sem fonte", valor: origem.naoClassificado, cor: "o" }], { fixo: true });
  const fatiasDestino = fatias(grupos.map((g) => ({ chave: g.grupo, rotulo: g.rotulo, valor: g.valor })), { max: 5 });
  // a pergunta 1: o custo da cadeira com a conta por extenso, também para prefeito (1 cadeira)
  const p1 = pintar === "vaga";
  const rotuloPrincipal = p1 ? "Custo da cadeira" : aba === "gasto" && cargo === "Prefeito" && mun ? "Gasto na disputa" : medidaInfo.rotulo;
  const subPrincipal = p1 && conta ? `${reais(conta.gasto)} ÷ ${inteiro(conta.vagas)} ${conta.vagas === 1 ? "cadeira" : "cadeiras"}`
    : aba === "gasto" && conta && !(cargo === "Prefeito" && mun) ? `${reais(conta.gasto)} ÷ ${inteiro(conta.vagas)} ${conta.vagas === 1 ? "vaga" : "vagas"}`
    : aba === "gasto" ? "todas as campanhas a prefeito" : aba === "eleitor" ? "gasto ÷ eleitores aptos" : "do dinheiro recebido";
  // nas eleições gerais, a P1 compara os seis estados ao lado dos outros cargos
  const rankingSeis = p1 && !municipal;
  // os cards dos números: na P1 com os quatro, o último ocupa as duas colunas que sobram ao lado do principal
  const temEleitor = aba === "gasto" && valorLugar("eleitor") !== null;
  const temDesde = antes !== null && valorAntes !== null;
  const largo = p1 && temEleitor && temDesde ? " din-kpi-largo" : "";
  const tituloRanking = rankingSeis ? "Nos seis estados"
    : aba === "gasto" ? (cargo === "Prefeito" && cidadesTopo.length ? "Onde a disputa custou mais" : "Onde se gastou mais por vaga")
    : aba === "eleitor" ? "Onde se gastou mais por eleitor" : "Onde o dinheiro público pesa mais";
  const propaganda = `/analises/dinheiro?${new URLSearchParams(Object.entries({ ano: String(ano), cargo, uf: uf ?? "", aba: "propaganda" }).filter(([, v]) => v))}`;
  const paramsMun = Object.fromEntries(new URL(href({ mun: null }), "http://x").searchParams);

  return (
    <>
      <MapaVivo className={`palco s12 palco-dinheiro${!uf ? " dinheiro-inicial" : ""}`} estado={uf}>
        {menu}
        <div className="palco-topo">
          <div>
            <h1 id="h-mapa">{TITULO_TELA[tela]} em {ano}</h1>
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
          {!uf && <p className="palco-dica">Selecione um estado para explorar o dinheiro das campanhas, ou veja embaixo os seis comparados</p>}
        </div>

        <div className="palco-base">
          {uf && <ul className="legenda-q" aria-label={uf && municipal ? `Cores: faixas fixas de ${medidaInfo.rotulo.toLowerCase()}` : `Cores: cada uma reúne um quinto dos estados por ${medidaInfo.rotulo.toLowerCase()}`}>
            {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
          </ul>}
          <div className="anos" role="group" aria-label="Ano da eleição">
            {ANOS_DINHEIRO.map((a) => (
              <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                {a}<small>{ehMunicipal(a) ? "Municipal" : "Geral"}</small>
              </Link>
            ))}
          </div>
        </div>
      </MapaVivo>

      {/* sem estado escolhido, o painel compara os seis (o mapa fica neutro até a escolha) */}
      <div id="dinheiro-painel" className="painel s12 din" key={`dinheiro-${uf}-${mun?.id_municipio}-${ano}-${cargo}-${tela}`}>
        {/* cabeçalho: onde estamos e a troca de cidade */}
        <header className="din-cab s12">
          <div>
            {/* a P8 não separa por cidade nem por porte (o q8 é por estado): numa cidade, mostra o estado dela */}
            {tem("p8") ? (
              <>
                <p className="din-kicker">{uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}</p>
                <h2>{uf ? NOME_UF[uf] ?? uf : "Os seis estados"}</h2>
              </>
            ) : (
              <>
                <p className="din-kicker">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}{!mun && porteInfo ? ` · ${porteInfo.rotulo}` : ""}</p>
                <h2>{lugar}</h2>
              </>
            )}
          </div>
          {municipal && (
            <EscolhaMunicipio vazio={uf ? "O estado inteiro" : "Os seis estados"}
              opcoes={opcoesMunicipio(municipios.map((m) => ({ cod_ibge: m.cod_ibge, uf: m.uf, nome: nomeMun.get(m.id_municipio)! })), uf)}
              atual={mun?.cod_ibge} params={paramsMun}
            />
          )}
        </header>

        {/* pergunta 8: eleitos × não eleitos, no público e no privado */}
        {tem("p8") && (dadosP8 ? <PublicoPrivado d={dadosP8} /> : (
          <div className="card aviso s12">
            <h2>Dinheiro público e privado indisponível</h2>
            <p>A API não respondeu: não devolveu a análise <code>q8</code>. Recarregue a página para tentar de novo.</p>
          </div>
        ))}

        {/* os números do lugar, para ler de relance: o principal grande e, ao lado, as outras medidas e as comparações */}
        {tem("numeros") && <section className="din-kpis s12" aria-label={`${lugar} em números`}>
          <div className="din-kpi din-kpi-principal">
            <small>{rotuloPrincipal}</small>
            <b>{textoValor(principal, aba, cargo)}</b>
            <span>{subPrincipal}</span>
          </div>
          {temEleitor && (
            <div className="din-kpi"><small>Gasto por eleitor</small><b>{textoValor(valorLugar("eleitor"), "eleitor", cargo)}</b><span>gasto ÷ eleitores aptos</span></div>
          )}
          {temDesde && (
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
            <div className={`din-kpi${largo}`} title={`Mediana de ${inteiro(referencia.n)} cidades de ${porteCidade!.rotulo}`}>
              <small>Vs. cidades do mesmo porte</small>
              <b className={`delta${difReferencia! > 0 ? " sobe" : difReferencia! < 0 ? " desce" : ""}`}>{seta(difReferencia)}</b>
              <span>mediana {textoValor(referencia.valor, aba, cargo)}</span>
            </div>
          ) : p1 ? (cargoAqui?.medianaEleito != null && (
            /* na P1, os seis estados ficam no ranking ao lado: aqui, o que gastou quem se elegeu */
            <div className={`din-kpi${largo}`}>
              <small>Eleito típico</small>
              <b>{reais(cargoAqui.medianaEleito)}</b>
              <span>o que gastou quem se elegeu (mediana)</span>
            </div>
          )) : cima === null ? (estadosConhecidos.length > 1 && (
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
        </section>}
        {tem("numeros") && ((!mun && porte) || eleitoPrefeito || fora) && (
          <ul className="din-notas s12" aria-label="Notas sobre os números">
            {!mun && porte && <li>Soma de {inteiro(valorDoPorte(resumo, ano, uf, porte, aba, cargo).n)} cidades</li>}
            {fora && <li>Inclui {reais(fora.gasto)} de {inteiro(fora.n)} {fora.n === 1 ? "campanha que não chegou" : "campanhas que não chegaram"} a disputar</li>}
            {eleitoPrefeito && <li>Eleito: {eleitoPrefeito.nome_urna} ({eleitoPrefeito.partido}){eleitoPrefeito.prestou === false ? ", sem prestação final" : ` · gastou ${reais(eleitoPrefeito.gasto)}`}</li>}
          </ul>
        )}

        {/* pergunta 2: primeiro a resposta (dinheiro × resultado), depois quem gastou */}
        {tem("comparar") && <ComparacoesDinheiro
          noite escolhaFora ano={ano} cargo={cargo} uf={uf} mun={mun} nomeMun={mun ? lugar : undefined} porte={porte} medir="publico" semGasto={!uf}
          hrefMedir={() => href({}, "comparar")} hrefUf={(u) => href({ uf: u })}
        />}

        {/* cada pergunta do menu mostra só os seus blocos (SECOES, em src/lib/dinheiro.ts); as pessoas que mais gastaram */}
        {tem("maiores") && <section id="dinheiro-maiores" className="bloco noite s12 din-maiores">
          <header className="din-sec">
            <h3>Quem mais gastou</h3>
            {maiores[0] ? (
              <p><b>{nomeProprio(maiores[0].nome)}</b> ({maiores[0].partido}) gastou {reais(maiores[0].gasto)}
                {parteDoTotal(maiores[0].gasto, totalVoto?.gasto) !== null && parteDoTotal(maiores[0].gasto, totalVoto?.gasto)! >= 0.01 ? `, ${pct(parteDoTotal(maiores[0].gasto, totalVoto?.gasto)!, 0)} de tudo o que se gastou` : ""}
                {" "}e {maiores[0].eleito ? "se elegeu" : "não se elegeu"}</p>
            ) : <p>{cargo} · {ano} · {quemTexto}</p>}
          </header>
          {chipsQuem("dinheiro-maiores")}
          {maiores.length > 0 ? (
            <MaioresGastos maiores={maiores} comLugar={municipal && !mun}
              titulo={`As ${maiores.length} campanhas a ${cargoMin} que mais gastaram, ${quemTexto}, ${lugar}, ${ano}`} />
          ) : <p className="muted">{linhasMaior === null && !mun ? "A API não devolveu a lista agora. Recarregue a página para tentar de novo." : "Ninguém declarou gasto neste recorte."}</p>}
          <p className="din-rodape">Gasto declarado na prestação de contas final · cada voto = gasto ÷ votos no 1º turno · público = parte do que recebeu vinda dos fundos Eleitoral e Partidário · clique no nome para ver o perfil</p>
        </section>}
        {/* quanto cada partido gastou, logo depois das pessoas */}
        {tem("partidos") && partidos.length > 0 && (
          <section id="dinheiro-partidos" className={`bloco noite s12 din-partidos${meia("partidos")}`}>
            <header className="din-sec">
              <h3>Quanto cada partido gastou</h3>
              <p><b>{partidos[0].partido}</b> gastou mais: {reais(partidos[0].gasto)}, {pct(partidos[0].parte, 0)} do total de {cargoMin} {mun ? `em ${lugar}` : uf ? `em ${NOME_UF[uf]}` : "nos seis estados"}</p>
            </header>
            <PartidosGasto partidos={partidos} titulo={`Gasto de cada partido com as campanhas a ${cargoMin}, ${lugar}, ${ano}`} inicio={mun ? 8 : 10} />
          </section>
        )}

        {tem("voto") && totalVoto?.porVoto != null && (
          <section id="dinheiro-voto" className={`bloco noite s12 din-voto${meia("voto")}`}>
            <header className="din-sec">
              <h3>Quanto custou um voto</h3>
              <p>Gasto de todas as campanhas ÷ votos no 1º turno</p>
            </header>
            <div className="din-duas">
            <div>
            <p className="voto-grande"><b>{brlCentavos(totalVoto.porVoto)}</b><span>por voto</span></p>
            <p className="voto-conta">{reais(totalVoto.gasto)} ÷ {compacto(totalVoto.votos)} votos
              {antes !== null && votoAntes !== null && seta(variacaoVoto) && <> · <span className={`delta${variacaoVoto! > 0 ? " sobe" : variacaoVoto! < 0 ? " desce" : ""}`}>{seta(variacaoVoto)}</span> desde {antes} ({brlCentavos(votoAntes)})</>}
            </p>
            </div>
            {quartis && quartis.grupos.some((g) => g.faixa >= 1 && g.porVoto !== null) && (
              <div>
                <p className="rotulo">Cada voto, por grupo de gasto</p>
                <BarrasH compacto titulo={`Custo de cada voto em cada grupo de gasto dos candidatos a ${cargoMin}, ${ano}`}
                  linhas={quartis.grupos.filter((g) => g.faixa >= 1 && g.porVoto !== null).map((g) => ({ chave: String(g.faixa), rotulo: g.rotulo, valor: g.porVoto!, classe: COR_FAIXA[g.faixa], texto: brlCentavos(g.porVoto!), subtexto: "" }))} />
              </div>
            )}
            </div>
            <p className="din-rodape">Votos nominais: o voto só na legenda do partido não entra</p>
          </section>
        )}

        {tem("origem") && fatiasOrigem.length > 0 && (
          <section id="dinheiro-origem" className={`bloco noite s12 din-origem${meia("origem")}`}>
            <header className="din-sec">
              <h3>De onde veio o dinheiro</h3>
              <p>Tudo o que as campanhas a {cargoMin} receberam · {ano}</p>
            </header>
            <BarraEmpilhada titulo="Recebido" total={reais(origem!.total)} fatias={fatiasOrigem} valor={reais} />
            <p className="din-rodape">Público = Fundo Eleitoral e Fundo Partidário · sem repasses entre candidatos · valores sem correção pela inflação</p>
          </section>
        )}
        {/* quanto custou cada cadeira, cargo a cargo, na mesma eleição e no mesmo lugar */}
        {tem("cadeiras") && cargosLugar.length > 0 && (p1 ? (
          /* P1: a mesma conta nos outros cargos (8 colunas), ao lado do ranking (4) */
          <section id="dinheiro-cadeiras" className="bloco noite s12 din-cadeiras din-oito">
            <header className="din-sec">
              <h3>Nos outros cargos</h3>
              <p>A mesma conta, na mesma eleição</p>
            </header>
            <CadeirasCargos cargos={cargosLugar} atual={cargo} hrefCargo={(c) => href({ cargo: c }, "dinheiro-cadeiras")}
              titulo={`Quanto custou cada cadeira em cada cargo, ${lugar}, ${ano}`} />
            {legislativo && <p className="din-rodape"><Link href={legislativo}>Ver quanto custou a cadeira de cada partido no plenário →</Link></p>}
          </section>
        ) : (
          <section id="dinheiro-cadeiras" className="bloco noite s12 din-cadeiras">
            <header className="din-sec">
              <h3>Quanto custou cada cadeira</h3>
              {cargoAqui?.porCadeira != null ? (
                <p>Cada cadeira de {cargoMin} custou <b>{reais(cargoAqui.porCadeira)}</b>: {reais(cargoAqui.gasto)} de {inteiro(cargoAqui.candidatos)} candidatos ÷ {inteiro(cargoAqui.vagas)} {cargoAqui.vagas === 1 ? "cadeira" : "cadeiras"}
                  {cargoAqui.medianaEleito !== null ? `. O eleito típico gastou ${reais(cargoAqui.medianaEleito)}` : ""}</p>
              ) : <p>{lugar} · {ano}</p>}
            </header>
            <CadeirasCargos cargos={cargosLugar} atual={cargo} hrefCargo={(c) => href({ cargo: c }, "dinheiro-cadeiras")}
              titulo={`Quanto custou cada cadeira em cada cargo, ${lugar}, ${ano}`} />
            <p className="din-rodape">Cada cadeira = gasto de todas as campanhas ao cargo ÷ cadeiras em disputa · eleito típico = mediana do gasto dos eleitos{!mun && porteInfo ? ` · só cidades de ${porteInfo.rotulo}` : ""} · clique num cargo para vê-lo no painel</p>
          </section>
        ))}

        {/* quantos de cada 100 dependeram do dinheiro público (mais da metade do que receberam veio dos fundos) */}
        {tem("fundos") && cargoAqui && (
          <section id="dinheiro-fundos" className="bloco noite s12 din-fundos">
            <header className="din-sec">
              <h3>Quem dependeu do dinheiro público</h3>
              <p>{cem || cemEleitos ? "Dependeu: mais da metade do que a campanha recebeu veio do Fundo Eleitoral e do Fundo Partidário" : `${cargo} · ${ano} · ${lugar}`}</p>
            </header>
            {cem || cemEleitos ? (
              <div className="cem-par">
                {cem && <CemCandidatos grupos={cem} quem={`candidatos a ${cargoMin}`} total={totalFundos(cargoAqui.todos)} titulo={`Candidatos a ${cargoMin}, ${lugar}, ${ano}, de cada 100`} />}
                {cemEleitos && <CemCandidatos grupos={cemEleitos} quem="eleitos" total={totalFundos(cargoAqui.soEleitos)} titulo={`Eleitos para ${cargoMin}, ${lugar}, ${ano}, de cada 100`} />}
              </div>
            ) : (
              <p className="cem-poucos">{fraseDependeram(cargoAqui.todos, cargoAqui.soEleitos)}</p>
            )}
            {cargosLugar.length > 1 && (
              <div className="tabela-rolar">
                <table className="fundos-tabela" aria-label={`Quantos dependeram do dinheiro público em cada cargo, ${lugar}, ${ano}`}>
                  <thead><tr><th>Cargo</th><th>Candidatos que dependeram</th><th>Eleitos que dependeram</th></tr></thead>
                  <tbody>
                    {cargosLugar.map((c) => (
                      <tr key={c.cargo} className={c.cargo === cargo ? "on" : undefined}>
                        <th scope="row"><Link href={href({ cargo: c.cargo }, "dinheiro-fundos")} scroll={false} aria-current={c.cargo === cargo ? "true" : undefined}>{c.cargo}</Link></th>
                        {[c.todos, c.soEleitos].map((g, i) => (
                          <td key={i} className="fd-celula">
                            {parteDependeu(g) === null ? <span className="muted">ninguém</span> : (
                              <><span className="fd-trilho" aria-hidden="true"><i style={{ width: `${parteDependeu(g)! * 100}%` }} /></span><b>{textoDependeram(g)}</b></>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="din-rodape">Com menos de {MINIMO_CADA_100} pessoas, a conta aparece como de fato é (ex.: 2 de 3)</p>
          </section>
        )}

        {/* os candidatos em quatro grupos de gasto (quartis) */}
        {tem("quartis") && quartis && (
          <section id="dinheiro-quartis" className="bloco noite s12 din-quartis">
            <header className="din-sec">
              <h3>Quem gastou quanto</h3>
              <p>Os candidatos que declararam gasto em 4 grupos do mesmo tamanho (quartis), do que menos ao que mais gastou</p>
            </header>
            <QuartisDoGasto q={quartis} />
            <p className="din-rodape">Grupos de tamanho aproximado: valores iguais ficam no mesmo grupo{!mun ? ` · candidatos comparados com todos os ${cargoMin === "prefeito" ? "candidatos a prefeito" : "candidatos"} do recorte${porte ? "" : " (use o porte para comparar cidades parecidas)"}` : ""}</p>
          </section>
        )}

        {/* o mesmo cargo nas eleições com dados de dinheiro, no mesmo lugar */}
        {medidasAnos.length > 0 && (
          <section id="dinheiro-anos" className={`bloco noite s12 din-anos${meia("anos")}`}>
            <header className="din-sec">
              <h3>{cargo}: {anosCargo.join(" × ")}</h3>
              <p>{lugar}{!mun && porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""} · as eleições para {cargoMin} com dados de dinheiro, lado a lado</p>
            </header>
            <AnosDoCargo anos={anosCargo} atual={ano} medidas={medidasAnos} hrefAno={(a) => href({ ano: a }, "dinheiro-anos")} titulo={`${cargo} em ${lugar}: ${anosCargo.join(" e ")}`} />
            <p className="din-rodape">Valores da época, sem correção pela inflação · porcentagens comparadas em pontos percentuais (p.p.)</p>
          </section>
        )}

        {/* as cidades do estado (ou os seis estados) na medida do mapa */}
        {tem("ranking") && <section id="dinheiro-ranking" className={`bloco noite s12 dinheiro-barras${meia("ranking")}${p1 ? " din-quatro" : ""}`}>
          <header className="din-sec">
            <h3>{tituloRanking}</h3>
            <p>{rankingSeis && uf && posUf >= 0 && estadosLista[posUf].valor !== null ? `${NOME_UF[uf] ?? uf} é o ${posUf + 1}º mais caro`
              : rankingSeis ? `${cargo} · ${ano}`
              : cidadesTopo.length ? `${Math.min(8, cidadesTopo.length)} de ${inteiro(cidadesUf.length)} cidades de ${NOME_UF[uf!]}${porteInfo ? ` · ${porteInfo.rotulo}` : ""}` : `Os seis estados · ${cargo} · ${ano}`}</p>
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
            <BarrasH compacto titulo={`${medidaInfo.rotulo} de ${cargoMin} em cada estado, ${ano}`}
              linhas={estadosLista.map((e) => ({ chave: e.id, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.id ? "pub" : "fx2",
                texto: textoValor(e.valor, aba, cargo), subtexto: "", href: href({ uf: e.id }), atual: uf === e.id }))} />
          )}
        </section>}

        {tem("cand") && temCandidatos && (
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
            <LinhasCandidatos detalhar linhas={eleitos.slice(0, INICIO_LISTA)} ano={ano}
              vazio={candidatos === null && eleitosUf === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum eleito registrado."} />
            {eleitos.length > INICIO_LISTA && (
              <details className="ver-todos"><summary>Todos os {inteiro(eleitos.length)} eleitos</summary>
                <LinhasCandidatos detalhar linhas={eleitos.slice(INICIO_LISTA)} ano={ano} vazio="" />
              </details>
            )}
            {naoEleitos.length > 0 && (
              <>
                <p className="rotulo">Não eleitos ({inteiro(naoEleitos.length)})</p>
                <LinhasCandidatos detalhar linhas={naoEleitos.slice(0, INICIO_LISTA)} ano={ano} vazio="" />
                {naoEleitos.length > INICIO_LISTA && (
                  <details className="ver-todos"><summary>{naoEleitos.length > MAX_LISTA ? `Os ${MAX_LISTA} primeiros (${ordInfo.rotulo.toLowerCase()})` : `Todos os ${inteiro(naoEleitos.length)} não eleitos`}</summary>
                    <LinhasCandidatos detalhar linhas={naoEleitos.slice(INICIO_LISTA, MAX_LISTA)} ano={ano} vazio="" />
                  </details>
                )}
              </>
            )}
            <p className="din-rodape">Selecione um nome para ver os detalhes.</p>
          </section>
        )}


        {/* o fim de "Dinheiro elege?" nas duas medidas: em que as campanhas gastaram (pergunta 9) */}
        {tem("destino") && (fatiasDestino.length > 0 || tem("propaganda")) && (
          <header className="din-divisao s12">
            <h3>Em que as campanhas gastaram</h3>
          </header>
        )}
        {tem("destino") && fatiasDestino.length > 0 && (
          <section id="dinheiro-destino" className="bloco noite s12 din-origem">
            <header className="din-sec">
              <h3>Para onde foi o dinheiro</h3>
              <p>Tudo o que as campanhas a {cargoMin} gastaram · {ano}</p>
            </header>
            <BarraEmpilhada titulo="Gasto" total={reais(totalGrupos)} fatias={fatiasDestino} valor={reais} />
            {grupos.length > 0 && (
              <details className="ver-todos dinheiro-grupos">
                <summary>Todos os {grupos.length} grupos de despesa</summary>
                <BarrasH compacto titulo={`Despesas das campanhas a ${cargoMin} por grupo, ${ano}`}
                  linhas={grupos.map((g) => ({ chave: g.grupo, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, classe: g.grupo.startsWith("propaganda") ? "pub" : "fx2", texto: pct(g.parte, 0), subtexto: reais(g.valor) }))} />
              </details>
            )}
            <p className="din-rodape">Grupos de categoria de despesa do TSE · sem repasses entre candidatos · valores sem correção pela inflação</p>
          </section>
        )}

        {/* o que se comprou em propaganda (nuvem de palavras), de todos ou só dos eleitos */}
        {tem("propaganda") && <section id="dinheiro-propaganda" className="bloco noite s12 din-propaganda">
          <header className="din-sec">
            <h3>O que se comprou em propaganda</h3>
            {pecas?.todos[0] ? (
              <p>Onde mais foi dinheiro: <b>{pecas.todos[0].termo}</b>, {reais(pecas.todos[0].centavos / 100)} ({pct(pecas.todos[0].parte, 0)} da propaganda de {quemTexto})</p>
            ) : <p>{cargo} · {ano} · {quemTexto}</p>}
          </header>
          {chipsQuem("dinheiro-propaganda")}
          {comNuvem && pecas ? (
            <div className="din-nuvem">
              <NuvemPalavras nuvem={pecas} />
              <div>
                <p className="rotulo">As maiores peças</p>
                <ol className="din-pecas" aria-label={`As peças de propaganda de maior valor, ${cargoMin}, ${lugar}, ${ano}, ${quemTexto}`}>
                  {pecas.todos.slice(0, 8).map((t) => (
                    <li key={t.termo} title={t.explicacao ?? undefined}>
                      <span>{t.termo}</span>
                      <span className="din-pecas-trilho" aria-hidden="true"><i style={{ width: `${Math.round((t.centavos / pecas.todos[0].centavos) * 100)}%` }} /></span>
                      <b>{pct(t.parte, 0)}</b><small>{reais(t.centavos / 100)}</small>
                    </li>
                  ))}
                </ol>
                <p className="din-rodape">Total em propaganda: {reais(pecas.totalCentavos / 100)}</p>
              </div>
            </div>
          ) : (
            <p className="muted">{pecasPreparando ? "A nuvem ainda está sendo calculada. Recarregue a página em um ou dois minutos." : recebidasPecas === null ? "A API não devolveu a propaganda agora. Recarregue a página para tentar de novo." : "Há poucas peças de propaganda declaradas neste recorte para uma nuvem."}</p>
          )}
          <p className="din-rodape">O tamanho da palavra é o valor contratado · a cor é o tipo (material físico, rádio e TV, internet; cinza: não diz a peça){!mun && porte ? " · a nuvem não separa por porte: são todas as cidades do recorte" : ""} · <Link href={propaganda}>Propaganda em detalhe</Link></p>
        </section>}

        <details id="dinheiro-metodo" className="bloco noite s12 dinheiro-metodo">
          <summary>Como calculamos</summary>
          <ul>{(tela === "publico" ? CALCULO_P8_MAPA : CALCULO_MAPA_DINHEIRO).map((t) => <li key={t}>{t}</li>)}</ul>
        </details>

        {pintar !== "vaga" && <ul className="atalhos s12">
          <li><Link href={propaganda}>Onde os candidatos investem em propaganda</Link></li>
          <li><Link href={uf ? `/candidatos?uf=${uf}` : "/candidatos"}>Candidatos</Link></li>
        </ul>}
      </div>
    </>
  );
}

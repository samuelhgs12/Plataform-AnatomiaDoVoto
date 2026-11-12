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
  type Aba, type LinhaDespesa,
} from "@/lib/dinheiro";
import { METODOLOGIA } from "@/lib/metodologia";
import { naRegua, type FichaDica } from "@/lib/dica";
import { NOME_UF } from "@/lib/financiamento";
import { inteiro, pct, reais } from "@/lib/format";
import { centrarLupa, TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
import { BarraEmpilhada } from "./BarraEmpilhada";
import { BarrasH } from "./BarrasH";
import { ComparacoesDinheiro } from "./ComparacoesDinheiro";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { LinhasCandidatos, type LinhaCandidato } from "./LinhasCandidatos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { MiniMapa } from "./MiniMapa";
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
  const [dados, dadosDespesas] = await Promise.all([lerAnalise("municipios", ["municipios", "resumo", "estados"]), lerAnalise("dinheiro", ["despesas"])]);
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
          <a href="#dinheiro-ranking">{cidadesTopo.length ? "Cidades" : "Estados"}</a>
          {(fatiasOrigem.length > 0 || fatiasDestino.length > 0) && <a href="#dinheiro-origem">Origem e destino</a>}
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

        {/* o ranking (cidades do estado ou os seis estados) e, ao lado, de onde veio e para onde foi o dinheiro */}
        <section id="dinheiro-ranking" className={`bloco noite ${fatiasOrigem.length || fatiasDestino.length ? "s6" : "s12"} dinheiro-barras`}>
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

        {(fatiasOrigem.length > 0 || fatiasDestino.length > 0) && (
          <section id="dinheiro-origem" className="bloco noite s6 din-origem">
            <header className="din-sec">
              <h3>De onde veio, para onde foi</h3>
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

import type { ReactNode } from "react";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import {
  abaDe, ANOS_DINHEIRO, anoAnterior, classeComPorte, coberturaCurta, composicaoDespesas, contaGasto, contaGastoEstado, contasDaCidade, contasDoEstado, contasDoPorte, corCidade, corTerco,
  diferencaRelativa, ehMunicipal, escolhaMapaDinheiro, foraDaDisputa, hrefMapaDinheiro, legendaCidade, legendaPorFaixas, ordemCandidatos, ordenarCandidatos,
  ORDENS_CANDIDATOS, ordenarLinhas, origemDoDinheiro, PINTAR, referenciaDoPorte, TERCOS, textoCurto, textoDiferenca, textoValor, unidade, valorCidade, valorDoEstado, valorDoPorte, variacaoNominal,
  type Aba, type LinhaDespesa,
} from "@/lib/dinheiro";
import { METODOLOGIA } from "@/lib/metodologia";
import { naRegua, type FichaDica } from "@/lib/dica";
import { NOME_UF } from "@/lib/financiamento";
import { compacto, inteiro, pct, pctSinal, reais } from "@/lib/format";
import { centrarLupa, TELA } from "@/lib/lupa";
import { disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo } from "@/lib/territorio";
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
    return {
      // o selo do estado é curto e sem "R$" (a unidade está no título e na legenda): "222 mil", "9,2", "62%"
      uf: u, classe: corTerco(v, faixasUf), href: href({ uf: u === uf ? null : u }), sigla: u, valor: v === null ? "" : aba === "publico" ? textoCurto(v, aba) : aba === "eleitor" ? v.toLocaleString("pt-BR", { maximumFractionDigits: v < 10 ? 1 : 0 }) : compacto(v),
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
  const legenda = uf && municipal ? legendaCidade(aba, cargo) : legendaPorFaixas(faixasUf, (v) => textoCurto(v, aba), TERCOS);
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
  const fora = !mun && aba === "gasto" ? foraDaDisputa(estados, ano, uf, cargo) : null;

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
  const grupos = despesas ? composicaoDespesas(despesas, { ano, cargo, uf, mun: mun?.id_municipio }) : [];
  const totalGrupos = grupos.reduce((a, g) => a + g.valor, 0);

  // sem candidatos à vista: os estados lado a lado (ou, com um estado aberto, as cidades de maior valor)
  const estadosLista = ordenarLinhas(ufs.map((u, i) => ({ id: u, nome: NOME_UF[u] ?? u, valor: valoresUf[i], conta: contaUf(u) })), "valor");
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
  const tituloCidades = aba === "gasto" ? `Cidades de ${NOME_UF[uf!]} que mais gastaram${cargo === "Prefeito" ? " na disputa a prefeito" : " por vaga"}`
    : aba === "eleitor" ? `Cidades de ${NOME_UF[uf!]} que mais gastaram por eleitor` : `Cidades de ${NOME_UF[uf!]} com maior parte de dinheiro público`;
  // cartão do lugar escolhido, por cima do mapa: o número, a posição e o atalho para a seção dele embaixo
  const posUf = uf ? estadosLista.findIndex((e) => e.id === uf) : -1;
  const unidadeCurta = aba === "gasto" ? (cargo === "Prefeito" && mun ? "gastos por todas as campanhas a prefeito" : `por vaga de ${cargoMin}`) : aba === "eleitor" ? "por eleitor apto" : "do dinheiro recebido veio de fundos públicos";
  const semContas = contas && contas.com < contas.total ? `${inteiro(contas.total - contas.com)} de ${inteiro(contas.total)} candidaturas sem prestação final: total incompleto` : null;
  const cartao = mun ? {
    rotulo: `Município · ${uf} · ${cargo}`, nome: lugar,
    valor: textoValor(principal, aba, cargo), unidade: unidadeCurta,
    posicao: posMun >= 0 ? `${posMun + 1}ª de ${inteiro(cidadesUf.length)} cidades de ${NOME_UF[uf!]}${porteInfo ? ` (${porteInfo.rotulo})` : ""}` : null,
    extra: eleitoPrefeito ? `Eleito: ${eleitoPrefeito.nome_urna} (${eleitoPrefeito.partido}), ${eleitoPrefeito.prestou === false ? "sem prestação de contas final" : `gastou ${reais(eleitoPrefeito.gasto)}`}`
      : candidatos ? `${inteiro(linhas.length)} candidatos, ${inteiro(eleitos.length)} eleitos` : null,
    ir: { href: "#dinheiro-cand", texto: `Ver os ${linhas.length ? `${inteiro(linhas.length)} ` : ""}candidatos ↓` },
  } : uf ? {
    rotulo: `Estado · ${cargo}${porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}`, nome: lugar,
    valor: textoValor(principal, aba, cargo), unidade: unidadeCurta,
    posicao: posUf >= 0 ? `${posUf + 1}º de ${ufs.length} estados` : null,
    extra: municipal ? "Clique numa cidade do mapa para ver os candidatos dela." : null,
    ir: municipal ? { href: "#dinheiro-painel", texto: "Ver as cidades e as comparações ↓" } : { href: "#dinheiro-cand", texto: `Ver os ${inteiro(eleitos.length)} eleitos ↓` },
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
            <p className="palco-sobre">{cargo} · {municipal ? (uf ? "por cidade" : "por estado; clique para ver as cidades") : "eleição geral, por estado"}{porteInfo ? ` · só cidades de ${porteInfo.rotulo}` : ""}</p>
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
              {cartao.posicao && <p className="cartao-linha">{cartao.posicao}</p>}
              {cartao.extra && <p className="cartao-linha">{cartao.extra}</p>}
              {semContas && <p className="cartao-linha cartao-aviso">{semContas}</p>}
              <a className="cartao-ir" href={cartao.ir.href}>{cartao.ir.texto}</a>
            </aside>
          )}
        </div>

        <div className="palco-base">
          <ul className="legenda-q" aria-label={uf && municipal ? `Cores: faixas fixas de ${pintarInfo.rotulo.toLowerCase()}` : `Cores: três faixas dos estados por ${pintarInfo.rotulo.toLowerCase()}`}>
            {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
          </ul>
          <div className="palco-escolhas">
            <nav className="chips pintar" aria-label="O que pinta o mapa">
              {PINTAR.map((p) => (
                <a key={p.chave} href={href({ pintar: p.chave })} data-mapa="" className={`chip${p.chave === pintar ? " on" : ""}`} aria-current={p.chave === pintar ? "true" : undefined}>{p.rotulo}</a>
              ))}
            </nav>
            <div className="anos" role="group" aria-label="Ano da eleição">
              {ANOS_DINHEIRO.map((a) => (
                <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                  {a}<small>{ehMunicipal(a) ? "Municipal" : "Geral"}</small>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </MapaVivo>

      <div id="dinheiro-painel" className="painel s12" key={`dinheiro-${uf}-${mun?.id_municipio}-${ano}-${cargo}-${pintar}`}>
        {/* o caminho do painel: quanto → de onde veio e para onde foi → quem → comparações */}
        <nav className="painel-nav s12" aria-label="Seções do painel">
          <a href="#dinheiro-painel">Números</a>
          {(origem || grupos.length > 0) && <a href="#dinheiro-origem">De onde veio e para onde foi</a>}
          {temCandidatos && <a href="#dinheiro-cand">{mun ? "Candidatos" : "Eleitos"}</a>}
          <a href="#estados">Comparar os estados</a>
          <a href="#comparar">Quem teve mais dinheiro se elegeu mais?</a>
          <a href="#dinheiro-metodo">Como calculamos</a>
        </nav>

        <div className="bloco noite painel-cab s4">
          <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {cargo} · {ano}{!mun && porteInfo ? ` · cidades de ${porteInfo.rotulo}` : ""}</p>
          <h2>{lugar}</h2>
          <p className="painel-num longo"><Rolar valor={textoValor(principal, aba, cargo)} /></p>
          {aba === "gasto" && cargo === "Prefeito" && mun ? (
            <p>gastos por todas as campanhas a prefeito.</p>
          ) : aba === "gasto" ? (
            <p>por vaga de {cargoMin}{conta ? <>: <small className="muted">{reais(conta.gasto)} ÷ {inteiro(conta.vagas)} {conta.vagas === 1 ? "vaga" : "vagas"}</small></> : ""}.</p>
          ) : (
            <p>{unidade(aba, cargo)}.</p>
          )}
          {eleitoPrefeito && aba === "gasto" && <p className="pequeno">Prefeito eleito: <b>{eleitoPrefeito.nome_urna}</b> ({eleitoPrefeito.partido}), que {eleitoPrefeito.prestou === false ? "não tem prestação de contas final na base" : <>gastou <b>{reais(eleitoPrefeito.gasto)}</b></>}.</p>}

          {/* fichas: as outras medidas (clicáveis: trocam a pintura do mapa), a eleição anterior e as referências */}
          <ul className="fichas-dinheiro" aria-label="Outras medidas e referências">
            {outras.map((o) => (
              <li key={o.chave}><a href={href({ pintar: o.chave }, "dinheiro-painel")} data-mapa=""><small>{o.rotulo}</small><b>{textoValor(o.valor, o.aba, cargo)}</b><span className="ficha-acao">ver no mapa</span></a></li>
            ))}
            {antes !== null && valorAntes !== null && (
              <li><small>Em {antes}</small><b>{textoValor(valorAntes, aba, cargo)}</b>{variacao !== null && aba !== "publico" && <span className={`ficha-delta${variacao > 0 ? " sobe" : variacao < 0 ? " desce" : ""}`}>{pctSinal(variacao)} nominal</span>}</li>
            )}
            {cima !== null && (
              <li><small>{mun ? NOME_UF[uf!] : "Seis estados"}{porteInfo ? ` · ${porteInfo.rotulo.replace(" eleitores", "")}` : ""}</small><b>{textoValor(cima, aba, cargo)}</b><span className="ficha-nota">{unidadeCurta}</span></li>
            )}
            {referencia && referencia.valor !== null && (
              <li><small>Porte parecido · {porteCidade!.rotulo.replace(" eleitores", "")} ({inteiro(referencia.n)} cidades)</small><b>{textoValor(referencia.valor, aba, cargo)}</b><span className="ficha-nota">mediana</span>{difReferencia !== null && <span className={`ficha-delta${difReferencia > 0 ? " sobe" : difReferencia < 0 ? " desce" : ""}`}>{lugar.split(" ")[0]} está {textoDiferenca(difReferencia)}</span>}</li>
            )}
          </ul>
          {coberturaLinha && <p className={`pequeno cobertura${coberturaLinha.incompleta ? " cobertura-aviso" : " muted"}`}>{coberturaLinha.texto}</p>}
          {fora && <p className="pequeno muted">A Pergunta 1 soma ainda {reais(fora.gasto)} de {inteiro(fora.n)} {fora.n === 1 ? "campanha que não chegou" : "campanhas que não chegaram"} a disputar; aqui conta só quem disputou.</p>}
          {!mun && porte && <p className="pequeno muted">Soma das {inteiro(valorDoPorte(resumo, ano, uf, porte, aba, cargo).n)} cidades deste porte.</p>}
          {municipal && uf && (
            <EscolhaMunicipio
              opcoes={municipios.filter((m) => m.uf === uf).map((m) => [m.cod_ibge, nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
              atual={mun?.cod_ibge} params={paramsMun}
            />
          )}
        </div>

        {cidadesTopo.length > 0 ? (
          <div className="bloco noite s8 dinheiro-barras">
            <h3>{tituloCidades}</h3>
            <BarrasH compacto titulo={`${tituloCidades}, ${ano}`}
              linhas={cidadesTopo.map((c) => ({ chave: String(c.id), rotulo: `${cidadesUf.indexOf(c) + 1}º ${c.nome}`, valor: c.valor ?? 0, classe: c.id === mun?.id_municipio ? "pub" : "fx2", texto: textoValor(c.valor, aba, cargo),
                subtexto: aba === "gasto" && c.conta && cargo !== "Prefeito" ? `${reais(c.conta.gasto)} ÷ ${inteiro(c.conta.vagas)} ${c.conta.vagas === 1 ? "vaga" : "vagas"}` : "", href: href({ mun: codDe.get(c.id)! }), atual: c.id === mun?.id_municipio }))} />
            <p className="muted pequeno">{mun ? `${lugar} é a ${posMun + 1}ª de ${inteiro(cidadesUf.length)} cidades${porteInfo ? ` de ${porteInfo.rotulo}` : ""}.` : "Clique numa cidade, aqui ou no mapa, para ver os candidatos e quanto cada um gastou."}</p>
            <details className="ver-todos">
              <summary>Ver todas as {inteiro(cidadesUf.length)} cidades{porteInfo ? ` de ${porteInfo.rotulo}` : ""}</summary>
              <div className="tabela-rolar">
                <table className="dinheiro-tabela">
                  <thead><tr><th>Cidade</th><th>Porte</th><th className="num">{cargo === "Prefeito" ? "Gasto na disputa" : "Gasto por vaga"}</th><th className="num">Por eleitor</th><th className="num">Público</th><th className="num">Gasto total</th><th className="num">Contas na base</th></tr></thead>
                  <tbody>
                    {cidadesUf.map((c) => (
                      <tr key={c.id} aria-current={c.id === mun?.id_municipio ? "true" : undefined}>
                        <td><Link href={href({ mun: codDe.get(c.id)! })} scroll={false}>{c.nome}</Link></td>
                        <td>{c.porte?.replace(" eleitores", "") ?? "Não informado"}</td>
                        <td className="num">{textoValor(c.vaga, "gasto", cargo)}</td>
                        <td className="num">{textoValor(c.eleitor, "eleitor", cargo)}</td>
                        <td className="num">{textoValor(c.publico, "publico", cargo)}</td>
                        <td className="num">{c.conta ? reais(c.conta.gasto) : "Não informado"}</td>
                        <td className="num">{c.contas ? `${inteiro(c.contas.com)} de ${inteiro(c.contas.total)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted pequeno">Contas na base: candidaturas com prestação de contas final, do total que disputou. Sem ela, o gasto é desconhecido e entra como zero.</p>
            </details>
          </div>
        ) : (
          <div className="bloco noite s8 dinheiro-barras">
            <h3>{pintarInfo.rotulo} em cada estado</h3>
            <BarrasH compacto titulo={`${pintarInfo.rotulo} de ${cargoMin} em cada estado, ${ano}`}
              linhas={estadosLista.map((e) => ({ chave: e.id, rotulo: e.nome, valor: e.valor ?? 0, classe: !uf || uf === e.id ? "pub" : "fx2",
                texto: textoValor(e.valor, aba, cargo), subtexto: aba === "gasto" && e.conta ? `${reais(e.conta.gasto)} ÷ ${inteiro(e.conta.vagas)} vagas` : "", href: href({ uf: e.id }), atual: uf === e.id }))} />
            <p className="muted pequeno">{aba === "gasto" ? "Gasto de todas as campanhas ao cargo ÷ vagas." : aba === "eleitor" ? "Gasto de todas as campanhas ao cargo ÷ eleitores aptos do estado." : "Dinheiro dos fundos Eleitoral e Partidário ÷ tudo o que as campanhas receberam."} Valores sem correção pela inflação.</p>
          </div>
        )}

        {(origem || grupos.length > 0) && (
          <div id="dinheiro-origem" className="bloco noite s12 dinheiro-barras dinheiro-origem">
            <h3>De onde veio e para onde foi o dinheiro {mun ? `em ${lugar}` : uf ? `em ${NOME_UF[uf]}` : "nos seis estados"}</h3>
            <p className="comparacao-sub">{cargo} · {ano} · todas as campanhas ao cargo{porteInfo && !mun ? ` nas cidades de ${porteInfo.rotulo}` : ""}.</p>
            <div className="origem-destino">
              {origem && (
                <div>
                  <h4>De onde veio: {reais(origem.total)} recebidos</h4>
                  <BarrasH compacto titulo={`Dinheiro recebido pelas campanhas a ${cargoMin} ${mun ? `em ${lugar}` : uf ? `em ${NOME_UF[uf]}` : "nos seis estados"}, público e privado, ${ano}`}
                    linhas={[
                      { chave: "pub", rotulo: "Público", detalhe: "fundos Eleitoral e Partidário", valor: origem.publico, classe: "pub", trilhoCheio: true, texto: pct(origem.publico / origem.total, 0), subtexto: reais(origem.publico) },
                      { chave: "priv", rotulo: "Privado", detalhe: "doações de pessoas e recursos próprios", valor: origem.privado, classe: "priv", trilhoCheio: true, texto: pct(origem.privado / origem.total, 0), subtexto: reais(origem.privado) },
                    ]} max={origem.total} />
                  <p className="muted pequeno">Sem repasses entre candidatos (o mesmo real não conta duas vezes). Quem recebeu material em vez de dinheiro não aparece aqui.</p>
                </div>
              )}
              {grupos.length > 0 && (
                <div className="dinheiro-grupos">
                  <h4>Para onde foi: {reais(totalGrupos)} em despesas</h4>
                  <BarrasH compacto titulo={`Despesas das campanhas a ${cargoMin} ${mun ? `em ${lugar}` : uf ? `em ${NOME_UF[uf]}` : "nos seis estados"} por grupo, ${ano}`}
                    linhas={grupos.map((g) => ({ chave: g.grupo, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.valor, classe: g.grupo.startsWith("propaganda") ? "pub" : "fx2", texto: pct(g.parte, 0), subtexto: `${reais(g.valor)} · ${inteiro(g.despesas)} ${g.despesas === 1 ? "despesa" : "despesas"}` }))} />
                  <p className="muted pequeno">Grupos de categoria do TSE; valores contratados, não pagos; sem transferências a outros candidatos ou partidos. A propaganda em detalhe fica em <Link href={propaganda}>Onde os candidatos investem em propaganda</Link>.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {temCandidatos && (
          <div id="dinheiro-cand" className="bloco noite s12 dinheiro-cand">
            <h3>{mun ? `Candidatos a ${cargoMin} em ${lugar}` : `Eleitos: ${cargoMin} em ${NOME_UF[uf!]}`}</h3>
            {maisGastou && <p className="r-texto"><b>{maisGastou.nome_urna}</b> teve o maior gasto declarado e {maisGastou.eleito ? "foi eleito" : "não foi eleito"}.</p>}
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
              <details className="ver-todos"><summary>Ver todos os {inteiro(eleitos.length)} eleitos</summary>
                <LinhasCandidatos linhas={eleitos.slice(INICIO_LISTA)} ano={ano} vazio="" />
              </details>
            )}
            {naoEleitos.length > 0 && (
              <>
                <p className="rotulo">Não eleitos ({inteiro(naoEleitos.length)})</p>
                <LinhasCandidatos linhas={naoEleitos.slice(0, INICIO_LISTA)} ano={ano} vazio="" />
                {naoEleitos.length > INICIO_LISTA && (
                  <details className="ver-todos"><summary>Ver {naoEleitos.length > MAX_LISTA ? `os ${MAX_LISTA} primeiros (${ordInfo.rotulo.toLowerCase()})` : `todos os ${inteiro(naoEleitos.length)} não eleitos`}</summary>
                    <LinhasCandidatos linhas={naoEleitos.slice(INICIO_LISTA, MAX_LISTA)} ano={ano} vazio="" />
                  </details>
                )}
              </>
            )}
            <p className="muted pequeno">{mun ? "Gasto e dinheiro recebido de cada campanha, da prestação de contas final na base (não quer dizer contas aprovadas)." : "Por estado, só os eleitos."} Clique no nome para ver o perfil.</p>
          </div>
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

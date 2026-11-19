import type { ReactNode } from "react";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio } from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { ehMunicipal, escolhaMapaDinheiro, hrefMapaDinheiro } from "@/lib/dinheiro";
import { NOME_UF } from "@/lib/financiamento";
import { inteiro } from "@/lib/format";
import { TELA } from "@/lib/lupa";
import { fraseParesP2, METODOLOGIA } from "@/lib/metodologia";
import {
  ANOS_PATRIMONIO, anosDoTipo, classificar, composicaoEleitos, concordancia, concordanciaDeCandidatos, COR_CATEGORIA, corDaMetade, corDaParteCidades,
  disputaDeCandidatos, disputaEmOrdem, ehMajoritarioP2, escada, escadaDeCandidatos, escadaDeVotos, eixoSerie, fraseSerie, escadaPosicoes, frasePosicao, fraseTopo, histograma,
  histogramaDeCandidatos, juntarPatrimonio, legendaMetade, legendaParteCidades, legendaPrefeito, LISTAS, listaDeCandidatos, listaDoRecorte, medianasDeCandidatos,
  medianasDoRecorte, metadeDaCidade, metadeMaisRica, MINIMO_CANDIDATOS, posicaoDoEleito, quemTinha, recorteDaDisputa, rotuloSemCargo,
  serieDisputa, serieMaisRico, serieMetade, serieMetadeCidade, taxaDoTopo, tituloP2, topoDaComposicao, valorTipico, vitoriaDoMaisRico,
  type Degrau, type FiltroP2, type LinhaDecil, type LinhaDisputa, type LinhaFaixa, type LinhaLista, type LinhaMedianas, type LinhaPares, type LinhaPessoa,
  type LinhaPosicao, type LinhaVereadorCidade, type PosicaoEleito,
} from "@/lib/patrimonio";
import type { CandidatoLocal, LinhaMunicipio } from "@/lib/territorio";
import { ComposicaoEleitos } from "./ComposicaoEleitos";
import { DispersaoPatrimonio } from "./DispersaoPatrimonio";
import { EscadaPatrimonio } from "./EscadaPatrimonio";
import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { FaixasPatrimonio } from "./FaixasPatrimonio";
import { ListaPatrimonio } from "./ListaPatrimonio";
import { MapaAbstencao, type EstadoNoMapa, type MarcaMapa, type MunicipioNoMapa } from "./MapaAbstencao";
import { MapaVivo } from "./MapaVivo";
import { SerieDisputa, SeriePatrimonio } from "./SeriePatrimonio";

type SP = Record<string, string | string[] | undefined>;
const um = (v: SP[string]) => (Array.isArray(v) ? v[0] : v);
const pc = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const SELO_CATEGORIA: Record<string, string> = { primeiro: "1º", segundo: "2º", sem_bens: "s/ bens", fora: "—" };
const seloPosicao = (p: PosicaoEleito | null) => (!p ? "—" : p.categoria === "abaixo" ? `${p.posicao}º` : SELO_CATEGORIA[p.categoria]);

/**
 * Camada Dinheiro do mapa, pergunta 2 (?ver=dinheiro&pintar=voto): existe relação entre o patrimônio declarado e a
 * vitória? Cada candidato é comparado só com os concorrentes da mesma disputa. O mapa pinta, por cidade (vereador) ou
 * estado (deputados), a parte dos eleitos que estava na metade mais rica dos candidatos, numa escala divergente com o
 * neutro em 50–60%; para prefeito, onde o eleito estava no patrimônio (o mais rico, o 2º, abaixo), com marca quando ele
 * já era prefeito. Embaixo: a escada, eleitos × não eleitos, quem são os eleitos, os candidatos e a série ao longo do
 * tempo (com e sem quem já tinha o cargo); a frase dos pares fica em "Como calculamos". Com uma cidade escolhida, tudo é da cidade. `?semcargo=1` tira quem já tinha o cargo.
 * Dados: tabelas pat_* de /api/analises/q2 (estado) ou, na cidade, a lista de candidatos + pat_cidade_<ano>; as contas
 * estão em src/lib/patrimonio.ts.
 */
export async function VisaoPatrimonio({ menu, sp }: { menu: ReactNode; sp: SP }) {
  const { ano, cargo, semCargo, lista } = escolhaMapaDinheiro(sp);
  const majoritario = ehMajoritarioP2(cargo);
  const municipal = ehMunicipal(ano);
  const cargoMin = cargo.toLowerCase();
  const pedidoUf = um(sp.uf);
  // várias leituras pequenas (cada uma abaixo de 2 MB, para o Next guardar em cache), só as que o recorte usa
  const [dadosMun, dadosMapa, dadosPainel, dadosLista] = await Promise.all([
    lerAnalise("municipios", ["municipios"]),
    lerAnalise("q2", majoritario ? ["pat_disputas"] : ["pat_decis", ...(cargo === "Vereador" ? ["pat_vereador"] : [])]),
    pedidoUf ? lerAnalise("q2", [...(majoritario ? ["pat_posicoes"] : []), "pat_medianas", "pat_faixas", "pat_pares"]) : Promise.resolve(null),
    pedidoUf && !um(sp.mun) ? lerAnalise("q2", ["pat_lista"]) : Promise.resolve(null),
  ]);
  const titulo = tituloP2(cargo, ano);
  if (!dadosMun?.municipios || !(majoritario ? dadosMapa?.pat_disputas : dadosMapa?.pat_decis) || (cargo === "Vereador" && !dadosMapa?.pat_vereador)) {
    return (
      <MapaVivo className="palco s12">
        {menu}
        <div className="palco-topo"><div><h1 id="h-mapa">{titulo}</h1></div></div>
        <div className="card aviso">
          <h2>Patrimônio indisponível</h2>
          <p>A API não devolveu a análise <code>q2</code> (tabelas <code>pat_*</code>). Confira se ela está rodando (<code>uvicorn app.main:app</code> em <code>api/</code>) e se já leu a versão nova de <code>q2.sql</code> (o cache dela dura até 1 hora).</p>
        </div>
      </MapaVivo>
    );
  }
  const municipios = comoObjetos<LinhaMunicipio>(dadosMun.municipios);
  const decis = dadosMapa?.pat_decis ? comoObjetos<LinhaDecil>(dadosMapa.pat_decis) : [];
  const porCidade = dadosMapa?.pat_vereador ? comoObjetos<LinhaVereadorCidade>(dadosMapa.pat_vereador) : [];
  const disputas = dadosMapa?.pat_disputas ? comoObjetos<LinhaDisputa>(dadosMapa.pat_disputas) : [];
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === pedidoUf);
  const mun = municipal && uf ? municipios.find((m) => m.uf === uf && m.cod_ibge === um(sp.mun)) : undefined;
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Os seis estados";
  const href = (novo: Parameters<typeof hrefMapaDinheiro>[1], ancora?: string) =>
    hrefMapaDinheiro({ ano, cargo, uf, mun: mun?.cod_ibge, pintar: "voto", semCargo, lista }, novo, ancora);
  // governador e senador: uma disputa por estado e eleição; a escada junta as eleições do estado (2006 a 2022)
  const umaPorEstado = majoritario && !municipal;
  const anosEscada = umaPorEstado ? anosDoTipo(cargo) : [ano];

  // ---------- o mapa: cada estado e, com um estado aberto nas municipais, cada cidade ----------
  const doEstado = (u: string, sc = semCargo) => {
    if (!majoritario) {
      const m = metadeMaisRica(escada(decis, { anos: [ano], cargo, uf: u }, { semCargo: sc }));
      return { classe: corDaMetade(m.parte, m.candidatos), selo: pc(m.parte), parte: m.parte, texto: m.parte === null ? "sem dado" : `${pc(m.parte)} dos eleitos estavam na metade mais rica`, marca: undefined as MarcaMapa | undefined };
    }
    if (cargo === "Prefeito") {
      const v = vitoriaDoMaisRico(disputas, { anos: [ano], cargo, uf: u }, { semCargo: sc });
      return { classe: corDaParteCidades(v.parte), selo: pc(v.parte), parte: v.parte, texto: v.parte === null ? "sem dado" : `${pc(v.parte)} das cidades elegeram o mais rico (${inteiro(v.venceu)} de ${inteiro(v.comparaveis)})`, marca: undefined };
    }
    const d = disputas.find((x) => x.ano === ano && x.cargo === cargo && x.uf === u);
    const p = d ? posicaoDoEleito(d, { semCargo: sc }) : null;
    return { classe: p ? COR_CATEGORIA[p.categoria] : "sem", selo: seloPosicao(p), parte: null, texto: p ? frasePosicao(p) : "sem dado", marca: (p?.categoria === "fora" ? "hachura" : p?.eleitoTinha ? "pontos" : undefined) as MarcaMapa | undefined };
  };
  const noMapaUf: EstadoNoMapa[] = ufs.map((u) => {
    const e = doEstado(u);
    return { uf: u, classe: e.classe, href: href({ uf: u === uf ? null : u }), sigla: u, valor: e.selo, descricao: `${NOME_UF[u] ?? u}, ${cargoMin}, ${ano}: ${e.texto}`, marca: e.marca };
  });
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const atraso = (ibge: string) => (caixa ? Math.round(((CENTRO_MUNICIPIO[ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100 : 0);
  const disputaDaCidade = new Map(disputas.filter((d) => d.ano === ano && d.cargo === cargo && d.id_municipio !== null).map((d) => [d.id_municipio!, d]));
  const cidadesUf = uf ? municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]) : [];
  const estadoAqui = uf ? doEstado(uf) : null;
  const noMapaMun: MunicipioNoMapa[] = !uf || !caixa ? [] : cidadesUf.map((m) => {
    const nome = nomeMun.get(m.id_municipio)!;
    const base = { ibge: m.cod_ibge, href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.cod_ibge }), atraso: atraso(m.cod_ibge) };
    if (!municipal) return { ...base, href: href({}), classe: estadoAqui!.classe, dica: `${nome} · ${NOME_UF[uf]}: ${estadoAqui!.texto}` };
    if (cargo === "Vereador") {
      const md = metadeDaCidade(porCidade, ano, m.id_municipio, { semCargo });
      const classe = corDaMetade(md?.parte ?? null, md?.candidatos ?? 0);
      return { ...base, classe, marca: classe === "poucos" ? "hachura" : undefined,
        dica: !md ? `${nome}: sem dado` : classe === "poucos" ? `${nome}: poucos candidatos (${md.candidatos})` : `${nome}: ${pc(md.parte)} dos eleitos na metade mais rica (${md.rica} de ${md.comBens} com bens)` };
    }
    const d = disputaDaCidade.get(m.id_municipio);
    const p = d ? posicaoDoEleito(d, { semCargo }) : null;
    return { ...base, classe: p ? COR_CATEGORIA[p.categoria] : "sem", marca: p?.categoria === "fora" ? "hachura" : p?.eleitoTinha ? "pontos" : undefined,
      dica: `${nome}: ${p ? frasePosicao(p) : "sem dado"}${p?.eleitoTinha && p.categoria !== "fora" ? " · já era prefeito" : ""}` };
  });
  const legenda = uf && municipal
    ? (cargo === "Vereador" ? legendaMetade() : [...legendaPrefeito(), { classe: "pontos", texto: "já era prefeito" }])
    : !majoritario ? legendaMetade().filter((l) => l.classe !== "poucos") : cargo === "Prefeito" ? legendaParteCidades() : [...legendaPrefeito().filter((l) => l.classe !== "psb"), { classe: "pontos", texto: `já era ${cargoMin}` }];
  const base: [number, number, number, number] = caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA];
  const quadro: [number, number, number, number] | undefined = uf ? [base[0], base[1], base[2] + (base[2] - base[0]) * (caixa ? 0.8 : 0.7), base[3]] : undefined;
  const camera = enquadrar(quadro ?? base, TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;

  // ---------- o painel: estado (tabelas pat_*) ou cidade (a lista de candidatos com o patrimônio) ----------
  const [candidatos, pessoasTab] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    mun ? lerAnalise("q2", [`pat_cidade_${ano}`]) : Promise.resolve(null),
  ]);
  const pessoas = pessoasTab?.[`pat_cidade_${ano}`] ? comoObjetos<LinhaPessoa>(pessoasTab[`pat_cidade_${ano}`]) : null;
  const cls = mun && candidatos && pessoas ? classificar(juntarPatrimonio(candidatos, pessoas)) : null;
  const rec = (sc: boolean) => (cls ? recorteDaDisputa(cls, { majoritario, semCargo: sc }) : []);
  const recAqui = rec(semCargo);
  const posicoes = dadosPainel?.pat_posicoes ? comoObjetos<LinhaPosicao>(dadosPainel.pat_posicoes) : [];
  const f: FiltroP2 = { anos: anosEscada, cargo, uf };
  const degrausDe = (sc: boolean): Degrau[] => (mun ? escadaDeCandidatos(rec(sc), { majoritario }) : majoritario ? escadaPosicoes(posicoes, f, { semCargo: sc }) : escada(decis, f, { semCargo: sc }));
  // prefeito numa cidade: uma disputa só; a escada mostra os votos de cada candidato, do menos ao mais rico
  const cidadeUnica = !!(mun && majoritario && cls);
  // vereador numa cidade com poucos candidatos: um ou dois por décimo dariam 0% ou 100%; mostra os votos de cada um
  const poucos = !!(mun && !majoritario && cls && cls.length < MINIMO_CANDIDATOS);
  const porCandidato = cidadeUnica || poucos;
  const degraus = !uf ? [] : porCandidato ? (recAqui.length ? escadaDeVotos(recAqui) : []) : degrausDe(semCargo);
  const [topoCom, topoSem] = uf ? [taxaDoTopo(degrausDe(false), { majoritario }), taxaDoTopo(degrausDe(true), { majoritario })] : [null, null];
  const metade = !majoritario && uf ? metadeMaisRica(degrausDe(semCargo)) : null;
  const metadeOutra = !majoritario && uf ? metadeMaisRica(degrausDe(!semCargo)) : null;
  // a disputa única (prefeito na cidade, governador ou senador no estado): onde estava o eleito
  const disputaUnica = mun && majoritario && cls ? disputaDeCandidatos(cls, { ano, cargo, uf: uf!, id_municipio: mun.id_municipio })
    : umaPorEstado && uf ? disputas.find((d) => d.ano === ano && d.cargo === cargo && d.uf === uf) ?? null : null;
  const posUnica = disputaUnica ? posicaoDoEleito(disputaUnica, { semCargo }) : null;
  const vitoria = cargo === "Prefeito" && uf && !mun ? vitoriaDoMaisRico(disputas, { anos: [ano], cargo, uf }, { semCargo }) : null;
  const vitoriaOutra = cargo === "Prefeito" && uf && !mun ? vitoriaDoMaisRico(disputas, { anos: [ano], cargo, uf }, { semCargo: !semCargo }) : null;
  const medTab = dadosPainel?.pat_medianas ? comoObjetos<LinhaMedianas>(dadosPainel.pat_medianas) : [];
  const medianas = mun ? (cls ? medianasDeCandidatos(recAqui) : null) : uf ? medianasDoRecorte(medTab, { ano, cargo, uf }, { semCargo }) : null;
  const hist = mun ? (cls ? histogramaDeCandidatos(recAqui) : null) : uf && dadosPainel?.pat_faixas ? histograma(comoObjetos<LinhaFaixa>(dadosPainel.pat_faixas), { anos: [ano], cargo, uf }, { semCargo }) : null;
  const grupos = cidadeUnica ? [] : composicaoEleitos(degraus, { majoritario });
  const topoComp = topoDaComposicao(grupos);
  const pares = mun ? (cls ? concordanciaDeCandidatos(recAqui) : null) : uf && dadosPainel?.pat_pares ? concordancia(comoObjetos<LinhaPares>(dadosPainel.pat_pares), { anos: [ano], cargo, uf }, { semCargo }) : null;
  const listas = dadosLista?.pat_lista ? comoObjetos<LinhaLista>(dadosLista.pat_lista) : null;
  const itens = mun ? (cls ? listaDeCandidatos(recAqui.length ? recAqui : [], lista) : []) : uf && listas ? listaDoRecorte(listas, { ano, cargo, uf }, lista, { semCargo }) : [];
  const disputaInteira = mun && majoritario && cls ? disputaEmOrdem(cls) : null;
  const eleitoUnico = mun && majoritario && cls ? cls.filter((c) => c.eleito).sort((a, b) => a.posicao - b.posicao)[0] : undefined;
  // a série: a cidade (vereador: a metade; prefeito: a posição do eleito) ou o estado
  const serieDe = (sc: boolean) => (!uf ? null : cargo === "Vereador" ? (mun ? serieMetadeCidade(porCidade, mun.id_municipio, { semCargo: sc }) : serieMetade(decis, cargo, uf, { semCargo: sc }))
    : !majoritario ? serieMetade(decis, cargo, uf, { semCargo: sc }) : cargo === "Prefeito" && !mun ? serieMaisRico(disputas, cargo, uf, { semCargo: sc }) : null);
  const [serieCom, serieSem] = [serieDe(false), serieDe(true)];
  const linhasSerie = serieCom && serieSem ? [
    { nome: "com todos", pontos: serieCom, fina: semCargo },
    { nome: majoritario ? "sem disputas|com reeleição" : "sem quem já|tinha o cargo", pontos: serieSem, fina: !semCargo },
  ] : [];
  const eixo = eixoSerie([...(serieCom ?? []), ...(serieSem ?? [])].map((x) => x.valor), cargo);
  const tituloSerie = (semCargo ? serieSem : serieCom) ? fraseSerie((semCargo ? serieSem : serieCom)!, cargo) : null;
  const serieUnica = uf && majoritario && (mun || umaPorEstado) ? serieDisputa(disputas, cargo, uf, mun ? mun.id_municipio : null, { semCargo }) : null;
  const anosSerie = anosDoTipo(cargo);
  // ---------- o cartão do lugar (sobre o mapa) ----------
  const tipicos = medianas && (medianas.medianaEleitos !== null || medianas.medianaTodos !== null) ? `Eleito típico: ${valorTipico(medianas.medianaEleitos)} · candidato típico: ${valorTipico(medianas.medianaTodos)}` : null;
  const outraVariante = semCargo ? "Com todos" : `Sem ${quemTinha(cargo)}`;
  const cartao = !uf ? null : posUnica ? {
    rotulo: `${mun ? `Município · ${uf}` : "Estado"} · ${cargo}`,
    valor: seloPosicao(posUnica), unidade: frasePosicao(posUnica).replace(/^O eleito era o /, "o eleito era o "),
    linha: eleitoUnico ? `Eleito: ${nomeProprio(eleitoUnico.nome_urna ?? "")} (${eleitoUnico.partido ?? "?"}), ${eleitoUnico.patrimonio > 0 ? valorTipico(eleitoUnico.patrimonio) : "sem bens declarados"}` : null,
    selos: [posUnica.eleitoTinha && posUnica.categoria !== "fora" ? `já era ${cargoMin}` : null].filter((x): x is string => !!x),
  } : vitoria ? {
    rotulo: `Estado · ${cargo}`, valor: pc(vitoria.parte), unidade: `das cidades elegeram o candidato mais rico (${inteiro(vitoria.venceu)} de ${inteiro(vitoria.comparaveis)})`,
    linha: tipicos,
    selos: [vitoriaOutra?.parte != null ? `${outraVariante}: ${pc(vitoriaOutra.parte)}` : null, vitoria.categorias.fora ? `${inteiro(vitoria.categorias.fora)} cidades fora da conta` : null].filter((x): x is string => !!x),
  } : metade ? {
    rotulo: `${mun ? `Município · ${uf}` : "Estado"} · ${cargo}`, valor: pc(metade.parte), unidade: "dos eleitos estavam na metade mais rica dos candidatos",
    linha: tipicos,
    selos: [metadeOutra?.parte != null ? `${outraVariante}: ${pc(metadeOutra.parte)}` : null,
      metade.eleitos ? `${pc(metade.semBens / metade.eleitos)} dos eleitos sem bens` : null, mun && metade.candidatos < MINIMO_CANDIDATOS ? "poucos candidatos" : null].filter((x): x is string => !!x),
  } : null;
  const paramsMun = Object.fromEntries(new URL(href({ mun: null }), "http://x").searchParams);
  const chips = (ancora: string) => (
    <nav className="chips p2-chips" aria-label="Quem entra na conta">
      {[false, true].map((sc) => (
        <Link key={String(sc)} href={href({ semCargo: sc }, ancora)} scroll={false} className={`chip${sc === semCargo ? " on" : ""}`} aria-current={sc === semCargo ? "true" : undefined}>
          {sc ? rotuloSemCargo(cargo) : "Com todos"}
        </Link>
      ))}
    </nav>
  );
  const fraseFaixa = poucos && metade ? `Poucos candidatos (${cls!.length}): ${metade.rica} de ${metade.comBens} eleitos com bens estavam na metade mais rica; com tão poucas pessoas, as porcentagens mudam muito com uma a mais ou a menos.` : cidadeUnica ? (posUnica ? `${frasePosicao(posUnica)}${posUnica.eleitoTinha && posUnica.categoria !== "fora" ? ", e já era prefeito" : ""}.` : null) : fraseTopo(cargo, topoCom, topoSem, semCargo);
  const naDisputa = mun ? (cargo === "Prefeito" ? `os candidatos a prefeito de ${lugar}` : `os candidatos de ${lugar}`) : cargo === "Vereador" || cargo === "Prefeito" ? "os da mesma cidade" : `os do mesmo estado`;
  const semPainel = mun && (!candidatos || !pessoas);

  return (
    <>
      <MapaVivo className="palco s12 palco-dinheiro palco-p2" estado={uf}>
        {menu}
        <div className="palco-topo">
          <div>
            <h1 id="h-mapa">{titulo}</h1>
            <p className="palco-sobre">{cargo} · patrimônio declarado, comparado dentro de cada disputa{semCargo ? ` · sem ${quemTinha(cargo)}` : ""}</p>
          </div>
          <nav className="trilha" aria-label="Onde você está no mapa">
            <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
            {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
            {mun && <><span aria-hidden="true">/</span><span aria-current="true">{lugar}</span></>}
          </nav>
        </div>

        <div className="palco-mapa">
          <MapaAbstencao
            titulo={`${titulo}: ${lugar}`} camera={camera} estados={noMapaUf} uf={uf} municipios={noMapaMun}
            destaque={mun && centro ? { ibge: mun.cod_ibge, nome: lugar, x: centro[0], y: centro[1] } : undefined}
          />
          {!uf && <p className="palco-dica">Selecione um estado para ver cidade por cidade</p>}
          <p className="carregando-mapa" aria-hidden="true">Carregando…</p>
          {cartao && (
            <aside className="cartao-lugar cartao-p2" aria-label={`Resumo: ${lugar}`}>
              <a className="cartao-fechar" href={href(mun ? { mun: null } : { uf: null })} data-mapa="" aria-label={mun ? "Voltar ao estado" : "Voltar aos seis estados"}>×</a>
              <p className="cartao-rotulo">{cartao.rotulo} · {ano}</p>
              <h2>{lugar}</h2>
              <p className="cartao-valor"><b>{cartao.valor}</b> {cartao.unidade}</p>
              {cartao.linha && <p className="cartao-linha">{cartao.linha}</p>}
              {degraus.length > 1 && <EscadaPatrimonio mini votos={porCandidato} degraus={degraus} titulo={porCandidato ? `Votos de cada candidato, do menos ao mais rico, ${lugar}` : `Taxa de eleição por grupo de patrimônio, ${lugar}`} />}
              <p className="cartao-selos">{cartao.selos.map((s) => <span key={s}>{s}</span>)}</p>
            </aside>
          )}
        </div>

        <div className="palco-base">
          <ul className="legenda-q legenda-p2" aria-label={!majoritario ? "Cores: parte dos eleitos que estava na metade mais rica dos candidatos da disputa" : "Cores: onde o eleito estava no patrimônio da disputa"}>
            {legenda.map((l) => <li key={l.texto}><i className={l.classe} />{l.texto}</li>)}
          </ul>
          <div className="anos anos-p2" role="group" aria-label="Ano da eleição">
            {ANOS_PATRIMONIO.map((a) => (
              <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                {a}<small>{ehMunicipal(a) ? "Mun." : "Geral"}</small>
              </Link>
            ))}
          </div>
        </div>
      </MapaVivo>

      {uf && <div id="dinheiro-painel" className="painel s12 din p2" key={`p2-${uf}-${mun?.id_municipio}-${ano}-${cargo}-${semCargo}`}>
        <header className="din-cab s12">
          <div>
            <p className="din-kicker">{mun ? `Município · ${uf}` : "Estado"} · {cargo} · {ano}</p>
            <h2>{lugar}</h2>
          </div>
          {municipal && (
            <EscolhaMunicipio
              opcoes={municipios.filter((m) => m.uf === uf).map((m) => [m.cod_ibge, nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
              atual={mun?.cod_ibge} params={paramsMun}
            />
          )}
        </header>

        {semPainel && <p className="card aviso s12">Não foi possível carregar os candidatos de {lugar} agora (a API não respondeu). Recarregue a página para tentar de novo.</p>}

        {/* 1. a escada */}
        <section id="p2-escada" className="bloco noite s12 p2-escada">
          <header className="din-sec">
            <h3>Quanto mais patrimônio, mais eleitos?</h3>
            <p>{porCandidato ? `Votos de cada candidato no 1º turno, do que declarou menos ao que declarou mais (${cidadeUnica ? "o eleito" : "os eleitos"} em destaque)${cidadeUnica ? "; uma disputa só, sem porcentagem de vitória" : `; com ${cls!.length} candidatos, décimos não dizem nada`}` : majoritario ? "Quantos venceram em cada posição no patrimônio da própria disputa" : "Quantos se elegeram em cada décimo de patrimônio, do menos ao mais rico"}{porCandidato ? "" : <>: cada candidato comparado só com {naDisputa}</>}
              {umaPorEstado ? ` · ${anosDoTipo(cargo).length} eleições, ${anosDoTipo(cargo)[0]} a ${anosDoTipo(cargo).at(-1)}` : ""}</p>
          </header>
          {degraus.length ? (
            <EscadaPatrimonio votos={porCandidato} degraus={degraus} titulo={porCandidato ? `Parte dos votos de cada candidato a ${cargoMin} em ${lugar}, ${ano}, do menos ao mais rico` : `Taxa de eleição por grupo de patrimônio declarado, ${cargoMin}, ${lugar}, ${umaPorEstado ? "2006 a 2022" : ano}`} />
          ) : <p className="muted">{mun && posUnica?.categoria === "fora" ? `${frasePosicao(posUnica)}.` : "Sem candidatos comparáveis neste recorte."}</p>}
          <div className="p2-faixa">
            <p>{fraseFaixa ?? "Sem dados para a comparação."}</p>
            {chips("p2-escada")}
          </div>
          <p className="din-rodape">{porCandidato ? "Em cima, a parte dos votos; embaixo, o patrimônio declarado." : "Embaixo, o patrimônio típico de cada grupo; “sem bens” fica à parte."}</p>
        </section>

        {/* 2. eleitos × não eleitos e quem são os eleitos */}
        <section id="p2-declararam" className={`bloco noite s12${cidadeUnica ? "" : " meia"} p2-declararam`}>
          <header className="din-sec">
            <h3>Eleitos e não eleitos: quanto declararam</h3>
            <p>{medianas ? <>Eleito típico: <b>{valorTipico(medianas.medianaEleitos)}</b> · não eleito típico: <b>{valorTipico(medianas.medianaNao)}</b></> : `${cargo} · ${ano}`}</p>
          </header>
          {hist ? <FaixasPatrimonio h={hist} m={medianas} titulo={`Patrimônio declarado de eleitos e não eleitos, ${cargoMin}, ${lugar}, ${ano}`} /> : <p className="muted">Sem dados neste recorte.</p>}
        </section>
        {!cidadeUnica && <section id="p2-composicao" className="bloco noite s12 meia p2-composicao">
          <header className="din-sec">
            <h3>Quem são os eleitos</h3>
            <p>{topoComp ? <>{majoritario ? "O mais rico de cada disputa" : "O décimo mais rico"} é <b>{pc(topoComp.parteCandidatos)}</b> dos candidatos, mas <b>{pc(topoComp.parteEleitos)}</b> dos eleitos.</> : `${cargo} · ${ano}`}</p>
          </header>
          {grupos.length ? <ComposicaoEleitos grupos={grupos} titulo={`Candidatos e eleitos por grupo de patrimônio, ${cargoMin}, ${lugar}`} /> : <p className="muted">Sem dados neste recorte.</p>}
          {umaPorEstado && <p className="din-rodape">{anosDoTipo(cargo).length} eleições para {cargoMin} juntas (2006 a 2022)</p>}
        </section>}

        {/* 3. os candidatos */}
        <section id="p2-candidatos" className="bloco noite s12 p2-candidatos">
          <header className="din-sec">
            <h3>Os candidatos</h3>
            <p>{disputaInteira ? `A disputa inteira em ${lugar}, do mais rico ao que não declarou bens` : `${cargo} · ${lugar} · ${ano}${semCargo ? ` · sem ${quemTinha(cargo)}` : ""}`}</p>
          </header>
          {disputaInteira ? (
            <ListaPatrimonio itens={disputaInteira} ano={ano} inicio={10} titulo={`Candidatos a ${cargoMin} em ${lugar}, ${ano}, em ordem de patrimônio declarado`} />
          ) : (
            <>
              <nav className="chips p2-abas" aria-label="Qual lista">
                {LISTAS.map((l) => (
                  <Link key={l.chave} href={href({ lista: l.chave }, "p2-candidatos")} scroll={false} className={`chip${l.chave === lista ? " on" : ""}`} aria-current={l.chave === lista ? "true" : undefined}>{l.rotulo}</Link>
                ))}
              </nav>
              <div className={mun && cls && cls.length > 2 ? "p2-cand-duas" : undefined}>
                {mun && cls && cls.length > 2 && <DispersaoPatrimonio cls={recAqui} titulo={`Patrimônio declarado e posição nos votos dos candidatos a ${cargoMin} em ${lugar}, ${ano}`} />}
                {mun || listas ? (
                  <ListaPatrimonio itens={itens} ano={ano} comCidade={!mun && municipal} titulo={`${LISTAS.find((l) => l.chave === lista)!.rotulo}: ${cargoMin}, ${lugar}, ${ano}`} />
                ) : <p className="muted">A API não devolveu a lista agora. Recarregue a página para tentar de novo.</p>}
              </div>
            </>
          )}
          <p className="din-rodape">Valores declarados pelo candidato ao TSE; podem conter erros.</p>
        </section>

        {/* 4. ao longo do tempo, na largura toda */}
        <section id="p2-serie" className="bloco noite s12 p2-serie">
          <header className="din-sec">
            <h3>{serieUnica ? `De ${anosSerie[0]} a ${anosSerie.at(-1)}: onde estava o eleito` : tituloSerie ?? `De ${anosSerie[0]} a ${anosSerie.at(-1)}`}</h3>
          </header>
          {serieUnica ? <SerieDisputa anos={serieUnica} atual={ano} titulo={`Posição do eleito no patrimônio, ${cargoMin}, ${lugar}, ${anosSerie[0]} a ${anosSerie.at(-1)}`} />
            : linhasSerie.length ? <SeriePatrimonio linhas={linhasSerie} eixo={eixo} atual={ano} referencia={!majoritario ? "50% = sem relação" : undefined} titulo={`${!majoritario ? "Eleitos na metade mais rica" : "Cidades que elegeram o mais rico"}, ${cargoMin}, ${lugar}, ${anosSerie[0]} a ${anosSerie.at(-1)}`} />
            : <p className="muted">Sem série para este recorte.</p>}
        </section>
        <details id="dinheiro-metodo" className="bloco noite s12 dinheiro-metodo">
          <summary>Como calculamos</summary>
          <ul>{[...METODOLOGIA.p2.calculo.map((t) => (t === fraseParesP2() ? fraseParesP2(pares?.parte, mun ? `de ${lugar}` : cargo === "Vereador" || cargo === "Prefeito" ? "da mesma cidade" : "do mesmo estado") : t)), ...METODOLOGIA.p2.limites].map((t) => <li key={t}>{t}</li>)}</ul>
        </details>
      </div>}
    </>
  );
}

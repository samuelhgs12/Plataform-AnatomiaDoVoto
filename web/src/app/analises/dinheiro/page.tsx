import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { enquadrar, nomeProprio, quantis } from "@/lib/abstencao";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import {
  ABAS, cargosDoAno, classeComPorte, corCidade, corPorFaixas, ehMajoritario, ehMunicipal, emCada100, FAIXAS_PARTE_CIDADES, fraseTaxas,
  hrefDinheiro, legendaCidade, lerRecorte, qualificacao, referenciaDoPorte, textoValor, unidade, valorCidade, valorDoEstado,
} from "@/lib/dinheiro";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaSucesso } from "@/lib/financiamento";
import { inteiro, pct, reais } from "@/lib/format";
import { coberturaDisputas, daMedida, grupo, maiorGastador, respostaGasto, respostaMaior, sucessoPorGasto, type LinhaGastoFaixa, type LinhaMaiorGasto } from "@/lib/gastos";
import { TELA } from "@/lib/lupa";
import {
  disputaPrefeito, porteDe, PORTES, type CandidatoLocal, type Eleito, type LinhaEstado, type LinhaMunicipio, type LinhaResumo,
} from "@/lib/territorio";
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

export default async function Dinheiro({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("municipios", ["municipios", "resumo", "estados"]);
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
  const { ano, cargo, aba, uf, mun } = r;
  const municipal = ehMunicipal(ano);
  const majoritario = ehMajoritario(cargo);
  const porteFiltro = PORTES.some((p) => p.chave === um(sp.porte)) && municipal ? um(sp.porte) : undefined;
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));
  const lugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Os seis estados";
  const doAno = new Map(resumo.filter((x) => x.ano === ano).map((x) => [x.id_municipio, x]));
  const linhaMun = mun ? doAno.get(mun.id_municipio) : undefined;
  const porte = porteDe(linhaMun?.eleitorado);
  const href = (novo: Parameters<typeof hrefDinheiro>[1] = {}, ancora?: string) => {
    const h = hrefDinheiro(r, novo, ancora);
    return porteFiltro && !("porte" in novo) ? h.replace("?", `?porte=${porteFiltro}&`) : h;
  };
  const infoAba = ABAS.find((a) => a.chave === aba)!;

  // dados de cada aba (só o que ela usa)
  const [q2, q8] = await Promise.all([
    aba === "resultado" ? lerAnalise("q2", ["faixas", "maior_gasto"]) : Promise.resolve(null),
    aba === "publico" ? lerAnalise("q8", ["sucesso"]) : Promise.resolve(null),
  ]);
  const f = { ano, cargo, uf };


  // ---------- P2: grupos (vereador/deputado) e "quem mais gastou venceu?" (majoritários) ----------
  const faixasQ2 = q2?.faixas ? daMedida(comoObjetos<LinhaGastoFaixa>(q2.faixas), "recursos") : [];
  const gruposQ2 = sucessoPorGasto(faixasQ2, f);
  const respQ2 = respostaGasto(gruposQ2);
  const maiores = q2?.maior_gasto ? daMedida(comoObjetos<LinhaMaiorGasto>(q2.maior_gasto), "gasto") : [];
  const maior = maiorGastador(maiores, f);
  const cobertura = coberturaDisputas(maior);
  // por porte (prefeito): a parte das cidades comparáveis em que quem mais gastou venceu
  const porPorte = PORTES.map((p) => {
    const sel = resumo.filter((x) => x.ano === ano && (!uf || x.uf === uf) && porteDe(x.eleitorado)?.chave === p.chave && x.maior_venceu != null);
    const venceu = sel.filter((x) => x.maior_venceu).length;
    return { ...p, n: sel.length, venceu, parte: sel.length ? venceu / sel.length : 0 };
  });

  // P2 num estado (ou nos seis): majoritário = parte das disputas em que quem mais gastou venceu; proporcional = taxa
  // de eleição dos que tiveram mais recursos. Não vem da tabela de estados, mas das análises da P2.
  const resultadoEm = (u: string | undefined): number | null => {
    if (majoritario) { const m = maiorGastador(maiores, { ano, cargo, uf: u }); return m.disputas ? m.pct : null; }
    const g = grupo(sucessoPorGasto(faixasQ2, { ano, cargo, uf: u }), "muito");
    return g.candidaturas ? g.taxa : null;
  };

  // ---------- o valor do lugar (painel) e as referências ----------
  // cargoTexto: na P2 fora da cidade, o valor é uma parte (das disputas ou dos candidatos), não "venceu/perdeu"
  const cargoTexto = aba === "resultado" && !mun ? "parte" : cargo;
  const valorLugar = mun ? valorCidade(linhaMun, aba, cargo) : aba === "resultado" ? resultadoEm(uf) : valorDoEstado(estados, ano, uf, aba, cargo);
  const valorUf = mun ? (aba === "resultado" ? (cargo === "Prefeito" ? valorDoEstado(estados, ano, uf, aba, cargo) : resultadoEm(uf)) : valorDoEstado(estados, ano, uf, aba, cargo)) : null;
  const refPorte = mun && porte && municipal ? referenciaDoPorte(resumo, ano, porte.chave, aba, cargo) : null;
  const unidadeLugar = mun || aba !== "resultado" ? unidade(aba, cargo)
    : majoritario ? `das ${cargo === "Prefeito" ? "cidades" : "disputas"}: quem mais gastou para ${cargo.toLowerCase()} venceu` : unidade(aba, cargo);

  // ---------- P8: grupos por dinheiro público ----------
  const sucesso = q8?.sucesso ? comoObjetos<LinhaSucesso>(q8.sucesso) : [];
  const gruposQ8 = sucessoTresGrupos(sucesso, f);
  const respQ8 = respostaSucesso(gruposQ8);

  // ---------- candidatos do recorte ----------
  const [candidatos, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<CandidatoLocal[]>(`/municipios/${mun.id_municipio}/candidatos?ano=${ano}&cargo=${encodeURIComponent(cargo)}`) : Promise.resolve(null),
    !municipal && uf ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${ano}`) : Promise.resolve(null),
  ]);
  const disputa = cargo === "Prefeito" && candidatos ? disputaPrefeito(candidatos) : null;
  const linhas: LinhaCandidato[] = disputa ? disputa.candidatos : candidatos ?? (eleitosUf ?? []).filter((e) => e.cargo === cargo).map((e) => ({ ...e, eleito: true }));
  const eleitosLinhas = linhas.filter((c) => c.eleito);
  const outrasLinhas = linhas.filter((c) => !c.eleito);
  const maisGastou = disputa?.candidatos.find((c) => c.maisGastou);

  // ---------- mapa ----------
  const valoresUf = ufs.map((u) => (aba === "resultado" ? resultadoEm(u) : valorDoEstado(estados, ano, u, aba, cargo)));
  const faixasUf = aba === "resultado" && majoritario ? FAIXAS_PARTE_CIDADES : quantis(valoresUf.flatMap((v) => v ?? []), 5);
  const noMapaUf: EstadoNoMapa[] = ufs.map((u, i) => {
    const v = valoresUf[i];
    return { uf: u, classe: corPorFaixas(v, faixasUf), href: href({ uf: u === uf ? null : u }, "mapa"), sigla: u,
      valor: v === null ? "" : textoValor(v, aba, aba === "resultado" ? "parte" : cargo).replace("R$ ", ""),
      descricao: `${NOME_UF[u] ?? u}: ${v === null ? "não informado" : textoValor(v, aba, aba === "resultado" ? "parte" : cargo)} (${cargo.toLowerCase()}, ${ano})` };
  });
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !municipal || !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const linha = doAno.get(m.id_municipio);
    const v = valorCidade(linha, aba, cargo);
    return { ibge: m.cod_ibge, classe: classeComPorte(corCidade(v, aba, cargo), porteDe(linha?.eleitorado)?.chave, porteFiltro),
      href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }, "mapa"),
      dica: `${nomeMun.get(m.id_municipio)}: ${textoValor(v, aba, cargo)}`, atraso: Math.round(((CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0])) * 100) / 100 };
  });
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const legenda = uf && municipal ? legendaCidade(aba, cargo) : [{ classe: "q0", texto: "menor" }, { classe: "q4", texto: "maior" }, { classe: "sem", texto: "Não informado" }];
  const tituloMapa = aba === "gasto" ? `Gasto por vaga de ${cargo.toLowerCase()}` : aba === "publico" ? `Parte pública das receitas: ${cargo.toLowerCase()}`
    : cargo === "Prefeito" ? "Quem mais gastou para prefeito venceu?" : municipal ? "Vereadores com mais recursos que se elegeram" : null;

  // ---------- textos ----------
  const abrangencia = mun && aba !== "gasto" && !(aba === "resultado" && cargo === "Prefeito")
    ? `Comparação estatística disponível para ${NOME_UF[uf!] ?? uf}. A lista abaixo mostra os candidatos de ${lugar}.` : null;

  return (
    <>
      <header className="area-cab">
        <p className="rotulo">Dinheiro nas eleições · 2018 a 2024 · AP, ES, MG, PE, RJ e RR</p>
        <h1>Dinheiro nas eleições</h1>
        <p>Quanto as campanhas gastaram, de onde veio o dinheiro e se quem teve mais se elegeu mais. Escolha a eleição e o lugar uma vez.</p>
      </header>

      <FiltrosDinheiro
        anos={anos.map((a) => [String(a), `${a} · ${ehMunicipal(a) ? "municipal" : "geral"}`])}
        cargos={cargosDoAno(ano)} ufs={ufs.map((u) => [u, NOME_UF[u] ?? u])}
        cidades={municipal ? ufs.map((u) => ({ uf: u, nome: NOME_UF[u] ?? u, opcoes: municipios.filter((m) => m.uf === u).map((m) => [String(m.id_municipio), nomeMun.get(m.id_municipio)!] as [string, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR")) })) : null}
        atual={{ ano: String(ano), cargo, uf: uf ?? "", mun: mun ? String(mun.id_municipio) : "" }}
        fixos={{ ...(aba !== "gasto" ? { aba } : {}), ...(r.vista === "lista" ? { vista: "lista" } : {}) }}
      />
      {(r.cargoTrocado || r.munIgnorado) && (
        <p className="aviso-linha">
          {r.cargoTrocado && `${r.cargoTrocado} não é eleito em ${ano}: mostrando ${cargo.toLowerCase()}. `}
          {r.munIgnorado && `Nas eleições gerais não há dados por município: mostrando ${lugar}.`}
        </p>
      )}

      <nav className="area-abas" aria-label="Assunto">
        {ABAS.map((a) => <Link key={a.chave} href={href({ aba: a.chave === "gasto" ? null : a.chave })} scroll={false} aria-current={a.chave === aba ? "page" : undefined}>{a.rotulo}</Link>)}
      </nav>

      {/* 1. A pergunta e a frase do resultado */}
      <section className="area-resposta" aria-labelledby="h-pergunta">
        <h2 id="h-pergunta">{infoAba.pergunta}</h2>
        <p className="area-frase">
          {aba === "gasto" && (valorLugar === null ? `Não informado para ${cargo.toLowerCase()} em ${lugar}, ${ano}.`
            : <>Em {lugar}, em {ano}, as campanhas a {cargo.toLowerCase()} gastaram <b>{reais(valorLugar)} por vaga</b>.</>)}
          {aba === "resultado" && (majoritario
            ? mun && disputa ? (maisGastou ? <><b>{maisGastou.nome_urna}</b>, quem mais gastou, <b>{maisGastou.eleito ? "venceu" : "não venceu"}</b>.</> : "Não dá para dizer quem gastou mais nesta disputa (candidato único, empate ou prestação de contas incompleta).")
              : maior.disputas > 0 ? <>Quem mais gastou venceu em <b>{inteiro(maior.venceu)} de {inteiro(maior.disputas)} {cargo === "Prefeito" ? "cidades" : "disputas"}</b>{uf ? ` de ${NOME_UF[uf]}` : ""} ({pct(maior.pct, 0)}).</> : "Sem disputas comparáveis neste recorte."
            : respQ2.curta === null ? "Sem dados para este recorte."
              : <>Entre os candidatos a {cargo.toLowerCase()}{uf ? ` de ${NOME_UF[uf]}` : ""}, os com mais recursos: <b>{fraseTaxas(respQ2.muito.taxa, respQ2.base.taxa)}</b> entre os {respQ2.base.chave === "pouco" ? "com menos recursos" : "que declararam zero"}.</>)}
          {aba === "publico" && (gruposQ8.muito.candidaturas === 0 ? "Sem dados para este recorte."
            : <>Entre os candidatos a {cargo.toLowerCase()}{uf ? ` de ${NOME_UF[uf]}` : ""}, os que mais receberam dinheiro público: <b>{fraseTaxas(gruposQ8.muito.taxa, respQ8.base.taxa)}</b> entre os que {respQ8.base === gruposQ8.nada ? "não receberam" : "receberam menos"}.</>)}
        </p>
        {aba === "resultado" && !majoritario && respQ2.curta && <p className="escala">{qualificacao(respQ2.curta)}</p>}
        {aba === "resultado" && majoritario && !mun && maior.disputas > 0 && <p className="escala">{qualificacao(respostaMaior(maior))} Mostra que dinheiro e vitória andam juntos, não que o dinheiro fez ganhar.</p>}
        {aba === "publico" && gruposQ8.muito.candidaturas > 0 && <p className="escala">{qualificacao(respQ8.curta)} Os partidos costumam mandar mais dinheiro para quem já tem mais chance.</p>}
        {abrangencia && <p className="escala">{abrangencia}</p>}
      </section>

      {/* 2. Mapa e painel do lugar */}
      <section id="mapa" className="quadro observatorio area-mapa" aria-labelledby="h-mapa">
        <MapaVivo className="palco s8 palco-area" estado={uf}>
          <div className="palco-topo">
            <div>
              <p className="palco-sobre">No mapa · {municipal ? `eleição municipal de ${ano}` : `eleição geral de ${ano} (por estado)`}</p>
              <h2 id="h-mapa">{tituloMapa ?? "Não se aplica neste recorte"}</h2>
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
                  <thead><tr><th>Cidade</th><th>Porte</th><th>Prefeito eleito</th><th className="num">{tituloMapa}</th></tr></thead>
                  <tbody>
                    {municipios.filter((m) => m.uf === uf).sort((a, b) => nomeMun.get(a.id_municipio)!.localeCompare(nomeMun.get(b.id_municipio)!, "pt-BR")).map((m) => {
                      const linha = doAno.get(m.id_municipio);
                      return (
                        <tr key={m.id_municipio} aria-current={m.id_municipio === mun?.id_municipio ? "true" : undefined}>
                          <td><Link href={href({ mun: m.id_municipio }, "mapa")} scroll={false}>{nomeMun.get(m.id_municipio)}</Link></td>
                          <td>{porteDe(linha?.eleitorado)?.rotulo ?? "Não informado"}</td>
                          <td>{linha?.prefeito_nome ? `${linha.prefeito_nome} (${linha.prefeito_partido})` : "Não informado"}</td>
                          <td className="num">{textoValor(valorCidade(linha, aba, cargo), aba, cargo)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : (
                <table>
                  <thead><tr><th>Estado</th><th className="num">{cargo}</th></tr></thead>
                  <tbody>{ufs.map((u, i) => <tr key={u}><td><Link href={href({ uf: u })} scroll={false}>{NOME_UF[u]}</Link></td><td className="num">{textoValor(valoresUf[i], aba, aba === "resultado" ? "parte" : cargo)}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ) : (
            <div className="palco-mapa">
              <MapaAbstencao titulo={`${tituloMapa ?? "Mapa"}: ${lugar}, ${ano}`}
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

        <div className="area-painel s4" key={`${uf}-${mun?.id_municipio}-${ano}-${cargo}-${aba}`}>
          <div className="bloco noite painel-cab">
            <p className="palco-sobre">{mun ? `Município · ${uf} · ${porte?.rotulo ?? "porte não informado"}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"} · {ano}</p>
            <h3>{lugar}</h3>
            <p className="painel-resumo"><b>{textoValor(valorLugar, aba, cargoTexto)}</b> {unidadeLugar}</p>
            {refPorte && refPorte.n > 0 && <p className="pequeno">Cidades do mesmo porte: <b>{textoValor(refPorte.valor, aba, cargo === "Prefeito" && aba === "resultado" ? "parte" : cargo)}</b> <span className="muted-noite">({aba === "resultado" && cargo === "Prefeito" ? "parte das" : "mediana de"} {inteiro(refPorte.n)} cidades)</span></p>}
            {valorUf !== null && <p className="pequeno">{NOME_UF[uf!]}: <b>{textoValor(valorUf, aba, aba === "resultado" ? "parte" : cargo)}</b>{aba === "resultado" && (cargo === "Prefeito" ? " das cidades" : " dos que tiveram mais recursos se elegeram")}</p>}
            {municipal && uf && (
              <div className="portes" role="group" aria-label="Destacar cidades de um porte no mapa">
                <span className="palco-sobre">Destacar no mapa:</span>
                <Link href={href({}, "mapa").replace(/porte=[^&]*&?/, "")} scroll={false} className={!porteFiltro ? "on" : undefined}>Todas</Link>
                {PORTES.map((p) => <Link key={p.chave} href={hrefDinheiro(r, {}, "mapa").replace("?", `?porte=${p.chave}&`)} scroll={false} className={porteFiltro === p.chave ? "on" : undefined}>{p.rotulo.replace(" eleitores", "")}</Link>)}
              </div>
            )}
          </div>
          {mun && linhaMun && (
            <div className="bloco noite">
              <h3>{lugar} em {ano}, nas três perguntas</h3>
              <dl className="painel-mini tres">
                <div><dt>Gasto por vaga de vereador</dt><dd>{textoValor(valorCidade(linhaMun, "gasto", "Vereador"), "gasto", "Vereador")}</dd></div>
                <div><dt>Quem mais gastou para prefeito venceu?</dt><dd>{linhaMun.maior_venceu == null ? "Não comparável" : linhaMun.maior_venceu ? "Sim" : "Não"}</dd></div>
                <div><dt>Parte pública nas receitas (prefeito e vereador)</dt><dd>{(() => { const rec = linhaMun.vereador_receita + linhaMun.prefeito_receita; return rec > 0 ? pct((linhaMun.vereador_publica + linhaMun.prefeito_publica) / rec, 0) : "Não informado"; })()}</dd></div>
              </dl>
              <p className="pequeno muted-noite">Cada indicador tem o próprio cargo, escrito no rótulo: não muda com o cargo escolhido acima.</p>
            </div>
          )}
        </div>
      </section>

      {/* 3. Comparação visual da aba */}
      <section className="card area-comparacao" aria-labelledby="h-comp">
        {aba === "gasto" && (
          <>
            <h2 id="h-comp">{mun ? `${lugar} comparada com cidades parecidas` : `Gasto por vaga de ${cargo.toLowerCase()} em cada estado`}</h2>
            <BarrasH compacto titulo={`Gasto por vaga de ${cargo}, ${ano}`}
              linhas={mun ? [
                { chave: "cidade", rotulo: lugar, valor: valorLugar ?? 0, classe: "pub", texto: textoValor(valorLugar, aba, cargo) },
                ...(refPorte?.valor != null ? [{ chave: "porte", rotulo: "Cidades do mesmo porte", detalhe: `mediana de ${inteiro(refPorte.n)}, ${porte?.rotulo}`, valor: refPorte.valor, classe: "fx2", texto: textoValor(refPorte.valor, aba, cargo) }] : []),
                ...(valorUf !== null ? [{ chave: "uf", rotulo: NOME_UF[uf!] ?? uf!, detalhe: "todas as campanhas ÷ todas as vagas", valor: valorUf, classe: "fx2", texto: textoValor(valorUf, aba, cargo) }] : []),
              ] : ufs.map((u, i) => ({ chave: u, rotulo: NOME_UF[u] ?? u, valor: valoresUf[i] ?? 0, classe: !uf || uf === u ? "pub" : "fx2", texto: textoValor(valoresUf[i], aba, cargo), href: href({ uf: u }) }))} />
            <p className="escala">{mun ? "A referência certa é a cidade do mesmo porte: o gasto por vaga é cerca de 150 vezes maior nas cidades com mais de 200 mil eleitores do que nas de até 5 mil." : "Clique num estado para ver as cidades."} Valores sem correção pela inflação.</p>
          </>
        )}
        {aba === "resultado" && (majoritario ? (
          <>
            <h2 id="h-comp">{cargo === "Prefeito" ? `Quem mais gastou venceu, pelo porte da cidade${uf ? ` (${NOME_UF[uf]})` : " (seis estados)"}` : `Disputas para ${cargo.toLowerCase()}`}</h2>
            {cargo === "Prefeito" && municipal ? (
              <BarrasH compacto max={1} titulo={`Parte das cidades em que quem mais gastou para prefeito venceu, por porte, ${ano}`}
                linhas={porPorte.filter((p) => p.n > 0).map((p) => ({ chave: p.chave, rotulo: p.rotulo, valor: p.parte, classe: porte?.chave === p.chave ? "pub" : "fx2", trilhoCheio: true, texto: pct(p.parte, 0), subtexto: `${inteiro(p.venceu)} de ${inteiro(p.n)} cidades` }))} />
            ) : <p>Quem mais gastou venceu em {inteiro(maior.venceu)} de {inteiro(maior.disputas)} disputas.</p>}
            <p className="escala">Análise de {inteiro(cobertura.analisadas)} disputas{cobertura.excluidas > 0 && `; ${inteiro(cobertura.excluidas)} excluídas (${cobertura.motivos.map((m) => `${inteiro(m.n)} ${m.motivo}`).join(", ")})`}.</p>
          </>
        ) : (
          <>
            <h2 id="h-comp">Parte dos candidatos que se elegeu, por recursos de campanha considerados</h2>
            <BarrasH compacto max={1} titulo={`Taxa de eleição por recursos, ${cargo}, ${ano}`}
              linhas={gruposQ2.map((g) => ({ chave: g.chave, rotulo: g.rotulo, detalhe: g.detalhe, valor: g.taxa, classe: g.chave === "muito" ? "pub" : "fx2", trilhoCheio: true, texto: `${emCada100(g.taxa)} em cada 100`, subtexto: `${inteiro(g.eleitos)} de ${inteiro(g.candidaturas)} candidatos` }))} />
            {mun && linhaMun?.rec_mais_cand ? <p className="escala">Em {lugar}: dos {inteiro(linhaMun.rec_mais_cand)} vereadores com mais recursos, {inteiro(linhaMun.rec_mais_eleitos ?? 0)} se elegeram; dos outros {inteiro(linhaMun.rec_demais_cand ?? 0)}, {inteiro(linhaMun.rec_demais_eleitos ?? 0)}.</p> : null}
          </>
        ))}
        {aba === "publico" && (
          <>
            <h2 id="h-comp">Parte dos candidatos que se elegeu, por dinheiro público recebido</h2>
            <BarrasH compacto max={1} titulo={`Taxa de eleição por dinheiro público, ${cargo}, ${ano}`}
              linhas={[
                { chave: "nada", rotulo: "Não recebeu", valor: gruposQ8.nada.taxa, classe: "fx2", trilhoCheio: true, texto: `${emCada100(gruposQ8.nada.taxa)} em cada 100`, subtexto: `${inteiro(gruposQ8.nada.eleitos)} de ${inteiro(gruposQ8.nada.candidaturas)}` },
                { chave: "pouco", rotulo: "Recebeu menos", valor: gruposQ8.pouco.taxa, classe: "fx2", trilhoCheio: true, texto: `${emCada100(gruposQ8.pouco.taxa)} em cada 100`, subtexto: `${inteiro(gruposQ8.pouco.eleitos)} de ${inteiro(gruposQ8.pouco.candidaturas)}` },
                { chave: "muito", rotulo: "Recebeu mais", detalhe: "cerca de 1/4 na disputa", valor: gruposQ8.muito.taxa, classe: "pub", trilhoCheio: true, texto: `${emCada100(gruposQ8.muito.taxa)} em cada 100`, subtexto: `${inteiro(gruposQ8.muito.eleitos)} de ${inteiro(gruposQ8.muito.candidaturas)}` },
              ]} />
            {(() => {
              const v = mun ? valorCidade(linhaMun, "publico", cargo) : valorDoEstado(estados, ano, uf, "publico", cargo);
              return v === null ? <p className="escala">Origem do dinheiro: não informada neste recorte.</p>
                : <p className="escala">De onde veio o dinheiro: em {lugar}, de cada R$ 100 recebidos pelas campanhas a {cargo.toLowerCase()}, <b>R$ {Math.round(v * 100)} vieram de fundos públicos</b> (é o que o mapa mostra).</p>;
            })()}
            {mun && linhaMun?.pub_mais_cand && cargo === "Vereador" ? <p className="escala">Em {lugar}: dos {inteiro(linhaMun.pub_mais_cand)} vereadores que mais receberam, {inteiro(linhaMun.pub_mais_eleitos ?? 0)} se elegeram; dos outros {inteiro(linhaMun.pub_demais_cand ?? 0)}, {inteiro(linhaMun.pub_demais_eleitos ?? 0)}.</p> : null}
          </>
        )}
      </section>

      {/* 4. Candidatos do recorte */}
      <section className="card area-candidatos" aria-labelledby="h-cand">
        <h2 id="h-cand">Candidatos{mun ? ` a ${cargo.toLowerCase()} em ${lugar}` : uf && !municipal ? ` eleitos: ${cargo.toLowerCase()} em ${NOME_UF[uf]}` : ""}</h2>
        {mun ? (
          <>
            <LinhasCandidatos linhas={cargo === "Prefeito" ? linhas : eleitosLinhas} ano={ano} valor={aba === "publico" ? "publico" : "gasto"}
              vazio={candidatos === null ? "Não foi possível carregar os candidatos agora. Recarregue a página para tentar de novo." : "Nenhum candidato registrado."} />
            {cargo !== "Prefeito" && outrasLinhas.length > 0 && (
              <details>
                <summary>Não eleitos ({inteiro(outrasLinhas.length)}){outrasLinhas.length > MAX_LISTA && `: os ${MAX_LISTA} mais votados`}</summary>
                <LinhasCandidatos linhas={outrasLinhas.slice(0, MAX_LISTA)} ano={ano} valor={aba === "publico" ? "publico" : "gasto"} vazio="" />
              </details>
            )}
          </>
        ) : !municipal && uf ? (
          <>
            <LinhasCandidatos linhas={linhas} ano={ano} valor={aba === "publico" ? "publico" : "gasto"} vazio={eleitosUf === null ? "Não foi possível carregar os eleitos agora." : "Nenhum eleito registrado."} />
            <p className="escala">Por estado, só os eleitos estão disponíveis.</p>
          </>
        ) : <p className="muted">{municipal ? "Escolha um município (na lista acima ou no mapa) para ver os candidatos." : "Escolha um estado para ver os eleitos."}</p>}
      </section>

      {/* 5. Explicações em dois níveis */}
      <details className="card mais">
        <summary>Entenda este número</summary>
        {aba === "gasto" && <p>Gasto por vaga = soma do que todas as campanhas ao cargo gastaram, inclusive as de quem perdeu, ÷ número de vagas. Não é salário nem custo do mandato. O gasto médio por candidato é outra conta (÷ candidatos).</p>}
        {aba === "resultado" && <p>{majoritario ? "Em cada disputa, olhamos se o candidato que mais gastou (gasto declarado) foi o eleito. Disputas com um só candidato, empate no maior gasto ou prestação de contas incompleta ficam de fora." : "Recursos de campanha considerados: o maior valor entre receitas e despesas declaradas, para considerar também campanhas que receberam material. Cada candidato é comparado com os concorrentes da mesma disputa: “mais recursos” é cerca de 1/4 dos que declararam algo, os de maior valor."}</p>}
        {aba === "publico" && <p>Dinheiro público = Fundo Eleitoral e Fundo Partidário. O mapa mostra de onde veio o dinheiro (parte pública das receitas); as barras mostram se quem recebeu mais se elegeu mais. São indicadores relacionados, mas diferentes.</p>}
      </details>
      <details className="card analise-metodo">
        <summary>Metodologia completa · <span className="muted">{infoAba.numero}</span></summary>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Fonte: TSE (candidaturas, resultados e prestação de contas final ou regularização). Só titulares, eleições ordinárias e quem disputou. Dinheiro só existe de 2018 em diante.</li>
          <li>Quem não entregou a prestação de contas final aparece como “Não informado”, não como R$ 0, e fica fora dos grupos.</li>
          <li>Porte da cidade: eleitores aptos no ano da eleição (TSE). A comparação usa a mediana das cidades do mesmo porte.</li>
          <li>Empate no maior valor: a disputa sai da comparação (valor exato da base, antes de arredondar).</li>
          <li>“Grande demais para ser acaso”: teste estatístico com 95% de confiança, acompanhado da diferença de pelo menos 20%. A falta de significância não quer dizer que não haja relação.</li>
          <li>Valores em reais da época, sem correção pela inflação. Mostram associação, não causa.</li>
        </ul>
      </details>
    </>
  );
}

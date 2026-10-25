import type { Metadata } from "next";
import Link from "next/link";
import { apiGetOpcional, lerAnalise } from "@/lib/api";
import { comoObjetos } from "@/lib/data";
import { classe, enquadrar, nomeProprio, quantis, rotulosFaixas } from "@/lib/abstencao";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { NOME_UF } from "@/lib/financiamento";
import { inteiro, pct, reais } from "@/lib/format";
import { TELA } from "@/lib/lupa";
import {
  anosDisponiveis, escolherAno, INDICADORES, resumoEstado, valorEstado, valorMunicipio,
  type Eleito, type Indicador, type LinhaEstado, type LinhaMunicipio, type LinhaResumo,
} from "@/lib/territorio";
import { Cabecalho } from "@/components/Cabecalho";
import { EscolhaMunicipio } from "@/components/EscolhaMunicipio";
import { ListaEleitos } from "@/components/ListaEleitos";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "@/components/MapaAbstencao";
import { MapaVivo } from "@/components/MapaVivo";
import { PartyChip } from "@/components/PartyChip";
import { Retrato } from "@/components/Retrato";
import { Rolar } from "@/components/Rolar";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Eleitos e dinheiro por cidade" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
/** Cortes fixos para "quem mais gastou venceu?" nos estados (parte das cidades): 50%, 60%, 70% e 80%. */
const CORTES_MAIOR = [0.5, 0.6, 0.7, 0.8];

/** O valor de um indicador escrito para leitura: reais, porcentagem ou sim/não. */
function texto(ind: Indicador, v: number | null, municipio: boolean): string {
  if (v === null) return "sem dado";
  if (ind === "custo") return reais(v);
  if (ind === "publico") return pct(v, 0);
  return municipio ? (v === 1 ? "venceu" : "perdeu") : pct(v, 0);
}

export default async function Municipios({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerAnalise("municipios", ["municipios", "resumo", "estados"]);
  if (!dados?.resumo) {
    return (
      <>
        <Cabecalho titulo="Eleitos e dinheiro por cidade" foto={FOTOS.itajuba} />
        <div className="card aviso">
          <h2>Dados indisponíveis</h2>
          <p>A API não respondeu. Verifique se ela está rodando (pasta <code>api/</code>: <code>uvicorn app.main:app</code>).</p>
        </div>
      </>
    );
  }
  const municipios = comoObjetos<LinhaMunicipio>(dados.municipios);
  const resumo = comoObjetos<LinhaResumo>(dados.resumo);
  const estados = comoObjetos<LinhaEstado>(dados.estados);

  // filtros: ano municipal (o mapa), ano geral (os eleitos do estado), estado, município e a pergunta que colore o mapa
  const { municipais, gerais } = anosDisponiveis(estados);
  const ano = escolherAno(Number(um(sp.ano)), municipais);
  const geral = escolherAno(Number(um(sp.geral)), gerais);
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.includes(um(sp.uf) ?? "") ? um(sp.uf) : undefined;
  const mun = uf ? municipios.find((m) => m.uf === uf && String(m.id_municipio) === um(sp.mun)) : undefined;
  const ind: Indicador = INDICADORES.some((i) => i.chave === um(sp.ver)) ? (um(sp.ver) as Indicador) : "custo";
  const infoInd = INDICADORES.find((i) => i.chave === ind)!;

  const params = (novo: Record<string, string | number | null>) => {
    const atual: Record<string, string | number | null> = { ano, geral, uf: uf ?? null, mun: mun?.id_municipio ?? null, ver: ind === "custo" ? null : ind };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...atual, ...novo })) if (v !== null && v !== undefined) p.set(k, String(v));
    return p;
  };
  const href = (novo: Record<string, string | number | null>) => `/municipios?${params(novo).toString()}#mapa`;

  // cores: custo e dinheiro público em quintos dos municípios dos seis estados; "maior" em venceu/perdeu (e, nos
  // estados, a parte das cidades em faixas fixas)
  const doAno = new Map(resumo.filter((r) => r.ano === ano).map((r) => [r.id_municipio, r]));
  const cortes = ind === "maior" ? CORTES_MAIOR : quantis([...doAno.values()].flatMap((r) => valorMunicipio(r, ind) ?? []), 5);
  const corUf = (v: number | null) => (v === null ? "sem" : `q${classe(v, cortes)}`);
  const corMun = (v: number | null) => (v === null ? "sem" : ind === "maior" ? (v === 1 ? "q4" : "q0") : `q${classe(v, cortes)}`);
  const nomeMun = new Map(municipios.map((m) => [m.id_municipio, nomeProprio(m.nome)]));

  const noMapaUf: EstadoNoMapa[] = ufs.map((u) => {
    const v = valorEstado(estados, ano, u, ind);
    return { uf: u, classe: corUf(v), href: href({ uf: u === uf ? null : u, mun: null }), sigla: u,
      valor: v === null ? "—" : ind === "custo" ? reais(v).replace("R$ ", "") : pct(v, 0),
      descricao: `${NOME_UF[u] ?? u}: ${infoInd.rotulo.toLowerCase()} ${texto(ind, v, false)} em ${ano}` };
  });
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapaMun: MunicipioNoMapa[] = !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const v = valorMunicipio(doAno.get(m.id_municipio), ind);
    const atraso = (CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0]);   // surgem de oeste para leste
    return { ibge: m.cod_ibge, classe: corMun(v), href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }),
      dica: `${nomeMun.get(m.id_municipio)}: ${texto(ind, v, true)}`, atraso: Math.round(atraso * 100) / 100 };
  });
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;
  const legenda = uf && ind === "maior"
    ? [{ classe: "q4", texto: "Venceu" }, { classe: "q0", texto: "Perdeu" }, { classe: "sem", texto: "Só um candidato ou sem gasto" }]
    : rotulosFaixas(cortes, (v) => (ind === "custo" ? reais(v).replace("R$ ", "R$ ") : pct(v, 0))).map((t, i) => ({ classe: `q${i}`, texto: ind === "maior" ? `${t} das cidades` : t }));

  // painel: o lugar escolhido
  const r = mun ? doAno.get(mun.id_municipio) : undefined;
  const est = resumoEstado(estados, ano, uf);
  const [eleitosMun, eleitosUf] = await Promise.all([
    mun ? apiGetOpcional<Eleito[]>(`/municipios/${mun.id_municipio}/eleitos?ano=${ano}`) : Promise.resolve(null),
    uf && !mun ? apiGetOpcional<Eleito[]>(`/estados/${uf}/eleitos?ano=${geral}`) : Promise.resolve(null),
  ]);
  const prefeito = eleitosMun?.find((e) => e.cargo === "Prefeito");
  const vereadoresEtc = eleitosMun?.filter((e) => e.cargo !== "Prefeito") ?? [];
  const nomeLugar = mun ? nomeMun.get(mun.id_municipio)! : uf ? NOME_UF[uf] ?? uf : "Os seis estados";
  const valorLugar = mun ? valorMunicipio(r, ind) : uf ? valorEstado(estados, ano, uf, ind) : ind === "custo" ? est.custoCadeira : ind === "publico" ? est.partePublica : est.parteMaior;

  return (
    <>
      <Cabecalho titulo="Eleitos e dinheiro por cidade" pergunta="Quem foi eleito em cada cidade e quanto custaram as campanhas?" foto={FOTOS.itajuba}>
        <p className="lead">
          Escolha um estado no mapa e depois uma cidade para ver o prefeito e os vereadores eleitos, quanto cada um gastou e
          de onde veio o dinheiro. As cores do mapa respondem, cidade por cidade, às perguntas 1, 2 e 8.
        </p>
      </Cabecalho>

      <section id="mapa" className="quadro observatorio" aria-labelledby="h-mapa">
        <MapaVivo className="palco s8" estado={uf}>
          <div className="palco-topo">
            <div>
              <nav className="visoes" aria-label="O que o mapa mostra">
                {INDICADORES.map((i) => (
                  <a key={i.chave} href={href({ ver: i.chave === "custo" ? null : i.chave })} data-mapa="" aria-current={i.chave === ind ? "true" : undefined}>
                    {i.chave === "custo" ? "Custo da cadeira" : i.chave === "publico" ? "Dinheiro público" : "Quem gastou mais"}
                  </a>
                ))}
              </nav>
              <h1 id="h-mapa">{ind === "maior" ? `Em ${ano}, quem mais gastou para prefeito venceu?` : `${infoInd.rotulo} em ${ano}`}</h1>
              <p className="palco-sobre">{infoInd.pergunta} · {infoInd.explicacao}</p>
            </div>
            <nav className="trilha" aria-label="Onde você está no mapa">
              <a href={href({ uf: null, mun: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
              {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
              {mun && <><span aria-hidden="true">/</span><span aria-current="true">{nomeMun.get(mun.id_municipio)}</span></>}
            </nav>
          </div>

          <div className="palco-mapa">
            <MapaAbstencao
              titulo={uf ? `Municípios de ${NOME_UF[uf]}: ${infoInd.rotulo.toLowerCase()} em ${ano}` : `${infoInd.rotulo} em ${ano} nos seis estados`}
              camera={camera} estados={noMapaUf} uf={uf} municipios={noMapaMun}
              destaque={mun && centro ? { ibge: mun.cod_ibge, nome: nomeMun.get(mun.id_municipio)!, x: centro[0], y: centro[1] } : undefined}
            />
            {!uf && <p className="palco-dica" aria-hidden="true">Clique num estado para ver as cidades</p>}
          </div>

          <div className="palco-base">
            <ul className="legenda-q" aria-label={`Cores: ${infoInd.rotulo.toLowerCase()}`}>
              {legenda.map((l) => <li key={l.texto} className={l.classe === "sem" ? "legenda-sem" : undefined}><i className={l.classe} />{l.texto}</li>)}
            </ul>
            <div className="anos" role="group" aria-label="Eleição municipal">
              {municipais.map((a) => (
                <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined}>
                  {a}<small>municipal</small>
                </Link>
              ))}
            </div>
          </div>
        </MapaVivo>

        <div className="painel s4" key={`${uf}-${mun?.id_municipio}`}>
          <div className="bloco noite painel-cab">
            <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? "Estado" : "AP, ES, MG, PE, RJ e RR"}</p>
            <h2>{nomeLugar}</h2>
            <p className={`painel-num${ind === "custo" ? " longo" : ""}`}><Rolar valor={texto(ind, valorLugar, !!mun)} /></p>
            <p>
              {ind === "custo" && (valorLugar === null ? `Sem dado de gasto ou de vagas de vereador em ${ano}.` : `por cadeira de vereador em ${ano}: o gasto de todos os candidatos a vereador dividido pelas vagas da câmara.`)}
              {ind === "publico" && (valorLugar === null ? `Sem receitas declaradas em ${ano}.` : `do dinheiro recebido pelas campanhas a prefeito e vereador em ${ano} veio de fundos públicos (Fundo Eleitoral e Fundo Partidário).`)}
              {ind === "maior" && (mun
                ? valorLugar === null ? `Só um candidato a prefeito ou nenhum gasto declarado em ${ano}.` : `o candidato a prefeito que mais gastou em ${ano}.`
                : valorLugar === null ? "Sem disputas com gasto declarado." : `das ${inteiro(est.disputas)} cidades com disputa para prefeito em ${ano}: o candidato que mais gastou venceu.`)}
            </p>
            {uf && (
              <EscolhaMunicipio caminho="/municipios"
                opcoes={municipios.filter((m) => m.uf === uf).map((m) => [m.id_municipio, nomeMun.get(m.id_municipio)!] as [number, string]).sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))}
                atual={mun?.id_municipio}
                params={Object.fromEntries(params({ mun: null }))}
              />
            )}
          </div>

          {mun ? (
            <>
              <div className="bloco noite">
                <h3>Prefeito eleito em {ano}</h3>
                {prefeito ? (
                  <div className="prefeito">
                    <Retrato nome={prefeito.nome_urna} partido={prefeito.partido} />
                    <div>
                      <p className="prefeito-nome">
                        {prefeito.id_candidato ? <Link href={`/candidato/${prefeito.id_candidato}?campanha=${prefeito.id_candidatura}#dinheiro`}>{prefeito.nome_urna}</Link> : prefeito.nome_urna}
                      </p>
                      <p className="muted pequeno"><PartyChip sigla={prefeito.partido} /> {inteiro(prefeito.votos)} votos no 1º turno</p>
                      <p className="pequeno">Gastou {reais(prefeito.gasto)} na campanha{prefeito.receita > 0 && `; ${pct(prefeito.receita_publica / prefeito.receita, 0)} do dinheiro que recebeu era público`}.</p>
                    </div>
                  </div>
                ) : <p className="muted pequeno">Não há prefeito eleito registrado nesta eleição (a eleição pode ter sido anulada ou estar pendente).</p>}
              </div>
              <div className="bloco noite">
                <h3>As perguntas nesta cidade</h3>
                <dl className="painel-mini">
                  <div><dt>Custo da cadeira de vereador (P1)</dt><dd>{texto("custo", valorMunicipio(r, "custo"), true)}</dd></div>
                  <div><dt>Dinheiro público nas campanhas (P8)</dt><dd>{texto("publico", valorMunicipio(r, "publico"), true)}</dd></div>
                  <div><dt>Quem mais gastou para prefeito venceu? (P2)</dt><dd>{r?.maior_venceu == null ? "—" : r.maior_venceu ? "Sim" : "Não"}</dd></div>
                </dl>
                {r && <p className="muted pequeno">{inteiro(r.vereador_candidatos)} candidatos disputaram {inteiro(r.vereador_vagas)} vagas de vereador; {inteiro(r.prefeito_candidatos)} disputaram a prefeitura.</p>}
              </div>
              <div className="bloco noite">
                <h3>Vereadores e vice eleitos</h3>
                <ListaEleitos eleitos={vereadoresEtc} vazio={eleitosMun === null ? "Não foi possível carregar a lista agora." : "Nenhum eleito registrado."} />
              </div>
            </>
          ) : uf ? (
            <div className="bloco noite">
              <h3>Eleitos do estado</h3>
              <p className="muted pequeno">Governador, senadores e deputados são escolhidos na eleição geral, pelo estado inteiro.</p>
              <div className="anos" role="group" aria-label="Eleição geral">
                {gerais.map((a) => (
                  <Link key={a} scroll={false} href={href({ geral: a })} className={`ano${a === geral ? " on" : ""}`} aria-current={a === geral ? "true" : undefined}>
                    {a}<small>geral</small>
                  </Link>
                ))}
              </div>
              <ListaEleitos eleitos={eleitosUf ?? []} vazio={eleitosUf === null ? "Não foi possível carregar a lista agora." : `Nenhum eleito registrado em ${geral}.`} />
            </div>
          ) : (
            <div className="bloco noite">
              <h3>Os seis estados em {ano}</h3>
              <dl className="painel-mini">
                <div><dt>Custo da cadeira de vereador (P1)</dt><dd>{texto("custo", est.custoCadeira, false)}</dd></div>
                <div><dt>Dinheiro público nas campanhas (P8)</dt><dd>{texto("publico", est.partePublica, false)}</dd></div>
                <div><dt>Cidades onde quem mais gastou para prefeito venceu (P2)</dt><dd>{texto("maior", est.parteMaior, false)}</dd></div>
              </dl>
              <p className="muted pequeno">{inteiro(est.prefeitos)} prefeitos e {inteiro(est.vagasVereador)} vereadores eleitos. Clique num estado para ver as cidades e os eleitos.</p>
            </div>
          )}
        </div>
      </section>

      <section className="card" aria-labelledby="h-como">
        <h2 id="h-como">Como ler esta página</h2>
        <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
          <li><b>Custo da cadeira (pergunta 1):</b> tudo o que os candidatos a vereador gastaram, dividido pelas vagas da câmara. Inclui o gasto de quem perdeu.</li>
          <li><b>Dinheiro público (pergunta 8):</b> parte do dinheiro recebido pelas campanhas a prefeito e vereador que veio do Fundo Eleitoral e do Fundo Partidário. O que um candidato repassou a outro não é contado de novo.</li>
          <li><b>Quem gastou mais (pergunta 2):</b> se o candidato a prefeito que mais gastou foi o eleito. Não prova que o dinheiro faz ganhar: quem já tem mais chance também arrecada mais.</li>
          <li>Gasto: despesas da prestação de contas final entregue ao TSE, sem as transferências para outros candidatos ou partidos. Votos do 1º turno. Só eleições ordinárias.</li>
          <li>Deputados, senadores e governador concorrem no estado inteiro: o banco não tem os votos de cada um por cidade, então eles aparecem no estado, e não na cidade.</li>
          <li>Os dados de dinheiro existem de 2018 em diante. Sem fotos: os políticos aparecem com as iniciais na cor do partido.</li>
        </ul>
      </section>
    </>
  );
}

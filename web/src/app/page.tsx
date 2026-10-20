import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { SearchBox } from "@/components/SearchBox";
import { Rolar } from "@/components/Rolar";
import { MapaAbstencao, type EstadoNoMapa, type MunicipioNoMapa } from "@/components/MapaAbstencao";
import { TELA } from "@/lib/lupa";
import { MapaVivo } from "@/components/MapaVivo";
import { Dispersao } from "@/components/Dispersao";
import { EscolhaMunicipio } from "@/components/EscolhaMunicipio";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import type { LinhaLegenda } from "@/lib/legenda";
import { conjunto, dinheiroTotal, legendaPorUf } from "@/lib/mapa";
import {
  ANOS_CENSO, INDICADORES_CENSO, anosDe, classe, corMunicipio, correlacao, enquadrar, formatarIndicador, indicadoresPorMunicipio, lerCorrelacao,
  mediaPonderada, nomeProprio, posicao, quantis, rotulosFaixas, serieAbstencao, somarParticipacao, taxaDe, tendencia,
  type ChaveIndicador, type LinhaIndicador, type LinhaMunicipio, type LinhaParticipacao,
} from "@/lib/abstencao";
import { CAIXA_UF, CENTRO_MUNICIPIO } from "@/lib/brasil-municipios";
import { MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { compacto, pct } from "@/lib/format";
import { FOTOS } from "@/lib/fotos";
import { ANALISES } from "@/lib/analises";
import { FaixasAnalises } from "@/components/FaixasAnalises";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const um = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const ESTADOS = ["Amapá", "Espírito Santo", "Minas Gerais", "Pernambuco", "Rio de Janeiro", "Roraima"];
const umaCasa = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function Home({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const [q8, q5, dados] = await Promise.all([lerEstatico("q8"), lerEstatico("q5"), lerEstatico("mapa")]);
  const fontes = comoObjetos<LinhaFontes>(q8?.fontes);
  const sucesso = comoObjetos<LinhaSucesso>(q8?.sucesso);
  const legenda = comoObjetos<LinhaLegenda>(q5?.legenda);
  const municipios = comoObjetos<LinhaMunicipio>(dados?.municipios);
  const participacao = comoObjetos<LinhaParticipacao>(dados?.participacao);
  const indicadores = indicadoresPorMunicipio(comoObjetos<LinhaIndicador>(dados?.indicadores));

  // filtros da URL, validados contra os dados: ano, estado, município, indicador e modo de cor
  const anos = anosDe(participacao);
  const anoPadrao = anos.includes(2012) ? 2012 : anos[anos.length - 1];
  const ano = anos.includes(Number(um(sp.ano))) ? Number(um(sp.ano)) : anoPadrao;
  const ufs = [...new Set(municipios.map((m) => m.uf))].sort();
  const uf = ufs.find((u) => u === um(sp.uf));
  const mun = uf ? municipios.find((m) => m.uf === uf && String(m.id_municipio) === um(sp.mun)) : undefined;
  const comCenso = ANOS_CENSO.includes(ano);
  const ind: ChaveIndicador = INDICADORES_CENSO.find((i) => i.chave === um(sp.ind))?.chave ?? "idhm";
  const infoInd = INDICADORES_CENSO.find((i) => i.chave === ind)!;
  const cruzar = comCenso && !!uf && um(sp.cor) === "cruzar";

  const params = (nova: { ano?: number; uf?: string | null; mun?: number | null; ind?: string; cor?: string | null }) => {
    const n = { ano, uf, mun: mun?.id_municipio, ind, cor: cruzar ? "cruzar" : null, ...nova };
    if (nova.uf !== undefined && nova.mun === undefined) n.mun = null;   // trocar de estado solta o município
    const p = new URLSearchParams();
    if (n.ano !== anoPadrao) p.set("ano", String(n.ano));
    if (n.uf) p.set("uf", n.uf);
    if (n.uf && n.mun) p.set("mun", String(n.mun));
    if (n.ind !== "idhm") p.set("ind", n.ind);
    if (n.cor && n.uf) p.set("cor", n.cor);
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

  const estados: EstadoNoMapa[] = ufs.map((u) => {
    const t = totalDe(idsDe(u));
    return { uf: u, classe: `q${classe(t.taxa, cortes)}`, href: href({ uf: u === uf ? null : u }), sigla: u, valor: pct(t.taxa, 0), descricao: `${NOME_UF[u] ?? u}: ${pct(t.taxa)} de abstenção em ${ano}` };
  });

  // municípios do estado em zoom; no modo "cruzar", 3 × 3 cores: terço da abstenção × terço do indicador, dentro do estado
  const idsUf = uf ? idsDe(uf) : [];
  const corte3Abst = quantis(idsUf.flatMap((id) => taxaDe(doAno.get(id)) ?? []), 3);
  const corte3Ind = quantis(idsUf.flatMap((id) => indicadores.get(id)?.[ind] ?? []), 3);
  const caixa = uf ? CAIXA_UF[uf] : undefined;
  const noMapa: MunicipioNoMapa[] = !uf || !caixa ? [] : municipios.filter((m) => m.uf === uf && CENTRO_MUNICIPIO[m.cod_ibge]).map((m) => {
    const t = taxaDe(doAno.get(m.id_municipio));
    const v = indicadores.get(m.id_municipio)?.[ind];
    const cor = corMunicipio(t, v, { quintos: cortes, tercosAbst: corte3Abst, tercosInd: corte3Ind }, cruzar);
    const nome = nomeMun.get(m.id_municipio)!;
    const dica = t == null ? `${nome}: sem dado em ${ano}` : `${nome}: ${pct(t)} de abstenção${cruzar && v != null ? ` · ${infoInd.rotulo} ${formatarIndicador(ind, v)}` : ""}`;
    const atraso = (CENTRO_MUNICIPIO[m.cod_ibge][0] - caixa[0]) / (caixa[2] - caixa[0]);   // os municípios surgem de oeste para leste
    return { ibge: m.cod_ibge, classe: cor, href: href({ mun: m.id_municipio === mun?.id_municipio ? null : m.id_municipio }), dica, atraso: Math.round(atraso * 100) / 100 };
  });
  const camera = enquadrar(caixa ?? [0, 0, MAPA_LARGURA, MAPA_ALTURA], TELA.larg, TELA.alt, caixa ? 0.06 : 0.02);
  const centro = mun ? CENTRO_MUNICIPIO[mun.cod_ibge] : undefined;

  // painel: a unidade escolhida (município, estado ou os seis estados) comparada com a de cima
  const idsTodos = idsDe();
  const ids = mun ? [mun.id_municipio] : uf ? idsUf : idsTodos;
  const total = totalDe(ids);
  const referencia = mun ? { nome: `da média de ${NOME_UF[uf!]}`, t: totalDe(idsUf) } : uf ? { nome: "dos seis estados juntos", t: totalDe(idsTodos) } : null;
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
  const ranking = idsUf.flatMap((id) => { const t = taxaDe(doAno.get(id)); return t == null ? [] : [{ id, t }]; }).sort((a, b) => b.t - a.t);
  const legendaQ = rotulosFaixas(cortes, (v) => pct(v, 0));

  // números do mosaico e achados das análises
  const dinheiro = dinheiroTotal(fontes);
  const anoSucesso = Math.max(0, ...sucesso.map((l) => l.ano));
  const p8 = anoSucesso ? respostaSucesso(sucessoTresGrupos(sucesso, { ano: anoSucesso })) : null;
  const anoGeral = Math.max(0, ...legenda.filter((l) => l.ano % 4 === 2).map((l) => l.ano));
  const p5 = anoGeral ? conjunto(legendaPorUf(legenda, anoGeral)) : null;

  const achados = {
    "/analises/financiamento": p8?.vezes ? `Em ${anoSucesso}, quem recebeu muito dinheiro público se elegeu ${umaCasa(p8.vezes)} vezes mais do que quem ${p8.base.chave === "nada" ? "não recebeu nada" : "recebeu pouco"}.` : undefined,
    "/analises/legenda": p5 ? `Em ${anoGeral}, ${pct(p5.valor, 1)} dos votos para deputado foram só no partido, sem escolher candidato.` : undefined,
  };

  return (
    <>
      {!participacao.length ? (
        <div className="card aviso">
          <h2>Mapa indisponível</h2>
          <p>Os dados do mapa ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py mapa</code>.</p>
        </div>
      ) : (
        <section id="mapa" className="quadro observatorio" aria-labelledby="h-mapa">
          <MapaVivo className="palco s8" estado={uf}>
            <div className="palco-topo">
              <div>
                <p className="palco-sobre">Abstenção nas eleições · {cruzar ? `cruzada com ${infoInd.rotulo.toLowerCase()} (Censo 2010)` : "1º turno"}</p>
                <h1 id="h-mapa">Quem não foi votar em {ano}</h1>
              </div>
              <nav className="trilha" aria-label="Onde você está no mapa">
                <a href={href({ uf: null })} data-mapa="" aria-current={!uf ? "true" : undefined}>Seis estados</a>
                {uf && <><span aria-hidden="true">/</span><a href={href({ mun: null })} data-mapa="" aria-current={!mun ? "true" : undefined}>{NOME_UF[uf]}</a></>}
                {mun && <><span aria-hidden="true">/</span><span aria-current="true">{nomeMun.get(mun.id_municipio)}</span></>}
              </nav>
            </div>

            <div className="palco-mapa">
              <MapaAbstencao
                titulo={uf ? `Municípios de ${NOME_UF[uf]}: abstenção em ${ano}` : `Abstenção em ${ano} nos seis estados`}
                camera={camera} estados={estados} uf={uf} municipios={noMapa}
                destaque={mun && centro ? { ibge: mun.cod_ibge, nome: nomeMun.get(mun.id_municipio)!, x: centro[0], y: centro[1] } : undefined}
              />
              {!uf && <p className="palco-dica" aria-hidden="true">Clique num estado para ver os municípios</p>}
            </div>

            <div className="palco-base">
              {cruzar ? (
                <div className="legenda-bi" aria-label={`Cores: abstenção (colunas) e ${infoInd.rotulo} (linhas), em terços dos municípios de ${NOME_UF[uf!]}`}>
                  <div className="bi-grade" aria-hidden="true">{[2, 1, 0].flatMap((i) => [0, 1, 2].map((a) => <i key={`${i}${a}`} className={`b${i}${a}`} />))}</div>
                  <span className="bi-y">{infoInd.rotulo} ↑</span>
                  <span className="bi-x">Abstenção →</span>
                </div>
              ) : (
                <ul className="legenda-q" aria-label="Cores: cada uma reúne um quinto dos municípios dos seis estados">
                  {legendaQ.map((t, i) => <li key={i}><i className={`q${i}`} />{t}</li>)}
                </ul>
              )}
              <div className="anos" role="group" aria-label="Ano da eleição">
                {anos.map((a) => (
                  <Link key={a} scroll={false} href={href({ ano: a })} className={`ano${a === ano ? " on" : ""}${ANOS_CENSO.includes(a) ? " censo" : ""}`} aria-current={a === ano ? "true" : undefined}>
                    {a}{ANOS_CENSO.includes(a) && <small>Censo</small>}
                  </Link>
                ))}
              </div>
            </div>
          </MapaVivo>

          <div className="painel s4" key={`${uf}-${mun?.id_municipio}`}>
            <div className="bloco noite painel-cab">
              <p className="palco-sobre">{mun ? `Município · ${uf}` : uf ? `Estado · ${idsUf.length} municípios` : "AP, ES, MG, PE, RJ e RR"}</p>
              <h2>{nomeUnidade}</h2>
              {total.aptos > 0 ? (
                <>
                  <p className="painel-num"><Rolar valor={pct(total.taxa, 1)} /></p>
                  <p>dos {compacto(total.aptos)} eleitores aptos não foram votar em {ano}{referencia && <> ({total.taxa >= referencia.t.taxa ? "acima" : "abaixo"} {referencia.nome}, {pct(referencia.t.taxa, 1)})</>}.</p>
                  <dl className="painel-mini">
                    <div><dt>Compareceram</dt><dd>{compacto(total.comparecimento)}</dd></div>
                    <div><dt>Brancos e nulos</dt><dd>{pct((total.brancos + total.nulos) / Math.max(1, total.comparecimento), 1)}</dd></div>
                  </dl>
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

            <div className="bloco noite">
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
              <p className="muted pequeno">Anos gerais: governador; municipais: prefeito. As barras marcadas são as eleições comparadas com o Censo 2010.</p>
            </div>

            {comCenso ? (
              <>
                <div className="bloco noite">
                  <h3>Censo 2010</h3>
                  <p className="muted pequeno">{mun ? `O município entre os ${universo.length} de ${NOME_UF[uf!]}` : `Média ponderada pela população; a faixa mostra do menor ao maior município ${uf ? "do estado" : "dos seis estados"}`}. Escolha um indicador para cruzar com a abstenção.</p>
                  <ul className="indicadores">
                    {INDICADORES_CENSO.map((i) => {
                      const v = valorInd(i.chave);
                      const todos = universo.flatMap((id) => indicadores.get(id)?.[i.chave] ?? []);
                      const p = v == null ? null : posicao(v, todos);
                      return (
                        <li key={i.chave}>
                          <Link scroll={false} href={href({ ind: i.chave })} className={i.chave === ind ? "on" : undefined} aria-current={i.chave === ind ? "true" : undefined}>
                            <span className="ind-nome">{i.rotulo}</span>
                            <b>{v == null ? "—" : formatarIndicador(i.chave, v)}</b>
                            <span className="ind-faixa" aria-hidden="true">{p != null && <i style={{ "--p": p } as CSSProperties} />}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="bloco noite">
                  <h3>Abstenção × {infoInd.rotulo}</h3>
                  {pontos.length >= 3 ? (
                    <>
                      <p className="r-texto">{r != null && lerCorrelacao(r, /^[A-Z]{2}/.test(infoInd.rotulo) ? infoInd.rotulo : infoInd.rotulo[0].toLowerCase() + infoInd.rotulo.slice(1))}{r != null && <small> (r = {r.toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })})</small>}</p>
                      <Dispersao
                        pontos={pontos} tendencia={tendencia(pontos)} rotuloX={infoInd.rotulo}
                        formatoX={(v) => formatarIndicador(ind, v)}
                        descricao={`Cada ponto é um município ${uf ? `de ${NOME_UF[uf]}` : "dos seis estados"}: ${infoInd.rotulo} em 2010 no eixo horizontal, abstenção em ${ano} no vertical.${r != null ? ` Correlação ${r.toFixed(2)}.` : ""}`}
                      />
                      <p className="muted pequeno">Cada ponto é um município {uf ? `de ${NOME_UF[uf]}` : "dos seis estados"}{mun ? "; o círculo grande é o escolhido" : ""}. Correlação não é causa.</p>
                      {uf && (
                        <Link scroll={false} className={`chip cruzar${cruzar ? " on" : ""}`} href={href({ cor: cruzar ? null : "cruzar" })} aria-current={cruzar ? "true" : undefined}>
                          {cruzar ? "Voltar a pintar só a abstenção" : `Pintar o mapa com abstenção × ${infoInd.rotulo}`}
                        </Link>
                      )}
                    </>
                  ) : <p>Poucos municípios com os dois dados.</p>}
                </div>
              </>
            ) : (
              <div className="bloco noite censo-aviso">
                <h3>E os indicadores sociais?</h3>
                <p>Os indicadores do Censo 2010 (renda, escolaridade, IDHM) só são comparados com as eleições municipais em volta dele.</p>
                <div className="chips">{ANOS_CENSO.map((a) => <Link key={a} scroll={false} className="chip" href={href({ ano: a })}>Ver {a}</Link>)}</div>
              </div>
            )}

            {uf && !mun && ranking.length > 0 && (
              <div className="bloco noite">
                <h3>Onde mais e menos se faltou</h3>
                <ol className="extremos">
                  {[...ranking.slice(0, 4), ...ranking.slice(-4)].map((x, i) => (
                    <li key={x.id} className={i === 4 ? "corte" : undefined}>
                      <Link scroll={false} href={href({ mun: x.id })}><span>{nomeMun.get(x.id)}</span><b>{pct(x.t, 1)}</b></Link>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {uf && (
              <ul className="atalhos">
                <li><Link href={`/candidatos?uf=${uf}`}>Candidatos</Link></li>
                <li><Link href={`/analises/financiamento?uf=${uf}`}>Financiamento</Link></li>
                <li><Link href={`/analises/legenda?uf=${uf}`}>Voto de legenda</Link></li>
                <li><Link href={`/analises/pos-mandato?uf=${uf}`}>Depois do mandato</Link></li>
              </ul>
            )}
          </div>
        </section>
      )}

      {/* a frase e a busca */}
      <section className="quadro capa" aria-label="Sobre a plataforma">
        <div className="bloco s7 declaracao">
          <p>Quem se candidata, quem paga a campanha e o que acontece depois do mandato, em seis estados, de 1998 a 2024, com os dados abertos do TSE.</p>
        </div>
        <div className="bloco s5 tinta busca-capa">
          <SearchBox />
        </div>
      </section>

      {/* letreiro: os seis estados passando */}
      <div className="letreiro" aria-hidden="true">
        <div className="letreiro-fita">
          {[0, 1].map((k) => <span key={k}>{ESTADOS.map((e) => <span key={e}>{e}<i /></span>)}</span>)}
        </div>
      </div>

      {dinheiro && (
        <section className="quadro mosaico" aria-labelledby="h-dinheiro">
          <h2 id="h-dinheiro" className="s12 titulo-secao">O dinheiro das campanhas</h2>
          <figure className="bloco foto persiana s8 mosaico-foto">
            <Image src={FOTOS.interior.src} alt={FOTOS.interior.alt} width={FOTOS.interior.largura} height={FOTOS.interior.altura} sizes="(min-width: 1000px) 66vw, 100vw" />
          </figure>
          <div className="s4 mosaico-numeros">
            <div className="bloco tinta">
              <p className="figura"><Rolar valor={`R$ ${umaCasa(dinheiro.total / 1e9)} bi`} /></p>
              <p>arrecadados pelas campanhas dos seis estados de {dinheiro.anos[0]} a {dinheiro.anos[1]}, sem contar as de presidente.</p>
            </div>
            <div className="bloco cinza">
              <p className="figura"><Rolar valor={pct(dinheiro.publico / dinheiro.total, 0)} /></p>
              <p>desse dinheiro veio do Fundo Eleitoral e do Fundo Partidário, ou seja, de impostos.</p>
            </div>
          </div>
        </section>
      )}

      <section className="quadro analises-home" aria-labelledby="h-perguntas">
        <div className="bloco s4 perguntas-titulo">
          <h2 id="h-perguntas">Quatro perguntas aos dados</h2>
          <p className="muted">Cada análise responde a uma pergunta com gráficos que dá para filtrar por ano, cargo e estado.</p>
        </div>
        <FaixasAnalises analises={ANALISES} achados={achados} className="s8" />
      </section>

      {/* vitrine: o Congresso recortado em blocos, com cinco blocos de cor */}
      <section className="vitrine" aria-labelledby="h-vitrine" style={{ "--foto": `url(${FOTOS.congresso.src})` } as CSSProperties}>
        {Array.from({ length: 24 }, (_, i) => {
          const r = Math.floor(i / 6), c = i % 6;
          const peca = { "--x": `${(c / 5) * 100}%`, "--y": `${(r / 3) * 100}%` } as CSSProperties;
          if (i === 0) return <div key={i} className="peca cor tinta"><h2 id="h-vitrine">Seis estados</h2><p>26 anos de eleições</p></div>;
          if (i === 9) return <div key={i} className="peca cor"><p>7 cargos, de vereador a presidente, com vices e suplentes</p></div>;
          if (i === 13) return <div key={i} className="peca cor"><p>Mais de meio milhão de políticos seguidos ao longo da carreira</p></div>;
          if (i === 22) return <div key={i} className="peca cor"><p>14 eleições: 7 gerais e 7 municipais</p></div>;
          if (i === 17) return <Link key={i} href="/candidatos" className="peca cor acao">Buscar um candidato →</Link>;
          return <div key={i} className="peca" aria-hidden="true"><span style={peca} /></div>;
        })}
        <p className="sr-only">{FOTOS.congresso.alt}</p>
      </section>
    </>
  );
}

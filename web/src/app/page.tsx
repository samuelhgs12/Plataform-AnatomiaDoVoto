import type { CSSProperties } from "react";
import Link from "next/link";
import Image from "next/image";
import { SearchBox } from "@/components/SearchBox";
import { MapaBrasil } from "@/components/MapaBrasil";
import { Rolar } from "@/components/Rolar";
import { comoObjetos, lerEstatico } from "@/lib/data";
import { NOME_UF, TIPO_ELEICAO, respostaSucesso, sucessoTresGrupos, type LinhaFontes, type LinhaSucesso } from "@/lib/financiamento";
import type { LinhaLegenda } from "@/lib/legenda";
import { conjunto, dinheiroTotal, faixasCor, INDICADORES, legendaPorUf, publicoPorUf, type Indicador, type ValorUf } from "@/lib/mapa";
import { compacto, inteiro, pct, reais } from "@/lib/format";
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
  const [q8, q5] = await Promise.all([lerEstatico("q8"), lerEstatico("q5")]);
  const fontes = comoObjetos<LinhaFontes>(q8?.fontes);
  const sucesso = comoObjetos<LinhaSucesso>(q8?.sucesso);
  const legenda = comoObjetos<LinhaLegenda>(q5?.legenda);

  // mapa: indicador e ano vêm da URL, validados contra os dados
  const indicador: Indicador = INDICADORES.some((i) => i.chave === um(sp.indicador)) ? (um(sp.indicador) as Indicador) : "publico";
  const anos = [...new Set((indicador === "publico" ? fontes : legenda).map((l) => l.ano))].sort((a, b) => a - b);
  const ano = anos.includes(Number(um(sp.ano))) ? Number(um(sp.ano)) : anos[anos.length - 1];
  const porIndicador: Record<Indicador, ValorUf[]> = { publico: ano ? publicoPorUf(fontes, ano) : [], legenda: ano ? legendaPorUf(legenda, ano) : [] };
  const valores = porIndicador[indicador];
  const uf = valores.some((v) => v.uf === um(sp.uf)) ? um(sp.uf) : undefined;
  const info = INDICADORES.find((i) => i.chave === indicador)!;
  const casas = indicador === "legenda" ? 1 : 0;   // legenda fica entre 2% e 5%: sem decimal, as faixas viram "4%–4%"
  const { faixa, limites } = faixasCor(valores.map((v) => v.valor));
  const todos = conjunto(valores);
  const maior = Math.max(...valores.map((v) => v.valor));   // barras do ranking relativas ao 1º: legenda vai só de 2% a 5%
  const sel = uf ? { uf, publico: porIndicador.publico.find((v) => v.uf === uf), legenda: porIndicador.legenda.find((v) => v.uf === uf) } : null;

  const href = (nova: { indicador?: string; ano?: number; uf?: string | null }) => {
    const p = new URLSearchParams();
    const n = { indicador, ano, uf, ...nova };
    if (n.indicador !== "publico") p.set("indicador", n.indicador);
    if (n.ano && n.ano !== anos[anos.length - 1]) p.set("ano", String(n.ano));
    if (n.uf) p.set("uf", n.uf);
    const s = p.toString();
    return `/${s ? `?${s}` : ""}#mapa`;
  };

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
      {/* capa: o nome numa faixa, a frase e a busca */}
      <section className="quadro capa" aria-labelledby="h-nome">
        <div className="bloco s12 faixa-nome">
          <h1 id="h-nome" className="nome"><span className="linha"><span>Anatomia do Voto</span></span></h1>
        </div>
        <div className="bloco s7 declaracao">
          <p>Quem se candidata, quem paga a campanha e o que acontece depois do mandato, em seis estados, de 1998 a 2024, com os dados abertos do TSE.</p>
        </div>
        <div className="bloco s5 tinta busca-capa">
          <SearchBox />
        </div>
      </section>

      {!valores.length ? (
        <div className="card aviso">
          <h2>Mapa indisponível</h2>
          <p>Os dados do mapa ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py</code>.</p>
        </div>
      ) : (
        <section id="mapa" className="quadro mapa-quadro" aria-labelledby="h-mapa">
          <div className="trilho-esq s3">
            <figure className="bloco foto persiana foto-alta">
              <Image src={FOTOS.confirma.src} alt={FOTOS.confirma.alt} width={FOTOS.confirma.largura} height={FOTOS.confirma.altura} sizes="(min-width: 1000px) 25vw, 100vw" preload />
            </figure>
            <dl className="bloco fatos">
              <div><dt>Eleições</dt><dd>14, de 1998 a 2024</dd></div>
              <div><dt>Cargos</dt><dd>7, de vereador a presidente</dd></div>
              <div><dt>Estados</dt><dd>AP, ES, MG, PE, RJ e RR</dd></div>
              <div><dt>Fonte</dt><dd>Tribunal Superior Eleitoral</dd></div>
            </dl>
          </div>

          <div className="bloco s5 mapa-bloco">
            <h2 id="h-mapa">{info.rotulo} em {ano}</h2>
            <p className="muted">Parte {indicador === "publico" ? "da receita das campanhas que veio de fundos públicos" : "dos votos para deputado e vereador dados só ao partido"}, numa {TIPO_ELEICAO(ano)}. Clique num estado.</p>
            <div className="teclas-mapa">
              <div className="chips" role="group" aria-label="Indicador">
                {INDICADORES.map((i) => <Link key={i.chave} scroll={false} className={`chip${i.chave === indicador ? " on" : ""}`} aria-current={i.chave === indicador ? "true" : undefined} href={href({ indicador: i.chave })}>{i.rotulo}</Link>)}
              </div>
              <div className="chips" role="group" aria-label="Ano da eleição">
                {anos.map((a) => <Link key={a} scroll={false} className={`chip${a === ano ? " on" : ""}`} aria-current={a === ano ? "true" : undefined} href={href({ ano: a })}>{a}</Link>)}
              </div>
            </div>
            <MapaBrasil
              titulo={`${info.rotulo} em ${ano}, por estado`}
              rotulos={Object.fromEntries(valores.map((v) => [v.uf, pct(v.valor, casas)]))}
              faixas={Object.fromEntries(valores.map((v) => [v.uf, faixa(v.valor)]))}
              descricoes={Object.fromEntries(valores.map((v) => [v.uf, `${NOME_UF[v.uf] ?? v.uf}: ${pct(v.valor)} ${info.unidade}`]))}
              hrefs={Object.fromEntries(valores.map((v) => [v.uf, href({ uf: v.uf === uf ? null : v.uf })]))}
              selecionada={uf}
            />
            <p className="escala-mapa" aria-hidden="true">
              {limites.map(([a, b], i) => <span key={i}><i className={`m${i + 1}`} />{pct(a, casas)}–{pct(b, casas)}</span>)}
              <span><i className="fora" />fora da pesquisa</span>
            </p>
          </div>

          <div className="trilho-dir s4">
            <div className="bloco ranking-bloco">
              <h3>Do maior para o menor</h3>
              <ol className="ranking" aria-label={`Estados do maior para o menor: ${info.curto}`}>
                {valores.map((v) => (
                  <li key={v.uf}>
                    <Link scroll={false} href={href({ uf: v.uf === uf ? null : v.uf })} className={v.uf === uf ? "on" : undefined} aria-current={v.uf === uf ? "true" : undefined}>
                      <span className="ranking-nome">{NOME_UF[v.uf] ?? v.uf}<small>{indicador === "publico" ? `${reais(v.base)} arrecadados` : `${compacto(v.base)} votos`}</small></span>
                      <span className="ranking-trilho" aria-hidden="true"><i className={`m${faixa(v.valor)}`} style={{ "--v": v.valor / maior } as CSSProperties} /></span>
                      <b>{pct(v.valor, casas)}</b>
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            {sel ? (
              <div className="bloco tinta painel-uf" key={sel.uf} aria-live="polite">
                <h3>{NOME_UF[sel.uf]} em {ano}</h3>
                <dl>
                  {sel.publico && <div><dd><Rolar valor={pct(sel.publico.valor, 0)} /></dd><dt>dinheiro público, de {reais(sel.publico.base)}</dt></div>}
                  {sel.legenda && <div><dd><Rolar valor={pct(sel.legenda.valor, 1)} /></dd><dt>voto de legenda, de {inteiro(sel.legenda.base)} votos</dt></div>}
                </dl>
                <ul className="atalhos">
                  <li><Link href={`/candidatos?uf=${sel.uf}`}>Candidatos</Link></li>
                  <li><Link href={`/analises/financiamento?uf=${sel.uf}&ano=${ano}`}>Financiamento</Link></li>
                  <li><Link href={`/analises/legenda?uf=${sel.uf}`}>Voto de legenda</Link></li>
                  <li><Link href={`/analises/pos-mandato?uf=${sel.uf}`}>Depois do mandato</Link></li>
                </ul>
              </div>
            ) : todos && (
              <div className="bloco tinta painel-uf">
                <h3>Os seis estados juntos</h3>
                <p className="painel-num"><Rolar valor={pct(todos.valor, casas)} /></p>
                <p className="muted">{indicador === "publico" ? `de ${reais(todos.base)} arrecadados em ${ano}` : `de ${compacto(todos.base)} votos em ${ano}`}. Escolha um estado no mapa para ver os números dele.</p>
              </div>
            )}
          </div>
        </section>
      )}

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

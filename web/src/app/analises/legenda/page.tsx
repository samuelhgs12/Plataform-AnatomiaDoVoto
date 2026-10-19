import type { Metadata } from "next";
import Link from "next/link";
import { comoObjetos, lerEstatico } from "@/lib/data";
import {
  anosCiclo, compararCiclos, cortesTom, faixaEventos, filtrar, hrefLegenda, indicePartidos, lerParametros, resolverSelecao,
  resumoCiclos, resumoSerie, serie, sugestoes, tabelaPartidos, MAX_PARTIDOS, TODOS,
  type CargoCiclo, type EventoPartido, type LinhaLegenda, type Linhagem, type OrdemCiclo,
} from "@/lib/legenda";
import { compacto, pct } from "@/lib/format";
import { BuscaPartido } from "@/components/BuscaPartido";
import { ComparaCiclos } from "@/components/ComparaCiclos";
import { SerieLegenda, corSerie } from "@/components/SerieLegenda";

export const metadata: Metadata = { title: "Voto de legenda" };
export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;
const LIMITE = 10;

export default async function Legenda({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const dados = await lerEstatico("q5");
  if (!dados?.legenda) {
    return (
      <div className="card aviso">
        <h1>Voto de legenda</h1>
        <p>Os dados desta página ainda não foram gerados. Na pasta <code>pipeline/</code>, rode <code>python export_static.py</code>.</p>
      </div>
    );
  }
  const todas = comoObjetos<LinhaLegenda>(dados.legenda);
  const eventos = comoObjetos<EventoPartido>(dados.eventos);
  const linhagem = comoObjetos<Linhagem>(dados.linhagem);
  const ufs = [...new Set(todas.map((l) => l.uf))].sort();
  const par = lerParametros(sp, { ufs, partidos: [...new Set(todas.map((l) => l.partido))] });
  const href = (m: Parameters<typeof hrefLegenda>[1]) => hrefLegenda(par, m);

  const linhas = filtrar(todas, { uf: par.uf, juntar: par.juntar, linhagem });
  const escolhidos = resolverSelecao(par.p, par.juntar, linhagem);
  const series = serie(linhas, escolhidos);
  const cortes = Object.fromEntries(escolhidos.map((p) => [p, cortesTom(p, eventos, par.juntar)]));
  const comparacao = compararCiclos(linhas, par, linhagem);
  const tabela = tabelaPartidos(linhas);
  const anosTabela = series[0].pontos.map((p) => p.ano);
  const ciclos = { geral: anosCiclo(todas, "geral"), municipal: anosCiclo(todas, "municipal") };
  const resumo = resumoSerie(series);

  const CARGOS: [CargoCiclo, string][] = [["ambos", "Federal e estadual"], ["federal", "Deputado federal"], ["estadual", "Deputado estadual"]];
  const ORDENS: [OrdemCiclo, string][] = comparacao.anos
    ? [["soma", "Total dos dois anos"], ["recente", `Votos em ${comparacao.anos[1]}`], ["anterior", `Votos em ${comparacao.anos[0]}`], ["crescimento", "Variação"]]
    : [];

  return (
    <>
      <h1>Voto de legenda</h1>
      <p className="muted" style={{ marginTop: 0 }}>Qual é a quantidade e a proporção de votos de legenda recebidos por cada partido? Eleições de 2018 a 2024.</p>

      <div className="chips" style={{ margin: "14px 0 16px" }}>
        <span className="chips" role="group" aria-label="Filtrar por UF">
          <Link className={`chip${!par.uf ? " on" : ""}`} href={href({ uf: undefined })} scroll={false}>Todas</Link>
          {ufs.map((u) => <Link key={u} className={`chip${par.uf === u ? " on" : ""}`} href={href({ uf: u })} scroll={false}>{u}</Link>)}
        </span>
        <Link className={`chip${par.juntar ? " on" : ""}`} href={href({ juntar: !par.juntar })} scroll={false} aria-current={par.juntar ? "true" : undefined}>
          {par.juntar ? "✓ " : ""}Juntar partidos que se fundiram
        </Link>
      </div>

      <section className="card" aria-labelledby="h-serie">
        <h2 id="h-serie">Série histórica</h2>
        <p className="muted" style={{ marginTop: 0 }}>{resumo}</p>
        <BuscaPartido indice={indicePartidos(todas, par.juntar, linhagem)} escolhidos={escolhidos} atual={par} />
        <div className="tags" aria-label="Partidos escolhidos">
          {escolhidos.map((p, i) => (
            <span key={p} className="tag">
              <i style={{ background: corSerie(i) }} />{p}
              {!series[i + 1].pontos.length && <span className="muted" style={{ fontWeight: 400 }}>sem votos aqui</span>}
              <Link href={href({ p: escolhidos.filter((x) => x !== p) })} scroll={false} aria-label={`Remover ${p}`}>×</Link>
            </span>
          ))}
          {escolhidos.length < MAX_PARTIDOS && sugestoes(linhas, escolhidos).map((s) => (
            <Link key={s} className="chip" href={href({ p: [...escolhidos, s] })} scroll={false} aria-label={`Adicionar ${s}`}>+ {s}</Link>
          ))}
        </div>
        <div className="legend">
          <span><i style={{ background: "var(--o)" }} />Todos os partidos</span>
          {escolhidos.map((p, i) => <span key={p}><i style={{ background: corSerie(i) }} />{p}</span>)}
          <span><i style={{ background: "var(--panel2)", border: "1px solid var(--line)" }} />Eleição municipal</span>
          <span>◆ mudança no partido</span>
        </div>
        <SerieLegenda series={series} cortes={cortes} eventos={faixaEventos(escolhidos, eventos)} descricao={resumo} />
        <p className="muted" style={{ fontSize: 14 }}>
          Proporção de legenda = votos de legenda ÷ (votos de legenda + votos nominais). Faixas cinza = eleições municipais (vereadores); as outras, gerais (deputados).
          Tom mais claro na linha = antes da mudança de nome ou, com “Juntar” ligado, antes da fusão ou incorporação. Passe o cursor sobre um ponto para ver os votos.
        </p>
      </section>

      <section className="card" aria-labelledby="h-ciclos">
        <h2 id="h-ciclos">Comparar ciclos por partido</h2>
        <p className="muted" style={{ marginTop: 0 }}>Votos de legenda de cada partido no ano anterior e no mais recente do mesmo tipo de eleição. {resumoCiclos(comparacao)}</p>
        <div className="chips" role="group" aria-label="Ciclo" style={{ marginBottom: 8 }}>
          {ciclos.geral && <Link className={`chip${par.ciclo === "geral" ? " on" : ""}`} href={href({ ciclo: "geral" })} scroll={false}>Deputados {ciclos.geral[0]} × {ciclos.geral[1]}</Link>}
          {ciclos.municipal && <Link className={`chip${par.ciclo === "municipal" ? " on" : ""}`} href={href({ ciclo: "municipal" })} scroll={false}>Vereadores {ciclos.municipal[0]} × {ciclos.municipal[1]}</Link>}
        </div>
        {par.ciclo === "geral" && (
          <div className="chips" role="group" aria-label="Cargo" style={{ marginBottom: 8 }}>
            {CARGOS.map(([c, rotulo]) => <Link key={c} className={`chip${par.cargo === c ? " on" : ""}`} href={href({ cargo: c })} scroll={false}>{rotulo}</Link>)}
          </div>
        )}
        {ORDENS.length > 0 && (
          <div className="chips" role="group" aria-label="Ordenar por" style={{ marginBottom: 4 }}>
            <span className="muted" style={{ fontSize: 14, alignSelf: "center" }}>Ordenar por</span>
            {ORDENS.map(([o, rotulo]) => <Link key={o} className={`chip${par.ordem === o ? " on" : ""}`} href={href({ ordem: o })} scroll={false}>{rotulo}</Link>)}
          </div>
        )}
        <ComparaCiclos comparacao={comparacao} limite={LIMITE} todos={par.todos} hrefAlternar={href({ todos: !par.todos })} />
      </section>

      <details className="card">
        <summary>Ver tabela completa</summary>
        <div className="tablewrap" style={{ marginTop: 10 }}>
          <table>
            <caption className="sr-only">Proporção e votos de legenda por partido e ano{par.uf ? `, ${par.uf}` : ""}</caption>
            <thead><tr><th>Partido</th>{anosTabela.map((a) => <th key={a} className="num">{a}</th>)}</tr></thead>
            <tbody>
              {[series[0], ...tabela].map((s) => (
                <tr key={s.partido} style={s.partido === TODOS ? { fontWeight: 600 } : undefined}>
                  <td>{s.partido === TODOS ? "Todos os partidos" : s.partido}</td>
                  {anosTabela.map((a) => {
                    const p = s.pontos.find((x) => x.ano === a);
                    return <td key={a} className="num">{p ? <>{pct(p.proporcao)}<br /><span className="muted" style={{ fontWeight: 400 }}>{compacto(p.legenda)}</span></> : <span className="muted">—</span>}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>Em cada célula: proporção e votos de legenda{par.juntar ? ", com os partidos que se fundiram somados ao atual" : ""}.</p>
      </details>

      <p className="muted" style={{ fontSize: 14 }}>
        Fonte: TSE, dados abertos; banco do projeto BDR. Cargos proporcionais, 1º turno, eleições ordinárias, em AP, ES, MG, PE, RJ e RR.
        Siglas renomeadas aparecem com o nome atual (PRB → REPUBLICANOS, PR → PL, PPS → CIDADANIA, PTC → AGIR, PMN → MOBILIZA).
        Com “Juntar partidos que se fundiram”, os votos dos antigos passam para o atual: DEM e PSL → UNIÃO; PTB, PATRIOTA e PRP → PRD;
        PSC e PHS → PODEMOS; PROS → SOLIDARIEDADE; PPL → PCdoB. Datas das mudanças: ano da aprovação pelo TSE.
      </p>
    </>
  );
}

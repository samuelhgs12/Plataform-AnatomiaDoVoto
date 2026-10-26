import Link from "next/link";
import type { CSSProperties } from "react";
import type { Comparacao, ParCiclo } from "@/lib/legenda";
import { compacto, inteiro, pct, pctSinal } from "@/lib/format";

function Barra({ valor, max, cor, ano, status }: { valor: number | null; max: number; cor: string; ano: number; status: string | null }) {
  return (
    <div className="par-linha">
      {valor != null
        ? <><span className="par-barra" style={{ "--f": valor / max, background: cor } as CSSProperties} /><span className="n" title={`${ano}: ${inteiro(valor)} votos de legenda`}>{compacto(valor)}</span></>
        : <span className="muted">{ano}: {status ?? "—"}</span>}
    </div>
  );
}

const SETA = { sobe: "M6 10V2M2.5 5.5 6 2l3.5 3.5", desce: "M6 2v8M2.5 6.5 6 10l3.5-3.5" };

/** A variação como pílula: alta e queda nas cores do tema (com seta desenhada, não só cor); sem comparação, neutra. */
function Variacao({ p }: { p: ParCiclo }) {
  if (p.variacao == null) return p.status === "novo" ? <span className="pilula neutra">novo</span> : <span className="muted" aria-label="sem variação">—</span>;   // o motivo já está na barra
  const texto = pctSinal(p.variacao);
  if (texto === "0%") return <span className="pilula neutra">0%</span>;
  const lado = p.variacao > 0 ? "sobe" : "desce";
  return (
    <span className={`pilula ${lado}`}>
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d={SETA[lado]} /></svg>
      {texto}
    </span>
  );
}

/**
 * Barras pareadas (pergunta 5): votos de legenda de cada partido no ano anterior (--o) e no mais recente (--accent)
 * do mesmo tipo de eleição, com a variação à direita. Mostra os `limite` primeiros, ou todos com `todos`.
 */
export function ComparaCiclos({ comparacao, limite, todos, hrefAlternar }: { comparacao: Comparacao; limite: number; todos: boolean; hrefAlternar: string }) {
  const { anos, pares } = comparacao;
  if (!anos) return <p className="muted">Não há duas eleições deste ciclo para comparar.</p>;
  const visiveis = todos ? pares : pares.slice(0, limite);
  const max = Math.max(1, ...visiveis.flatMap((p) => [p.anterior ?? 0, p.recente ?? 0]));
  return (
    <>
      <div className="legend">
        <span><i style={{ background: "var(--o)" }} />{anos[0]}</span>
        <span><i style={{ background: "var(--accent)" }} />{anos[1]}</span>
        <span>À direita: variação dos votos de legenda de {anos[0]} para {anos[1]}</span>
      </div>
      <div className="pares" role="table" aria-label={`Votos de legenda por partido, ${anos[0]} e ${anos[1]}`}>
        <div role="row" style={{ display: "contents" }}>
          <span role="columnheader" className="sr-only">Partido</span>
          <span role="columnheader" className="sr-only">Votos de legenda em {anos[0]} e {anos[1]}</span>
          <span role="columnheader" className="sr-only">Variação</span>
        </div>
        {visiveis.map((p) => (
          <div key={p.partido} role="row" style={{ display: "contents" }}>
            <div role="rowheader" className="nm">
              <span className="nm-sigla">{p.partido}<span className="nm-num">nº {p.numero}</span></span>
              {p.recente != null && <small>{pct(p.fatia, 0)} da legenda · {inteiro(p.eleitosRecente)} {p.eleitosRecente === 1 ? "eleito" : "eleitos"}</small>}
            </div>
            <div role="cell">
              <Barra valor={p.anterior} max={max} cor="var(--o)" ano={anos[0]} status={p.anterior == null ? p.status : null} />
              <Barra valor={p.recente} max={max} cor="var(--accent)" ano={anos[1]} status={p.recente == null ? p.status : null} />
            </div>
            <div role="cell" className="var"><Variacao p={p} /></div>
          </div>
        ))}
      </div>
      {pares.length > limite && (
        <p style={{ margin: "14px 0 0" }}>
          <Link href={hrefAlternar} scroll={false}>{todos ? `Mostrar só os ${limite} primeiros` : `Mostrar todos os ${pares.length} partidos`}</Link>
        </p>
      )}
    </>
  );
}

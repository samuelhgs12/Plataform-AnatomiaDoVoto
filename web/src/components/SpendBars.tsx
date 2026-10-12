import type { Despesas } from "@/lib/types";
import { brl, pct } from "@/lib/format";

const ROTULOS: Record<string, string> = {
  propaganda_digital: "Propaganda digital", propaganda_audiovisual: "Propaganda audiovisual", propaganda_fisica: "Propaganda física",
  mobilizacao: "Mobilização", transferencia: "Transferências", outros: "Outros",
};

/** Gasto por categoria (pergunta 9). A marca vertical é a mediana de quem gastou na categoria, no mesmo cargo, ano e UF. */
export function SpendBars({ d }: { d: Despesas }) {
  if (!d.categorias.length) return <p className="muted">Sem despesas registradas na prestação de contas final desta candidatura.</p>;
  const max = Math.max(...d.categorias.flatMap((c) => [c.valor, c.mediana_cargo ?? 0]));
  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        Total gasto <b style={{ color: "var(--fg)" }}>{brl(d.total)}</b>, dos quais <b style={{ color: "var(--fg)" }}>{pct(d.pct_propaganda, 0)}</b> em propaganda.
        {d.n_comparaveis > 1 && ` Comparação com ${d.n_comparaveis} candidaturas do mesmo cargo, ano e UF.`}
      </p>
      <div className="spend" role="table" aria-label="Gasto por categoria">
        {d.categorias.map((c) => (
          <div key={c.categoria} style={{ display: "contents" }} role="row">
            <div role="cell">{ROTULOS[c.categoria] ?? c.categoria}</div>
            <div className="trilho" role="cell" aria-label={`${brl(c.valor)}${c.mediana_cargo != null ? `, mediana do cargo ${brl(c.mediana_cargo)}` : ""}`}>
              <div className={`barra${c.publicidade ? " prop" : ""}`} style={{ width: `${(c.valor / max) * 100}%` }} />
              {c.mediana_cargo != null && <div className="mediana" style={{ left: `${(c.mediana_cargo / max) * 100}%` }} title={`Mediana: ${brl(c.mediana_cargo)}`} />}
            </div>
            <div role="cell" style={{ textAlign: "right" }}>{brl(c.valor)} <span className="muted">({pct(c.pct, 0)})</span></div>
          </div>
        ))}
      </div>
      <p className="note muted" style={{ fontSize: 12 }}>Verde = categorias de propaganda. Marca preta = mediana do cargo (considera só quem gastou nessa categoria).</p>
    </div>
  );
}

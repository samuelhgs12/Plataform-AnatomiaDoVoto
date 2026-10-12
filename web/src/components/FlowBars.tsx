import { DESTINOS, type GrupoFluxo } from "@/lib/fluxo";
import { inteiro, pct } from "@/lib/format";

/** Barras empilhadas 100%: o que cada eleito fez até a eleição seguinte do mesmo tipo. */
export function FlowBars({ grupos }: { grupos: GrupoFluxo[] }) {
  if (!grupos.length) return <p className="muted">Sem mandatos para os filtros escolhidos.</p>;
  return (
    <>
      <div className="legend">
        {DESTINOS.map((d) => <span key={d.chave}><i className={d.classe} />{d.rotulo}</span>)}
      </div>
      <div className="flow">
        {grupos.map((g) => (
          <div key={g.cargo} style={{ display: "contents" }}>
            <div className="nm">{g.cargo}<small>{inteiro(g.total)} mandatos</small></div>
            <div className="stack" role="img" aria-label={`${g.cargo}: ${DESTINOS.map((d) => `${d.rotulo} ${pct((g.porDestino[d.chave] ?? 0) / g.total, 0)}`).join(", ")}`}>
              {DESTINOS.map((d) => {
                const n = g.porDestino[d.chave] ?? 0;
                if (!n) return null;
                const p = n / g.total;
                return <div key={d.chave} className={`seg ${d.classe}`} style={{ width: `${p * 100}%` }} title={`${d.rotulo}: ${inteiro(n)} (${pct(p)})`}>{p >= 0.035 ? `${Math.round(p * 100)}%` : ""}</div>;
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

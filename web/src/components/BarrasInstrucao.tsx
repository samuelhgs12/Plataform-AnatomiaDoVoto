import type { CSSProperties } from "react";
import { NIVEIS, type LinhaNiveis } from "@/lib/instrucao";
import { compacto, pct } from "@/lib/format";

/**
 * Os quatro graus de instrução em barras de 100%, uma por linha (a população, os eleitos e, fora do município, os eleitos
 * de cada cargo), montadas por `linhasNiveis` (src/lib/instrucao.ts). Os graus da medida que pinta o mapa (`niveis`)
 * ganham contorno. Cada parte larga o bastante leva a porcentagem; todas estão no aria-label da
 * barra. Componente de servidor sem JS.
 */
export function BarrasInstrucao({ linhas, niveis }: { linhas: LinhaNiveis[]; niveis: readonly number[] }) {
  return (
    <div className="niveis">
      <ul className="niveis-legenda" aria-hidden="true">
        {NIVEIS.map((n) => <li key={n.nivel}><i className={`ni-${n.nivel}`} />{n.rotulo}</li>)}
      </ul>
      <ol className="niveis-linhas">
        {linhas.map((l) => (
          <li key={l.chave}>
            <p className="niveis-rotulo"><span>{l.rotulo}</span><small>{compacto(l.total)} pessoas</small></p>
            <div className="niveis-barra" role="img" aria-label={`${l.rotulo} (${compacto(l.total)}): ${NIVEIS.map((n, i) => `${pct(l.partes[i], 0)} ${n.rotulo.toLowerCase()}`).join(", ")}`}>
              {l.partes.map((p, i) => p > 0 && (
                <i key={i} className={`ni-${i + 1}${niveis.includes(i + 1) ? " marca" : ""}`} style={{ "--p": p } as CSSProperties}>
                  {p >= 0.09 && <span>{pct(p, 0)}</span>}
                </i>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

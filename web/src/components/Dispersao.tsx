import { escala, eixoPct } from "@/lib/grafico";
import { pct } from "@/lib/format";

interface Props {
  /** x: indicador; y: taxa de abstenção (0 a 1); on: o município escolhido */
  pontos: { id: number; x: number; y: number; on?: boolean }[];
  rotuloX: string;
  formatoX: (v: number) => string;
  tendencia: { a: number; b: number } | null;
  descricao: string;
}

const L = 360, A = 240, M = { e: 46, d: 12, t: 12, b: 36 };

/**
 * Dispersão indicador × abstenção, um ponto por município. Os pontos se movem (transform com transição) quando o
 * indicador muda, em vez de redesenhar o gráfico.
 */
export function Dispersao({ pontos, rotuloX, formatoX, tendencia, descricao }: Props) {
  const xs = pontos.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const { teto, marcas } = eixoPct(Math.max(...pontos.map((p) => p.y)));
  const sx = escala(x0, x1, M.e, L - M.d), sy = escala(0, teto, A - M.b, M.t);
  const marcasX = [0, 0.5, 1].map((t) => x0 + (x1 - x0) * t);
  const escolhido = pontos.find((p) => p.on);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="dispersao" role="img" aria-label={descricao}>
      {marcas.map((m) => (
        <g key={m}>
          <line className="gr" x1={M.e} x2={L - M.d} y1={sy(m)} y2={sy(m)} />
          <text x={M.e - 8} y={sy(m)} dy="0.32em" textAnchor="end">{pct(m, 0)}</text>
        </g>
      ))}
      {marcasX.map((v, i) => <text key={i} x={sx(v)} y={A - M.b + 18} textAnchor={(["start", "middle", "end"] as const)[i]}>{formatoX(v)}</text>)}
      <text x={L - M.d} y={A - 2} textAnchor="end" className="eixo">{rotuloX} →</text>
      {pontos.map((p) => <circle key={p.id} r={p.on ? 0 : 2.6} style={{ transform: `translate(${sx(p.x)}px, ${sy(p.y)}px)` }} />)}
      {tendencia && <line className="tendencia" x1={sx(x0)} x2={sx(x1)} y1={sy(tendencia.a + tendencia.b * x0)} y2={sy(tendencia.a + tendencia.b * x1)} />}
      {escolhido && <circle className="on" r={6} style={{ transform: `translate(${sx(escolhido.x)}px, ${sy(escolhido.y)}px)` }} />}
    </svg>
  );
}

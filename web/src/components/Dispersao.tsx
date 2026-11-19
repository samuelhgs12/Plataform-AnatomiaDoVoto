import { escala, eixoPct } from "@/lib/grafico";
import { pct } from "@/lib/format";

interface Props {
  /** x: indicador; y: taxa de abstenção (0 a 1) ou o valor do eixoY; on: o município escolhido */
  pontos: { id: number; x: number; y: number; on?: boolean }[];
  rotuloX: string;
  formatoX: (v: number) => string;
  tendencia: { a: number; b: number } | null;
  descricao: string;
  /** eixo vertical que não é taxa (idade, viés): faixa, marcas (eixoNum) e formato; sem ele, de 0 à maior taxa, em % */
  eixoY?: { de: number; ate: number; marcas: number[]; formato: (v: number) => string; rotulo: string };
}

const L = 360, A = 240, M = { e: 46, d: 12, t: 12, b: 36 };

/**
 * Dispersão indicador × abstenção (ou, com eixoY, idade × idade dos votados ou viés), um ponto por município. Os pontos se movem (transform com transição) quando o
 * indicador muda, em vez de redesenhar o gráfico.
 */
export function Dispersao({ pontos, rotuloX, formatoX, tendencia, descricao, eixoY }: Props) {
  const xs = pontos.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const pctY = eixoPct(Math.max(...pontos.map((p) => p.y)));
  const y0 = eixoY?.de ?? 0, y1 = eixoY?.ate ?? pctY.teto, marcas = eixoY?.marcas ?? pctY.marcas;
  const fmtY = eixoY?.formato ?? ((v: number) => pct(v, 0));
  const sx = escala(x0, x1, M.e, L - M.d), sy = escala(y0, y1, A - M.b, M.t);
  const marcasX = [0, 0.5, 1].map((t) => x0 + (x1 - x0) * t);
  const escolhido = pontos.find((p) => p.on);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="dispersao" role="img" aria-label={descricao}>
      {marcas.map((m) => (
        <g key={m}>
          <line className="gr" x1={M.e} x2={L - M.d} y1={sy(m)} y2={sy(m)} />
          <text x={M.e - 8} y={sy(m)} dy="0.32em" textAnchor="end">{fmtY(m)}</text>
        </g>
      ))}
      {marcasX.map((v, i) => <text key={i} x={sx(v)} y={A - M.b + 18} textAnchor={(["start", "middle", "end"] as const)[i]}>{formatoX(v)}</text>)}
      <text x={L - M.d} y={A - 2} textAnchor="end" className="eixo">{rotuloX} →</text>
      {eixoY && <text x={M.e} y={M.t - 4} className="eixo">↑ {eixoY.rotulo}</text>}
      {pontos.map((p) => <circle key={p.id} r={p.on ? 0 : 2.6} style={{ transform: `translate(${sx(p.x)}px, ${sy(p.y)}px)` }} />)}
      {tendencia && <line className="tendencia" x1={sx(x0)} x2={sx(x1)} y1={sy(tendencia.a + tendencia.b * x0)} y2={sy(tendencia.a + tendencia.b * x1)} />}
      {escolhido && <circle className="on" r={6} style={{ transform: `translate(${sx(escolhido.x)}px, ${sy(escolhido.y)}px)` }} />}
    </svg>
  );
}

import { eixoNum, escala } from "@/lib/grafico";
import { fmtVies } from "@/lib/legislativo";
import { ANOS_VIES, classeMapaVies } from "@/lib/vies";

type Ponto = { ano: number; score: number };

interface Props {
  /** viés do lugar em cada eleição do cargo escolhido (anos sem o cargo ficam de fora) */
  serie: Ponto[];
  /** a média de cima (o estado, para o município; os seis estados, para o estado), tracejada */
  referencia?: { rotulo: string; serie: Ponto[] };
  ano: number;
  descricao: string;
}

const L = 560, A = 230, M = { e: 40, d: 16, t: 26, b: 30 };

/**
 * Linha do tempo do viés (pergunta 7) de um cargo, de 2018 a 2026: uma coluna por eleição (as do outro ciclo ficam
 * vazias), a faixa do centro (−20 a +20, como no Legislativo) ao fundo, a linha do lugar com o valor em cada ponto (na
 * cor do mapa) e a referência tracejada. A eleição mostrada no mapa fica marcada. Componente de servidor sem JS.
 */
export function SerieVies({ serie, referencia, ano, descricao }: Props) {
  const todos = [...serie, ...(referencia?.serie ?? [])].map((p) => p.score);
  const { de, ate, marcas } = eixoNum(Math.min(-20, ...todos), Math.max(20, ...todos), 5);
  const sx = escala(0, ANOS_VIES.length - 1, M.e + 24, L - M.d - 24), sy = escala(de, ate, A - M.b, M.t);
  const x = (a: number) => sx(ANOS_VIES.indexOf(a as (typeof ANOS_VIES)[number]));
  const linha = (s: Ponto[]) => s.map((p, i) => `${i ? "L" : "M"}${x(p.ano).toFixed(1)},${sy(p.score).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${L} ${A}`} className="serie-vies" role="img" aria-label={descricao}>
      <rect className="sv-centro" x={M.e} width={L - M.e - M.d} y={sy(20)} height={sy(-20) - sy(20)} />
      <text className="sv-faixa" x={L - M.d - 6} y={Math.min(sy(-20), A - M.b) - 6} textAnchor="end">centro (−20 a +20)</text>
      <text className="sv-faixa" x={L - M.d - 4} y={M.t - 10} textAnchor="end">mais à direita ↑</text>
      {marcas.map((m) => (
        <g key={m}>
          <line className={m === 0 ? "sv-zero" : "gr"} x1={M.e} x2={L - M.d} y1={sy(m)} y2={sy(m)} />
          <text x={M.e - 8} y={sy(m)} dy="0.32em" textAnchor="end">{fmtVies(m, 0)}</text>
        </g>
      ))}
      {ANOS_VIES.map((a) => (
        <text key={a} className={`sv-ano${a === ano ? " on" : ""}`} x={x(a)} y={A - 8} textAnchor="middle">{a}</text>
      ))}
      <line className="sv-atual" x1={x(ano)} x2={x(ano)} y1={M.t} y2={A - M.b} />
      {referencia && referencia.serie.length > 1 && <path className="sv-ref" d={linha(referencia.serie)} />}
      {serie.length > 1 && <path className="sv-linha" d={linha(serie)} />}
      {serie.map((p) => (
        <g key={p.ano} transform={`translate(${x(p.ano)} ${sy(p.score)})`}>
          <circle className={`${classeMapaVies(p.score)}${p.ano === ano ? " on" : ""}`} r={p.ano === ano ? 7 : 5.5} />
          <text className="sv-valor" y={-13} textAnchor="middle">{fmtVies(p.score)}</text>
        </g>
      ))}
    </svg>
  );
}

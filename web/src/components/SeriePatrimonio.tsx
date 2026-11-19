import { COR_CATEGORIA, type PontoSerie, type PosicaoEleito } from "@/lib/patrimonio";

const L = 480, A = 210, ESQ = 36, DIR = 14, TOPO = 30, BASE = 26;
const p = (v: number) => `${Math.round(v * 100)}%`;

/**
 * A métrica principal da pergunta 2 em cada eleição do tipo do cargo (linha de 0 a 100%), com o ano escolhido em
 * destaque e, se `referencia`, a linha de 50% ("sem relação": vereador e deputados). Eleição sem dado fica sem ponto.
 * Componente de servidor, sem JS.
 */
export function SeriePatrimonio({ pontos, atual, titulo, referencia }: { pontos: PontoSerie[]; atual: number; titulo: string; referencia?: string }) {
  const vivos = pontos.filter((x): x is PontoSerie & { valor: number } => x.valor !== null);
  if (!vivos.length) return <p className="muted pequeno">Sem dados nas outras eleições.</p>;
  const x = (i: number) => ESQ + (pontos.length > 1 ? (i / (pontos.length - 1)) * (L - ESQ - DIR) : (L - ESQ - DIR) / 2);
  const y = (v: number) => TOPO + (1 - v) * (A - TOPO - BASE);
  const caminho = pontos.map((pt, i) => (pt.valor === null ? null : `${x(i)} ${y(pt.valor)}`)).filter(Boolean).join("L");
  return (
    <figure className="serie-p2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}: ${pontos.map((pt) => `${pt.ano} ${pt.valor === null ? "sem dado" : p(pt.valor)}`).join(", ")}.`}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v} className="sp-grade"><line x1={ESQ} x2={L - DIR} y1={y(v)} y2={y(v)} /><text x={ESQ - 6} y={y(v) + 4}>{p(v)}</text></g>
        ))}
        {referencia && <g className="sp-ref"><line x1={ESQ} x2={L - DIR} y1={y(0.5)} y2={y(0.5)} /><text x={ESQ + 6} y={y(0.5) + 15}>{referencia}</text></g>}
        <path className="sp-linha" d={`M${caminho}`} />
        {pontos.map((pt, i) => pt.valor === null ? null : (
          <g key={pt.ano} className={`sp-ponto${pt.ano === atual ? " on" : ""}`}>
            <circle cx={x(i)} cy={y(pt.valor)} r={pt.ano === atual ? 6 : 4} />
            <text x={x(i)} y={y(pt.valor) - 10}>{p(pt.valor)}</text>
          </g>
        ))}
        {pontos.map((pt, i) => <text key={pt.ano} className={`sp-ano${pt.ano === atual ? " on" : ""}`} x={x(i)} y={A - 6}>{pt.ano}</text>)}
      </svg>
    </figure>
  );
}

const CURTO: Record<string, string> = { primeiro: "o mais rico", segundo: "o 2º", abaixo: "3º ou abaixo", sem_bens: "sem bens", fora: "fora da conta" };

/** Uma disputa só ao longo das eleições (prefeito numa cidade, governador num estado): onde o eleito estava no patrimônio. */
export function SerieDisputa({ anos, atual, titulo }: { anos: { ano: number; p: PosicaoEleito | null }[]; atual: number; titulo: string }) {
  return (
    <ol className="serie-disputa" aria-label={titulo}>
      {anos.map(({ ano, p: pos }) => (
        <li key={ano} className={ano === atual ? "on" : undefined}>
          <span className="sd-ano">{ano}</span>
          <i className={pos ? COR_CATEGORIA[pos.categoria] : "sem"} aria-hidden="true" />
          <span className="sd-txt">{!pos ? "sem dado" : pos.categoria === "fora" ? "fora da conta" : `venceu ${CURTO[pos.categoria]}`}{pos && pos.categoria !== "fora" && pos.categoria !== "sem_bens" && <small>entre {pos.candidatos}</small>}</span>
        </li>
      ))}
    </ol>
  );
}

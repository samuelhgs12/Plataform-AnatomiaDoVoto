import { grupo } from "@/lib/propaganda";
import { descricaoGrafico, GRAFICO, graficoCargos, type Composicao } from "@/lib/propaganda-geral";

/**
 * "Como cada cargo dividiu a propaganda": uma linha por tipo (a campanha média), pelos cargos em ordem de alcance; internet
 * tracejada, para não depender só da cor. O nome do tipo vai junto do início da linha; a coluna do cargo escolhido tem fundo
 * mais claro e os percentuais escritos. O nome de cada cargo é um link que o escolhe. SVG desenhado no servidor, sem JS;
 * a geometria vem de graficoCargos (src/lib/propaganda-geral.ts).
 */
export function GraficoCargos({ cargos, cargoAtual, ano, onde, hrefDe }: {
  cargos: Composicao[]; cargoAtual: string; ano: number; onde: string; hrefDe: (cargo: string) => string;
}) {
  const g = graficoCargos(cargos, cargoAtual);
  const { largura, altura, margemEsq, margemDir } = GRAFICO;
  const yNome = g.y0 + 24;
  return (
    <figure className="p9g-grafico">
      <svg viewBox={`0 0 ${largura} ${altura}`} className="p9g-svg">
        <g role="img" aria-label={descricaoGrafico(cargos, ano, onde)}>
          {g.faixa && <rect className="p9g-faixa" x={g.faixa.x} y={g.y100 - 10} width={g.faixa.largura} height={g.y0 - g.y100 + 20} rx={6} />}
          {[[g.y0, "0%"], [g.y50, "50%"]].map(([y, t]) => (
            <g key={t} className="p9g-grade" aria-hidden="true">
              <line x1={margemEsq - 6} x2={largura - margemDir + 6} y1={y} y2={y} />
              <text x={0} y={Number(y) + 4}>{t}</text>
            </g>
          ))}
          {g.series.map((s) => (
            <g key={s.grupo} className={grupo(s.grupo).classe} aria-hidden="true">
              <polyline className={`p9g-serie${s.tracejada ? " tracejada" : ""}`} points={s.pontos.map((p) => `${p.x},${p.y}`).join(" ")} />
              {s.pontos.map((p, i) => <circle key={i} className="p9g-ponto" cx={p.x} cy={p.y} r={4} />)}
              <text className="p9g-nome-tipo" x={margemEsq - 12} y={s.rotuloY + 4} textAnchor="end">{s.rotulo}</text>
            </g>
          ))}
          {g.valores.map((v) => (
            <text key={v.grupo} className={`p9g-valor-ponto ${grupo(v.grupo).classe}`} x={v.x} y={v.y + 4} aria-hidden="true">{v.texto}</text>
          ))}
        </g>
        {g.colunas.map((c) => (
          <a key={c.cargo} href={hrefDe(c.cargo)} className={`p9g-cargo${c.atual ? " atual" : ""}`} aria-current={c.atual ? "true" : undefined}
            aria-label={`${c.cargo}${c.detalhe ? `, ${c.detalhe}` : ""}: ver em destaque`}>
            <text x={c.x} y={yNome} textAnchor="middle">
              {c.nome.map((l, i) => <tspan key={i} x={c.x} dy={i ? 14 : 0}>{l}</tspan>)}
            </text>
            {c.detalhe && <text className="p9g-campanhas" x={c.x} y={yNome + c.nome.length * 14} textAnchor="middle">{c.detalhe}</text>}
          </a>
        ))}
      </svg>
    </figure>
  );
}

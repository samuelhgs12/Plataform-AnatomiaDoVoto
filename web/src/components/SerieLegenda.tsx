import { caminho, cortar, eixoPct, empilhar, escala, espalhar, yEm, type Ponto } from "@/lib/grafico";
import { cicloDoAno, trechos, type EventoFaixa, type PontoSerie, type Serie } from "@/lib/legenda";
import { inteiro, pct } from "@/lib/format";

/** Cor do i-ésimo partido escolhido (tokens --s1..--s3 de globals.css). */
export const corSerie = (i: number) => `var(--s${i + 1})`;

const W = 760, ESQ = 44, DIR = 112, TOPO = 18, ALT = 220;
const CLARO = 0.4;   // opacidade da linha antes da mudança
const losango = (x: number, y: number, r = 5) => `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
const rotuloEvento = (e: EventoFaixa) => (e.tipo === "renomeacao" ? e.rotulo : `${e.partido} ${e.rotulo}`);
const dica = (partido: string, p: PontoSerie) =>
  `${partido}, ${p.ano}: ${pct(p.proporcao)} de legenda (${inteiro(p.legenda)} votos de legenda, ${inteiro(p.nominais)} nominais, ${inteiro(p.eleitos)} eleitos)`;

/**
 * Série histórica da proporção de legenda (pergunta 5): área cinza = todos os partidos; uma linha por partido escolhido.
 * Faixas = eleições municipais. A linha fica mais clara antes da última mudança do partido (cortes); losangos marcam
 * as mudanças, listadas na faixa "Mudanças nos partidos" embaixo.
 */
export function SerieLegenda({ series, cortes, eventos, descricao }: { series: Serie[]; cortes: Record<string, number[]>; eventos: EventoFaixa[]; descricao: string }) {
  const [todos, ...partidos] = series;
  if (!todos?.pontos.length) return <p className="muted">Sem votos para os filtros escolhidos.</p>;

  const anos = todos.pontos.map((p) => p.ano);
  const x = escala(anos[0] - 0.5, anos[anos.length - 1] + 0.5, ESQ, W - DIR);
  const { teto, marcas } = eixoPct(Math.max(...series.flatMap((s) => s.pontos.map((p) => p.proporcao))));
  const base = TOPO + ALT;
  const y = escala(0, teto, base, TOPO);
  const xy = (p: PontoSerie): Ponto => ({ x: x(p.ano), y: y(p.proporcao) });
  const cor = (partido: string) => { const i = partidos.findIndex((s) => s.partido === partido); return i < 0 ? "var(--muted)" : corSerie(i); };

  // rótulos no fim de cada linha, afastados para não se sobreporem
  const finais = series.filter((s) => s.pontos.length).map((s) => ({ s, p: s.pontos[s.pontos.length - 1] }));
  const ysRotulo = espalhar(finais.map((f) => y(f.p.proporcao)), 13, TOPO, base);

  // faixa de mudanças: cada evento numa linha onde não encosta no anterior
  const yFaixa = base + 54;
  const linhas = empilhar(eventos.map((e) => ({ x: x(e.x) - 6, largura: (rotuloEvento(e).length + 7) * 6.2 + 16 })));   // + " (2019)"
  const nLinhas = eventos.length ? Math.max(...linhas) + 1 : 1;
  const H = yFaixa + 12 + nLinhas * 18;

  const pontosTodos = todos.pontos.map(xy);
  const area = `${caminho(pontosTodos)}L${pontosTodos[pontosTodos.length - 1].x},${base}L${pontosTodos[0].x},${base}Z`;

  return (
    <div className="chartwrap">
      <svg className="chart wide" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao}>
        {anos.filter((a) => cicloDoAno(a) === "municipal").map((a) => (
          <rect key={a} x={x(a - 0.5)} y={TOPO - 8} width={x(a + 0.5) - x(a - 0.5)} height={ALT + 44} fill="var(--panel2)" />
        ))}
        {marcas.map((m) => (
          <g key={m}>
            <line className="gr" x1={ESQ} x2={W - DIR} y1={y(m)} y2={y(m)} />
            <text x={ESQ - 6} y={y(m) + 4} textAnchor="end" fontSize={11}>{pct(m, 0)}</text>
          </g>
        ))}
        {anos.map((a) => (
          <g key={a}>
            <text x={x(a)} y={base + 18} textAnchor="middle" fontSize={12} fontWeight={600} style={{ fill: "var(--fg)" }}>{a}</text>
            <text x={x(a)} y={base + 32} textAnchor="middle" fontSize={10}>{cicloDoAno(a) === "geral" ? "deputados" : "vereadores"}</text>
          </g>
        ))}
        {[...new Set(eventos.map((e) => e.x))].map((ex) => <line key={ex} className="gr" x1={x(ex)} x2={x(ex)} y1={TOPO} y2={yFaixa - 14} />)}

        <path d={area} fill="var(--o)" fillOpacity={0.35} className="surge" />
        <path d={caminho(pontosTodos)} fill="none" stroke="var(--muted)" strokeWidth={2} pathLength={1} className="desenha" />
        {todos.pontos.map((p, i) => (
          <g key={p.ano}>
            <circle cx={pontosTodos[i].x} cy={pontosTodos[i].y} r={3.5} fill="var(--muted)"><title>{dica("Todos os partidos", p)}</title></circle>
            <text x={pontosTodos[i].x} y={pontosTodos[i].y - 9} textAnchor="middle" fontSize={11} fontWeight={600}>{pct(p.proporcao)}</text>
          </g>
        ))}

        {partidos.map((s, i) => {
          const ultimo = cortes[s.partido]?.at(-1);
          const xc = ultimo != null ? x(ultimo) : -Infinity;
          return (
            <g key={s.partido} stroke={corSerie(i)} fill={corSerie(i)}>
              {trechos(s.pontos, anos).map((t) => {
                const [antes, depois] = cortar(t.map(xy), xc);
                return (
                  <g key={t[0].ano} fill="none" strokeWidth={2.5}>
                    {antes.length > 1 && <path d={caminho(antes)} strokeOpacity={CLARO} pathLength={1} className="desenha" />}
                    {depois.length > 1 && <path d={caminho(depois)} pathLength={1} className="desenha" />}
                  </g>
                );
              })}
              {(cortes[s.partido] ?? []).flatMap((c) => trechos(s.pontos, anos).map((t) => {
                const yc = yEm(t.map(xy), x(c));
                return yc == null ? null : <path key={`${c}-${t[0].ano}`} d={losango(x(c), yc)} stroke="var(--panel)" strokeWidth={1.5} />;
              }))}
              {s.pontos.map((p) => {
                const q = xy(p);
                return <circle key={p.ano} className="surge" cx={q.x} cy={q.y} r={4} stroke="var(--panel)" strokeWidth={1.5} fillOpacity={q.x < xc ? CLARO : 1}><title>{dica(s.partido, p)}</title></circle>;
              })}
            </g>
          );
        })}

        {finais.map(({ s, p }, k) => (
          <text key={s.partido} x={x(p.ano) + 9} y={ysRotulo[k] + 4} fontSize={12} fontWeight={600} style={{ fill: s === todos ? "var(--muted)" : cor(s.partido) }}>
            {s === todos ? "Todos" : s.partido} {pct(p.proporcao)}
          </text>
        ))}

        <text x={ESQ} y={yFaixa - 2} fontSize={11} fontWeight={600} style={{ fill: "var(--fg)" }}>Mudanças nos partidos</text>
        {!eventos.length && <text x={ESQ} y={yFaixa + 16} fontSize={11}>Nenhuma mudança nos partidos escolhidos entre {anos[0]} e {anos[anos.length - 1]}.</text>}
        {eventos.map((e, k) => {
          const ex = x(e.x), ey = yFaixa + 12 + linhas[k] * 18;
          return (
            <g key={`${e.partido}-${e.ano}-${e.tipo}`}>
              <title>{`${e.ano}: ${e.descricao}`}</title>
              <path d={losango(ex, ey - 4, 4.5)} style={{ fill: cor(e.partido) }} />
              <text x={ex + 8} y={ey} fontSize={11}>{rotuloEvento(e)} <tspan fontSize={10}>({e.ano})</tspan></text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

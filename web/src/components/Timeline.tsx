import type { CarreiraItem } from "@/lib/types";
import { corPartido, ROTULO_RESULTADO, inteiro } from "@/lib/format";

const NIVEIS: [number, string][] = [[7, "Presidente"], [6, "Governador"], [5, "Senador"], [4, "Dep. federal"], [3, "Dep. estadual"], [2, "Prefeito"], [1, "Vereador"]];
const TOPO = NIVEIS[0][0];
// nível pelo id_cargo (vices e suplentes no nível do titular). É a mesma escala de NIVEL_CARGO em
// api/app/routers/util.py, mas calculada aqui para o gráfico não depender de respostas antigas em cache.
const NIVEL_CARGO: Record<number, number> = { 13: 1, 11: 2, 12: 2, 7: 3, 8: 3, 6: 4, 5: 5, 9: 5, 10: 5, 3: 6, 4: 6, 1: 7, 2: 7 };

/**
 * Linha do tempo da carreira (pergunta 10): anos no eixo X, nível do cargo no eixo Y.
 * Ponto cheio = eleito; vazado = não eleito. Para acessibilidade há uma tabela equivalente logo abaixo (<details>).
 * Se quiser interatividade (zoom, tooltips ricos), troque por Observable Plot ou ECharts.
 */
export function Timeline({ carreira, nome }: { carreira: CarreiraItem[]; nome: string }) {
  const W = 760, H = 370, L = 104, R = 20, T = 24, B = 34, pw = W - L - R, ph = H - T - B;
  const a0 = 1998, a1 = 2024;
  const X = (ano: number) => L + ((ano - a0) / (a1 - a0)) * pw;
  const Y = (nivel: number) => T + ((TOPO - nivel) / (TOPO - 1)) * ph;
  const pts = [...carreira].sort((a, b) => a.ano - b.ano).map((p) => ({ ...p, nivel: NIVEL_CARGO[p.id_cargo] ?? p.nivel }));
  const anosEixo = Array.from({ length: (a1 - a0) / 2 + 1 }, (_, i) => a0 + i * 2);
  const descricao = `Linha do tempo de ${nome}: ${pts.map((p) => `${p.ano} ${p.cargo} (${p.eleito ? "eleito" : "não eleito"})`).join("; ")}.`;

  return (
    <figure style={{ margin: 0 }}>
      <div className="chartwrap">
      <svg className="chart wide" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao}>
        {NIVEIS.map(([n, rot]) => (
          <g key={n}>
            <line className="gr" x1={L} x2={W - R} y1={Y(n)} y2={Y(n)} />
            <text x={L - 8} y={Y(n) + 3} textAnchor="end" fontSize="10.5">{rot}</text>
          </g>
        ))}
        {anosEixo.map((a) => <text key={a} x={X(a)} y={H - B + 16} textAnchor="middle" fontSize="9.5">{a}</text>)}
        {pts.length > 1 && <polyline fill="none" stroke="var(--muted)" strokeWidth="1.3" opacity="0.6" points={pts.map((p) => `${X(p.ano)},${Y(p.nivel)}`).join(" ")} />}
        {pts.map((p) => {
          const cx = X(p.ano), cy = Y(p.nivel), cor = corPartido(p.partido);
          return (
            <g key={p.id_candidatura}>
              <circle cx={cx} cy={cy} r="6.5" fill={p.eleito ? "var(--ok)" : "var(--panel)"} stroke={p.eleito ? "var(--ok)" : "var(--fg)"} strokeWidth="1.8">
                <title>{`${p.ano} · ${p.cargo} · ${p.partido ?? "?"} · ${ROTULO_RESULTADO[p.resultado] ?? p.resultado}${p.votos_1t ? ` · ${inteiro(p.votos_1t)} votos` : ""}`}</title>
              </circle>
              <text x={cx} y={p.nivel === TOPO ? cy + 20 : cy - 11} textAnchor={cx > W - 70 ? "end" : cx < L + 30 ? "start" : "middle"} fontSize="9" style={{ fill: cor }}>{p.partido}</text>
            </g>
          );
        })}
      </svg>
      </div>
      <figcaption className="legend">
        <span><i style={{ background: "var(--ok)", borderRadius: "50%" }} />Eleito</span>
        <span><i style={{ border: "1.8px solid var(--fg)", borderRadius: "50%" }} />Não eleito</span>
      </figcaption>
      <details>
        <summary>Ver candidaturas em tabela</summary>
        <div className="tablewrap">
          <table>
            <thead><tr><th>Ano</th><th>Cargo</th><th>UF / município</th><th>Partido</th><th>Resultado</th><th className="num">Votos (1º turno)</th></tr></thead>
            <tbody>
              {pts.map((p) => (
                <tr key={p.id_candidatura}>
                  <td>{p.ano}</td><td>{p.cargo}</td><td>{p.municipio ?? p.uf}</td><td>{p.partido ?? "—"}</td>
                  <td>{ROTULO_RESULTADO[p.resultado] ?? p.resultado}</td><td className="num">{p.votos_1t ? inteiro(p.votos_1t) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

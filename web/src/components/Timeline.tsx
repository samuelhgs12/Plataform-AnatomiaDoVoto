import type { CarreiraItem } from "@/lib/types";
import { corPartido, ROTULO_RESULTADO, inteiro } from "@/lib/format";
import { NIVEIS_CARREIRA, rotulosPartido } from "@/lib/carreira";
import { caminho, escala } from "@/lib/grafico";

const TOPO = NIVEIS_CARREIRA[0][0];
const FONTE_PARTIDO = 11;

/**
 * Linha do tempo da carreira: anos no eixo X, nível do cargo no eixo Y. `carreira` já vem de `naLinhaDoTempo`.
 * Ponto cheio = eleito; vazado = não eleito. O partido de cada eleição fica numa faixa própria, entre o nível mais baixo
 * e os anos, ligado ao ponto por uma linha tracejada. Para acessibilidade há uma tabela equivalente logo abaixo (<details>).
 */
export function Timeline({ carreira, nome }: { carreira: (CarreiraItem & { nivel: number })[]; nome: string }) {
  const W = 760, L = 112, R = 20, T = 18, PASSO = 34;         // PASSO: distância entre níveis
  const a0 = 1998, a1 = 2024;
  const X = escala(a0, a1, L + 18, W - R - 18);
  const Y = (nivel: number) => T + (TOPO - nivel) * PASSO;
  const base = Y(1);                                         // linha do nível mais baixo (vereador)

  const pts = carreira.map((p) => ({ ...p, cx: X(p.ano), cy: Y(p.nivel) }));
  const rotulos = rotulosPartido(pts.map((p) => ({ x: p.cx, partido: p.partido })), FONTE_PARTIDO, { min: L - 8, max: W - 2 });
  const LINHA_ETIQ = 26, ALT_ETIQ = 19;
  const topoFaixa = base + 26;
  const nLinhas = Math.max(1, ...rotulos.map((r) => r.linha + 1));
  const yAnos = topoFaixa + nLinhas * LINHA_ETIQ + 12;
  const H = yAnos + 8;
  const yEtiq = (linha: number) => topoFaixa + linha * LINHA_ETIQ;

  const anosEixo = Array.from({ length: (a1 - a0) / 2 + 1 }, (_, i) => a0 + i * 2);
  const anosComPonto = new Set(pts.map((p) => p.ano));
  const etiquetaDe = (p: (typeof pts)[number]) => rotulos.find((r) => r.partido === p.partido && r.xPonto === p.cx);
  const descricao = `Linha do tempo de ${nome}: ${pts.map((p) => `${p.ano} ${p.cargo}${p.partido ? ` pelo ${p.partido}` : ""} (${p.eleito ? "eleito" : "não eleito"})`).join("; ")}.`;

  return (
    <figure style={{ margin: 0 }}>
      <div className="chartwrap">
        <svg className="chart wide carreira" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descricao}>
          {/* níveis */}
          {NIVEIS_CARREIRA.map(([n, rot], i) => (
            <g key={n}>
              {i % 2 === 0 && <rect className="faixa" x={L} y={Y(n) - PASSO / 2} width={W - R - L} height={PASSO} rx="6" />}
              <line className="nivel" x1={L} x2={W - R} y1={Y(n)} y2={Y(n)} />
              <text x={L - 12} y={Y(n) + 4} textAnchor="end" fontSize="12">{rot}</text>
            </g>
          ))}

          {/* faixa dos partidos */}
          <line className="nivel" x1={L} x2={W - R} y1={topoFaixa - 9} y2={topoFaixa - 9} />
          <text x={L - 12} y={topoFaixa + ALT_ETIQ / 2 + 4} textAnchor="end" fontSize="12" fontWeight="600">Partido</text>

          {/* ligação de cada ponto com a etiqueta do seu partido */}
          {pts.map((p) => {
            const e = etiquetaDe(p);
            return e ? <line key={`l${p.id_candidatura}`} className="guia" x1={p.cx} x2={p.cx} y1={p.cy + 9} y2={yEtiq(e.linha)} /> : null;
          })}

          {/* trajetória */}
          {pts.length > 1 && <path className="trajeto" d={caminho(pts.map((p) => ({ x: p.cx, y: p.cy })))} />}

          {pts.map((p) => (
            <g key={p.id_candidatura}>
              {p.eleito && <circle cx={p.cx} cy={p.cy} r="12" className="halo" />}
              <circle cx={p.cx} cy={p.cy} r="7" className={p.eleito ? "ponto eleito" : "ponto"}>
                <title>{`${p.ano} · ${p.cargo} · ${p.partido ?? "?"} · ${ROTULO_RESULTADO[p.resultado] ?? p.resultado}${p.votos_1t ? ` · ${inteiro(p.votos_1t)} votos` : ""}`}</title>
              </circle>
            </g>
          ))}

          {rotulos.map((r) => (
            <g key={`${r.xPonto}${r.partido}`}>
              <rect x={r.x - r.largura / 2} y={yEtiq(r.linha)} width={r.largura} height={ALT_ETIQ} rx={ALT_ETIQ / 2} style={{ fill: corPartido(r.partido) }} />
              <text x={r.x} y={yEtiq(r.linha) + ALT_ETIQ / 2 + 4} textAnchor="middle" fontSize={FONTE_PARTIDO} fontWeight="700" style={{ fill: "#fff" }}>{r.partido}</text>
            </g>
          ))}

          {/* anos */}
          {anosEixo.map((a) => (
            <text key={a} x={X(a)} y={yAnos} textAnchor="middle" fontSize="11.5" fontWeight={anosComPonto.has(a) ? 700 : 400}
              style={anosComPonto.has(a) ? { fill: "var(--fg)" } : undefined}>{a}</text>
          ))}
        </svg>
      </div>
      <figcaption className="legend">
        <span><i style={{ background: "var(--ok)", borderRadius: "50%" }} />Eleito</span>
        <span><i style={{ border: "2px solid var(--muted)", borderRadius: "50%" }} />Não eleito</span>
        <span>Etiqueta: partido pelo qual concorreu</span>
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

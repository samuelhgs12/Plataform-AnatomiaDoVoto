import { afastarRotulos, COR_CATEGORIA, type PontoSerie, type PosicaoEleito } from "@/lib/patrimonio";

const A = 250, TOPO = 24, BASE = 28;
/** Larga (tela grande) e compacta (celular): no celular o mesmo desenho fica mais estreito e os rótulos quebram em linhas planejadas. */
const LARGA = { L: 760, ESQ: 118, DIR: 180, compacta: false };
const COMPACTA = { L: 440, ESQ: 70, DIR: 112, compacta: true };
const p = (v: number) => `${Math.round(v * 100)}%`;
/** O nome da linha em linhas curtas, para a versão compacta. */
const QUEBRA: Record<string, string[]> = { "sem quem já tinha o cargo": ["sem quem já", "tinha o cargo"], "sem disputas com reeleição": ["sem disputas", "com reeleição"] };

/** Uma linha da série: o nome escrito na ponta direita, embaixo do último valor; `sem`: a linha sem quem já tinha o cargo (tracejada, mais clara). */
export interface LinhaSerie { nome: string; pontos: PontoSerie[]; sem?: boolean }
type Props = { linhas: LinhaSerie[]; atual: number; titulo: string; eixo: { min: number; max: number; marcas: number[] }; referencia?: boolean };

/**
 * A métrica principal da pergunta 2 em cada eleição do tipo do cargo, em duas linhas (com todos e sem quem já tinha o
 * cargo, tracejada e mais clara), cada uma com o último valor e o nome na ponta direita (linhas planejadas, afastadas por
 * afastarRotulos), sem legenda à parte. Outros valores só no primeiro ponto e no ano escolhido. Eixo pelos dados
 * (eixoSerie); `referencia`: a linha de 50%, escrita no eixo da esquerda ("50% · sem relação"). Dois desenhos, um
 * largo e um compacto, trocados por CSS conforme a largura da tela. Sem JS.
 */
export function SeriePatrimonio(props: Props) {
  if (!props.linhas.some((l) => l.pontos.some((x) => x.valor !== null))) return <p className="muted pequeno">Sem dados nas outras eleições.</p>;
  return (
    <figure className="serie-p2">
      <Desenho {...props} d={LARGA} />
      <Desenho {...props} d={COMPACTA} />
    </figure>
  );
}

function Desenho({ linhas, atual, titulo, eixo, referencia, d }: Props & { d: typeof LARGA }) {
  const { L, ESQ, DIR, compacta } = d;
  const vivas = linhas.filter((l) => l.pontos.some((x) => x.valor !== null));
  const anos = vivas[0].pontos.map((x) => x.ano);
  const x = (i: number) => ESQ + (anos.length > 1 ? (i / (anos.length - 1)) * (L - ESQ - DIR) : (L - ESQ - DIR) / 2);
  const y = (v: number) => TOPO + (1 - (v - eixo.min) / (eixo.max - eixo.min)) * (A - TOPO - BASE);
  const nomeEm = (l: LinhaSerie) => (compacta ? QUEBRA[l.nome] ?? [l.nome] : [l.nome]);
  // a ponta de cada linha (o último ponto com dado); os rótulos das pontas, de cima para baixo, afastados pela altura deles
  const pontas = vivas.map((l, k) => { const i = l.pontos.map((q) => q.valor !== null).lastIndexOf(true); return { k, i, v: l.pontos[i].valor! }; });
  const ordem = [...pontas].sort((m, n) => n.v - m.v);
  const alturaRotulo = Math.max(...vivas.map((l) => 1 + nomeEm(l).length)) * 16 + 4;
  const ys = afastarRotulos(ordem.map((pt) => y(pt.v) - 4), alturaRotulo, 12, A - BASE - alturaRotulo + 16);
  const yNome = new Map(ordem.map((pt, j) => [pt.k, ys[j]]));
  const texto = vivas.map((l) => `${l.nome}: ${l.pontos.map((q) => `${q.ano} ${q.valor === null ? "sem dado" : p(q.valor)}`).join(", ")}`).join(". ");
  return (
    <svg className={compacta ? "sp-compacta" : "sp-larga"} viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}. ${texto}.`}>
      {eixo.marcas.map((m) => {
        const ref = referencia && m === 0.5;
        return (
          <g key={m} className={ref ? "sp-ref" : "sp-grade"}>
            <line x1={ESQ} x2={L - DIR + 4} y1={y(m)} y2={y(m)} />
            {ref && compacta
              ? <text x={ESQ - 6} y={y(m) - 2}><tspan x={ESQ - 6}>50%</tspan><tspan x={ESQ - 6} dy={14}>sem relação</tspan></text>
              : <text x={ESQ - 8} y={y(m) + 4}>{ref ? "50% · sem relação" : p(m)}</text>}
          </g>
        );
      })}
      {vivas.map((l, k) => {
        const caminho = l.pontos.map((q, i) => (q.valor === null ? null : `${x(i)} ${y(q.valor)}`)).filter(Boolean).join("L");
        const iVivos = l.pontos.flatMap((q, i) => (q.valor === null ? [] : [i]));
        // o último valor vai na ponta, com o nome; os outros rótulos, só no primeiro ponto e no ano escolhido
        const comRotulo = new Set([iVivos[0], anos.indexOf(atual)].filter((i) => i !== iVivos[iVivos.length - 1]));
        const outra = vivas[1 - k];
        const embaixo = !!outra && (l.pontos[iVivos[0]]?.valor ?? 0) < (outra.pontos[iVivos[0]]?.valor ?? 0);
        const xn = x(pontas[k].i) + 12, yn = yNome.get(k)!;
        return (
          <g key={l.nome} className={`sp-serie${l.sem ? " sem" : ""}`}>
            <path className="sp-linha" d={`M${caminho}`} />
            {l.pontos.map((q, i) => q.valor === null ? null : (
              <g key={q.ano} className={`sp-ponto${q.ano === atual ? " on" : ""}`}>
                <circle cx={x(i)} cy={y(q.valor)} r={q.ano === atual ? 5.5 : 3.5} />
                {comRotulo.has(i) && <text x={x(i)} y={y(q.valor) + (embaixo ? 19 : -10)}>{p(q.valor)}</text>}
              </g>
            ))}
            <text className="sp-nome" x={xn} y={yn}>
              <tspan className="sp-nome-valor" x={xn}>{p(pontas[k].v)}</tspan>
              {nomeEm(l).map((n) => <tspan key={n} x={xn} dy={16}>{n}</tspan>)}
            </text>
          </g>
        );
      })}
      {anos.map((a2, i) => <text key={a2} className={`sp-ano${a2 === atual ? " on" : ""}`} x={x(i)} y={A - 6}>{a2}</text>)}
    </svg>
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

import { COR_CATEGORIA, type PontoSerie, type PosicaoEleito } from "@/lib/patrimonio";

const L = 720, A = 240, ESQ = 44, DIR = 200, TOPO = 24, BASE = 28;
const p = (v: number) => `${Math.round(v * 100)}%`;

/** Uma linha da série: o nome escrito na ponta direita ("|" quebra a linha do nome) e, se `fina`, tracejada. */
export interface LinhaSerie { nome: string; pontos: PontoSerie[]; fina?: boolean }

/**
 * A métrica principal da pergunta 2 em cada eleição do tipo do cargo, numa ou duas linhas (com todos e sem quem já tinha
 * o cargo, a segunda tracejada), com o nome de cada uma na ponta, sem legenda à parte. Valores escritos só no primeiro e
 * no último ponto e no ano escolhido; marcas do eixo só onde não colidem. `referencia`: a linha de 50% ("sem relação",
 * rótulo na ponta direita). Eleição sem dado fica sem ponto. Componente de servidor, sem JS.
 */
export function SeriePatrimonio({ linhas, atual, titulo, eixo, referencia }: { linhas: LinhaSerie[]; atual: number; titulo: string; eixo: { min: number; max: number; marcas: number[] }; referencia?: string }) {
  const vivas = linhas.filter((l) => l.pontos.some((x) => x.valor !== null));
  if (!vivas.length) return <p className="muted pequeno">Sem dados nas outras eleições.</p>;
  const anos = vivas[0].pontos.map((x) => x.ano);
  const x = (i: number) => ESQ + (anos.length > 1 ? (i / (anos.length - 1)) * (L - ESQ - DIR) : (L - ESQ - DIR) / 2);
  const y = (v: number) => TOPO + (1 - (v - eixo.min) / (eixo.max - eixo.min)) * (A - TOPO - BASE);
  // a ponta de cada linha (o último ponto com dado) e o nome ao lado; nomes perto demais se afastam
  const pontas = vivas.map((l) => { const i = l.pontos.map((q) => q.valor !== null).lastIndexOf(true); return { i, v: l.pontos[i].valor!, ny: y(l.pontos[i].valor!) }; });
  if (pontas.length === 2 && Math.abs(pontas[0].ny - pontas[1].ny) < 44) {
    const meio = (pontas[0].ny + pontas[1].ny) / 2, cima = pontas[0].v >= pontas[1].v ? 0 : 1;
    pontas[cima].ny = meio - 26; pontas[1 - cima].ny = meio + 10;
  }
  const texto = vivas.map((l) => `${l.nome.replace("|", " ")}: ${l.pontos.map((q) => `${q.ano} ${q.valor === null ? "sem dado" : p(q.valor)}`).join(", ")}`).join(". ");
  return (
    <figure className="serie-p2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}. ${texto}.`}>
        {eixo.marcas.filter((m) => !(referencia && m === 0.5)).map((m) => (
          <g key={m} className="sp-grade"><line x1={ESQ} x2={L - DIR + 8} y1={y(m)} y2={y(m)} /><text x={ESQ - 6} y={y(m) + 4}>{p(m)}</text></g>
        ))}
        {referencia && 0.5 > eixo.min && 0.5 < eixo.max && (
          <g className="sp-ref"><line x1={ESQ} x2={L - DIR + 8} y1={y(0.5)} y2={y(0.5)} /><text className="sp-ref-eixo" x={ESQ - 6} y={y(0.5) + 4}>50%</text><text x={L - DIR + 14} y={y(0.5) + 4}>{referencia}</text></g>
        )}
        {vivas.map((l, k) => {
          const caminho = l.pontos.map((q, i) => (q.valor === null ? null : `${x(i)} ${y(q.valor)}`)).filter(Boolean).join("L");
          const iVivos = l.pontos.flatMap((q, i) => (q.valor === null ? [] : [i]));
          // o último valor vai junto do nome, na ponta; os outros rótulos, só no primeiro ponto e no ano escolhido
          const comRotulo = new Set([iVivos[0], anos.indexOf(atual)].filter((i) => i !== iVivos[iVivos.length - 1]));
          const embaixo = k === 1 && vivas.length === 2 && (vivas[1].pontos[iVivos[0]]?.valor ?? 0) <= (vivas[0].pontos[iVivos[0]]?.valor ?? 0);
          return (
            <g key={l.nome} className={`sp-serie${l.fina ? " fina" : ""}`}>
              <path className="sp-linha" d={`M${caminho}`} />
              {l.pontos.map((q, i) => q.valor === null ? null : (
                <g key={q.ano} className={`sp-ponto${q.ano === atual ? " on" : ""}`}>
                  <circle cx={x(i)} cy={y(q.valor)} r={q.ano === atual ? 5.5 : 3.5} />
                  {comRotulo.has(i) && <text x={x(i)} y={y(q.valor) + (embaixo ? 18 : -10)}>{p(q.valor)}</text>}
                </g>
              ))}
              <text className="sp-nome" x={x(pontas[k].i) + 12} y={pontas[k].ny + 4}>
                <tspan className="sp-nome-valor">{p(pontas[k].v)}</tspan> {l.nome.split("|")[0]}
                {l.nome.split("|").slice(1).map((n) => <tspan key={n} x={x(pontas[k].i) + 12} dy="1.2em">{n}</tspan>)}
              </text>
            </g>
          );
        })}
        {anos.map((a, i) => <text key={a} className={`sp-ano${a === atual ? " on" : ""}`} x={x(i)} y={A - 6}>{a}</text>)}
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

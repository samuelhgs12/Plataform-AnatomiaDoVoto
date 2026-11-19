import { colunasComposicao, type GrupoComposicao } from "@/lib/patrimonio";

const p = (v: number) => `${Math.round(v * 100)}%`;
/** Cores claras pedem texto escuro dentro do pedaço. */
const CLARAS = new Set(["q3", "q4"]);

/**
 * Quem são os eleitos: duas colunas 100% em pé (candidatos e eleitos) com o grupo mais rico em cima, faixas
 * translúcidas ligando o mesmo grupo de uma coluna à outra, o percentual dentro do pedaço (ou ao lado, quando não cabe)
 * e o nome de cada grupo à direita dos eleitos. Posições e alturas vêm de colunasComposicao (src/lib/patrimonio.ts);
 * aqui só se desenha. aria-label com todos os valores e tabela equivalente para leitor de tela. Sem JS.
 */
export function ComposicaoEleitos({ grupos, titulo }: { grupos: GrupoComposicao[]; titulo: string }) {
  const c = colunasComposicao(grupos);
  const leitura = `${titulo}: ${grupos.map((g) => `${g.rotulo}, ${p(g.parteCandidatos)} dos candidatos e ${p(g.parteEleitos)} dos eleitos`).join("; ")}.`;
  const xNome = c.colunas[1].x + c.larguraColuna + 10;
  return (
    <figure className="comp-p2">
      <svg viewBox={`0 0 ${c.largura} ${c.altura}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={leitura}>
        <defs>
          <pattern id="comp-hachura" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect className="comp-hachura-fundo" width="6" height="6" /><line className="comp-hachura-traco" x1="0" y1="0" x2="0" y2="6" />
          </pattern>
        </defs>
        {c.faixas.map((f) => <polygon key={f.chave} className={`comp-faixa ${f.cor}`} points={f.pontos} />)}
        {c.colunas.map((col, k) => (
          <g key={col.titulo}>
            <text className="comp-titulo" x={col.x + c.larguraColuna / 2} y={c.topo - 9}>{col.titulo}</text>
            {col.segmentos.filter((s) => s.parte > 0).map((s) => (
              <g key={s.chave}>
                <rect className={`comp-seg ${s.cor}`} x={col.x} y={s.y} width={c.larguraColuna} height={s.h} />
                {s.dentro
                  ? <text className={`comp-pct${CLARAS.has(s.cor) ? " escuro" : ""}`} x={col.x + c.larguraColuna / 2} y={s.yRotulo + 4.5}>{p(s.parte)}</text>
                  : k === 0 && <text className="comp-pct fora" x={col.x - 6} y={s.yRotulo + 4.5}>{p(s.parte)}</text>}
              </g>
            ))}
          </g>
        ))}
        {c.nomes.map((n) => {
          const linhas = n.fora ? [`${n.fora} · ${n.linhas[0]}`, ...n.linhas.slice(1)] : n.linhas;
          return (
            <text key={n.chave} className="comp-nome" x={xNome} y={n.y - (linhas.length - 1) * 7.5 + 4.5}>
              {linhas.map((l, i) => <tspan key={l} x={xNome} dy={i ? 15 : 0}>{l}</tspan>)}
            </text>
          );
        })}
      </svg>
      <div className="sr-only">
        <table>
          <caption>{titulo}</caption>
          <thead><tr><th scope="col">Grupo</th><th scope="col">Candidatos</th><th scope="col">Eleitos</th></tr></thead>
          <tbody>{grupos.map((g) => <tr key={g.chave}><th scope="row">{g.rotulo}</th><td>{p(g.parteCandidatos)}</td><td>{p(g.parteEleitos)}</td></tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}

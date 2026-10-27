// "Do dado à tela" (/sobre): o caminho dos dados em SVG de servidor. Dois desenhos do mesmo diagrama: em linha no
// computador e em coluna no celular; o CSS mostra um só, e o oculto (display: none) sai também da árvore de acessibilidade.

interface Etapa { titulo: string; sub: string; destino?: boolean }

const PRINCIPAL: Etapa[] = [
  { titulo: "Dados abertos", sub: "TSE, com as fotos" },
  { titulo: "Carga e validação", sub: "repositório load_BDR" },
  { titulo: "Banco bdr_final", sub: "DuckDB · MotherDuck" },
  { titulo: "API FastAPI", sub: "um .sql por análise" },
  { titulo: "Páginas", sub: "Next.js", destino: true },
];

const PROVISORIO: Etapa[] = [
  { titulo: "Censos 2010 e 2022", sub: "e TSE 2008–2016" },
  { titulo: "export_static.py", sub: "decisão 10" },
  { titulo: "mapa.json", sub: "arquivo estático" },
];

export const DESCRICAO_CAMINHO =
  "Caminho dos dados. Principal: dados abertos do TSE (candidaturas, votos, prestação de contas e fotos) passam pela carga e validação no repositório load_BDR, " +
  "vão para o banco bdr_final (DuckDB no MotherDuck; as fotos num banco à parte, bdr_fotos), são consultados pela API FastAPI, com um arquivo .sql por análise, " +
  "e chegam às páginas Next.js, montadas no servidor. Provisório, só para o mapa: os indicadores do Censo 2010 (Atlas do Desenvolvimento Humano) e do Censo 2022 (IBGE) " +
  "e a abstenção de 2008 a 2016 dos dados abertos do TSE são exportados pelo pipeline/export_static.py para o arquivo estático mapa.json, que a página inicial lê.";

function Caixa({ e, x, y, w, h, fraca }: { e: Etapa; x: number; y: number; w: number; h: number; fraca?: boolean }) {
  const cls = e.destino ? "cd-caixa destino" : fraca ? "cd-caixa fraca" : "cd-caixa";
  return (
    <g className={cls}>
      <rect x={x} y={y} width={w} height={h} rx={8} />
      <text x={x + 16} y={y + h / 2 - 4} className="cd-titulo">{e.titulo}</text>
      <text x={x + 16} y={y + h / 2 + 18} className="cd-sub">{e.sub}</text>
    </g>
  );
}

const Seta = ({ d, id }: { d: string; id: string }) => <path className="cd-seta" d={d} markerEnd={`url(#${id})`} />;

const Ponta = ({ id }: { id: string }) => (
  <defs>
    <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 10 5 0 10z" className="cd-ponta" />
    </marker>
  </defs>
);

export function CaminhoDados() {
  // em linha: 5 caixas de 186 com 22 de vão; a linha provisória embaixo, saindo da 1ª coluna e entrando nas páginas
  const W = 186, H = 84, V = 22, x = (i: number) => i * (W + V);
  const yP = 150;
  // em coluna: caixas de 320 × 70, 34 de vão
  const cW = 320, cH = 70, cV = 34, cy = (i: number) => i * (cH + cV);
  const cyP = cy(5) + 56;
  return (
    <>
      <svg className="caminho largo" viewBox={`0 0 ${x(5) - V} ${yP + H + 2}`} role="img" aria-label={DESCRICAO_CAMINHO}>
        <Ponta id="cd-ponta-l" />
        {PRINCIPAL.slice(0, -1).map((_, i) => <Seta key={i} id="cd-ponta-l" d={`M${x(i) + W + 4} ${H / 2} H${x(i + 1) - 4}`} />)}
        {PRINCIPAL.map((e, i) => <Caixa key={e.titulo} e={e} x={x(i)} y={0} w={W} h={H} />)}
        <Seta id="cd-ponta-l" d={`M${x(0) + W + 4} ${yP + H / 2} H${x(2) - 4}`} />
        <Seta id="cd-ponta-l" d={`M${x(2) + W + 4} ${yP + H / 2} H${x(3) - 4}`} />
        <Seta id="cd-ponta-l" d={`M${x(3) + W + 4} ${yP + H / 2} H${x(4) + W / 2} V${H + 6}`} />
        {PROVISORIO.map((e, i) => <Caixa key={e.titulo} e={e} x={x([0, 2, 3][i])} y={yP} w={W} h={H} fraca />)}
      </svg>
      <svg className="caminho estreito" viewBox={`-2 0 ${cW + 4} ${cyP + 3 * (cH + cV) - cV + 2}`} role="img" aria-label={DESCRICAO_CAMINHO}>
        <Ponta id="cd-ponta-e" />
        {PRINCIPAL.slice(0, -1).map((_, i) => <Seta key={i} id="cd-ponta-e" d={`M${cW / 2} ${cy(i) + cH + 4} V${cy(i + 1) - 4}`} />)}
        {PRINCIPAL.map((e, i) => <Caixa key={e.titulo} e={e} x={0} y={cy(i)} w={cW} h={cH} />)}
        <text x={0} y={cyP - 16} className="cd-sub">Só para o mapa, provisório:</text>
        {PROVISORIO.slice(0, -1).map((_, i) => <Seta key={i} id="cd-ponta-e" d={`M${cW / 2} ${cyP + cy(i) + cH + 4} V${cyP + cy(i + 1) - 4}`} />)}
        {PROVISORIO.map((e, i) => <Caixa key={e.titulo} e={e} x={0} y={cyP + cy(i)} w={cW} h={cH} fraca />)}
      </svg>
    </>
  );
}

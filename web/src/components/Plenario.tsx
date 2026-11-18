import { hemiciclo, siglasNoArco, type Lugar } from "@/lib/legislativo";

export interface CadeiraDesenho {
  /** classe de cor da leitura (v-*, c-*, p-*, r-*) */
  classe: string;
  /** índice da bancada, para o realce cruzado com a tabela */
  bancada: number;
  /** texto da dica: nome, partido e UF, e o valor na leitura */
  nome: string; detalhe: string; valor: string;
  href: string;
  apagada?: boolean;
}

export interface RotuloBancada { bancada: number; sigla: string }

// MARGEM: espaço dos lados para as siglas compridas (REPUBLICANOS) não saírem do bloco
const W = 1200, H = 590, CX = 600, CY = 560, R = 470, MARGEM = 110;

/**
 * Hemiciclo da casa (componente de servidor, sem JS). Cada cadeira é um link para o perfil; o realce cruzado com a
 * tabela das bancadas é CSS (`:has`, regras geradas na página). `lugares` já vem na ordem do hemiciclo; as cadeiras de
 * outros estados e as sem resultado só têm contorno. As siglas das maiores bancadas ficam do lado de fora do arco.
 */
export function Plenario({ lugares, desenho, rotulos, numero, legenda, titulo }: {
  lugares: Lugar[];
  desenho: (l: Extract<Lugar, { tipo: "eleito" }>, i: number) => CadeiraDesenho;
  rotulos: RotuloBancada[];
  numero: string; legenda: string; titulo: string;
}) {
  const { pontos, raio } = hemiciclo(lugares.length);
  const r = raio * R;
  // ângulo médio de cada bancada, para pôr a sigla do lado de fora do arco
  const angulos = new Map<number, number[]>();
  const cadeiras = lugares.map((l, i) => {
    const p = pontos[i];
    const x = CX + p.x * R, y = CY + p.y * R;
    const atraso = Math.round((i / Math.max(1, lugares.length - 1)) * 420);
    if (l.tipo !== "eleito") {
      return <circle key={i} className={`cad-vazia${l.tipo === "sem_resultado" ? " sem-resultado" : ""}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(r * 0.86).toFixed(2)} />;
    }
    const d = desenho(l, i);
    if (!angulos.has(d.bancada)) angulos.set(d.bancada, []);
    angulos.get(d.bancada)!.push(Math.atan2(-p.y, p.x));
    return (
      <a key={i} href={d.href} tabIndex={-1}>
        <circle className={`cad ${d.classe}${d.apagada ? " apagada" : ""}`} data-b={d.bancada} data-n={d.nome} data-s={d.detalhe} data-v={d.valor}
          style={{ "--atraso": `${atraso}ms` } as React.CSSProperties} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)}>
          <title>{`${d.nome} · ${d.detalhe} · ${d.valor}`}</title>
        </circle>
      </a>
    );
  });

  const nomes = new Map(rotulos.map((x) => [x.bancada, x.sigla]));
  const postas = siglasNoArco(rotulos.map(({ bancada }) => ({ bancada, angulos: angulos.get(bancada) ?? [] })));
  const siglas = postas.map(({ bancada, angulo: ang }) => {
    const sigla = nomes.get(bancada);
    const rr = R + Math.max(20, r * 2.4);
    const x = CX + Math.cos(ang) * rr, y = CY - Math.sin(ang) * rr;
    const ancora = Math.cos(ang) > 0.25 ? "start" : Math.cos(ang) < -0.25 ? "end" : "middle";
    return <text key={bancada} className="cad-sigla" data-b={bancada} x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={ancora}>{sigla}</text>;
  });

  return (
    <svg className="plenario" viewBox={`${-MARGEM} 0 ${W + 2 * MARGEM} ${H}`} role="img" aria-label={titulo}>
      <g aria-hidden="true">{cadeiras}</g>
      <g aria-hidden="true">{siglas}</g>
      <text className={`plen-numero${numero.length > 6 ? " longo" : ""}`} x={CX} y={CY - 52} textAnchor="middle">{numero}</text>
      <text className="plen-legenda" x={CX} y={CY - 8} textAnchor="middle">{legenda}</text>
    </svg>
  );
}

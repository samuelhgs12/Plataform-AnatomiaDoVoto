import { hemiciclo, siglasNoArco, textoCentral, type Lugar } from "@/lib/legislativo";

export interface CadeiraDesenho {
  /** classe de cor da leitura (v-*, c-*, par-*, r-*) */
  classe: string;
  /** índice da bancada: passar o mouse numa cadeira destaca a bancada inteira */
  bancada: number;
  /** grupo do rótulo de fora do arco (a sigla da bancada, ou o bloco na Renovação) */
  grupo: string;
  /** cadeira fora do filtro: fica apagada */
  apagada?: boolean;
  /** texto do <title> (dica sem JS) */
  titulo: string;
  /** campos da ficha que a DicaPlenario lê, cada um vira data-<chave> */
  ficha: Record<string, string>;
  href: string;
}

/** Rótulo do lado de fora do arco, na ordem de prioridade (o maior grupo primeiro). */
export interface RotuloArco { grupo: string; texto: string }

// MARGEM: espaço dos lados para os rótulos compridos (REPUBLICANOS) não saírem do bloco
const W = 1200, H = 600, CX = 600, CY = 570, R = 470, MARGEM = 120, FONTE_ROTULO = 21;

/**
 * Hemiciclo da casa (componente de servidor, sem JS). Cada cadeira é um link para o perfil; passar o mouse destaca a
 * bancada (CSS `:has`, regras geradas na página) e a DicaPlenario mostra a ficha a partir dos data-*. A geometria
 * (vão central, tamanho das cadeiras, rótulos e texto do centro) vem de src/lib/legislativo.ts, para não haver
 * sobreposição em nenhum tamanho de casa.
 */
export function Plenario({ lugares, desenho, rotulos, numero, legenda, titulo }: {
  lugares: Lugar[];
  desenho: (l: Extract<Lugar, { tipo: "eleito" }>, i: number) => CadeiraDesenho;
  rotulos: RotuloArco[];
  numero: string; legenda: string; titulo: string;
}) {
  const { pontos, raio, interno } = hemiciclo(lugares.length);
  const r = raio * R;
  const angulos = new Map<string, number[]>();
  const cadeiras = lugares.map((l, i) => {
    const p = pontos[i];
    const x = CX + p.x * R, y = CY + p.y * R;
    const atraso = Math.round((i / Math.max(1, lugares.length - 1)) * 420);
    if (l.tipo !== "eleito") {
      return <circle key={i} className={`cad-vazia${l.tipo === "sem_resultado" ? " sem-resultado" : ""}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={(r * 0.86).toFixed(2)} />;
    }
    const d = desenho(l, i);
    if (!angulos.has(d.grupo)) angulos.set(d.grupo, []);
    angulos.get(d.grupo)!.push(Math.atan2(-p.y, p.x));
    return (
      <a key={i} href={d.href} tabIndex={-1}>
        <circle className={`cad ${d.classe}${d.apagada ? " apagada" : ""}`} data-b={d.bancada} {...Object.fromEntries(Object.entries(d.ficha).map(([k, v]) => [`data-${k}`, v]))}
          style={{ "--atraso": `${atraso}ms` } as React.CSSProperties} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)}>
          <title>{d.titulo}</title>
        </circle>
      </a>
    );
  });

  // rótulos de fora: o espaço que cada um ocupa no arco vem da largura do texto, para não se espremerem no topo
  const rr = R + Math.max(22, r * 2.4);
  const largura = (texto: string) => texto.length * FONTE_ROTULO * 0.62;
  const postas = siglasNoArco(rotulos.map((x, i) => ({ bancada: i, angulos: angulos.get(x.grupo) ?? [], largura: largura(x.texto) })), rr, FONTE_ROTULO);
  const textos = postas.map(({ bancada: i, angulo: ang }) => {
    const { grupo, texto } = rotulos[i];
    const x = CX + Math.cos(ang) * rr, y = CY - Math.sin(ang) * rr;
    const ancora = Math.cos(ang) > 0.3 ? "start" : Math.cos(ang) < -0.3 ? "end" : "middle";
    return <text key={grupo} className="cad-sigla" x={x.toFixed(1)} y={y.toFixed(1)} textAnchor={ancora} dominantBaseline={Math.sin(ang) > 0.85 ? "auto" : "middle"}>{texto}</text>;
  });

  // texto do centro do tamanho do vão: ele cabe sem encostar na fileira de dentro
  const fs = textoCentral((interno - raio) * R, numero, legenda);
  return (
    <svg className="plenario" viewBox={`${-MARGEM} 0 ${W + 2 * MARGEM} ${H}`} role="img" aria-label={titulo}>
      <g aria-hidden="true">{cadeiras}</g>
      <g aria-hidden="true">{textos}</g>
      <text className="plen-numero" x={CX} y={CY - fs.legenda * 1.6} textAnchor="middle" style={{ fontSize: fs.numero }}>{numero}</text>
      <text className="plen-legenda" x={CX} y={CY} textAnchor="middle" style={{ fontSize: fs.legenda }}>{legenda}</text>
    </svg>
  );
}

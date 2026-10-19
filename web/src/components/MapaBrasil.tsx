import Link from "next/link";
import { ESTADOS_MAPA, MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";

interface Props {
  /** texto de cada estado com dados (sigla → "62%"); estados fora daqui ficam cinza e sem link */
  rotulos: Record<string, string>;
  /** faixa de cor (1 = mais escura) de cada estado com dados */
  faixas: Record<string, 1 | 2 | 3 | 4>;
  /** descrição acessível de cada estado com dados (vira o nome do link) */
  descricoes: Record<string, string>;
  hrefs: Record<string, string>;
  selecionada?: string;
  titulo: string;
}

// estados pequenos do litoral: rótulo deslocado para o mar, senão encosta no vizinho
const DESLOCAR: Record<string, [number, number]> = { ES: [30, -8], RJ: [22, 22] };

/** Mapa do Brasil por UF: estados com dados coloridos e clicáveis, demais em cinza. */
export function MapaBrasil({ rotulos, faixas, descricoes, hrefs, selecionada, titulo }: Props) {
  // o selecionado vai por último para o contorno dele ficar por cima dos vizinhos
  const comDados = ESTADOS_MAPA.filter((e) => e.uf in rotulos).sort((a, b) => Number(a.uf === selecionada) - Number(b.uf === selecionada));
  return (
    <svg viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`} className="mapa" role="group" aria-label={titulo}>
      <g aria-hidden="true">
        {ESTADOS_MAPA.filter((e) => !(e.uf in rotulos)).map((e) => <path key={e.uf} d={e.d} className="uf-fora"><title>{`${e.nome}: fora do recorte`}</title></path>)}
      </g>
      {comDados.map((e) => (
        <Link key={e.uf} href={hrefs[e.uf]} scroll={false} aria-label={descricoes[e.uf]} aria-current={e.uf === selecionada ? "true" : undefined}
          className={`uf m${faixas[e.uf]}${e.uf === selecionada ? " on" : ""}`}>
          <path d={e.d} />
        </Link>
      ))}
      {/* rótulos numa camada própria, para o contorno do selecionado não cobrir os vizinhos pequenos (ES, RJ) */}
      <g aria-hidden="true">
        {comDados.map((e) => {
          const [dx, dy] = DESLOCAR[e.uf] ?? [0, 0];
          return (
            <text key={e.uf} x={e.x + dx} y={e.y + dy}>
              <tspan className="uf-sigla">{e.uf}</tspan>
              <tspan className="uf-valor" x={e.x + dx} dy="1.05em">{rotulos[e.uf]}</tspan>
            </text>
          );
        })}
      </g>
    </svg>
  );
}

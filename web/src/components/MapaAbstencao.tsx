import type { CSSProperties } from "react";
import { ESTADOS_MAPA } from "@/lib/brasil-uf";
import { TELA } from "@/lib/lupa";
import type { FichaDica } from "@/lib/dica";

/** `ficha`: o conteúdo gráfico da dica (MapaVivo); sem ela, a dica mostra só o texto (`descricao`, `dica`). */
export interface EstadoNoMapa { uf: string; classe: string; href: string; sigla: string; valor: string; descricao: string; ficha?: FichaDica }
export interface MunicipioNoMapa { ibge: string; classe: string; href: string; dica: string; atraso: number; ficha?: FichaDica }

interface Props {
  titulo: string;
  camera: { x: number; y: number; k: number };
  estados: EstadoNoMapa[];
  /** UF escolhida: com zoom, os municípios dela aparecem por cima do estado; sem zoom, só o contorno a destaca */
  uf?: string;
  /** false: a UF escolhida fica no mapa dos seis estados, sem esmaecer os vizinhos (visão de legenda, só por estado) */
  zoom?: boolean;
  municipios: MunicipioNoMapa[];
  /** município escolhido: contorno por cima dos vizinhos e nome na tela */
  destaque?: { ibge: string; nome: string; x: number; y: number };
}

// estados pequenos do litoral: etiqueta deslocada para o mar, senão encosta no vizinho
const DESLOCAR: Record<string, [number, number]> = { ES: [34, -6], RJ: [26, 22] };
const desenho = (ibge: string) => `/malhas/municipios.svg#m${ibge}`;

/**
 * Mapa da abstenção. Uma "câmera" (um <g> com transform) enquadra o Brasil ou o estado escolhido; como o elemento
 * é o mesmo entre as navegações, o CSS anima o zoom. Por fora dela, a "lupa" é o zoom livre (roda do mouse e
 * arrasto, em MapaVivo) dentro do estado. Os municípios vêm de um SVG estático (<use>), que o navegador baixa uma
 * vez: a página só manda a cor de cada um.
 */
export function MapaAbstencao({ titulo, camera, estados, uf, zoom = true, municipios, destaque }: Props) {
  const comDados = new Map(estados.map((e) => [e.uf, e]));
  const tela = (x: number, y: number) => [camera.x + x * camera.k, camera.y + y * camera.k];
  const contorno = uf ? ESTADOS_MAPA.find((e) => e.uf === uf) : undefined;
  // a nova cor varre os estados de oeste para leste (0 = o mais a oeste, 1 = o mais a leste), como os municípios no zoom
  const xs = ESTADOS_MAPA.filter((e) => comDados.has(e.uf)).map((e) => e.x);
  const [oeste, leste] = [Math.min(...xs), Math.max(...xs)];
  const varre = (x: number) => ({ "--varre": leste > oeste ? Math.round(((x - oeste) / (leste - oeste)) * 100) / 100 : 0 }) as CSSProperties;
  return (
    <svg viewBox={`0 0 ${TELA.larg} ${TELA.alt}`} className="mapa-abst" role="group" aria-label={titulo} data-zoom={uf && zoom ? "uf" : "brasil"}>
      <g className="lupa">
        <g className="camera" style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.k})` }}>
          <g aria-hidden="true">
            {ESTADOS_MAPA.filter((e) => !comDados.has(e.uf)).map((e) => <path key={e.uf} d={e.d} className="uf-fora" />)}
          </g>
          {ESTADOS_MAPA.filter((e) => comDados.has(e.uf)).map((e) => {
            const d = comDados.get(e.uf)!;
            return (
              <a key={e.uf} href={d.href} data-mapa="" data-dica={d.descricao} data-ficha={d.ficha && JSON.stringify(d.ficha)} aria-label={d.descricao} aria-current={e.uf === uf ? "true" : undefined}
                className={`uf ${d.classe}${e.uf === uf ? " on" : ""}`} style={varre(e.x)}>
                <path d={e.d} />
              </a>
            );
          })}
          {uf && zoom && (
            <g className="municipios" key={uf}>
              {municipios.map((m) => (
                <a key={m.ibge} href={m.href} data-mapa="" data-dica={m.dica} data-ficha={m.ficha && JSON.stringify(m.ficha)} aria-label={m.dica} tabIndex={-1}
                  className={`mun ${m.classe}`} style={{ "--atraso": m.atraso } as CSSProperties}>
                  <use href={desenho(m.ibge)} />
                </a>
              ))}
            </g>
          )}
          {contorno && <path className="contorno-uf" d={contorno.d} aria-hidden="true" />}
          {destaque && <use key={destaque.ibge} className="mun-destaque" href={desenho(destaque.ibge)} aria-hidden="true" />}
        </g>
        {/* etiquetas fora da câmera: não crescem com o zoom dela */}
        <g className="etiquetas-uf" aria-hidden="true">
          {ESTADOS_MAPA.filter((e) => comDados.has(e.uf)).map((e) => {
            const [dx, dy] = DESLOCAR[e.uf] ?? [0, 0];
            const [x, y] = tela(e.x + dx, e.y + dy);
            const d = comDados.get(e.uf)!;
            return (
              <g key={e.uf} className="etiqueta" transform={`translate(${x} ${y})`} style={varre(e.x)}>
                <rect x={-33} y={-13} width={66} height={26} rx={13} />
                <text x={-15} dy="0.35em" className="etiqueta-sigla">{d.sigla}</text>
                {/* a chave muda com o valor: o texto novo entra no lugar do antigo em vez de trocar seco */}
                <text key={d.valor} x={13} dy="0.35em" className="etiqueta-valor">{d.valor}</text>
              </g>
            );
          })}
        </g>
        {destaque && (() => {
          const [x, y] = tela(destaque.x, destaque.y);
          return <text key={destaque.ibge} className="rotulo-mun" x={x} y={y} dy="-0.8em" aria-hidden="true">{destaque.nome}</text>;
        })()}
      </g>
    </svg>
  );
}

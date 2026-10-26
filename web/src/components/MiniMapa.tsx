import type { CSSProperties, ReactNode } from "react";
import type { Lupa } from "@/lib/lupa";
import { Icone } from "./Icone";

/**
 * Mini-mapa ao lado dos números embaixo do mapa: a mesma pintura do palco, pequena, com o recorte escrito. Clicar
 * volta ao mapa. Quando o palco sai da tela, ele se revela de baixo para cima (CSS ligado à rolagem). O mapa dentro
 * dele é só imagem (inert): o único controle é o link que o cobre.
 * Com um município escolhido, `foco` é a lupa que o põe no centro, ampliado (centrarLupa): o elemento é o mesmo entre
 * as navegações, então trocar de município desliza e aproxima o mini-mapa em vez de saltar.
 */
export function MiniMapa({ recorte, foco, children }: { recorte: string; foco?: Lupa; children: ReactNode }) {
  const lupa = foco ? ({ "--mm-x": `${foco.x}px`, "--mm-y": `${foco.y}px`, "--mm-k": foco.k, "--lupa": foco.k } as CSSProperties) : undefined;
  return (
    <div className="minimapa" data-foco={foco ? "" : undefined} style={lupa}>
      <div className="minimapa-mapa" inert aria-hidden="true">{children}</div>
      <a href="#mapa" className="minimapa-link">
        <span className="minimapa-recorte">{recorte}</span>
        <span className="minimapa-voltar"><Icone nome="mapa" />Voltar ao mapa</span>
      </a>
    </div>
  );
}

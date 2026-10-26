import type { ReactNode } from "react";
import { Icone } from "./Icone";

/**
 * Mini-mapa no canto da tela enquanto se leem os números embaixo do mapa: a mesma pintura do palco, pequena, com o
 * recorte escrito. Clicar volta ao mapa. Quem o faz aparecer é o CSS, por uma animação ligada à rolagem (o palco sai
 * da tela, o mini-mapa entra); onde o navegador não tem isso, ele não aparece. O mapa dentro dele é só imagem (inert):
 * o único controle é o link que o cobre.
 */
export function MiniMapa({ recorte, children }: { recorte: string; children: ReactNode }) {
  return (
    <div className="minimapa">
      <div className="minimapa-mapa" inert aria-hidden="true">{children}</div>
      <a href="#mapa" className="minimapa-link">
        <span className="minimapa-recorte">{recorte}</span>
        <span className="minimapa-voltar"><Icone nome="mapa" />Voltar ao mapa</span>
      </a>
    </div>
  );
}

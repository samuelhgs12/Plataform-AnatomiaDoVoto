import { ViewTransition } from "react";

/**
 * O template é recriado a cada troca de rota (não a cada mudança de filtro na mesma página), então a página nova
 * entra e a antiga sai com a transição do navegador (classes em globals.css). Sem suporte, a navegação só acontece.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <ViewTransition enter="pagina-entra" exit="pagina-sai" default="none">{children}</ViewTransition>;
}

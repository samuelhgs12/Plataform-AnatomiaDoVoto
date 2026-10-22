"use client";

type Tema = "light" | "dark";

/** Chave do localStorage; o script em `layout.tsx` lê a mesma chave antes da página pintar. */
export const CHAVE_TEMA = "tema";

function temaAtual(): Tema {
  const escolhido = document.documentElement.dataset.theme;
  if (escolhido === "light" || escolhido === "dark") return escolhido;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Botão que alterna entre tema claro e escuro e guarda a escolha. Sem escolha salva, segue o sistema.
 * Os dois ícones são desenhados e o CSS (`.tema .sol/.lua`) mostra o certo, então o servidor não precisa saber o tema.
 */
/** comRotulo: escreve "Tema" ao lado do ícone (no menu lateral, que recolhe o texto com o resto dos rótulos). */
export function ThemeToggle({ className = "tema", comRotulo = false }: { className?: string; comRotulo?: boolean }) {
  function alternar() {
    const novo: Tema = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* sem armazenamento: vale só nesta visita */ }
  }

  const rotulo = "Alternar entre tema claro e escuro";
  return (
    <button type="button" className={className} onClick={alternar} aria-label={rotulo} title={comRotulo ? undefined : rotulo} data-rotulo="Tema">
      <svg className="sol" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="lua" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
      {comRotulo && <span className="menu-rotulo" aria-hidden="true">Tema claro ou escuro</span>}
    </button>
  );
}

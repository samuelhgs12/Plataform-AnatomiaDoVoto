"use client";

import { useEffect } from "react";

/** Blocos que se revelam ao entrar na tela (o CSS em globals.css decide como cada um anima). */
const ALVOS = ".bloco, .card, [data-revelar], .rolar, .vitrine";

/**
 * Marca `data-in` em cada alvo na primeira vez que ele aparece na tela, e `data-movimento` em <html> enquanto roda
 * (sem isso, o CSS mostra tudo depois de 3 s). Usa atributo, não classe: o React não mexe em atributos que não renderizou,
 * então a marca sobrevive quando a página é renderizada de novo com outros filtros. Blocos que chegam depois
 * (navegação, painel que abre) são pegos pelo MutationObserver.
 */
export function Movimento() {
  useEffect(() => {
    const raiz = document.documentElement;
    raiz.dataset.movimento = "";
    const marcar = (el: Element) => el.setAttribute("data-in", "");
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(ALVOS).forEach(marcar);
      return;
    }
    const io = new IntersectionObserver((entradas) => {
      for (const e of entradas) if (e.isIntersecting) { marcar(e.target); io.unobserve(e.target); }
    // margem enorme no topo: o que já ficou acima da tela conta como visto, mesmo numa rolagem rápida (tecla End, âncora)
    // que pula o bloco entre dois quadros sem ele nunca cruzar a tela
    }, { rootMargin: "100000px 0px -6% 0px", threshold: 0.06 });
    const observar = (el: Element) => { if (!el.hasAttribute("data-in")) io.observe(el); };
    document.querySelectorAll(ALVOS).forEach(observar);
    const mo = new MutationObserver((mudancas) => {
      for (const m of mudancas) m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return;
        if (n.matches(ALVOS)) observar(n);
        n.querySelectorAll(ALVOS).forEach(observar);
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); delete raiz.dataset.movimento; };
  }, []);
  return null;
}

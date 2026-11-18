"use client";

import { useEffect, useState } from "react";

interface Dica { nome: string; detalhe: string; valor: string; x: number; y: number }

/**
 * Dica do hemiciclo: ao passar o mouse numa cadeira, mostra quem a ocupa e o valor na leitura. Sem JS, a cadeira tem o
 * <title> nativo; com JS, os <title> saem (para não aparecerem duas dicas) e esta assume. Lê os data-* das cadeiras do
 * elemento `alvo`, que precisa de position: relative.
 */
export function DicaPlenario({ alvo }: { alvo: string }) {
  const [dica, setDica] = useState<Dica | null>(null);

  useEffect(() => {
    const caixa = document.getElementById(alvo);
    if (!caixa) return;
    caixa.querySelectorAll(".cad > title").forEach((t) => t.remove());
    const sobre = (e: PointerEvent) => {
      const cad = (e.target as Element).closest?.("[data-n]");
      if (!cad) { setDica(null); return; }
      const b = caixa.getBoundingClientRect(), c = cad.getBoundingClientRect();
      setDica({
        nome: cad.getAttribute("data-n") ?? "", detalhe: cad.getAttribute("data-s") ?? "", valor: cad.getAttribute("data-v") ?? "",
        x: c.left + c.width / 2 - b.left, y: c.top - b.top,
      });
    };
    const sair = () => setDica(null);
    caixa.addEventListener("pointerover", sobre);
    caixa.addEventListener("pointerleave", sair);
    return () => { caixa.removeEventListener("pointerover", sobre); caixa.removeEventListener("pointerleave", sair); };
  }, [alvo]);

  if (!dica) return null;
  return (
    <div className="dica-cadeira" style={{ left: dica.x, top: dica.y }} aria-hidden="true">
      <b>{dica.nome}</b>
      <span>{dica.detalhe}</span>
      <span className="dica-valor">{dica.valor}</span>
    </div>
  );
}

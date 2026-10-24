"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent, type ReactNode } from "react";

const nada = () => () => {};
const INCLINACAO = 5;   // graus, no máximo, que o cartão inclina na direção do cursor

const Girar = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5a5.5 5.5 0 0 1 10-2.2M13.5 9.5a5.5 5.5 0 0 1-10 2.2M12.5 1.5v3h-3M3.5 14.5v-3h3" /></svg>
);

/**
 * O cartão que vira. Cada face tem por cima um botão transparente do tamanho dela: clicar em qualquer ponto vira (Enter e Espaço
 * também), e o link do verso fica por cima do botão. O cartão mostra que é clicável: inclina na direção do cursor,
 * o canto dobrado se levanta e a dica "Clique para ver os números" fica na própria face. O foco passa para o botão da
 * face que aparece. Sem JavaScript (antes de hidratar), as faces ficam uma embaixo da outra e os botões somem (`.js`);
 * a face de trás só sai do teclado depois de montar, senão quem está sem JS perderia o link.
 */
export function VirarFicha({ frente, verso, nome }: { frente: ReactNode; verso: ReactNode; nome: string }) {
  const [virada, setVirada] = useState(false);
  const [tocada, setTocada] = useState(false);   // o giro só anima depois do primeiro clique, não na chegada
  const [inclinacao, setInclinacao] = useState<{ x: number; y: number } | null>(null);
  const montada = useSyncExternalStore(nada, () => true, () => false);   // false no servidor e na hidratação
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const comFoco = useRef(false);

  // quem virou pelo teclado continua no cartão: o foco vai para o botão da face que apareceu
  useEffect(() => {
    if (comFoco.current) botoes.current[virada ? 1 : 0]?.focus({ preventScroll: true });
  }, [virada]);

  const virar = () => {
    comFoco.current = document.activeElement === botoes.current[virada ? 1 : 0];
    setVirada((v) => !v);
    setTocada(true);
  };
  const mover = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    setInclinacao({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
  };
  const estilo = inclinacao ? ({ "--incl-x": `${(-inclinacao.y * INCLINACAO * 2).toFixed(2)}deg`, "--incl-y": `${(inclinacao.x * INCLINACAO * 2).toFixed(2)}deg` } as CSSProperties) : undefined;

  const face = (lado: 0 | 1, conteudo: ReactNode) => {
    const oculta = montada && virada !== (lado === 1);
    return (
      <div className={`ficha-face ${lado ? "ficha-verso" : "ficha-frente"}`} inert={oculta} aria-hidden={oculta ? true : undefined}>
        <button
          type="button" className="ficha-alvo" ref={(b) => { botoes.current[lado] = b; }} onClick={virar}
          aria-label={lado ? `Voltar à frente da ficha de ${nome}` : `Ficha de ${nome}: virar para ver os números`}
        />
        {conteudo}
        <span className="ficha-dica" aria-hidden="true"><Girar />{lado ? "Clique para voltar" : "Clique para ver os números"}</span>
        <span className="ficha-canto" aria-hidden="true" />
      </div>
    );
  };

  return (
    <div className="ficha-casca" onPointerMove={mover} onPointerLeave={() => setInclinacao(null)} style={estilo} data-inclinada={inclinacao ? "" : undefined}>
      <div className="ficha" data-virada={virada ? "" : undefined} data-tocada={tocada ? "" : undefined}>
        {face(0, frente)}
        {face(1, verso)}
      </div>
    </div>
  );
}

"use client";

import { useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

const nada = () => () => {};
/** Metade do giro (o cartão de perfil, sem face à vista): é aí que a altura passa a ser a da outra face. */
const MEIO_GIRO = 300;

/**
 * A ficha que vira. `virada` gira o cartão; `mostrada` diz qual face dá a altura, e só troca no meio do giro, quando o
 * cartão está de perfil, para a mudança de altura não aparecer. Sem JavaScript (antes de hidratar), as duas faces
 * ficam uma embaixo da outra e o botão some (CSS em `.js`); a face de trás só sai do teclado depois de montar, senão
 * quem está sem JS perderia o link do verso. Sem movimento (prefers-reduced-motion), a troca é seca.
 */
export function VirarFicha({ frente, verso, rotulo }: { frente: ReactNode; verso: ReactNode; rotulo: string }) {
  const id = useId();
  const [virada, setVirada] = useState(false);
  const [mostrada, setMostrada] = useState<"frente" | "verso">("frente");
  const relogio = useRef<ReturnType<typeof setTimeout>>(undefined);
  const montada = useSyncExternalStore(nada, () => true, () => false);   // false no servidor e na hidratação

  const virar = () => {
    const nova = !virada;
    setVirada(nova);
    clearTimeout(relogio.current);
    const espera = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : MEIO_GIRO;
    relogio.current = setTimeout(() => setMostrada(nova ? "verso" : "frente"), espera);
  };

  return (
    <div className="ficha-casca">
      <div className="ficha" data-virada={virada ? "" : undefined} data-mostrada={mostrada} id={id} aria-label={rotulo} role="group">
        <div className="ficha-face ficha-frente" inert={montada && virada} aria-hidden={montada && virada ? true : undefined}>{frente}</div>
        <div className="ficha-face ficha-verso" inert={montada && !virada} aria-hidden={montada && !virada ? true : undefined}>{verso}</div>
      </div>
      <button type="button" className="ficha-virar" aria-pressed={virada} aria-controls={id} onClick={virar}>
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6.5a5.5 5.5 0 0 1 10-2.2M13.5 9.5a5.5 5.5 0 0 1-10 2.2M12.5 1.5v3h-3M3.5 14.5v-3h3" /></svg>
        {virada ? "Voltar à frente" : "Ver números"}
      </button>
    </div>
  );
}

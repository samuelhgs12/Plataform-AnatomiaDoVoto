import type { CSSProperties } from "react";

/**
 * Número que rola dígito a dígito até o valor quando aparece na tela (o Movimento marca `data-in`) e de novo quando
 * muda. O valor inteiro fica escrito para leitores de tela; os dígitos animados são só visuais.
 */
export function Rolar({ valor }: { valor: string }) {
  let i = 0;
  return (
    <span className="rolar">
      <span className="sr-only">{valor}</span>
      <span aria-hidden="true" style={{ display: "inline-flex" }}>
        {[...valor].map((ch, k) => /\d/.test(ch) ? (
          <span key={k} className="rolar-col">
            <span className="rolar-fita" style={{ "--d": ch, "--i": i++ } as CSSProperties}>
              {"0123456789".split("").map((n) => <span key={n}>{n}</span>)}
            </span>
          </span>
        ) : <span key={k}>{ch === " " ? "\u00a0" : ch}</span>)}
      </span>
    </span>
  );
}

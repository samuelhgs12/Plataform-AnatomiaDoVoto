/**
 * Uma grade de 100 quadradinhos: os primeiros `parte × 100` pintados. Mostra "X em cada 100" de um jeito que dá para
 * contar, sem eixo nem escala. Componente de servidor, sem JS; o leitor de tela lê a frase do aria-label.
 */
export function GradeCem({ parte, titulo, destaque }: { parte: number; titulo: string; destaque?: boolean }) {
  const n = Math.max(0, Math.min(100, Math.round(parte * 100)));
  return (
    <span className={`grade-cem${destaque ? " destaque" : ""}`} role="img" aria-label={`${titulo}: ${n} em cada 100`}>
      {Array.from({ length: 100 }, (_, i) => <i key={i} className={i < n ? "on" : undefined} />)}
    </span>
  );
}

import Link from "next/link";

export function Pagination({ pagina, total, tamanho, params }: { pagina: number; total: number; tamanho: number; params: Record<string, string | undefined> }) {
  const paginas = Math.max(1, Math.ceil(total / tamanho));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("pagina", String(p));
    return `/candidatos?${sp.toString()}`;
  };
  if (paginas <= 1) return null;
  return (
    <nav className="pager" aria-label="Paginação">
      {pagina > 1 && <Link className="chip" href={href(pagina - 1)}>← Anterior</Link>}
      <span className="muted">Página {pagina} de {paginas}</span>
      {pagina < paginas && <Link className="chip" href={href(pagina + 1)}>Próxima →</Link>}
    </nav>
  );
}

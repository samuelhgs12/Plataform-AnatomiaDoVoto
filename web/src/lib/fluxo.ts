// Lógica da página "o que acontece depois de um mandato" (pergunta 10), sem dependência do React: fácil de testar.

export interface LinhaFluxo { ano_mandato: number; cargo_origem: string; nivel_origem: number; uf: string; genero: string; destino: string; n: number }

export const DESTINOS = [
  { chave: "Reeleito", rotulo: "Reeleito", classe: "w1" },
  { chave: "Eleito a cargo de nível acima", rotulo: "Eleito a um cargo acima", classe: "w2" },
  { chave: "Eleito a outro cargo, mesmo nível ou abaixo", rotulo: "Eleito a outro cargo, mesmo nível ou abaixo", classe: "w3" },
  { chave: "Eleito a outro cargo no meio do mandato", rotulo: "Eleito a outro cargo no meio do mandato", classe: "w4" },
  { chave: "Tentou a reeleição e perdeu", rotulo: "Perdeu a reeleição", classe: "l1" },
  { chave: "Tentou outro cargo e perdeu", rotulo: "Perdeu disputando outro cargo", classe: "l2" },
  { chave: "Não disputou a eleição seguinte", rotulo: "Não disputou", classe: "o" },
] as const;

export interface GrupoFluxo { cargo: string; nivel: number; total: number; porDestino: Record<string, number> }

/** Soma os mandatos por cargo, aplicando os filtros. Cargos com menos de `minimo` mandatos ficam de fora. */
export function agruparFluxo(linhas: LinhaFluxo[], filtros: { uf?: string; anoMandato?: number; genero?: string }, minimo = 20): GrupoFluxo[] {
  const mapa = new Map<string, GrupoFluxo>();
  for (const l of linhas) {
    if (filtros.uf && l.uf !== filtros.uf) continue;
    if (filtros.anoMandato && l.ano_mandato !== filtros.anoMandato) continue;
    if (filtros.genero && l.genero !== filtros.genero) continue;
    let g = mapa.get(l.cargo_origem);
    if (!g) mapa.set(l.cargo_origem, (g = { cargo: l.cargo_origem, nivel: l.nivel_origem, total: 0, porDestino: {} }));
    g.total += l.n;
    g.porDestino[l.destino] = (g.porDestino[l.destino] ?? 0) + l.n;
  }
  return [...mapa.values()].filter((g) => g.total >= minimo).sort((a, b) => a.nivel - b.nivel || a.cargo.localeCompare(b.cargo));
}

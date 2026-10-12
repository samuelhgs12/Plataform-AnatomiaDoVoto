// Lógica da página de votos de legenda (pergunta 5).

export interface LinhaLegenda { ano: number; cargo: string; uf: string; numero: number; sigla: string; votos_nominais: number; votos_legenda: number }

/** Siglas renomeadas que devem aparecer juntas. Fusões (ex.: DEM e PSL -> UNIÃO) NÃO são unificadas. */
export const RENOMEACOES: Record<string, string> = {
  PRB: "REPUBLICANOS", PR: "PL", PPS: "CIDADANIA", PTC: "AGIR", PMN: "MOBILIZA", PATRI: "PATRIOTA", PEN: "PATRIOTA",
  PTN: "PODE", PODEMOS: "PODE", PSDC: "DC", SD: "SOLIDARIEDADE", PCdoB: "PC do B", PTdoB: "AVANTE", "PT do B": "AVANTE",
};

export const proporcao = (legenda: number, nominais: number) => (legenda + nominais > 0 ? legenda / (legenda + nominais) : 0);

export interface PartidoAgregado { partido: string; porAno: Record<number, { legenda: number; nominais: number }>; legendaTotal: number; nominaisTotal: number }

export function agregarPorPartido(linhas: LinhaLegenda[], uf?: string): { partidos: PartidoAgregado[]; anos: number[] } {
  const mapa = new Map<string, PartidoAgregado>();
  const anos = new Set<number>();
  for (const l of linhas) {
    if (uf && l.uf !== uf) continue;
    const nome = RENOMEACOES[l.sigla] ?? l.sigla;
    anos.add(l.ano);
    let p = mapa.get(nome);
    if (!p) mapa.set(nome, (p = { partido: nome, porAno: {}, legendaTotal: 0, nominaisTotal: 0 }));
    const c = (p.porAno[l.ano] ??= { legenda: 0, nominais: 0 });
    c.legenda += l.votos_legenda;
    c.nominais += l.votos_nominais;
    p.legendaTotal += l.votos_legenda;
    p.nominaisTotal += l.votos_nominais;
  }
  return { partidos: [...mapa.values()].sort((a, b) => b.legendaTotal - a.legendaTotal), anos: [...anos].sort((a, b) => a - b) };
}

// Fotos dos candidatos: ficam num banco à parte (bdr_fotos, gerado por load_BDR/fotos_baixar.py) e a API as serve em
// GET /api/fotos/{ano}/{ue}/{sequencial}?tam=mini|ficha (404 sem foto). Só há fotos de 2018 em diante: antes disso
// nem pedimos. Sem foto, os componentes mantêm a alternativa de antes (as iniciais ou o número de urna).

export const ANO_PRIMEIRA_FOTO = 2018;

/** Crédito exigido pela licença CC BY do TSE (vale também quando o original aparece sem alteração). */
export const CREDITO_FOTOS = "Fotos: Tribunal Superior Eleitoral, Portal de Dados Abertos (CC BY). Imagens redimensionadas e convertidas pelo projeto.";

/** mini: WebP 120×160 para listas e buscas; ficha: o original do TSE (161×225), exibido com no máximo 340 px. */
export type TamanhoFoto = "mini" | "ficha";

/** Chave natural da candidatura no TSE, a mesma do banco de fotos. */
export interface ChaveFoto { ano: number; ue?: string | null; sequencial?: string | null }

export function urlFoto(c: ChaveFoto, tam: TamanhoFoto = "mini"): string | null {
  if (!c.ue || !c.sequencial || c.ano < ANO_PRIMEIRA_FOTO) return null;
  return `/api/fotos/${c.ano}/${encodeURIComponent(c.ue)}/${encodeURIComponent(c.sequencial)}?tam=${tam}`;
}

/**
 * Uma pessoa, um retrato: a foto mais recente que existe da pessoa (GET /api/candidatos/{id}/foto), a mesma na busca,
 * na ficha de qualquer ano e no perfil. `ultimo_ano` é o da candidatura mais recente: antes de 2018 nem pedimos; sem
 * ele (uma listagem de candidaturas não sabe), pede, e a API responde 404 se não houver.
 */
export function fotoDaPessoa(p: { id_candidato?: number | null; ultimo_ano?: number }, tam: TamanhoFoto = "mini"): string | null {
  if (p.id_candidato == null || (p.ultimo_ano !== undefined && p.ultimo_ano < ANO_PRIMEIRA_FOTO)) return null;
  return `/api/candidatos/${p.id_candidato}/foto?tam=${tam}`;
}

/** Foto de um resultado da /api/busca: a da pessoa. */
export const fotoDaBusca = (b: { id_candidato: number; ultimo_ano: number }, tam: TamanhoFoto = "mini") => fotoDaPessoa(b, tam);

/** Foto do perfil e da ficha: a da pessoa, se alguma candidatura dela puder ter foto. */
export function fotoDoPerfil(id_candidato: number, carreira: { ano: number }[], tam: TamanhoFoto = "ficha"): string | null {
  return fotoDaPessoa({ id_candidato, ultimo_ano: Math.max(0, ...carreira.map((c) => c.ano)) }, tam);
}

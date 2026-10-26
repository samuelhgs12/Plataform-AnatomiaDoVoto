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

/** Foto de um resultado da /api/busca: a da candidatura mais recente da pessoa. */
export const fotoDaBusca = (b: { ultimo_ano: number; ultimo_ue?: string | null; ultimo_sequencial?: string | null }, tam: TamanhoFoto = "mini") =>
  urlFoto({ ano: b.ultimo_ano, ue: b.ultimo_ue, sequencial: b.ultimo_sequencial }, tam);

/**
 * Foto do perfil: a da campanha escolhida (?campanha=), se ela puder ter foto; senão a da candidatura mais recente que
 * possa ter. `carreira` vem em ordem de ano, como a API devolve. O ano diz de quando é o retrato.
 */
export function fotoDoPerfil<T extends ChaveFoto & { id_candidatura: number }>(carreira: T[], escolhida?: number, tam: TamanhoFoto = "ficha"): { url: string; ano: number } | null {
  const pedida = carreira.find((c) => c.id_candidatura === escolhida && urlFoto(c));
  const c = pedida ?? carreira.findLast((x) => urlFoto(x));
  return c ? { url: urlFoto(c, tam)!, ano: c.ano } : null;
}

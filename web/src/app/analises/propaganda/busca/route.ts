import type { NextRequest } from "next/server";
import { lerEstatico } from "@/lib/data";
import { buscarCandidaturas, lerIndice, LIMITE_BUSCA } from "@/lib/propaganda";
import { carregarRecorte } from "@/lib/propaganda-dados";

/**
 * Busca de candidaturas pelo nome de urna para a pergunta 9: GET /analises/propaganda/busca?ano=2024&uf=MG&q=maria[&cargo=Vereador].
 * Lê só o JSON estático do recorte (public/data/q9, em cache no servidor) e devolve até LIMITE_BUSCA candidaturas com os
 * campos que a lista mostra: o navegador nunca baixa o recorte inteiro. Fica fora de /api/ (que o Next repassa à API FastAPI).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const indice = lerIndice(await lerEstatico("q9/indice"));
  const ano = Number(sp.get("ano"));
  const r = indice?.recortes.find((x) => x.ano === ano && x.uf === sp.get("uf"));
  if (!r) return Response.json({ itens: [], total: 0 }, { status: 404 });
  const { recorte, problemas, busca } = await carregarRecorte(r.arquivo);
  if (!recorte || problemas.length) return Response.json({ itens: [], total: 0 }, { status: 503 });
  const cargo = sp.get("cargo") ?? undefined;
  const { itens, total } = buscarCandidaturas(busca(), sp.get("q") ?? "", recorte.candidaturas.some((c) => c.cargo === cargo) ? cargo : undefined, LIMITE_BUSCA);
  return Response.json({
    total,
    itens: itens.map((c) => ({ c: c.sequencial, nome: c.nome_urna, partido: c.partido, numero: c.numero_urna, cargo: c.cargo, municipio: c.municipio })),
  });
}

import { nomeProprio, type LinhaMunicipio } from "@/lib/abstencao";
import { comoObjetos, lerEstatico } from "@/lib/data";

// Gerado uma vez no build: a lista muda só quando o mapa.json é exportado de novo.
export const dynamic = "force-static";

/**
 * Municípios do mapa para a busca rápida (Ctrl K): [id_municipio, nome, uf], ordenados pelo nome. São ~1.400 linhas
 * (dezenas de KB), contra os ~750 KB do mapa.json inteiro; a paleta só pede quando abre pela primeira vez.
 */
export async function GET() {
  const dados = await lerEstatico("mapa");
  const municipios = comoObjetos<LinhaMunicipio>(dados?.municipios)
    .map((m): [number, string, string] => [m.id_municipio, nomeProprio(m.nome), m.uf])
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  return Response.json(municipios);
}

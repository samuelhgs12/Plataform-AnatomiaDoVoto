import { existsSync } from "node:fs";
import { join } from "node:path";
import { fotoDaPessoa } from "./foto-candidato";

/** Só no servidor. Usa o retrato da campanha já baixado; sem ele, tenta o acervo da API. */
export function fotoDoDinheiro(c: { id_candidatura: number; id_candidato: number | null }): string | null {
  const arquivo = `${c.id_candidatura}.jpg`;
  if (existsSync(join(process.cwd(), "public", "fotos-candidatos", arquivo))) return `/fotos-candidatos/${arquivo}`;
  return fotoDaPessoa(c);
}

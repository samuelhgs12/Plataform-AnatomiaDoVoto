import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TabelaEstatica } from "./types";

/**
 * Lê public/data/<nome>.json (gerado por pipeline/export_static.py). Devolve null se ainda não foi gerado.
 * A pergunta 9 fica dividida em public/data/q9/ (índice + um arquivo por eleição e UF): "q9/indice", "q9/2024-MG".
 */
export async function lerEstatico(nome: "q5" | "q8" | "q10" | "mapa" | `q9/${string}`): Promise<Record<string, TabelaEstatica> | null> {
  if (nome.startsWith("q9/") && !/^q9\/(indice|\d{4}-[A-Z]{2})$/.test(nome)) return null;   // só nomes que o export gera
  try {
    const texto = await readFile(path.join(process.cwd(), "public", "data", `${nome}.json`), "utf-8");
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

/** Transforma {colunas, linhas} em uma lista de objetos. */
export function comoObjetos<T = Record<string, string | number | boolean | null>>(t: TabelaEstatica | undefined): T[] {
  if (!t) return [];
  return t.linhas.map((l) => Object.fromEntries(t.colunas.map((c, i) => [c, l[i]]))) as T[];
}

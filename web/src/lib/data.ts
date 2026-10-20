import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TabelaEstatica } from "./types";

/** Lê public/data/<nome>.json (gerado por pipeline/export_static.py). Devolve null se ainda não foi gerado. */
export async function lerEstatico(nome: "q5" | "q8" | "q10" | "mapa"): Promise<Record<string, TabelaEstatica> | null> {
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

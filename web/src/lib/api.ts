import { notFound } from "next/navigation";
import type { TabelaEstatica } from "./types";

const BASE = process.env.API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** GET na API (só em componentes de servidor). Os dados são históricos, então a resposta pode ficar em cache. */
export async function apiGet<T>(caminho: string, revalidarSegundos = 3600): Promise<T> {
  const res = await fetch(`${BASE}/api${caminho}`, { next: { revalidate: revalidarSegundos } });
  if (res.status === 404) notFound();
  if (!res.ok) throw new ApiError(res.status, `A API respondeu ${res.status} em ${caminho}`);
  return (await res.json()) as T;
}

/** Variante que não derruba a página: devolve null se a chamada falhar (blocos opcionais do perfil). */
export async function apiGetOpcional<T>(caminho: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api${caminho}`, { next: { revalidate: 3600 } });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Tabelas de uma análise (api/app/analises/<nome>.sql), só as pedidas. Devolve null se a API não responder. */
export async function lerAnalise(nome: string, tabelas: string[]): Promise<Record<string, TabelaEstatica> | null> {
  const p = new URLSearchParams(tabelas.map((t) => ["tabela", t]));
  return apiGetOpcional(`/analises/${nome}?${p}`);
}

/**
 * Peças de propaganda de um recorte (visão geral da pergunta 9, GET /api/propaganda/pecas): a lista; "preparando" enquanto
 * a API ainda calcula (resposta 202, que o Next não guarda em cache); null se a API não responder.
 */
export async function lerPecas(ano: number, cargo: string, uf: string | null): Promise<unknown[] | "preparando" | null> {
  const p = new URLSearchParams({ ano: String(ano), cargo, ...(uf ? { uf } : {}) });
  try {
    const res = await fetch(`${BASE}/api/propaganda/pecas?${p}`, { next: { revalidate: 3600 } });
    if (res.status === 202) return "preparando";
    return res.ok ? ((await res.json()) as unknown[]) : null;
  } catch {
    return null;
  }
}

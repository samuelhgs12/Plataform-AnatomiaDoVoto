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

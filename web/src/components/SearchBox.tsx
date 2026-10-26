"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { destacarBusca } from "@/lib/busca";
import type { CandidatoBusca } from "@/lib/types";
import { fotoDaBusca } from "@/lib/foto-candidato";
import { Avatar } from "./Avatar";
import { PartyChip } from "./PartyChip";

/** Nome com o trecho buscado em <mark>; mostra por que a pessoa apareceu (casou no nome de urna ou no civil). */
function Destaque({ nome, busca }: { nome: string; busca: string }) {
  return <>{destacarBusca(nome, busca).map((t, i) => (t.casou ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))}</>;
}

/** Busca com sugestões. Chama /api/busca (o Next repassa para a API FastAPI). */
export function SearchBox({ autoFocus = false }: { autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<CandidatoBusca[]>([]);
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");

  const curto = q.trim().length < 3;   // derivado do texto: não precisa de estado próprio

  useEffect(() => {
    if (curto) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        setRes(await r.json());
        setEstado("parado");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstado("erro");
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, curto]);

  const sugestoes = curto ? [] : res;

  return (
    <div role="search">
      <label htmlFor="busca" className="muted" style={{ fontSize: 15 }}>Buscar candidato pelo nome</label>
      <input id="busca" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ex.: Maria da Silva" autoComplete="off" autoFocus={autoFocus}
        style={{ width: "100%", maxWidth: 520, display: "block", marginTop: 4, fontSize: 18 }} />
      <div aria-live="polite" className="muted" style={{ fontSize: 14, minHeight: 18, marginTop: 4 }}>
        {!curto && estado === "buscando" && "Buscando…"}
        {!curto && estado === "erro" && "Não foi possível buscar agora."}
        {!curto && estado === "parado" && sugestoes.length === 0 && "Nenhum candidato encontrado."}
        {q.trim().length > 0 && curto && "Digite pelo menos 3 letras."}
      </div>
      {sugestoes.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "6px 0 0", maxWidth: 520 }}>
          {sugestoes.map((c) => (
            <li key={c.id_candidato} className="card" style={{ marginBottom: 8, padding: "10px 14px" }}>
              <Link href={`/candidato/${c.id_candidato}`} className="busca-item" style={{ textDecoration: "none" }}>
                <Avatar nome={c.nome_urna ?? c.nome_civil} partido={c.partido} foto={fotoDaBusca(c)} />
                <div>
                <b><Destaque nome={c.nome_urna ?? c.nome_civil ?? ""} busca={q} /></b>
                {c.nome_civil && c.nome_civil !== c.nome_urna && (
                  <div style={{ fontSize: 15 }}><Destaque nome={c.nome_civil} busca={q} /></div>
                )}
                {c.nome_urna_casado && (
                  <div style={{ fontSize: 15 }}>Já concorreu como <Destaque nome={c.nome_urna_casado} busca={q} /></div>
                )}
                <div className="muted" style={{ fontSize: 14 }}>
                  {c.ultimo_cargo} · {c.uf} · {c.ultimo_ano}{c.ultimo_eleito ? " · eleito" : ""} <PartyChip sigla={c.partido} />
                </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

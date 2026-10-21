"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import { destacarBusca, normalizarBusca } from "@/lib/busca";

interface Item { c: string; nome: string | null; partido: string | null; numero: string | null; cargo: string; municipio: string | null }

/** Nome com o trecho buscado em <mark> (mesmo destaque da busca de candidatos). */
function Destaque({ nome, busca }: { nome: string; busca: string }) {
  return <>{destacarBusca(nome, busca).map((t, i) => (t.casou ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))}</>;
}

/**
 * Combobox para achar uma candidatura da pergunta 9 pelo nome de urna, dentro da eleição e do estado escolhidos (e do
 * cargo, se houver), sem precisar saber o município (setas, Enter e Esc, como BuscaPartido). As sugestões vêm de
 * /analises/propaganda/busca, que lê o JSON estático no servidor e devolve poucas linhas. Escolher muda só ?c= na URL.
 * Sem JavaScript, as listas de cargo, município e candidatura continuam funcionando.
 */
export function BuscaCandidatura({ caminho, ano, uf, cargo, escopo, minimo }: {
  caminho: string; ano: number; uf: string; cargo?: string; escopo: string; minimo: number;
}) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [res, setRes] = useState<{ itens: Item[]; total: number; para: string }>({ itens: [], total: 0, para: "" });
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [carregando, iniciar] = useTransition();

  const curto = normalizarBusca(termo).replace(/ /g, "").length < minimo;   // derivado do texto: sem estado próprio

  useEffect(() => {
    if (curto) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const sp = new URLSearchParams({ ano: String(ano), uf, q: termo.trim(), ...(cargo ? { cargo } : {}) });
        const r = await fetch(`${caminho}/busca?${sp.toString()}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const dados = await r.json();
        setRes({ ...dados, para: termo });
        setAtivo(0);
        setEstado("parado");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstado("erro");
      }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [termo, curto, caminho, ano, uf, cargo]);

  const opcoes = curto ? [] : res.itens;
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const escolher = (item: Item) => {
    setTermo("");   // como BuscaPartido: a escolha já está na página; o campo fica livre para outra busca
    setAberto(false);
    const sp = new URLSearchParams({ ano: String(ano), uf, c: item.c });
    iniciar(() => router.push(`${caminho}?${sp.toString()}#resposta`, { scroll: false }));
  };
  const teclas = (ev: KeyboardEvent<HTMLInputElement>) => {
    const n = opcoes.length;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setAberto(true);
      if (n) setAtivo((marcado + (ev.key === "ArrowDown" ? 1 : n - 1)) % n);
    } else if (ev.key === "Enter" && mostrar) {
      ev.preventDefault();
      escolher(opcoes[marcado]);
    } else if (ev.key === "Escape") {
      if (mostrar) setAberto(false);
      else setTermo("");
    }
  };

  const status = termo.trim() === "" ? "" : curto ? `Digite pelo menos ${minimo} letras.`
    : estado === "buscando" ? "Buscando…" : estado === "erro" ? "Não foi possível buscar agora."
    : res.para !== termo ? "" : res.total === 0 ? "Nenhuma candidatura encontrada."
    : res.total > res.itens.length ? `${res.itens.length} de ${res.total} candidaturas: digite mais do nome para afinar.`
    : `${res.total} ${res.total === 1 ? "candidatura encontrada" : "candidaturas encontradas"}.`;

  return (
    <div className="combo combo-largo" aria-busy={carregando}>
      <label htmlFor={`${id}-campo`}>Nome de urna, em {escopo}</label>
      <input
        id={`${id}-campo`} type="search" role="combobox" autoComplete="off" spellCheck={false} enterKeyHint="search"
        aria-autocomplete="list" aria-expanded={mostrar} aria-controls={`${id}-lista`} aria-describedby={`${id}-status`}
        aria-activedescendant={mostrar ? `${id}-op-${marcado}` : undefined}
        placeholder="Ex.: Maria da Silva" value={termo}
        onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
        onKeyDown={teclas} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
      />
      <ul id={`${id}-lista`} role="listbox" aria-label="Candidaturas encontradas" hidden={!mostrar}>
        {opcoes.map((o, i) => (
          <li key={o.c} id={`${id}-op-${i}`} role="option" aria-selected={i === marcado}
            onMouseDown={(e) => { e.preventDefault(); escolher(o); }} onMouseEnter={() => setAtivo(i)}>
            <b><Destaque nome={o.nome ?? "Nome não informado"} busca={termo} /></b>
            {(o.partido || o.numero) && <span className="muted"> · {[o.partido, o.numero].filter(Boolean).join(" ")}</span>}
            <small>{o.cargo}{o.municipio ? ` · ${o.municipio}` : ""} · {uf === "BR" ? "Brasil" : uf} · {ano}</small>
          </li>
        ))}
      </ul>
      <p id={`${id}-status`} className="muted" role="status" aria-live="polite" style={{ fontSize: 14, margin: "4px 0 0", minHeight: 18 }}>{status}</p>
    </div>
  );
}

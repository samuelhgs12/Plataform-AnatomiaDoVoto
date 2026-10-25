"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import { buscarCandidato, type EntradaCandidato } from "@/lib/candidato-mapa";
import { nomeProprio } from "@/lib/abstencao";
import { PartyChip } from "./PartyChip";

const hrefCandidato = (id: number) => `/?ver=candidato&cand=${id}#mapa`;

/**
 * Combobox que escolhe o candidato do mapa (setas, Enter e Esc) e muda ?cand= na URL; o resto da página é renderizado
 * de novo no servidor. Com `indice`, filtra a lista recebida (o protótipo, com dados fictícios); sem ela, pergunta à
 * /api/busca como a SearchBox: a troca para os dados reais é tirar a prop. Sem JavaScript, um <select> faz o mesmo.
 */
export function BuscaCandidatoMapa({ indice, rotulo = "Buscar candidato pelo nome", destaque = false }: { indice?: EntradaCandidato[]; rotulo?: string; destaque?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [remotos, setRemotos] = useState<EntradaCandidato[]>([]);
  const [carregando, iniciar] = useTransition();

  // sem índice local: as mesmas sugestões da SearchBox, a partir de 3 letras
  useEffect(() => {
    if (indice || termo.trim().length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo.trim())}`, { signal: ctl.signal });
        if (r.ok) setRemotos(await r.json());
      } catch { /* sem sugestões; a caixa continua usável */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [termo, indice]);

  const opcoes = (indice ? buscarCandidato(indice, termo) : termo.trim().length < 3 ? [] : remotos).slice(0, 8);
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const escolher = (e: EntradaCandidato) => {
    setTermo(nomeProprio(e.nome_urna));
    setAberto(false);
    iniciar(() => router.push(hrefCandidato(e.id_candidato), { scroll: false }));
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

  return (
    <div className={`combo busca-cand${destaque ? " destaque" : ""}`} aria-busy={carregando}>
      <label htmlFor={`${id}-campo`}>{rotulo}</label>
      <div className="busca-cand-campo">
        <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>
        <input
          id={`${id}-campo`} type="text" role="combobox" autoComplete="off" spellCheck={false}
          aria-autocomplete="list" aria-expanded={mostrar} aria-controls={`${id}-lista`}
          aria-activedescendant={mostrar ? `${id}-op-${marcado}` : undefined}
          placeholder="Ex.: Teodora, Otávio" value={termo}
          onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
          onKeyDown={teclas} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
        />
      </div>
      <ul id={`${id}-lista`} role="listbox" aria-label="Candidatos encontrados" hidden={!mostrar}>
        {opcoes.map((o, i) => (
          <li
            key={o.id_candidato} id={`${id}-op-${i}`} role="option" aria-selected={i === marcado}
            onMouseDown={(e) => { e.preventDefault(); escolher(o); }} onMouseEnter={() => setAtivo(i)}
          >
            <b>{nomeProprio(o.nome_urna)}</b>
            <small>{o.ultimo_cargo} · {o.uf === "BR" ? "Brasil" : o.uf} · {o.ultimo_ano} <PartyChip sigla={o.partido} /></small>
          </li>
        ))}
      </ul>
      <p className="busca-cand-status" role="status">{termo.trim() !== "" && !opcoes.length && (indice || termo.trim().length >= 3) ? "Nenhum candidato encontrado." : ""}</p>
      {indice && (
        <noscript>
          <form method="get" action="/#mapa" className="busca-cand-sem-js">
            <input type="hidden" name="ver" value="candidato" />
            <select name="cand" aria-label="Candidato">
              {indice.map((o) => <option key={o.id_candidato} value={o.id_candidato}>{nomeProprio(o.nome_urna)} ({o.ultimo_cargo}, {o.ultimo_ano})</option>)}
            </select>
            <button type="submit">Ver no mapa</button>
          </form>
        </noscript>
      )}
    </div>
  );
}

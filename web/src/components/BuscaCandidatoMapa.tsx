"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import type { EntradaCandidato } from "@/lib/candidato-mapa";
import { nomeProprio } from "@/lib/abstencao";
import { fotoDaBusca } from "@/lib/foto-candidato";
import { FotoCandidato } from "./FotoCandidato";
import { PartyChip } from "./PartyChip";

const hrefCandidato = (id: number) => `/?ver=candidato&cand=${id}#mapa`;

/**
 * Combobox que escolhe o candidato do mapa (setas, Enter e Esc) e muda ?cand= na URL; o resto da página é renderizado
 * de novo no servidor. As sugestões vêm da /api/busca, como na SearchBox; com `uf` (o estado clicado no mapa), só quem
 * disputou nele, e o texto já digitado é buscado de novo. Sem JavaScript, leva à página de candidatos.
 */
export function BuscaCandidatoMapa({ rotulo = "Buscar candidato pelo nome", destaque = false, uf }: { rotulo?: string; destaque?: boolean; uf?: string }) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [remotos, setRemotos] = useState<EntradaCandidato[]>([]);
  const [carregando, iniciar] = useTransition();

  // as mesmas sugestões da SearchBox, a partir de 3 letras
  useEffect(() => {
    if (termo.trim().length < 3) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo.trim())}${uf ? `&uf=${uf}` : ""}`, { signal: ctl.signal });
        if (r.ok) setRemotos(await r.json());
      } catch { /* sem sugestões; a caixa continua usável */ }
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [termo, uf]);

  const opcoes = (termo.trim().length < 3 ? [] : remotos).slice(0, 8);
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const escolher = (e: EntradaCandidato) => {
    setTermo(nomeProprio(e.nome_urna ?? ""));
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
          placeholder={uf ? "Nome de urna ou nome civil" : "Ex.: Zema, Raquel Lyra"} value={termo}
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
            {/* alt vazio: o nome está logo ao lado, no texto da opção */}
            <FotoCandidato url={fotoDaBusca(o)} alt="" />
            <b>{nomeProprio(o.nome_urna ?? "")}</b>
            <small>{o.ultimo_cargo} · {o.uf === "BR" ? "Brasil" : o.uf} · {o.ultimo_ano} <PartyChip sigla={o.partido} /></small>
          </li>
        ))}
      </ul>
      <p className="busca-cand-status" role="status">{termo.trim().length >= 3 && !opcoes.length ? `Nenhum candidato encontrado${uf ? ` em ${uf}` : ""}.` : ""}</p>
      <noscript><p className="busca-cand-sem-js">Sem JavaScript, busque pela <a href="/candidatos">página de candidatos</a>.</p></noscript>
    </div>
  );
}

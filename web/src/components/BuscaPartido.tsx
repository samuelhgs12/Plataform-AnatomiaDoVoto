"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type KeyboardEvent } from "react";
import { buscarPartido, hrefLegenda, MAX_PARTIDOS, type EntradaIndice, type ParametrosLegenda } from "@/lib/legenda";

/**
 * Combobox para escolher um partido pela sigla ou pelo número (setas, Enter e Esc). Só muda ?p= na URL; o resto
 * da página é renderizado de novo no servidor. Sem JavaScript, as sugestões "+ SIGLA" ao lado continuam funcionando.
 */
export function BuscaPartido({ indice, escolhidos, atual }: { indice: EntradaIndice[]; escolhidos: string[]; atual: ParametrosLegenda }) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [carregando, iniciar] = useTransition();

  if (escolhidos.length >= MAX_PARTIDOS) return <p className="muted" style={{ fontSize: 12, margin: 0 }}>Máximo de {MAX_PARTIDOS} partidos: remova um para escolher outro.</p>;

  const opcoes = buscarPartido(indice, termo, escolhidos).slice(0, 8);
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const escolher = (e: EntradaIndice) => {
    setTermo("");
    setAberto(false);
    iniciar(() => router.push(hrefLegenda(atual, { p: [...escolhidos, e.partido] }), { scroll: false }));
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
    <div className="combo" aria-busy={carregando}>
      <label htmlFor={`${id}-campo`}>Adicionar partido</label>
      <input
        id={`${id}-campo`} type="text" role="combobox" autoComplete="off" spellCheck={false}
        aria-autocomplete="list" aria-expanded={mostrar} aria-controls={`${id}-lista`}
        aria-activedescendant={mostrar ? `${id}-op-${marcado}` : undefined}
        placeholder="Sigla ou número (ex.: PSOL, 50)" value={termo}
        onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
        onKeyDown={teclas} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
      />
      <ul id={`${id}-lista`} role="listbox" aria-label="Partidos encontrados" hidden={!mostrar}>
        {opcoes.map((o, i) => (
          <li
            key={`${o.sigla}-${o.numero}`} id={`${id}-op-${i}`} role="option" aria-selected={i === marcado}
            onMouseDown={(e) => { e.preventDefault(); escolher(o); }} onMouseEnter={() => setAtivo(i)}
          >
            <b>{o.sigla}</b> <span className="muted">{o.numero}</span>
            {o.partido !== o.sigla && <span className="muted"> → {o.partido}</span>}
          </li>
        ))}
      </ul>
      {termo.trim() !== "" && !opcoes.length && <p className="muted" role="status" style={{ fontSize: 12, margin: "4px 0 0" }}>Nenhum partido encontrado.</p>}
    </div>
  );
}

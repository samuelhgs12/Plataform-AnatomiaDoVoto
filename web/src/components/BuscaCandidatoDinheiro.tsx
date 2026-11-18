"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import { nomeProprio } from "@/lib/abstencao";
import { destacarBusca } from "@/lib/busca";
import { caminhoBuscaCandidato, hrefBuscaCandidato, termoBuscaCandidato } from "@/lib/dinheiro";
import { reais } from "@/lib/format";
import type { CandidatoLocal } from "@/lib/territorio";
import { PartyChip } from "./PartyChip";

type Achado = CandidatoLocal & { municipio?: string | null };

/** Nome com o trecho digitado em <mark>, como na busca do topo. */
function Destaque({ nome, busca }: { nome: string; busca: string }) {
  return <>{destacarBusca(nome, busca).map((t, i) => (t.casou ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))}</>;
}

/**
 * Busca de candidato da pergunta 1 (camada Dinheiro), com autocompletar: a partir de 2 letras, as sugestões vêm de
 * /api/dinheiro/candidatos no recorte aberto (ano, cargo, estado e, nas municipais, cidade), quem começa com o texto
 * primeiro. Setas, Enter e Esc como na busca do mapa; escolher ou enviar muda ?nome= e a página mostra o gasto, o custo
 * do voto e as despesas. Sem JavaScript, é um formulário GET comum (os campos escondidos guardam o recorte).
 */
export function BuscaCandidatoDinheiro({ campos, recorte, inicial, municipal }: {
  campos: [string, string][];
  recorte: { ano: number; cargo: string; uf: string; mun?: number | null };
  inicial: string;
  /** nas municipais sem cidade escolhida, a sugestão mostra a cidade */
  municipal: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState(inicial);
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [achados, setAchados] = useState<Achado[]>([]);
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");
  const [indo, iniciar] = useTransition();

  const q = termoBuscaCandidato(termo);
  const { ano, cargo, uf, mun } = recorte;
  useEffect(() => {
    if (!q) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const r = await fetch(`/api${caminhoBuscaCandidato({ q, ano, cargo, uf, mun })}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        setAchados(await r.json());
        setEstado("parado");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstado("erro");
      }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, ano, cargo, uf, mun]);

  const opcoes = q ? achados.slice(0, 8) : [];
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const ir = (nome: string) => {
    setAberto(false);
    iniciar(() => router.push(hrefBuscaCandidato(campos, nome)));
  };
  const escolher = (a: Achado) => {
    const nome = nomeProprio(a.nome_urna ?? "");
    setTermo(nome);
    ir(nome);
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
    <form className="din-busca-form combo" action="/#dinheiro-busca" method="get" role="search" aria-busy={indo}
      onSubmit={(ev) => { if (q) { ev.preventDefault(); ir(q); } }}>
      {campos.map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <label htmlFor={`${id}-campo`} className="sr-only">Nome do candidato</label>
      <div className="din-busca-campo">
        <input
          id={`${id}-campo`} name="nome" type="search" role="combobox" autoComplete="off" spellCheck={false}
          aria-autocomplete="list" aria-expanded={mostrar} aria-controls={`${id}-lista`}
          aria-activedescendant={mostrar ? `${id}-op-${marcado}` : undefined}
          placeholder="Comece a digitar: nome de urna ou nome completo" value={termo} minLength={2} maxLength={80}
          onChange={(e) => { setTermo(e.target.value); setAtivo(0); setAberto(true); }}
          onKeyDown={teclas} onFocus={() => setAberto(true)} onBlur={() => setAberto(false)}
        />
        <ul id={`${id}-lista`} role="listbox" aria-label="Candidatos encontrados" className="din-busca-lista" hidden={!mostrar}>
          {opcoes.map((o, i) => (
            <li key={o.id_candidatura} id={`${id}-op-${i}`} role="option" aria-selected={i === marcado}
              onMouseDown={(e) => { e.preventDefault(); escolher(o); }} onMouseEnter={() => setAtivo(i)}>
              <span className="din-busca-nome"><Destaque nome={nomeProprio(o.nome_urna ?? "")} busca={termo} /></span>
              <small>
                <PartyChip sigla={o.partido} />
                {municipal && !mun && o.municipio ? ` ${nomeProprio(o.municipio)} ·` : ""} {o.eleito ? "Eleito" : "Não eleito"}
                {" · "}{o.prestou === false ? "gasto não informado" : `gastou ${reais(o.gasto)}`}
              </small>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit">Buscar</button>
      <p className="din-busca-status" role="status">
        {q && aberto && estado === "buscando" && !opcoes.length ? "Buscando…" : ""}
        {q && estado === "erro" ? "Não foi possível buscar agora." : ""}
        {q && aberto && estado === "parado" && !opcoes.length && achados.length === 0 ? "Nenhum candidato com esse nome neste recorte." : ""}
      </p>
    </form>
  );
}

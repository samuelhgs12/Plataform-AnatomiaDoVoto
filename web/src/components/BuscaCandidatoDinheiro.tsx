"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import { nomeProprio } from "@/lib/abstencao";
import { destacarBusca } from "@/lib/busca";
import { reais } from "@/lib/format";
import { caminhoBuscaCandidato, hrefBuscaCandidato, lugarDoAchado, termoBuscaCandidato } from "@/lib/dinheiro";
import type { CandidatoLocal } from "@/lib/territorio";
import { PartyChip } from "./PartyChip";
import { DetalhesCandidatoDinheiro } from "./DetalhesCandidatoDinheiro";

type Achado = CandidatoLocal & { municipio?: string | null; uf?: string | null };

/** Nome com o trecho digitado em <mark>, como na busca do topo. */
function Destaque({ nome, busca }: { nome: string; busca: string }) {
  return <>{destacarBusca(nome, busca).map((t, i) => (t.casou ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))}</>;
}

/**
 * Busca de candidato da pergunta 1 (camada Dinheiro), com autocompletar: a partir de 2 letras, as sugestões vêm de
 * /api/dinheiro/candidatos no recorte aberto (ano, cargo, estado e, nas municipais, cidade), quem começa com o texto
 * primeiro. Escolher abre o detalhe da candidatura na tela; a busca por texto continua disponível para listar
 * vários resultados. Sem JavaScript, é um formulário GET comum (os campos escondidos guardam o recorte).
 */
export function BuscaCandidatoDinheiro({ campos, recorte, inicial, municipal }: {
  campos: [string, string][];
  /** sem `uf`, a busca vale para os seis estados */
  recorte: { ano: number; cargo: string; uf?: string; mun?: number | null };
  inicial: string;
  /** nas municipais sem cidade escolhida, a sugestão mostra a cidade */
  municipal: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const [termo, setTermo] = useState(inicial);
  const [ativo, setAtivo] = useState(0);
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState<{ chave: string; achados: Achado[]; erro: boolean } | null>(null);
  const [selecionado, setSelecionado] = useState<Achado | null>(null);
  const [indo, iniciar] = useTransition();

  const q = termoBuscaCandidato(termo);
  const { ano, cargo, uf, mun } = recorte;
  const chave = q ? caminhoBuscaCandidato({ q, ano, cargo, uf, mun }) : null;
  useEffect(() => {
    if (!chave) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api${chave}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const achados: Achado[] = await r.json();
        if (!ctl.signal.aborted) setResposta({ chave, achados, erro: false });
      } catch (e) {
        if (!ctl.signal.aborted && (e as Error).name !== "AbortError") setResposta({ chave, achados: [], erro: true });
      }
    }, 200);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [chave]);

  const atual = chave !== null && resposta?.chave === chave ? resposta : null;
  const opcoes = atual?.achados.slice(0, 8) ?? [];
  const buscando = !!chave && !atual;
  const mostrar = aberto && opcoes.length > 0;
  const marcado = Math.min(ativo, opcoes.length - 1);

  const ir = (nome: string) => {
    setAberto(false);
    iniciar(() => router.push(hrefBuscaCandidato(campos, nome)));
  };
  const escolher = (a: Achado) => {
    const nome = nomeProprio(a.nome_urna ?? "");
    setTermo(nome);
    setAberto(false);
    setSelecionado(a);
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

  return (<>
    <form className="din-busca-form combo" action="/#dinheiro-busca" method="get" role="search" aria-busy={indo}
      onSubmit={(ev) => { if (q) { ev.preventDefault(); if (atual?.achados.length === 1) escolher(atual.achados[0]); else ir(q); } }}>
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
              onMouseDown={(e) => e.preventDefault()} onClick={() => escolher(o)} onMouseEnter={() => setAtivo(i)}>
              <span className="din-busca-nome"><Destaque nome={nomeProprio(o.nome_urna ?? "")} busca={termo} /></span>
              <small>
                <PartyChip sigla={o.partido} />
                {(() => { const l = lugarDoAchado({ cidade: municipal && o.municipio ? nomeProprio(o.municipio) : null, uf: o.uf }, { uf, mun }); return l ? ` · ${l}` : ""; })()}
              </small>
              <span className="din-busca-valor">
                <b>{o.prestou === false ? "Sem contas" : reais(o.gasto)}</b>
                <span className={o.eleito ? "din-busca-eleito" : undefined}>{o.eleito ? "Eleito" : "Não eleito"}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <button type="submit">Ver resultados</button>
      <p className="din-busca-status" role="status">
        {aberto && buscando ? "Buscando…" : ""}
        {atual?.erro ? "Não foi possível buscar agora." : ""}
        {q && aberto && atual && !atual.erro && !opcoes.length ? "Nenhum candidato com esse nome neste recorte." : ""}
      </p>
      <p className="din-busca-ajuda">Selecione um nome para ver os gastos.</p>
    </form>
    {selecionado && <DetalhesCandidatoDinheiro key={selecionado.id_candidatura} candidato={selecionado} ano={ano} cargo={cargo} onFechar={() => setSelecionado(null)} />}
  </>);
}

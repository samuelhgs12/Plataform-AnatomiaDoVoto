"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { destacarBusca, normalizarBusca } from "@/lib/busca";
import { SUGESTOES, agrupar, candidatoNaPaleta, filtrarPaleta, indicePaleta, type ItemPaleta, type TipoItem } from "@/lib/paleta";
import type { CandidatoBusca } from "@/lib/types";
import { Icone, type NomeIcone } from "./Icone";
import { FotoCandidato } from "./FotoCandidato";

const ICONE: Record<TipoItem, NomeIcone> = { pagina: "pagina", estado: "estado", municipio: "municipio", candidato: "candidato" };
const EVENTO = "paleta:abrir";

/** Abre a busca rápida a partir de `origem`: a caixa nasce do formato e do lugar desse botão. */
export function abrirBusca(origem: HTMLElement | null) {
  window.dispatchEvent(new CustomEvent<HTMLElement | null>(EVENTO, { detail: origem }));
}

type ComTransicao = Document & { startViewTransition?: (mudar: () => void) => { finished: Promise<void> } };

/**
 * Troca de estado com View Transition: o botão de origem e a caixa da paleta têm o mesmo `view-transition-name` (um de
 * cada vez), então o navegador anima um no outro. Sem suporte ou com movimento reduzido, só troca.
 */
function transicionar(origem: HTMLElement | null, mudar: () => void, depois?: () => void) {
  const doc = document as ComTransicao;
  if (!origem || !doc.startViewTransition || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mudar();
    depois?.();
    return;
  }
  doc.startViewTransition(mudar).finished.finally(() => depois?.());
}

/** Nome com o trecho buscado em <mark>. */
function Realce({ texto, busca }: { texto: string; busca: string }) {
  return <>{destacarBusca(texto, busca).map((t, i) => (t.casou ? <mark key={i}>{t.texto}</mark> : <span key={i}>{t.texto}</span>))}</>;
}

/**
 * Busca rápida (Ctrl K ou o botão "Buscar" do menu): páginas, análises, estados e municípios do mapa filtrados aqui
 * mesmo, e candidatos pela API, numa lista só que se percorre pelo teclado. É um <dialog> modal: o navegador cuida do
 * foco preso dentro dele e do fundo inerte.
 */
export function PaletaBusca() {
  const router = useRouter();
  const id = useId();
  const caixa = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const origem = useRef<HTMLElement | null>(null);
  const [aberta, setAberta] = useState(false);
  const [q, setQ] = useState("");
  const [indice, setIndice] = useState<ItemPaleta[] | null>(null);
  const [candidatos, setCandidatos] = useState<{ termo: string; itens: ItemPaleta[] }>({ termo: "", itens: [] });
  const [estado, setEstado] = useState<"parado" | "buscando" | "erro">("parado");
  const [ativo, setAtivo] = useState(0);

  const termo = q.trim();
  const curto = normalizarBusca(termo).length < 3;

  const abrir = useCallback((de: HTMLElement | null) => {
    if (caixa.current?.open) return;
    origem.current = de;
    if (de) de.style.viewTransitionName = "paleta";
    transicionar(de, () => {
      if (de) de.style.viewTransitionName = "";
      flushSync(() => { setQ(""); setAtivo(0); setAberta(true); });
      caixa.current!.showModal();
      campo.current?.focus();
    });
  }, []);

  const fechar = useCallback(() => {
    const de = origem.current?.isConnected && origem.current.checkVisibility?.() !== false ? origem.current : null;
    transicionar(de, () => {
      flushSync(() => setAberta(false));
      caixa.current?.close();
      if (de) de.style.viewTransitionName = "paleta";
    }, () => { if (de) de.style.viewTransitionName = ""; });
  }, []);

  // Ctrl K (Cmd K no Mac) abre e fecha de qualquer página; os botões "Buscar" chamam abrirBusca()
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "k" || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      e.preventDefault();
      if (caixa.current?.open) { fechar(); return; }
      const visivel = [...document.querySelectorAll<HTMLElement>("[data-abre-busca]")].find((b) => b.checkVisibility?.() ?? b.offsetParent !== null);
      abrir(visivel ?? null);
    };
    const pedido = (e: Event) => abrir((e as CustomEvent<HTMLElement | null>).detail);
    window.addEventListener("keydown", tecla);
    window.addEventListener(EVENTO, pedido);
    return () => { window.removeEventListener("keydown", tecla); window.removeEventListener(EVENTO, pedido); };
  }, [abrir, fechar]);

  // estados e municípios: a lista leve de /indice/municipios, pedida só na primeira vez que a paleta abre
  useEffect(() => {
    if (!aberta || indice) return;
    fetch("/indice/municipios")
      .then((r) => (r.ok ? r.json() : []))
      .then((m: [number, string, string][]) => setIndice(indicePaleta(m)))
      .catch(() => setIndice(indicePaleta([])));
  }, [aberta, indice]);

  // candidatos: a mesma busca da API que a página inicial usa, 220 ms depois da última tecla
  useEffect(() => {
    if (!aberta || curto) return;
    const ctl = new AbortController();
    const t = setTimeout(async () => {
      setEstado("buscando");
      try {
        const r = await fetch(`/api/busca?q=${encodeURIComponent(termo)}`, { signal: ctl.signal });
        if (!r.ok) throw new Error(String(r.status));
        const lista: CandidatoBusca[] = await r.json();
        setCandidatos({ termo, itens: lista.slice(0, 6).map(candidatoNaPaleta) });
        setEstado("parado");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setEstado("erro");
      }
    }, 220);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [termo, curto, aberta]);

  const locais = termo ? filtrarPaleta(indice ?? indicePaleta([]), termo) : SUGESTOES;
  const grupos = agrupar([...locais, ...(!curto && candidatos.termo === termo ? candidatos.itens : [])]);
  const lista = grupos.flatMap((g) => g.itens);
  const atual = Math.min(ativo, Math.max(0, lista.length - 1));
  const idOpcao = (i: number) => `${id}-opcao-${i}`;

  useEffect(() => {
    if (aberta) document.getElementById(idOpcao(atual))?.scrollIntoView({ block: "nearest" });
  });

  const ir = (item: ItemPaleta | undefined) => {
    if (!item) return;
    // sai sem a transição de volta ao botão: a página muda junto
    flushSync(() => setAberta(false));
    caixa.current?.close();
    router.push(item.href);
  };

  const teclar = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (lista.length) setAtivo((atual + (e.key === "ArrowDown" ? 1 : -1) + lista.length) % lista.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      ir(lista[atual]);
    }
  };

  const aviso = !termo ? "" : estado === "erro" && !curto ? "Não foi possível buscar candidatos agora."
    : !curto && (estado === "buscando" || candidatos.termo !== termo) ? "Buscando candidatos…"
    : curto ? "Com 3 letras ou mais, a busca inclui candidatos." : "";
  let n = -1;

  return (
    <dialog ref={caixa} className="paleta" aria-label="Busca rápida"
      onCancel={(e) => { e.preventDefault(); fechar(); }}
      onClick={(e) => { if (e.target === caixa.current) fechar(); }}>
      {aberta && (
        <div className="paleta-caixa">
          <div className="paleta-campo">
            <Icone nome="buscar" />
            <input ref={campo} type="text" value={q} placeholder="Buscar candidato, município, estado ou análise"
              onChange={(e) => { setQ(e.target.value); setAtivo(0); }} onKeyDown={teclar}
              role="combobox" aria-expanded="true" aria-controls={`${id}-lista`} aria-activedescendant={lista.length ? idOpcao(atual) : undefined}
              aria-autocomplete="list" aria-label="Buscar" autoComplete="off" spellCheck={false} />
            <kbd className="paleta-esc">Esc</kbd>
          </div>

          <div className="paleta-rolagem">
            <ul id={`${id}-lista`} role="listbox" aria-label="Resultados" className="paleta-lista">
              {grupos.map((g) => (
                <li key={g.tipo} role="presentation">
                  <p className="paleta-grupo" aria-hidden="true">{termo ? g.rotulo : "Ir para"}</p>
                  <ul role="presentation">
                    {g.itens.map((item) => {
                      const i = ++n;
                      return (
                        <li key={item.href} id={idOpcao(i)} role="option" aria-selected={i === atual} className="paleta-item"
                          onMouseMove={() => i !== atual && setAtivo(i)} onClick={() => ir(item)}>
                          {item.foto ? (
                            // alt vazio: o nome já está no texto da opção, ao lado
                            <span className="paleta-foto"><FotoCandidato url={item.foto} alt=""><Icone nome={ICONE[item.tipo]} /></FotoCandidato></span>
                          ) : <Icone nome={ICONE[item.tipo]} />}
                          <span className="paleta-texto">
                            <span className="paleta-titulo"><Realce texto={item.titulo} busca={termo} /></span>
                            <span className="paleta-detalhe">{item.detalhe}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
            {termo && !lista.length && (curto || (estado !== "buscando" && candidatos.termo === termo)) && (
              <p className="paleta-vazio">Nada encontrado para “{termo}”.</p>
            )}
          </div>

          <div className="paleta-base">
            <span aria-live="polite" className="paleta-aviso">{aviso}</span>
            <span className="paleta-teclas" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> navegar <kbd>Enter</kbd> abrir</span>
          </div>
        </div>
      )}
    </dialog>
  );
}

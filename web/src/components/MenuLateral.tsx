"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ANALISES } from "@/lib/analises";
import { Icone, type NomeIcone } from "./Icone";
import { abrirBusca } from "./PaletaBusca";
import { ThemeToggle } from "./ThemeToggle";

/** Chave do localStorage; o script em `layout.tsx` lê a mesma chave antes da página pintar, para o menu não pular. */
export const CHAVE_MENU = "menu";

const ITENS: { href: string; rotulo: string; icone: NomeIcone; ativo: (p: string) => boolean }[] = [
  { href: "/", rotulo: "Mapa", icone: "mapa", ativo: (p) => p === "/" },
  { href: "/candidatos", rotulo: "Candidatos", icone: "candidatos", ativo: (p) => p.startsWith("/candidato") },
  { href: "/analises", rotulo: "Análises", icone: "analises", ativo: (p) => p.startsWith("/analises") },
  { href: "/sobre", rotulo: "Sobre os dados", icone: "sobre", ativo: (p) => p === "/sobre" },
];
const SUBITENS = ANALISES.filter((a) => a.href.startsWith("/analises/"));

// <html data-menu> é a fonte da verdade (o script do layout o põe antes da pintura); o React só o observa
const observarMenu = (avisar: () => void) => {
  const mo = new MutationObserver(avisar);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-menu"] });
  return () => mo.disconnect();
};
const menuRecolhido = () => document.documentElement.dataset.menu === "recolhido";

const digitando = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

/**
 * Menu da lateral. No computador, recolhe para um trilho só de ícones (botão no pé ou a tecla [), e a escolha fica
 * guardada; o nome de cada item aparece ao passar o mouse ou focar. No celular, é uma gaveta aberta pela barra do topo.
 * O estado recolhido fica em <html data-menu>, que o CSS lê: assim o servidor não precisa saber dele.
 */
export function MenuLateral() {
  const caminho = usePathname();
  const recolhido = useSyncExternalStore(observarMenu, menuRecolhido, () => false);
  const [gaveta, setGaveta] = useState({ aberta: false, caminho });
  const aberta = gaveta.aberta && gaveta.caminho === caminho;   // trocar de página fecha a gaveta

  const alternar = () => {
    const novo = !menuRecolhido();
    if (novo) document.documentElement.dataset.menu = "recolhido";
    else delete document.documentElement.dataset.menu;
    try { localStorage.setItem(CHAVE_MENU, novo ? "recolhido" : "aberto"); } catch { /* sem armazenamento: vale só nesta visita */ }
  };

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape" && aberta) setGaveta({ aberta: false, caminho });
      if (e.key === "[" && !e.ctrlKey && !e.metaKey && !e.altKey && !digitando(e.target)) alternar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  });

  return (
    <>
      {/* celular: a marca, a busca e o botão da gaveta */}
      <div className="barra-movel">
        <Link href="/" className="marca"><span className="marca-sinal" aria-hidden="true">AV</span><span>Anatomia do Voto</span></Link>
        <button type="button" className="barra-botao" data-abre-busca="" onClick={(e) => abrirBusca(e.currentTarget)} aria-label="Buscar (Ctrl K)">
          <Icone nome="buscar" />
        </button>
        <button type="button" className="barra-botao" onClick={() => setGaveta({ aberta: true, caminho })} aria-label="Abrir o menu" aria-expanded={aberta} aria-controls="menu-lateral">
          <Icone nome="menu" />
        </button>
      </div>
      {aberta && <div className="menu-veu" onClick={() => setGaveta({ aberta: false, caminho })} aria-hidden="true" />}

      <aside id="menu-lateral" className="menu" data-aberta={aberta ? "" : undefined} aria-label="Menu">
        <div className="menu-topo">
          <Link href="/" className="marca" aria-label="Anatomia do Voto, página inicial">
            <span className="marca-sinal" aria-hidden="true">AV</span>
            <span className="menu-rotulo marca-nome" aria-hidden="true">Anatomia <span>do Voto</span></span>
          </Link>
          <button type="button" className="barra-botao menu-fechar" onClick={() => setGaveta({ aberta: false, caminho })} aria-label="Fechar o menu">
            <Icone nome="fechar" />
          </button>
        </div>

        <nav aria-label="Principal" className="menu-nav">
          <ul>
            {ITENS.map((it) => {
              const atual = it.ativo(caminho);
              return (
                <li key={it.href}>
                  <Link href={it.href} className="menu-item" data-rotulo={it.rotulo} aria-current={atual && (it.href !== "/analises" || caminho === "/analises") ? "page" : undefined}
                    data-secao={atual ? "" : undefined}>
                    <Icone nome={it.icone} />
                    <span className="menu-rotulo">{it.rotulo}</span>
                  </Link>
                  {it.href === "/analises" && (
                    <ul className="menu-sub">
                      {SUBITENS.map((a) => (
                        <li key={a.href}>
                          <Link href={a.href} className="menu-subitem" aria-current={caminho === a.href ? "page" : undefined}>{a.curto}</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" className="menu-item menu-busca" data-abre-busca="" data-rotulo="Buscar" onClick={(e) => abrirBusca(e.currentTarget)}>
            <Icone nome="buscar" />
            <span className="menu-rotulo">Buscar</span>
            <kbd className="menu-rotulo">Ctrl K</kbd>
          </button>
        </nav>

        <div className="menu-base">
          <ThemeToggle className="tema menu-item" comRotulo />
          <button type="button" className="menu-item menu-recolher" onClick={alternar} data-rotulo={recolhido ? "Expandir o menu" : "Recolher o menu"}
            aria-label={recolhido ? "Expandir o menu" : "Recolher o menu"} aria-expanded={!recolhido} aria-controls="menu-lateral" aria-keyshortcuts="[">
            <Icone nome="recolher" />
            <span className="menu-rotulo" aria-hidden="true">Recolher</span>
            <kbd className="menu-rotulo" aria-hidden="true">[</kbd>
          </button>
        </div>
      </aside>
    </>
  );
}

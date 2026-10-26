"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icone } from "./Icone";

// aberto ou recolhido entre as navegações do mapa: trocar de visão remonta o palco, e o menu não deve mudar sozinho.
// null = a pessoa ainda não escolheu (aberto no computador, recolhido no celular, onde ele cobriria o mapa)
let escolhido: boolean | null = null;
const CELULAR = "(max-width: 1000px)";

interface Props {
  /** o que o mapa mostra agora ("Abstenção × IDHM"); aparece no trilho, com o menu recolhido */
  resumo: string;
  aba: "candidato" | "camadas";
  hrefCandidato: string;
  hrefCamadas: string;
  /** o conteúdo da aba ativa, renderizado no servidor */
  children: ReactNode;
}

/**
 * Menu do mapa, encaixado na lateral esquerda do palco: um <details> (funciona sem JavaScript) com as abas Candidato e
 * Camadas. Recolhido, vira um trilho com o ícone e o que está ligado. As abas e as camadas são links `data-mapa`, que
 * o MapaVivo segue sem recarregar; o estado aberto ou recolhido sobrevive à troca de visão.
 */
export function SubmenuMapa({ resumo, aba, hrefCandidato, hrefCamadas, children }: Props) {
  const [aberto, setAberto] = useState(escolhido ?? true);
  const caixa = useRef<HTMLDetailsElement>(null);
  const abrir = (v: boolean) => { escolhido = v; setAberto(v); };

  // primeira visita no celular: o mapa primeiro. Fecha o <details>, e o onToggle guarda a escolha
  useEffect(() => {
    if (escolhido === null && matchMedia(CELULAR).matches && caixa.current) caixa.current.open = false;
  }, []);

  // a roda do mouse sobre o menu rola só o menu (quando a lista não cabe) e nunca a página: no computador o menu é
  // uma ferramenta ao lado do mapa, e a página não deve fugir enquanto se escolhe uma camada
  useEffect(() => {
    const el = caixa.current!;
    const roda = (e: WheelEvent) => {
      if (matchMedia(CELULAR).matches || !el.open) return;
      const lista = el.querySelector<HTMLElement>(".submenu-conteudo");
      if (e.ctrlKey || (e.target as Element).closest("select")) return;   // zoom da página e listas nativas seguem como sempre
      e.preventDefault();
      if (lista) lista.scrollTop += e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, []);

  return (
    <details ref={caixa} className="submenu" open={aberto} onToggle={(e) => { if (e.currentTarget.open !== aberto) abrir(e.currentTarget.open); }}>
      <summary title={aberto ? "Recolher o menu do mapa" : "Abrir o menu do mapa"}>
        <Icone nome="camadas" className="submenu-icone" />
        <span className="submenu-rotulo">Menu do mapa</span>
        <span className="submenu-resumo">{resumo}</span>
        <Icone nome="recolher" className="submenu-seta" />
      </summary>
      <div className="submenu-painel">
        <nav className="submenu-abas" aria-label="O que o mapa mostra">
          <a href={hrefCandidato} data-mapa="" aria-current={aba === "candidato" ? "true" : undefined}><Icone nome="candidato" />Candidato</a>
          <a href={hrefCamadas} data-mapa="" aria-current={aba === "camadas" ? "true" : undefined}><Icone nome="camadas" />Camadas</a>
        </nav>
        <div className="submenu-conteudo">{children}</div>
      </div>
    </details>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { aproximar, arrastar, LUPA_INICIAL, LUPA_MAX, type Lupa } from "@/lib/lupa";

const svgDe = (el: HTMLElement | null) => el?.querySelector<SVGSVGElement>("svg.mapa-abst") ?? null;

/** Ponto do cursor em unidades do viewBox (o SVG é escalado para caber no palco) e quantas unidades vale 1 px. */
function noMapa(svg: SVGSVGElement, e: { clientX: number; clientY: number }) {
  const m = svg.getScreenCTM()!.inverse();
  const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
  return { x: p.x, y: p.y, porPixel: m.a };
}

/** A lupa é escrita direto no <g class="lupa">: o React não renderiza esse estilo, então não o desfaz ao navegar. */
function desenharLupa(svg: SVGSVGElement | null, l: Lupa, suave: boolean) {
  const g = svg?.querySelector<SVGGElement>(".lupa");
  if (!svg || !g) return;
  svg.toggleAttribute("data-lupa-suave", suave);
  g.style.transform = `translate(${l.x}px, ${l.y}px) scale(${l.k})`;
  svg.style.setProperty("--lupa", String(l.k));
}

/**
 * Casca do mapa:
 * - links marcados com `data-mapa` navegam sem recarregar a página (o zoom e as cores animam em vez de piscar);
 * - o elemento sob o mouse com `data-dica` mostra a dica ao lado do cursor;
 * - com um estado aberto (`estado`), a roda do mouse aproxima e afasta e arrastar move o mapa (a "lupa"), para
 *   alcançar municípios pequenos. Afastar além do enquadramento do estado devolve a roda para a página.
 * São centenas de municípios: um ouvinte só, aqui, em vez de um <Link> por município. Sem JavaScript, os links
 * funcionam como links comuns e o mapa fica no enquadramento do servidor.
 */
export function MapaVivo({ children, className, estado }: { children: React.ReactNode; className?: string; estado?: string }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  const [dica, setDica] = useState<{ texto: string; x: number; y: number } | null>(null);
  // escala da lupa para os botões; vale só para o estado em que foi medida (trocar de estado volta a 1)
  const [escala, setEscala] = useState({ estado, k: 1 });
  const caixa = useRef<HTMLDivElement>(null);
  const atual = useRef<Lupa>(LUPA_INICIAL);
  const arrasto = useRef<{ x: number; y: number; lupa: Lupa; moveu: boolean } | null>(null);
  const ignorarClique = useRef(false);
  const k = escala.estado === estado ? escala.k : 1;

  const aplicar = useCallback((l: Lupa, suave: boolean) => {
    atual.current = l;
    desenharLupa(svgDe(caixa.current), l, suave);
    setEscala({ estado, k: l.k });
  }, [estado]);

  // outro estado (ou o Brasil): a lupa volta, junto com a câmera, ao enquadramento do servidor
  useEffect(() => {
    atual.current = LUPA_INICIAL;
    desenharLupa(svgDe(caixa.current), LUPA_INICIAL, true);
  }, [estado]);

  useEffect(() => {
    const el = caixa.current!;
    const roda = (e: WheelEvent) => {
      const svg = svgDe(el);
      if (!estado || !svg || !(e.target as Element).closest("svg.mapa-abst")) return;
      if (e.deltaY > 0 && atual.current.k <= 1) return;   // já no estado inteiro: a roda rola a página
      e.preventDefault();
      aplicar(aproximar(atual.current, Math.exp(-e.deltaY * 0.002), noMapa(svg, e)), false);
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [estado, aplicar]);

  const clicar = (e: React.MouseEvent) => {
    if (ignorarClique.current) { ignorarClique.current = false; e.preventDefault(); return; }   // fim de um arrasto
    const a = (e.target as Element).closest("a[data-mapa]");
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    setDica(null);
    caixa.current!.setAttribute("data-navegou", "");   // daqui em diante, sem a animação de entrada do mapa
    iniciar(() => router.push(a.getAttribute("href")!, { scroll: false }));
  };
  const apertar = (e: React.PointerEvent) => {
    if (!estado || e.button !== 0 || !(e.target as Element).closest("svg.mapa-abst")) return;
    arrasto.current = { x: e.clientX, y: e.clientY, lupa: atual.current, moveu: false };
  };
  const mover = (e: React.PointerEvent) => {
    const a = arrasto.current, svg = svgDe(caixa.current);
    if (a && svg) {
      const dx = e.clientX - a.x, dy = e.clientY - a.y;
      if (!a.moveu && Math.hypot(dx, dy) < 5) return;   // abaixo disso ainda é um clique
      if (!a.moveu) { a.moveu = true; caixa.current!.setPointerCapture(e.pointerId); setDica(null); }
      const { porPixel } = noMapa(svg, e);
      aplicar(arrastar(a.lupa, dx * porPixel, dy * porPixel), false);
      return;
    }
    const alvo = (e.target as Element).closest("[data-dica]");
    const r = caixa.current!.getBoundingClientRect();
    setDica(alvo ? { texto: alvo.getAttribute("data-dica")!, x: e.clientX - r.left, y: e.clientY - r.top } : null);
  };
  const soltar = () => {
    if (arrasto.current?.moveu) ignorarClique.current = true;
    arrasto.current = null;
  };
  const botao = (fator: number) => {
    const s = svgDe(caixa.current)!.viewBox.baseVal;
    aplicar(aproximar(atual.current, fator, { x: s.width / 2, y: s.height / 2 }), true);
  };

  return (
    <div ref={caixa} className={className} onClick={clicar} onPointerDown={apertar} onPointerMove={mover} onPointerUp={soltar}
      onPointerCancel={soltar} onPointerLeave={() => setDica(null)} aria-busy={carregando}>
      {children}
      {estado && (
        <div className="lupa-botoes" role="group" aria-label="Zoom do mapa">
          <button type="button" onClick={() => botao(1.6)} aria-label="Aproximar" disabled={k >= LUPA_MAX}>+</button>
          <button type="button" onClick={() => botao(1 / 1.6)} aria-label="Afastar" disabled={k <= 1}>−</button>
          <button type="button" onClick={() => aplicar(LUPA_INICIAL, true)} aria-label="Ver o estado inteiro" disabled={k <= 1}>⤢</button>
        </div>
      )}
      {estado && <p className="lupa-dica" aria-hidden="true">Role para aproximar · arraste para mover</p>}
      {dica && <div className="dica-mapa" aria-hidden="true" style={{ left: dica.x, top: dica.y }}>{dica.texto}</div>}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { aproximar, arrastar, LUPA_INICIAL, LUPA_MAX, type Lupa } from "@/lib/lupa";
import { lerFicha, posicionarDica, type FichaDica } from "@/lib/dica";

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

/** Cartão da dica: nome e recorte, a casa da legenda 3 × 3 (no cruzamento) e cada medida com a régua das cores do mapa. */
function CartaoDica({ ficha, texto }: { ficha: FichaDica | null; texto: string }) {
  if (!ficha) return <>{texto}</>;
  return (
    <>
      <div className="dica-cab">
        <div>
          <b className="dica-titulo">{ficha.titulo}</b>
          <span className="dica-sub">{ficha.sub}</span>
        </div>
        {ficha.celula && (
          <span className="dica-celula">
            {[2, 1, 0].flatMap((i) => [0, 1, 2].map((a) => <i key={`${i}${a}`} className={`b${i}${a}${ficha.celula === `b${i}${a}` ? " on" : ""}`} />))}
          </span>
        )}
      </div>
      {ficha.medidas.map((m) => (
        <div key={m.rotulo} className="dica-medida">
          <span className="dica-rotulo">{m.rotulo}</span>
          <b>{m.valor}</b>
          {m.cores && m.p != null && (
            <span className="dica-regua">
              {m.cores.map((c) => <i key={c} className={c} />)}
              <em style={{ "--p": m.p } as CSSProperties} />
            </span>
          )}
        </div>
      ))}
    </>
  );
}

/**
 * Casca do mapa:
 * - links marcados com `data-mapa` navegam sem recarregar a página (o zoom e as cores animam em vez de piscar);
 * - o elemento sob o mouse com `data-dica` mostra a dica ao lado do cursor (gráfica, se tiver `data-ficha`); ela é
 *   fixa na janela e vira de lado perto das bordas, para nunca ser cortada (posicionarDica);
 * - com um estado aberto (`estado`), a roda do mouse aproxima e afasta e arrastar move o mapa (a "lupa"), para
 *   alcançar municípios pequenos. Afastar além do enquadramento do estado devolve a roda para a página.
 * São centenas de municípios: um ouvinte só, aqui, em vez de um <Link> por município. Sem JavaScript, os links
 * funcionam como links comuns e o mapa fica no enquadramento do servidor.
 */
export function MapaVivo({ children, className, estado }: { children: React.ReactNode; className?: string; estado?: string }) {
  const router = useRouter();
  const [carregando, iniciar] = useTransition();
  // a dica só renderiza de novo quando muda o elemento sob o cursor; mover o mouse só reposiciona (direto no DOM)
  const [dica, setDica] = useState<{ alvo: Element; texto: string; ficha: FichaDica | null } | null>(null);
  const cartao = useRef<HTMLDivElement>(null);
  const cursor = useRef({ x: 0, y: 0 });
  // escala da lupa para os botões; vale só para o estado em que foi medida (trocar de estado volta a 1)
  const [escala, setEscala] = useState({ estado, k: 1 });
  const caixa = useRef<HTMLDivElement>(null);
  const atual = useRef<Lupa>(LUPA_INICIAL);
  const arrasto = useRef<{ x: number; y: number; lupa: Lupa; moveu: boolean } | null>(null);
  const ignorarClique = useRef(false);
  const k = escala.estado === estado ? escala.k : 1;

  const posicionar = useCallback(() => {
    const el = cartao.current;
    if (!el) return;
    const janela = { larg: document.documentElement.clientWidth, alt: document.documentElement.clientHeight };
    const p = posicionarDica(cursor.current, { larg: el.offsetWidth, alt: el.offsetHeight }, janela);
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  }, []);
  useLayoutEffect(posicionar, [dica, posicionar]);

  /** Mostra (ou esconde) a dica do elemento em (x, y) da janela. */
  const mostrar = useCallback((sob: Element | null, x: number, y: number) => {
    cursor.current = { x, y };
    const alvo = sob?.closest("[data-dica]") ?? null;
    setDica((d) => (d?.alvo === alvo ? d : alvo ? { alvo, texto: alvo.getAttribute("data-dica")!, ficha: lerFicha(alvo.getAttribute("data-ficha")) } : null));
    posicionar();
  }, [posicionar]);

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
      mostrar(document.elementFromPoint(e.clientX, e.clientY), e.clientX, e.clientY);   // o mapa andou sob o cursor parado
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [estado, aplicar, mostrar]);

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
    if (e.pointerType === "touch") return;   // no toque não há cursor para seguir: o toque já navega
    mostrar(e.target as Element, e.clientX, e.clientY);
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
      {dica && (
        <div ref={cartao} className={`dica-mapa${dica.ficha ? " rica" : ""}`} aria-hidden="true">
          <CartaoDica ficha={dica.ficha} texto={dica.texto} />
        </div>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface Props {
  /** os anos que a animação percorre (só os que tiveram eleição para o cargo escolhido), em ordem, com o link de cada um */
  passos: { ano: number; href: string }[];
  /** o ano mostrado agora no mapa */
  ano: number;
}

/** Quanto tempo cada eleição fica na tela antes de passar à próxima (a transição das cores leva menos que isso). */
const PAUSA = 1800;

/**
 * Botão que anima a linha do tempo no próprio mapa (pergunta 7): navega de eleição em eleição, mantendo o resto da
 * escolha (cargo, estado, município), e para no último ano. Cada passo só começa depois que o mapa do ano anterior
 * chegou, então uma resposta lenta da API não pula anos. Sem JavaScript, os anos seguem como links comuns.
 */
export function TocarAnos({ passos, ano }: Props) {
  const router = useRouter();
  const botao = useRef<HTMLButtonElement>(null);
  const [tocando, setTocando] = useState(false);
  const [, iniciar] = useTransition();
  const recomecando = useRef(false);   // pediu para tocar do último ano: o efeito espera chegar ao primeiro

  const ir = (href: string) => {
    botao.current?.closest(".palco")?.setAttribute("data-navegou", "");   // como no MapaVivo: as cores mudam sem a entrada do mapa
    iniciar(() => router.push(href, { scroll: false }));
  };

  const i = passos.findIndex((p) => p.ano === ano);
  const ultimo = i === passos.length - 1;

  // o ano chegou: espera a pausa e segue para a próxima eleição do cargo; o passo que leva à última encerra a animação
  useEffect(() => {
    if (!tocando) return;
    if (recomecando.current) { if (i !== 0) return; recomecando.current = false; }
    const prox = passos.findIndex((p) => p.ano > ano);
    const t = setTimeout(() => {
      if (prox < 0) { setTocando(false); return; }
      ir(passos[prox].href);
      if (prox === passos.length - 1) setTocando(false);
    }, prox < 0 ? 0 : PAUSA);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocando, ano]);

  if (passos.length < 2) return null;

  const tocar = () => {
    if (tocando) { setTocando(false); recomecando.current = false; return; }
    setTocando(true);
    // do último ano (ou de um ano sem o cargo), recomeça do primeiro na hora; senão, o efeito avança depois da pausa
    if (i < 0 || ultimo) { recomecando.current = true; ir(passos[0].href); }
  };

  return (
    <button ref={botao} type="button" className="ano tocar" onClick={tocar} aria-pressed={tocando}
      aria-label={tocando ? "Pausar a animação dos anos" : `Animar o mapa de ${passos[0].ano} a ${passos[passos.length - 1].ano}`}>
      <span aria-hidden="true">{tocando ? "❚❚" : "▶"}</span><small>{tocando ? "Pausar" : "Animar"}</small>
    </button>
  );
}

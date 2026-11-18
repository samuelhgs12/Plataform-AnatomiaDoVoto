"use client";

import { useEffect, useState } from "react";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { iniciais } from "@/lib/format";
import { FotoCandidato } from "./FotoCandidato";

/** Campos que cada cadeira leva em data-* (montados em app/legislativo/page.tsx). */
interface Ficha {
  nome: string; partido: string; id: string; faixa: string; faixaRotulo: string; vies: string; gasto: string;
  renovacao: string; eleito: string; bancada: string;
}
/** Largura da ficha em px; a mesma do .dica-cadeira em globals.css. */
const LARGURA_FICHA = 300;

interface Dica { ficha: Ficha; x: number; y: number; abaixo: boolean }

const ler = (el: Element): Ficha => {
  const d = (k: string) => el.getAttribute(`data-${k}`) ?? "";
  return { nome: d("n"), partido: d("s"), id: d("id"), faixa: d("f"), faixaRotulo: d("fr"), vies: d("vies"), gasto: d("g"), renovacao: d("r"), eleito: d("e"), bancada: d("bc") };
};

/**
 * Ficha da cadeira: ao passar o mouse, mostra foto, partido, faixa e valor do viés, gasto de campanha, renovação e a
 * bancada. Sem JS, a cadeira tem o <title> nativo; com JS, os <title> saem (para não aparecerem duas dicas) e esta
 * assume. Lê os data-* das cadeiras do elemento `alvo`, que precisa de position: relative.
 */
export function DicaPlenario({ alvo }: { alvo: string }) {
  const [dica, setDica] = useState<Dica | null>(null);

  useEffect(() => {
    const caixa = document.getElementById(alvo);
    if (!caixa) return;
    caixa.querySelectorAll(".cad > title").forEach((t) => t.remove());
    const sobre = (e: PointerEvent) => {
      const cad = (e.target as Element).closest?.("[data-n]");
      if (!cad) { setDica(null); return; }
      const b = caixa.getBoundingClientRect(), c = cad.getBoundingClientRect();
      const y = c.top - b.top;
      // perto do topo do bloco, a ficha abre para baixo da cadeira, para não sair do bloco
      // a ficha (300 px) fica inteira dentro da caixa do plenário, mesmo nas cadeiras das pontas do arco
      const meia = LARGURA_FICHA / 2 + 4;
      const x = Math.min(Math.max(c.left + c.width / 2 - b.left, meia), b.width - meia);
      setDica({ ficha: ler(cad), x, y: y < 230 ? c.bottom - b.top : y, abaixo: y < 230 });
    };
    const sair = () => setDica(null);
    caixa.addEventListener("pointerover", sobre);
    caixa.addEventListener("pointerleave", sair);
    return () => { caixa.removeEventListener("pointerover", sobre); caixa.removeEventListener("pointerleave", sair); };
  }, [alvo]);

  if (!dica) return null;
  const f = dica.ficha;
  return (
    <div className={`dica-cadeira${dica.abaixo ? " abaixo" : ""}`} style={{ left: dica.x, top: dica.y }} aria-hidden="true">
      <div className="dica-topo">
        <span className="dica-foto">
          <FotoCandidato url={fotoDaPessoa({ id_candidato: Number(f.id) })} alt="" lazy={false}>
            <span className="dica-iniciais">{iniciais(f.nome)}</span>
          </FotoCandidato>
        </span>
        <span className="dica-quem">
          <b>{f.nome}</b>
          <span>{f.partido}</span>
          <span>{f.eleito}</span>
        </span>
      </div>
      <dl className="dica-dados">
        {f.faixaRotulo && <><dt>Viés</dt><dd><span className={`amostra v-${f.faixa}`} />{f.faixaRotulo} · {f.vies}</dd></>}
        <dt>Gasto</dt><dd>{f.gasto}</dd>
        <dt>Mandato</dt><dd>{f.renovacao}</dd>
      </dl>
      <p className="dica-bancada">{f.bancada}</p>
      <p className="dica-acao">Clique para abrir o perfil</p>
    </div>
  );
}

import type { CSSProperties } from "react";
import type { FichaDica } from "@/lib/dica";

/**
 * Cartão de um município ou estado: nome e recorte, a casa da legenda 3 × 3 (no cruzamento) e cada medida com a régua
 * das cores do mapa. O mesmo desenho na dica que segue o cursor (MapaVivo) e na ficha fixa do painel; nela o nome é
 * um título (`titulo="h3"`). Sem ficha, só o texto.
 */
export function CartaoDica({ ficha, texto, titulo }: { ficha: FichaDica | null; texto: string; titulo?: "h3" }) {
  if (!ficha) return <>{texto}</>;
  const Titulo = titulo ?? "b";
  return (
    <>
      <div className="dica-cab">
        <div>
          <Titulo className="dica-titulo">{ficha.titulo}</Titulo>
          <span className="dica-sub">{ficha.sub}</span>
        </div>
        {ficha.celula && (
          <span className="dica-celula">
            {[2, 1, 0].flatMap((i) => [0, 1, 2].map((a) => <i key={`${i}${a}`} className={`b${i}${a}${ficha.celula === `b${i}${a}` ? " on" : ""}`} />))}
          </span>
        )}
      </div>
      {ficha.medidas.length > 0 && (
        <div className="dica-medidas">
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
        </div>
      )}
    </>
  );
}

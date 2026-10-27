import { grupo } from "@/lib/propaganda";
import { ancorasSeta, descricaoSetas, type Seta } from "@/lib/propaganda-geral";

const pct = (v: number) => `${v * 100}%`;

/**
 * "Como mudou": uma linha por tipo, com a trilha de 0 a 100%, um círculo vazado no valor da eleição anterior e uma seta até
 * o valor da escolhida (sem mudança: só o círculo); os dois valores escritos acima e a diferença em pontos à direita.
 * Componente de servidor, sem JS; os dados vêm de setasMudanca (src/lib/propaganda-geral.ts).
 */
export function SetasMudanca({ setas, anoAntes, ano }: { setas: Seta[]; anoAntes: number; ano: number }) {
  return (
    <figure className="p9g-setas">
      <div role="img" aria-label={descricaoSetas(setas, anoAntes, ano)}>
        {setas.map((s) => {
          const ancora = ancorasSeta(s.direcao);
          const [ini, fim] = [Math.min(s.de, s.para), Math.max(s.de, s.para)];
          return (
            <div key={s.grupo} className="p9g-seta" aria-hidden="true">
              <p className="pp-tipo-nome"><i className={grupo(s.grupo).classe} />{s.rotulo}</p>
              <div className={`p9g-seta-meio ${grupo(s.grupo).classe}`}>
                <span className="p9g-seta-valor antes" style={{ left: pct(s.de), transform: ancora.de }}>{s.textoDe}</span>
                {ancora.para && <span className="p9g-seta-valor depois" style={{ left: pct(s.para), transform: ancora.para }}>{s.textoPara}</span>}
                <span className="p9g-seta-trilha">
                  {s.direcao !== "igual" && (
                    <>
                      <i className="p9g-seta-corpo" style={s.direcao === "sobe"
                        ? { left: pct(ini), width: `max(0px, calc(${pct(fim - ini)} - 9px))` }
                        : { left: `calc(${pct(ini)} + 9px)`, width: `max(0px, calc(${pct(fim - ini)} - 9px))` }} />
                      <i className={`p9g-seta-ponta ${s.direcao}`} style={{ left: s.direcao === "sobe" ? `calc(${pct(s.para)} - 9px)` : pct(s.para) }} />
                    </>
                  )}
                  <i className="p9g-seta-circulo" style={{ left: pct(s.de) }} />
                </span>
              </div>
              <p className="p9g-seta-dif">{s.diferenca}</p>
            </div>
          );
        })}
      </div>
    </figure>
  );
}

import { ESTADOS_MAPA, MAPA_ALTURA, MAPA_LARGURA } from "@/lib/brasil-uf";
import { caixaDoContorno } from "@/lib/legislativo";

/**
 * Seletor das Assembleias Legislativas (componente de servidor, sem JS): um botão por estado do projeto com a silhueta
 * dele (malha do IBGE, a mesma do mapa da página inicial), a sigla e o número de cadeiras; ao lado, um mini-mapa do
 * Brasil onde o estado escolhido fica aceso e o que está sob o mouse acende (CSS :has, regras em globals.css).
 */
export function Assembleias({ ufs, atual, href, cadeiras }: {
  ufs: string[];
  atual?: string;
  href: (uf: string) => string;
  /** cadeiras de cada Assembleia no ano escolhido */
  cadeiras: Record<string, number>;
}) {
  const estados = new Map(ESTADOS_MAPA.map((e) => [e.uf, e]));
  return (
    <div className="assembleias">
      <span className="leg-rot">Assembleias</span>
      <div className="assembleias-corpo">
        <ul className="assembleias-lista">
          {ufs.map((uf) => {
            const e = estados.get(uf);
            if (!e) return null;
            const c = caixaDoContorno(e.d);
            const on = atual === uf;
            return (
              <li key={uf}>
                <a href={href(uf)} className={`assembleia${on ? " on" : ""}`} data-uf={uf} aria-current={on ? "true" : undefined}
                  aria-label={`Assembleia Legislativa ${["AP", "ES", "RJ"].includes(uf) ? "do" : "de"} ${e.nome}${cadeiras[uf] ? `, ${cadeiras[uf]} cadeiras` : ""}`}>
                  <svg viewBox={`${c.x} ${c.y} ${c.largura} ${c.altura}`} aria-hidden="true"><path d={e.d} /></svg>
                  <b>{uf}</b>
                  <span>{cadeiras[uf] ? `${cadeiras[uf]} cadeiras` : "sem dado"}</span>
                </a>
              </li>
            );
          })}
        </ul>
        <svg className="assembleias-mapa" viewBox={`0 0 ${MAPA_LARGURA} ${MAPA_ALTURA}`} aria-hidden="true">
          {ESTADOS_MAPA.map((e) => (
            <path key={e.uf} d={e.d} data-uf={e.uf} className={ufs.includes(e.uf) ? (atual === e.uf ? "projeto on" : "projeto") : undefined} />
          ))}
        </svg>
      </div>
    </div>
  );
}

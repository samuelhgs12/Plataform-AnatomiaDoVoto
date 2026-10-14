import { pct } from "@/lib/format";

export interface Fatia { rotulo: string; valor: number; cor: string }

/**
 * Gráfico de pizza em forma de rosca (parte de um todo, até 6 fatias). O número principal vai no centro.
 * Cada fatia tem um <title> (dica ao passar o mouse); a legenda com os valores fica ao lado, na página.
 * As cores vêm de variáveis CSS (--f1...--f5) validadas para daltonismo nos modos claro e escuro.
 */
export function Donut({ fatias, centro, legendaCentro, descricao, tamanho = 240 }: {
  fatias: Fatia[]; centro: string; legendaCentro: string; descricao: string; tamanho?: number;
}) {
  const total = fatias.reduce((a, f) => a + f.valor, 0);
  const R = 100, r = 62, C = 110;   // raio externo, interno e centro (viewBox 220×220)
  let ang = -Math.PI / 2;           // começa no topo e segue no sentido horário
  const ponto = (raio: number, a: number) => `${(C + raio * Math.cos(a)).toFixed(2)} ${(C + raio * Math.sin(a)).toFixed(2)}`;

  const arcos = fatias.filter((f) => f.valor > 0).map((f) => {
    const p = f.valor / total;
    const a0 = ang, a1 = ang + p * 2 * Math.PI;
    ang = a1;
    if (p >= 0.9999) {
      // fatia única: dois semicírculos (um arco SVG não fecha um círculo inteiro)
      const d = `M ${ponto(R, -Math.PI / 2)} A ${R} ${R} 0 1 1 ${ponto(R, Math.PI / 2)} A ${R} ${R} 0 1 1 ${ponto(R, -Math.PI / 2)} `
        + `M ${ponto(r, -Math.PI / 2)} A ${r} ${r} 0 1 0 ${ponto(r, Math.PI / 2)} A ${r} ${r} 0 1 0 ${ponto(r, -Math.PI / 2)} Z`;
      return { f, p, d };
    }
    const grande = a1 - a0 > Math.PI ? 1 : 0;
    const d = `M ${ponto(R, a0)} A ${R} ${R} 0 ${grande} 1 ${ponto(R, a1)} L ${ponto(r, a1)} A ${r} ${r} 0 ${grande} 0 ${ponto(r, a0)} Z`;
    return { f, p, d };
  });

  return (
    <figure className="donut" style={{ maxWidth: tamanho }}>
      <svg viewBox="0 0 220 220" role="img" aria-label={descricao}>
        {total <= 0 ? <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="var(--line)" strokeWidth={R - r} /> : arcos.map(({ f, p, d }) => (
          <path key={f.rotulo} d={d} fill={f.cor} fillRule="evenodd" className="fatia">
            <title>{`${f.rotulo}: ${pct(p)}`}</title>
          </path>
        ))}
        <text x={C} y={C + 4} textAnchor="middle" className="donut-num">{centro}</text>
        <text x={C} y={C + 26} textAnchor="middle" className="donut-leg">{legendaCentro}</text>
      </svg>
    </figure>
  );
}

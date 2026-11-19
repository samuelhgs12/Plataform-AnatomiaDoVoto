import { nomeProprio } from "@/lib/abstencao";
import { inteiro } from "@/lib/format";
import { marcasLog, naEscalaLog, valorTipico, type Classificado } from "@/lib/patrimonio";

const L = 480, A = 300, ESQ = 58, SEM = 34, DIR = 10, TOPO = 12, BASE = 30;

/**
 * Os candidatos de uma cidade num só gráfico: x = patrimônio declarado em escala de 10 em 10 (os sem bens numa coluna à
 * parte, à esquerda), y = posição nos votos (o mais votado em cima). Eleito = losango cheio; não eleito = círculo vazado.
 * Cada ponto tem um <title> (passar o mouse ou tocar mostra o nome). Componente de servidor, sem JS.
 */
export function DispersaoPatrimonio({ cls, titulo }: { cls: Classificado[]; titulo: string }) {
  if (cls.length < 2) return null;
  const { min, max, marcas } = marcasLog(cls.map((c) => c.patrimonio));
  const n = Math.max(...cls.map((c) => c.posVotos));
  const x0 = ESQ + SEM, larg = L - x0 - DIR, alt = A - TOPO - BASE;
  const x = (v: number) => x0 + naEscalaLog(v, min, max) * larg;
  const y = (pos: number) => TOPO + (n > 1 ? ((pos - 1) / (n - 1)) * alt : alt / 2);
  // os sem bens se espalham um pouco na coluna deles, pelo id (estável), para não virarem um traço só
  const xs = (c: Classificado) => (c.patrimonio > 0 ? x(c.patrimonio) : ESQ + 6 + (c.id_candidatura % 17) * ((SEM - 12) / 16));
  const eleitos = cls.filter((c) => c.eleito).length;
  const ordem = [...cls].sort((a, b) => Number(a.eleito) - Number(b.eleito));   // os eleitos por cima
  return (
    <figure className="dispersao-p2">
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={`${titulo}: ${cls.length} candidatos, ${eleitos} eleitos. Cada ponto é um candidato: à direita, mais patrimônio; em cima, mais votos.`}>
        <rect className="dp-sem" x={ESQ} y={TOPO} width={SEM - 4} height={alt} rx={3} />
        {marcas.map((m) => (
          <g key={m.valor} className="dp-marca">
            <line x1={x(m.valor)} x2={x(m.valor)} y1={TOPO} y2={TOPO + alt} />
            <text x={x(m.valor)} y={A - 12}>{m.rotulo.replace("R$ ", "")}</text>
          </g>
        ))}
        <text className="dp-eixo" x={ESQ + (SEM - 4) / 2} y={A - 12}>0</text>
        <text className="dp-eixo dp-y" x={ESQ - 8} y={TOPO + 8}>1º</text>
        <text className="dp-eixo dp-y" x={ESQ - 8} y={TOPO + alt}>{inteiro(n)}º</text>
        <text className="dp-eixo dp-y" x={ESQ - 8} y={TOPO + alt / 2}>votos</text>
        {ordem.map((c) => {
          const cx = xs(c), cy = y(c.posVotos);
          const dica = `${nomeProprio(c.nome_urna ?? "Sem nome")} (${c.partido ?? "?"}): ${c.patrimonio > 0 ? valorTipico(c.patrimonio) : "sem bens"}, ${c.posVotos}º em votos (${inteiro(c.votos)}), ${c.eleito ? "eleito" : "não eleito"}${c.tinha_cargo ? ", já tinha o cargo" : ""}`;
          return c.eleito
            ? <path key={c.id_candidatura} className="dp-eleito" d={`M${cx} ${cy - 5}L${cx + 5} ${cy}L${cx} ${cy + 5}L${cx - 5} ${cy}Z`}><title>{dica}</title></path>
            : <circle key={c.id_candidatura} className="dp-nao" cx={cx} cy={cy} r={3}><title>{dica}</title></circle>;
        })}
      </svg>
      <figcaption className="dp-legenda">
        <span><svg width="12" height="12" aria-hidden="true"><path className="dp-eleito" d="M6 1L11 6L6 11L1 6Z" /></svg>eleito</span>
        <span><svg width="12" height="12" aria-hidden="true"><circle className="dp-nao" cx="6" cy="6" r="3.5" /></svg>não eleito</span>
        <span>à esquerda, a coluna dos sem bens · patrimônio em reais, de 10 em 10</span>
      </figcaption>
    </figure>
  );
}

import type { Metodologia } from "@/lib/metodologia";

// Ilustrações da /sobre: diagramas da ideia de cada medida, sem nenhum dado real (nada de resultado copiado das análises).

/** A medida principal como fração: resultado = parcela de cima ÷ parcela de baixo. */
export function Formula({ f }: { f: NonNullable<Metodologia["formula"]> }) {
  const [cima, baixo] = f.parcelas;
  return (
    <figure className="formula" role="img" aria-label={`${f.resultado} = ${cima} ${f.operador} ${baixo}`}>
      <span className="formula-resultado">{f.resultado} =</span>
      <span className="formula-fracao"><span>{cima}</span><i /><span>{baixo}</span></span>
    </figure>
  );
}

/** O mapa: as cinco cores dos quintos e a grade 3 × 3 do comparativo, com as cores do próprio mapa. */
export function IdeiaMapa() {
  return (
    <div className="ideia-mapa paleta-mapa">
      <figure role="img" aria-label="Quintos: cinco cores, cada uma com um quinto dos municípios, da menor para a maior abstenção.">
        <div className="ideia-quintos">{[0, 1, 2, 3, 4].map((q) => <i key={q} style={{ background: `var(--q${q})` }} />)}</div>
        <figcaption><span>menor abstenção</span><span>maior</span></figcaption>
      </figure>
      <figure role="img" aria-label="Comparativo: uma grade de 3 por 3. Na horizontal, o terço da abstenção no estado; na vertical, o terço do indicador do Censo. Cada município recebe a cor da casa onde cai.">
        <div className="ideia-grade">
          {[2, 1, 0].flatMap((i) => [0, 1, 2].map((a) => <i key={`${i}${a}`} style={{ background: `var(--b${i}${a})` }} />))}
        </div>
        <figcaption><span>abstenção →</span><span>indicador ↑</span></figcaption>
      </figure>
    </div>
  );
}

/** Pergunta 9: a propaganda de uma campanha repartida nos três tipos, com a marca da típica (partes iguais: é só a ideia). */
export function IdeiaPropaganda() {
  const tipos = [["pp-fis", "impresso e de rua"], ["pp-av", "rádio, TV e vídeo"], ["pp-dig", "internet"]];
  return (
    <figure className="ideia-propaganda" role="img" aria-label="Ideia da medida: o total de propaganda de uma campanha dividido em três tipos (impresso e de rua; rádio, TV e vídeo; internet), comparado com a parcela típica, a mediana das campanhas do mesmo cargo, ano e estado.">
      <div className="ideia-barra">{tipos.map(([c, t]) => <span key={c}><i style={{ background: `var(--${c})` }} />{t}</span>)}</div>
      <p className="muted pequeno">100% da propaganda de uma campanha; a típica é a mediana de cada parte no cargo, ano e estado.</p>
    </figure>
  );
}

/** Pergunta 10: a linha do tempo, com a altura do cargo e o ponto cheio para eleito. */
export function IdeiaCarreira() {
  const pts: [number, number, boolean][] = [[0, 3, false], [1, 3, true], [2, 2, true], [3, 1, false], [4, 1, true]];
  const x = (i: number) => 20 + i * 70, y = (n: number) => 20 + (3 - n) * 30;
  return (
    <figure className="ideia-carreira" role="img" aria-label="Ideia da linha do tempo: cada ponto é uma eleição disputada, mais alto quanto mais alto o cargo; ponto cheio é eleito, ponto vazado é não eleito.">
      <svg viewBox="0 0 320 120" aria-hidden="true">
        <path d={pts.map(([i, n], k) => `${k ? "L" : "M"}${x(i)} ${y(n)}`).join(" ")} />
        {pts.map(([i, n, eleito]) => <circle key={i} cx={x(i)} cy={y(n)} r={8} className={eleito ? "cheio" : "vazado"} />)}
      </svg>
      <figcaption><span><i className="cheio" />eleito</span><span><i className="vazado" />não eleito</span><span>mais alto = cargo mais alto</span></figcaption>
    </figure>
  );
}

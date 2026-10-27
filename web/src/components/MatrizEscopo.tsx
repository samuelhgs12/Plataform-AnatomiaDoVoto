import { ANOS_ELEICAO, ESCOPO, escopoEmTexto, type Cobertura } from "@/lib/metodologia";

// "O que existe em cada ano" (/sobre): cada tipo de dado numa linha, um ano de eleição por coluna. A forma diz a origem
// (quadrado cheio = no banco; vazado = dados abertos do TSE, fora do banco; círculo = comparado com o Censo), e cada
// linha diz os anos por escrito, que é o que fica no celular e o que o leitor de tela lê.

const LEGENDA: { c: Cobertura; texto: string }[] = [
  { c: "banco", texto: "No banco do projeto" },
  { c: "externo", texto: "Dados abertos do TSE, fora do banco" },
  { c: "censo", texto: "Ano comparado com o Censo 2010" },
];

export function MatrizEscopo() {
  return (
    <div className="matriz">
      <ul className="matriz-legenda" aria-label="Como ler a matriz">
        {LEGENDA.map((l) => <li key={l.c}><i className={`cob ${l.c}`} aria-hidden="true" />{l.texto}</li>)}
      </ul>
      <div className="matriz-grade">
        <div className="matriz-linha matriz-anos" aria-hidden="true">
          <span />
          {ANOS_ELEICAO.map((a) => <span key={a}>{a}</span>)}
        </div>
        {ESCOPO.map((l) => (
          <div key={l.dado} className="matriz-linha">
            <p className="matriz-dado"><b>{l.dado}</b><span>{escopoEmTexto(l)}</span><small>{l.nota}</small></p>
            {ANOS_ELEICAO.map((a) => <span key={a} className="matriz-cel" aria-hidden="true">{l.anos[a] && <i className={`cob ${l.anos[a]}`} />}</span>)}
          </div>
        ))}
      </div>
      <p className="muted pequeno">Anos de eleição geral e municipal, de dois em dois. Valores de dinheiro, quando existem, estão em reais da época.</p>
    </div>
  );
}

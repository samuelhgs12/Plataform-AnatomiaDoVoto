import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Análises" };

export default function Analises() {
  return (
    <>
      <h1>Análises</h1>
      <p className="muted">Resultados agregados. Para ver uma pessoa, use a busca ou a listagem de candidatos.</p>
      <div className="cards3">
        <Link href="/analises/pos-mandato" className="card card-link"><h3>Depois de um mandato</h3><p className="muted">Reeleição, mudança de cargo, derrota ou saída.</p></Link>
        <Link href="/analises/legenda" className="card card-link"><h3>Voto de legenda</h3><p className="muted">Série histórica por partido e UF, comparação entre ciclos e mudanças nos partidos (2018–2024).</p></Link>
        <Link href="/analises/financiamento" className="card card-link"><h3>Dinheiro público e sucesso eleitoral</h3><p className="muted">Quem recebe mais dinheiro público se elege mais? De 2018 a 2024.</p></Link>
      </div>
      <p className="muted" style={{ marginTop: 18 }}>Próximas: retenção por turma de estreia, trocas de partido, propaganda por cargo e IBGE.</p>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Análises" };

export default function Analises() {
  return (
    <>
      <h1>Análises</h1>
      <p className="muted">Resultados agregados. Para ver uma pessoa, use a busca ou a listagem de candidatos.</p>
      <div className="cards3">
        <Link href="/analises/pos-mandato" className="card card-link"><div className="kicker">Pergunta 10</div><h3>Depois de um mandato</h3><p className="muted">Reeleição, mudança de cargo, derrota ou saída.</p></Link>
        <Link href="/analises/legenda" className="card card-link"><div className="kicker">Pergunta 5</div><h3>Votos de legenda</h3><p className="muted">Por partido, cargo e ano.</p></Link>
        <Link href="/analises/financiamento" className="card card-link"><div className="kicker">Pergunta 8</div><h3>Dinheiro público e sucesso eleitoral</h3><p className="muted">Quem recebe mais dinheiro público se elege mais? De 2018 a 2024.</p></Link>
      </div>
      <p className="muted" style={{ marginTop: 18 }}>Próximas: retenção por turma de estreia, trocas de partido, propaganda por cargo e IBGE.</p>
    </>
  );
}

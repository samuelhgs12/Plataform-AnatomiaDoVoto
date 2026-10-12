import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sobre os dados" };

export default function Sobre() {
  return (
    <>
      <h1>Sobre os dados</h1>
      <div className="card">
        <h2>Fonte e escopo</h2>
        <p>Dados abertos do Tribunal Superior Eleitoral (TSE): candidaturas, votação, prestação de contas e eleitorado, de 1998 a 2024, para AP, ES, MG, PE, RJ e RR. Cargos: presidente, governador, senador, deputados federal e estadual, prefeito e vereador (e seus vices e suplentes). O Conselheiro Distrital de Fernando de Noronha ficou fora do escopo.</p>
        <p className="muted">Projeto acadêmico da disciplina de Banco de Dados, UFPI. Não é uma fonte oficial.</p>
      </div>
      <div className="card">
        <h2>Como lemos os dados</h2>
        <ul>
          <li>Só entram eleições <b>ordinárias</b> e candidaturas de <b>titulares</b> nas análises; vices e suplentes só têm resultado a partir de 2022.</li>
          <li>Em 2024 o TSE não divulgou a situação do registro; usamos o resultado para saber quem disputou.</li>
          <li>Gastos: prestação final (ou regularização da omissão), sem transferências para outros candidatos ou partidos.</li>
          <li>A carreira de uma pessoa é seguida por um identificador interno; a turma de 1998 inclui quem já tinha carreira antes.</li>
        </ul>
      </div>
      <div className="card">
        <h2>Privacidade</h2>
        <p>Os dados são públicos, mas não exibimos título eleitoral, CPF, data de nascimento nem documentos de doadores. Para pedir uma correção, entre em contato com a equipe (TODO: e-mail do grupo).</p>
      </div>
    </>
  );
}

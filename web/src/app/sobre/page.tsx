import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Sobre os dados" };

export default function Sobre() {
  return (
    <>
      <Cabecalho titulo="Sobre os dados" foto={FOTOS.interior}>
        <p className="lead">Dados abertos do Tribunal Superior Eleitoral, de 1998 a 2024, em seis estados. Projeto acadêmico da disciplina de Banco de Dados da UFPI; não é uma fonte oficial.</p>
      </Cabecalho>
      <div className="quadro">
        <section className="bloco s4" aria-labelledby="h-fonte">
          <h2 id="h-fonte">Fonte e escopo</h2>
          <p>Candidaturas, votação, prestação de contas e eleitorado, de 1998 a 2024, para AP, ES, MG, PE, RJ e RR.</p>
          <p>Cargos: presidente, governador, senador, deputados federal e estadual, prefeito e vereador (e seus vices e suplentes). O Conselheiro Distrital de Fernando de Noronha ficou fora do escopo.</p>
        </section>
        <section className="bloco s5" aria-labelledby="h-como">
          <h2 id="h-como">Como lemos os dados</h2>
          <ul className="lista">
            <li>Só entram eleições <b>ordinárias</b> e candidaturas de <b>titulares</b> nas análises; vices e suplentes só têm resultado a partir de 2022.</li>
            <li>Em 2024 o TSE não divulgou a situação do registro; usamos o resultado para saber quem disputou.</li>
            <li>Gastos: prestação final (ou regularização da omissão), sem transferências para outros candidatos ou partidos.</li>
            <li>A carreira de uma pessoa é seguida por um identificador interno; a turma de 1998 inclui quem já tinha carreira antes.</li>
          </ul>
        </section>
        <section className="bloco tinta s3" aria-labelledby="h-priv">
          <h2 id="h-priv">Privacidade</h2>
          <p>Os dados são públicos, mas não exibimos título eleitoral, CPF, data de nascimento nem documentos de doadores.</p>
          <p>Para pedir uma correção, entre em contato com a equipe (TODO: e-mail do grupo).</p>
        </section>
      </div>
    </>
  );
}

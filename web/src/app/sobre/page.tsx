import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { FOTOS } from "@/lib/fotos";
import { CREDITO_FOTOS } from "@/lib/foto-candidato";

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
        <section className="bloco s12" aria-labelledby="h-fotos" id="fotos">
          <h2 id="h-fotos">Fotos dos candidatos</h2>
          <p>As fotos são as que os próprios candidatos entregaram à Justiça Eleitoral no registro da candidatura, publicadas pelo TSE de 2018 em diante. Cada foto é da eleição indicada ao lado dela; candidaturas sem foto mostram as iniciais.</p>
          <p>{CREDITO_FOTOS} Usamos as fotos só para identificar a candidatura: não fazemos reconhecimento facial nem qualquer outro tratamento das imagens.</p>
          <p>Para pedir a remoção de uma foto, entre em contato com a equipe (TODO: e-mail do grupo) informando o nome e o ano da candidatura.</p>
        </section>
      </div>
    </>
  );
}

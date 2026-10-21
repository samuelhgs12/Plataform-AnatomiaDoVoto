import type { Metadata } from "next";
import { Cabecalho } from "@/components/Cabecalho";
import { FaixasAnalises } from "@/components/FaixasAnalises";
import { ANALISES } from "@/lib/analises";
import { FOTOS } from "@/lib/fotos";

export const metadata: Metadata = { title: "Análises" };

export default function Analises() {
  return (
    <>
      <Cabecalho titulo="Análises" foto={FOTOS.itajuba}>
        <p className="lead">Resultados agregados dos seis estados. Para ver uma pessoa, use a busca ou a listagem de candidatos.</p>
      </Cabecalho>
      <FaixasAnalises analises={ANALISES} />
      <p className="muted proximas">Em preparo: retenção por turma de estreia e trocas de partido.</p>
    </>
  );
}

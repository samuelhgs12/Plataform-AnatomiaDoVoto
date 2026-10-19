import Link from "next/link";
import type { Analise } from "@/lib/analises";

/** Lista das análises em faixas de tons alternados; `achados` troca o resumo de uma análise por um número real. */
export function FaixasAnalises({ analises, achados = {}, className = "" }: { analises: Analise[]; achados?: Record<string, string | undefined>; className?: string }) {
  return (
    <ul className={`faixas ${className}`}>
      {analises.map((a) => (
        <li key={a.href}>
          <Link href={a.href}>
            <span className="faixa-pergunta">{a.pergunta}</span>
            <span className="faixa-titulo">{a.titulo}<small>{achados[a.href] ?? a.resumo}</small></span>
            <span className="faixa-seta" aria-hidden="true">→</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

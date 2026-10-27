import Link from "next/link";
import { ABA_PROPAGANDA, hrefAba } from "@/lib/propaganda-geral";

/**
 * As abas da área "Dinheiro nas eleições", logo abaixo dos filtros: "Gasto por vaga" (a página padrão) e "Propaganda" (a
 * visão geral da pergunta 9). Links simples, sem JS; cada um preserva ano, cargo e UF.
 */
export function AbasDinheiro({ filtros, atual }: { filtros: { ano: number; cargo: string; uf: string | null }; atual: "gasto" | "propaganda" }) {
  const abas = [["gasto", "Gasto por vaga", null], ["propaganda", "Propaganda", ABA_PROPAGANDA]] as const;
  return (
    <nav className="chips p9g-abas" aria-label="Assunto">
      {abas.map(([chave, rotulo, aba]) => (
        <Link key={chave} href={hrefAba(filtros, aba)} className={`chip${atual === chave ? " on" : ""}`} aria-current={atual === chave ? "page" : undefined}>
          {rotulo}
        </Link>
      ))}
    </nav>
  );
}

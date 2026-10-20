"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/candidatos", rotulo: "Candidatos", ativo: (p: string) => p.startsWith("/candidato") },
  { href: "/analises", rotulo: "Análises", ativo: (p: string) => p.startsWith("/analises") },
  { href: "/sobre", rotulo: "Sobre os dados", ativo: (p: string) => p === "/sobre" },
];

/** Links do cabeçalho, com a página atual marcada (aria-current). */
export function Navegacao() {
  const caminho = usePathname();
  return LINKS.map((l) => (
    <Link key={l.href} href={l.href} aria-current={l.ativo(caminho) ? "page" : undefined}>{l.rotulo}</Link>
  ));
}

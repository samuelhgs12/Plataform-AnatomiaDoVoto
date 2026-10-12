import { corPartido } from "@/lib/format";

export function PartyChip({ sigla }: { sigla: string | null }) {
  if (!sigla) return null;
  return <span className="party" style={{ background: corPartido(sigla) }}>{sigla}</span>;
}

import { corPartido, iniciais } from "@/lib/format";

/** Não há foto nos dados do TSE que carregamos: usamos as iniciais na cor do partido. */
export function Avatar({ nome, partido }: { nome: string | null; partido: string | null }) {
  return <div className="avatar" style={{ background: corPartido(partido) }} aria-hidden="true">{iniciais(nome)}</div>;
}

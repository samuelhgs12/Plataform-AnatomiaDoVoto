import { corPartido, iniciais } from "@/lib/format";
import { FotoCandidato } from "./FotoCandidato";

/** A foto do candidato (url de src/lib/foto-candidato.ts); sem ela, as iniciais na cor do partido. */
export function Avatar({ nome, partido, foto = null, lazy = true }: { nome: string | null; partido: string | null; foto?: string | null; lazy?: boolean }) {
  return (
    <div className={`avatar${foto ? " com-foto" : ""}`} style={{ background: corPartido(partido) }}>
      <FotoCandidato url={foto} alt={nome ? `Foto de ${nome}` : "Foto do candidato"} lazy={lazy}>
        <span aria-hidden="true">{iniciais(nome)}</span>
      </FotoCandidato>
    </div>
  );
}

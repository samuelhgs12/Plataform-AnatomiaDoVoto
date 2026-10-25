import { Avatar } from "./Avatar";

/**
 * Rosto de um político nas listas de eleitos. Hoje mostra as iniciais na cor do partido (decisão 7 de docs/DECISOES.md:
 * sem foto). `foto` já está aqui para quando a equipe decidir usar as fotos oficiais do TSE: basta passar o endereço.
 */
export function Retrato({ nome, partido, foto }: { nome: string | null; partido: string | null; foto?: string | null }) {
  if (foto) {
    // eslint-disable-next-line @next/next/no-img-element -- foto externa (TSE), sem otimização do Next
    return <img className="avatar retrato" src={foto} alt="" loading="lazy" width={56} height={56} />;
  }
  return <Avatar nome={nome} partido={partido} />;
}

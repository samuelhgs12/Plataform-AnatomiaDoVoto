import Image from "next/image";
import type { Foto } from "@/lib/fotos";

/**
 * Topo das páginas internas: o título num bloco largo (com a pergunta e o texto de apoio) e uma foto ao lado,
 * que abre como persiana. `children` vai embaixo do título (texto, botão).
 */
export function Cabecalho({ titulo, pergunta, foto, children }: { titulo: string; pergunta?: string; foto: Foto; children?: React.ReactNode }) {
  return (
    <section className="quadro cabeca" aria-labelledby="h-pagina">
      <div className="bloco s8 titulo">
        <h1 id="h-pagina">{titulo}</h1>
        {pergunta && <p className="pergunta">{pergunta}</p>}
        {children}
      </div>
      <figure className="bloco foto persiana s4">
        <Image src={foto.src} alt={foto.alt} width={foto.largura} height={foto.altura} sizes="(min-width: 1000px) 33vw, 100vw" preload />
      </figure>
    </section>
  );
}

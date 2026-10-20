import Link from "next/link";

export default function NotFound() {
  return (
    <section className="quadro nao-encontrado" aria-labelledby="h-404">
      <div className="bloco s8 titulo">
        <h1 id="h-404">Não encontrado</h1>
        <p className="lead">Essa página ou esse candidato não existe nos dados.</p>
      </div>
      <Link className="bloco acento s4 acao-bloco" href="/">Voltar ao início →</Link>
    </section>
  );
}

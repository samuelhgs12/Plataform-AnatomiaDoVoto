import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card">
      <h1>Não encontrado</h1>
      <p className="muted">Essa página ou esse candidato não existe nos dados.</p>
      <Link className="btn" href="/">Voltar ao início</Link>
    </div>
  );
}

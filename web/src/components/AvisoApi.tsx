/**
 * Aviso das páginas das perguntas 1, 2 e 8 quando a API não responde: uma frase para quem visita, um botão para tentar
 * de novo (recarrega a página, sem JS) e, menor, a dica para quem roda o projeto.
 */
export function AvisoApi({ voltar }: { voltar: string }) {
  return (
    <div className="card aviso" role="alert">
      <h2>Não conseguimos carregar os dados agora</h2>
      <p>O servidor de dados não respondeu. Isso costuma se resolver em alguns instantes.</p>
      <p><a className="chip on" href={voltar}>Tentar de novo</a></p>
      <p className="muted pequeno">Para quem roda o projeto: a API não respondeu (na pasta <code>api/</code>, <code>uvicorn app.main:app</code>).</p>
    </div>
  );
}

"use client";

import { useState } from "react";
import { SearchBox } from "./SearchBox";

/** Botão que abre a busca por nome. A busca vale para todas as eleições e leva direto ao perfil da pessoa. */
export function BuscaNome() {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" aria-expanded={aberta} aria-controls="painel-busca" onClick={() => setAberta((a) => !a)}>
        {aberta ? "Fechar busca" : "Pesquisar por nome"}
      </button>
      {aberta && (
        <section id="painel-busca" className="card" style={{ flexBasis: "100%" }}>
          <SearchBox autoFocus />
          <p className="muted" style={{ fontSize: 12, margin: "4px 0 0" }}>Procura em todas as eleições de 1998 a 2024, independente dos filtros abaixo.</p>
        </section>
      )}
    </>
  );
}

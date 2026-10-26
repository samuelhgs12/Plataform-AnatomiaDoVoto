"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Foto do candidato vinda de /api/fotos (url de src/lib/foto-candidato.ts). Sem url, ou se a API responder 404, mostra
 * `children` (as iniciais). É cliente só pelo erro da imagem: um 404 que chega antes da hidratação
 * não dispara onError, então o efeito confere se a imagem já falhou.
 */
export function FotoCandidato({ url, alt, lazy = true, children }: { url: string | null; alt: string; lazy?: boolean; children?: ReactNode }) {
  const img = useRef<HTMLImageElement>(null);
  const [falhou, setFalhou] = useState<string | null>(null);   // a url que falhou: trocar de url tenta de novo

  useEffect(() => {
    const i = img.current;
    if (url && i?.complete && i.naturalWidth === 0) setFalhou(url);
  }, [url]);

  if (!url || falhou === url) return <>{children}</>;
  // <img> e não next/image: a imagem já vem pequena e com cache longo da API, sem nada a otimizar
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} className="foto-cand" src={url} alt={alt} loading={lazy ? "lazy" : undefined} decoding="async" onError={() => setFalhou(url)} />;
}

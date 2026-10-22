// Ícones do menu e da busca rápida: desenhados aqui, numa grade de 24 e no mesmo traço, em vez de glifos ou emoji.

const DESENHOS = {
  mapa: <><path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z" /><path d="M9 4.5v13M15 6.6v13" /></>,
  candidatos: <><circle cx="9" cy="8.5" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.9c1.9.8 3.1 2.5 3.5 5.1" /></>,
  analises: <><path d="M4 20V10M10 20V4M16 20v-7M21 20H3" /></>,
  sobre: <><ellipse cx="12" cy="6" rx="7.5" ry="2.8" /><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6" /><path d="M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8" /></>,
  buscar: <><circle cx="10.5" cy="10.5" r="6" /><path d="m15 15 5.5 5.5" /></>,
  recolher: <><rect x="3.5" y="4" width="17" height="16" rx="2.5" /><path d="M9.5 4v16" /><path d="m15.5 10-2 2 2 2" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  fechar: <><path d="m6 6 12 12M18 6 6 18" /></>,
  estado: <><path d="M12 21s7-6.1 7-11.5a7 7 0 1 0-14 0C5 14.9 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></>,
  municipio: <><path d="M4 20V9l5-3 5 3v11M14 20V12h6v8M3 20h18" /><path d="M8 12h2M8 15.5h2" /></>,
  pagina: <><path d="M6.5 3.5h7l4 4v13h-11z" /><path d="M13.5 3.5v4h4M9 12.5h6M9 16h6" /></>,
  candidato: <><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" /></>,
} as const;

export type NomeIcone = keyof typeof DESENHOS;

export function Icone({ nome, className }: { nome: NomeIcone; className?: string }) {
  return (
    <svg className={`icone${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {DESENHOS[nome]}
    </svg>
  );
}

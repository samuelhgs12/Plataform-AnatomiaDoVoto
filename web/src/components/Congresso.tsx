/**
 * Seletor do Senado e da Câmara desenhado como o Congresso Nacional (componente de servidor, sem JS): a cúpula virada
 * para baixo é o Senado, a cuia virada para cima é a Câmara, e as duas torres ficam no meio, sobre a plataforma. Cada
 * casa é um link (teclado e leitor de tela incluídos); a escolhida vem preenchida, a outra em contorno.
 */
export function Congresso({ atual, hrefSenado, hrefCamara, cadeirasSenado, cadeirasCamara }: {
  atual: "senado" | "camara" | null;
  hrefSenado: string; hrefCamara: string;
  cadeirasSenado: number; cadeirasCamara: number;
}) {
  const casa = (id: "senado" | "camara") => `congresso-casa${atual === id ? " on" : ""}`;
  return (
    <svg className="congresso" viewBox="0 0 380 152" role="group" aria-label="Escolha a casa do Congresso Nacional">
      {/* plataforma e torres: só desenho */}
      <g className="congresso-base" aria-hidden="true">
        <rect x="14" y="98" width="352" height="9" rx="1.5" />
        <rect x="172" y="12" width="13" height="86" />
        <rect x="195" y="12" width="13" height="86" />
        <rect x="185" y="50" width="10" height="5" />
      </g>
      <a href={hrefSenado} className={casa("senado")} aria-label={`Senado Federal, ${cadeirasSenado} cadeiras`} aria-current={atual === "senado" ? "true" : undefined}>
        <rect className="congresso-alvo" x="30" y="40" width="130" height="108" />
        <path className="congresso-forma" d="M44 98 A51 36 0 0 1 146 98 Z" />
        <text className="congresso-nome" x="95" y="126" textAnchor="middle">Senado</text>
        <text className="congresso-n" x="95" y="145" textAnchor="middle">{cadeirasSenado} cadeiras</text>
      </a>
      <a href={hrefCamara} className={casa("camara")} aria-label={`Câmara dos Deputados, ${cadeirasCamara} cadeiras`} aria-current={atual === "camara" ? "true" : undefined}>
        <rect className="congresso-alvo" x="220" y="40" width="140" height="108" />
        <path className="congresso-forma" d="M224 60 L356 60 C346 88 314 97 290 97 C266 97 234 88 224 60 Z" />
        <rect className="congresso-pe" x="282" y="96" width="16" height="3" aria-hidden="true" />
        <text className="congresso-nome" x="290" y="126" textAnchor="middle">Câmara</text>
        <text className="congresso-n" x="290" y="145" textAnchor="middle">{cadeirasCamara} cadeiras</text>
      </a>
    </svg>
  );
}

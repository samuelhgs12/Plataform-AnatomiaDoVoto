import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { Icone, type NomeIcone } from "./Icone";

/** O que pinta o mapa: o voto de legenda ou a abstenção, sozinha ou cruzada com um indicador do Censo (Comparar). */
export type ModoCamada = "legenda" | "comparar";

export interface CamadaLegenda {
  /** anos em que a camada existe, para a linha de apoio ("2018 a 2024") */
  anos: string;
  /** só com a legenda escolhida: o cargo (nos anos gerais) e o partido */
  cargos: { rotulo: string; href: string; on: boolean }[];
  partido?: { opcoes: [string, string][]; atual?: string; params: Record<string, string> };
}

export interface CamadaComparativos {
  /** o Censo do ano mostrado; undefined fora dos anos de Censo */
  censo?: number;
  /** o indicador escolhido tem `on`; o href dele desmarca (volta à abstenção sozinha) */
  itens: { chave: string; rotulo: string; href: string; on: boolean }[];
  disponivel: boolean;
  /** por que a camada não pinta o mapa agora (ano sem Censo, nenhum estado aberto) */
  motivo: string | null;
  /** fora dos anos do Censo: atalhos para eles */
  anos: { ano: number; href: string }[];
}

const MODOS: { chave: ModoCamada; rotulo: string; icone: NomeIcone }[] = [
  { chave: "legenda", rotulo: "Legenda", icone: "legenda" },
  { chave: "comparar", rotulo: "Comparar", icone: "comparar" },
];

/**
 * Conteúdo da aba Camadas do submenu. O mapa pinta uma coisa de cada vez, então a escolha é única nos dois níveis: um
 * controle segmentado escolhe o modo (legenda ou comparação) e, dentro dele, segmentos (cargo) ou uma lista de rádio
 * (indicador) escolhem a variante. Comparar começa sem indicador, com a abstenção sozinha; clicar de novo no indicador
 * escolhido o desmarca. Tudo é link `data-mapa` (escolher é navegar, sem JavaScript); a opção escolhida tem
 * `aria-current`. Só desenha: os links e as situações chegam prontos da página.
 */
export function CamadasMapa({ modo, hrefs, legenda, comparativos }: { modo: ModoCamada; hrefs: Record<ModoCamada, string>; legenda: CamadaLegenda; comparativos: CamadaComparativos }) {
  return (
    <div className="camadas">
      <nav className="segmentos camadas-modos" aria-label="O que pinta o mapa">
        {MODOS.map((m) => (
          <a key={m.chave} href={hrefs[m.chave]} data-mapa="" aria-current={m.chave === modo ? "true" : undefined}>
            <Icone nome={m.icone} />{m.rotulo}
          </a>
        ))}
      </nav>

      {modo === "legenda" && (
        <div className="camadas-opcoes">
          <p className="camadas-apoio">Votos dados só ao partido, sem escolher candidato, por estado · {legenda.anos}</p>
          {legenda.cargos.length > 0 && (
            <nav className="segmentos segmentos-pequenos" aria-label="Deputados">
              {legenda.cargos.map((c) => (
                <a key={c.rotulo} href={c.href} data-mapa="" aria-current={c.on ? "true" : undefined}>{c.rotulo}</a>
              ))}
            </nav>
          )}
          {legenda.partido && (
            <EscolhaMunicipio nome="p" rotulo="Partido" vazio="Todos os partidos" opcoes={legenda.partido.opcoes} atual={legenda.partido.atual} params={legenda.partido.params} />
          )}
        </div>
      )}

      {modo === "comparar" && (
        <div className="camadas-opcoes">
          {comparativos.disponivel ? (
            <>
              <p className="camadas-apoio">
                {comparativos.itens.some((i) => i.on)
                  ? `A abstenção cruzada com um indicador do Censo ${comparativos.censo}, em 3 × 3 cores. Clique de novo nele para ver só a abstenção.`
                  : `O mapa mostra a abstenção. Escolha um indicador do Censo ${comparativos.censo} para cruzar com ela, em 3 × 3 cores:`}
              </p>
              <nav className="radios" aria-label={`Indicador do Censo ${comparativos.censo}`}>
                {comparativos.itens.map((i) => (
                  <a key={i.chave} href={i.href} data-mapa="" aria-current={i.on ? "true" : undefined}>
                    <span className="radio" aria-hidden="true" />{i.rotulo}
                  </a>
                ))}
              </nav>
              {comparativos.motivo && comparativos.itens.some((i) => i.on) && <p className="camada-aviso">{comparativos.motivo}</p>}
            </>
          ) : (
            <>
              <p className="camadas-apoio">O mapa mostra a abstenção.</p>
              <div className="camada-aviso">
                <p>{comparativos.motivo}</p>
                <div className="chips">{comparativos.anos.map((a) => <a key={a.ano} className="chip" href={a.href} data-mapa="">Ver {a.ano}</a>)}</div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

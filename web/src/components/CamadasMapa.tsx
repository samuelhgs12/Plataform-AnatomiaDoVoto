import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { Icone } from "./Icone";

export interface CamadaLegenda {
  ligada: boolean;
  /** liga ou desliga (volta à abstenção) */
  href: string;
  /** anos em que a camada existe, para a linha de apoio ("2018 a 2024") */
  anos: string;
  /** só com a camada ligada: o cargo (nos anos gerais) e o partido */
  cargos: { rotulo: string; href: string; on: boolean }[];
  partido?: { opcoes: [string, string][]; atual?: string; params: Record<string, string> };
}

export interface CamadaComparativos {
  itens: { chave: string; rotulo: string; href: string; on: boolean }[];
  disponivel: boolean;
  /** por que a camada não pinta o mapa agora (ano sem Censo, nenhum estado aberto) */
  motivo: string | null;
  /** fora dos anos do Censo: atalhos para eles */
  anos: { ano: number; href: string }[];
}

/** Uma linha de camada: o interruptor desenhado, o nome e uma linha de apoio. É um link: ligar é navegar. */
function Camada({ href, on, nome, apoio, icone }: { href: string; on: boolean; nome: string; apoio?: string; icone: "legenda" | "comparar" }) {
  return (
    <a className="camada" href={href} data-mapa="" aria-current={on ? "true" : undefined}>
      <span className="camada-chave" aria-hidden="true"><i /></span>
      <Icone nome={icone} className="camada-icone" />
      <span className="camada-texto">
        <span className="camada-nome">{nome}</span>
        {apoio && <small>{apoio}</small>}
      </span>
      <span className="sr-only">{on ? " (ligada)" : " (desligada)"}</span>
    </a>
  );
}

/**
 * Conteúdo da aba Camadas do submenu: a abstenção é o mapa base e as camadas são grupos em sanfona (<details>, sem
 * JavaScript). Provisório: "Votos por legenda" e "Comparativos" (abstenção × indicadores do Censo 2010). Só desenha:
 * os links e as situações chegam prontos da página.
 */
export function CamadasMapa({ legenda, comparativos }: { legenda: CamadaLegenda; comparativos: CamadaComparativos }) {
  return (
    <div className="camadas">
      <p className="camadas-base">Mapa base: abstenção, município a município. Ligue uma camada por cima dela.</p>

      <details className="camada-grupo" open>
        <summary><Icone nome="seta" className="camada-grupo-seta" />Votos por legenda</summary>
        <Camada href={legenda.href} on={legenda.ligada} icone="legenda" nome="Voto só no partido" apoio={`Parte dos votos dada só à legenda, por estado · ${legenda.anos}`} />
        {legenda.ligada && (
          <div className="camada-filtros">
            {legenda.cargos.length > 0 && (
              <div className="chips" role="group" aria-label="Deputados">
                {legenda.cargos.map((c) => (
                  <a key={c.rotulo} href={c.href} data-mapa="" className={`chip${c.on ? " on" : ""}`} aria-current={c.on ? "true" : undefined}>{c.rotulo}</a>
                ))}
              </div>
            )}
            {legenda.partido && (
              <EscolhaMunicipio nome="p" rotulo="Partido" vazio="Todos os partidos" opcoes={legenda.partido.opcoes} atual={legenda.partido.atual} params={legenda.partido.params} />
            )}
          </div>
        )}
      </details>

      <details className="camada-grupo" open>
        <summary><Icone nome="seta" className="camada-grupo-seta" />Comparativos</summary>
        <p className="camada-apoio">A abstenção cruzada com um indicador do Censo 2010, em 3 × 3 cores. Escolha o indicador:</p>
        {comparativos.disponivel ? (
          <>
            {comparativos.itens.map((i) => (
              <Camada key={i.chave} href={i.href} on={i.on} icone="comparar" nome={i.rotulo} />
            ))}
            {comparativos.motivo && comparativos.itens.some((i) => i.on) && <p className="camada-aviso">{comparativos.motivo}</p>}
          </>
        ) : (
          <div className="camada-aviso">
            <p>{comparativos.motivo}</p>
            <div className="chips">{comparativos.anos.map((a) => <a key={a.ano} className="chip" href={a.href} data-mapa="">Ver {a.ano}</a>)}</div>
          </div>
        )}
      </details>
    </div>
  );
}

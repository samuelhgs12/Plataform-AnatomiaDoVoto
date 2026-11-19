import { EscolhaMunicipio } from "./EscolhaMunicipio";
import { Icone, type NomeIcone } from "./Icone";

/** O que pinta o mapa: o voto de legenda, uma comparação (Comparar) ou o gasto das campanhas por vaga (Dinheiro). */
export type ModoCamada = "legenda" | "comparar" | "dinheiro";
/** As sub-abas de Comparar: a abstenção (sozinha ou cruzada com um indicador do Censo) ou a instrução da população x a
 *  dos eleitos. Abstenção é a padrão. */
export type SubComparar = "abstencao" | "instrucao";

export interface CamadaLegenda {
  /** anos em que a camada existe, para a linha de apoio ("2018 a 2024") */
  anos: string;
  /** só com a legenda escolhida: o cargo (nos anos gerais) e o partido */
  cargos: { rotulo: string; href: string; on: boolean }[];
  partido?: { opcoes: [string, string][]; atual?: string; params: Record<string, string> };
  /** somar os partidos que se fundiram ao atual (DEM e PSL → UNIÃO); o link liga ou desliga */
  juntar?: { on: boolean; href: string };
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

/** Uma lista de escolha que aplica na hora (EscolhaMunicipio): as opções, a atual e os outros filtros, que ela mantém. */
type Lista = { opcoes: [string, string][]; atual?: string; params: Record<string, string> };

/**
 * Camada Dinheiro (perguntas 1, 2, 8 e 9), com os mesmos filtros da análise (a eleição fica nos anos embaixo do mapa): o cargo, o estado, a cidade
 * (municipais, com um estado escolhido) e o porte da cidade (municipais).
 */
export interface CamadaDinheiro {
  cargos: { rotulo: string; href: string; on: boolean }[];
  /** o que pinta o mapa: gasto por vaga, gasto por eleitor ou parte pública */
  pintar?: { rotulo: string; href: string; on: boolean }[];
  estado: Lista;
  cidade?: Lista;
  porte?: Lista;
}

export interface CamadaInstrucao {
  /** anos em que a sub-aba existe, para a linha de apoio ("2020 e 2024") */
  anos: string;
  /** o grau de instrução que pinta o mapa */
  medidas: { chave: string; rotulo: string; href: string; on: boolean }[];
}

const SUBS: { chave: SubComparar; rotulo: string }[] = [
  { chave: "abstencao", rotulo: "Abstenção" },
  { chave: "instrucao", rotulo: "Instrução" },
];

const MODOS: { chave: ModoCamada; rotulo: string; icone: NomeIcone }[] = [
  { chave: "legenda", rotulo: "Legenda", icone: "legenda" },
  { chave: "comparar", rotulo: "Comparar", icone: "comparar" },
  { chave: "dinheiro", rotulo: "Dinheiro", icone: "dinheiro" },
];

/**
 * Conteúdo da aba Camadas do submenu. O mapa pinta uma coisa de cada vez, então a escolha é única nos dois níveis: um
 * controle segmentado escolhe o modo (legenda, comparação ou dinheiro) e, dentro dele, segmentos (cargo, sub-aba de Comparar) ou
 * uma lista de rádio (indicador, grau de instrução) escolhem a variante. Comparar abre na
 * sub-aba Abstenção, sem indicador (a abstenção sozinha); clicar de novo no indicador escolhido o desmarca. Tudo é link `data-mapa` (escolher é navegar, sem JavaScript); a opção escolhida tem
 * `aria-current`. Só desenha: os links e as situações chegam prontos da página.
 */
export function CamadasMapa({ modo, hrefs, legenda, comparar, comparativos, instrucao, dinheiro }: {
  modo: ModoCamada; hrefs: Record<ModoCamada, string>; legenda: CamadaLegenda;
  comparar: { sub: SubComparar; hrefs: Record<SubComparar, string> }; comparativos: CamadaComparativos; instrucao: CamadaInstrucao;
  dinheiro?: CamadaDinheiro;
}) {
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
          {legenda.juntar && (
            <nav className="radios" aria-label="Fusões de partidos">
              <a href={legenda.juntar.href} data-mapa="" aria-current={legenda.juntar.on ? "true" : undefined}>
                <span className="radio marca" aria-hidden="true" />Juntar partidos que se fundiram
              </a>
            </nav>
          )}
          {legenda.partido && (
            <EscolhaMunicipio nome="p" rotulo="Partido" vazio="Todos os partidos" opcoes={legenda.partido.opcoes} atual={legenda.partido.atual} params={legenda.partido.params} />
          )}
        </div>
      )}

      {modo === "dinheiro" && dinheiro && (
        <div className="camadas-opcoes">
          <p className="camadas-apoio">Dinheiro das campanhas e patrimônio dos candidatos. Escolha o cargo, a pergunta e o lugar aqui ou clique no mapa; a eleição fica embaixo do mapa.</p>
          <nav className="radios" aria-label="Cargo">
            {dinheiro.cargos.map((c) => (
              <a key={c.rotulo} href={c.href} data-mapa="" aria-current={c.on ? "true" : undefined}>
                <span className="radio" aria-hidden="true" />{c.rotulo}
              </a>
            ))}
          </nav>
          {dinheiro.pintar && (
            <nav className="radios" aria-label="O que pinta o mapa">
              {dinheiro.pintar.map((c) => (
                <a key={c.rotulo} href={c.href} data-mapa="" aria-current={c.on ? "true" : undefined}>{c.rotulo}</a>
              ))}
            </nav>
          )}
          <EscolhaMunicipio nome="uf" rotulo="Estado" vazio="Os seis estados" opcoes={dinheiro.estado.opcoes} atual={dinheiro.estado.atual} params={dinheiro.estado.params} />
          {dinheiro.cidade && (
            <EscolhaMunicipio nome="mun" rotulo="Município" vazio="O estado inteiro" opcoes={dinheiro.cidade.opcoes} atual={dinheiro.cidade.atual} params={dinheiro.cidade.params} />
          )}
          {dinheiro.porte && (
            <EscolhaMunicipio nome="porte" rotulo="Porte da cidade" vazio="Todos os portes" opcoes={dinheiro.porte.opcoes} atual={dinheiro.porte.atual} params={dinheiro.porte.params} />
          )}
          {!dinheiro.estado.atual && <p className="camadas-apoio">Selecione um estado no mapa ou na lista para ver os dados.</p>}
        </div>
      )}

      {modo === "comparar" && (
        <nav className="segmentos segmentos-pequenos" aria-label="Comparar">
          {SUBS.map((s) => (
            <a key={s.chave} href={comparar.hrefs[s.chave]} data-mapa="" aria-current={s.chave === comparar.sub ? "true" : undefined}>{s.rotulo}</a>
          ))}
        </nav>
      )}

      {modo === "comparar" && comparar.sub === "instrucao" && (
        <div className="camadas-opcoes">
          <p className="camadas-apoio">A cor é a parte da população de 18 anos ou mais (Censo 2022) com o grau escolhido.</p>
          <nav className="radios" aria-label="Grau de instrução">
            {instrucao.medidas.map((m) => (
              <a key={m.chave} href={m.href} data-mapa="" aria-current={m.on ? "true" : undefined}>
                <span className="radio" aria-hidden="true" />{m.rotulo}
              </a>
            ))}
          </nav>
        </div>
      )}

      {modo === "comparar" && comparar.sub === "abstencao" && (
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

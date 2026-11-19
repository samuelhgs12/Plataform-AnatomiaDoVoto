import Link from "next/link";
import { fotoDaPessoa } from "@/lib/foto-candidato";
import { fotoDoDinheiro } from "@/lib/foto-dinheiro";
import { custoPorVoto } from "@/lib/dinheiro";
import { brlCentavos, inteiro, pct, reais } from "@/lib/format";
import { Avatar } from "./Avatar";
import { FotoCandidato } from "./FotoCandidato";
import { PartyChip } from "./PartyChip";
import { AbrirCandidatoDinheiro } from "./DetalhesCandidatoDinheiro";

export interface LinhaCandidato {
  id_candidato: number | null; id_candidatura: number; nome_urna: string | null; partido: string | null;
  votos: number; gasto: number; receita: number; receita_publica: number;
  eleito?: boolean; prestou?: boolean | null; municipio?: string | null; cargo?: string; parteVotos?: number | null; maisGastou?: boolean;
}

/**
 * Candidatos em linhas regulares (como nas listas de apuração): foto | nome e partido | resultado | quanto gastou |
 * quanto recebeu, com a barra pública/privada e os dois valores em reais (mais fácil de ler que porcentagens).
 * Sem prestação de contas final, o valor é "Não informado", e não R$ 0. Componente de servidor (a foto é cliente).
 */
export function LinhasCandidatos({ linhas, ano, vazio, detalhar = false }: { linhas: LinhaCandidato[]; ano: number; vazio: string; detalhar?: boolean }) {
  if (!linhas.length) return <p className="muted pequeno">{vazio}</p>;
  return (
    <ul className="linhas-cand">
      <li className="linhas-cab" aria-hidden="true"><span /><span>Candidato</span><span>Resultado</span><span>Gasto declarado</span><span>{detalhar ? "Por voto" : "Recebeu para a campanha"}</span></li>
      {linhas.map((c) => {
        const semDado = c.prestou === false;
        const nome = c.nome_urna ?? "Sem nome";
        const porVoto = semDado ? null : custoPorVoto(c.gasto, c.votos);
        return (
          <li key={c.id_candidatura}>
            <span className="linhas-foto">
              <FotoCandidato url={detalhar ? fotoDoDinheiro(c) : fotoDaPessoa({ id_candidato: c.id_candidato, ultimo_ano: ano })} alt="">
                <Avatar nome={c.nome_urna} partido={c.partido} />
              </FotoCandidato>
            </span>
            <span className="linhas-nome">
              {detalhar ? <AbrirCandidatoDinheiro candidato={c} ano={ano} /> : c.id_candidato ? <Link href={`/candidato/${c.id_candidato}?campanha=${c.id_candidatura}#dinheiro`}>{nome}</Link> : nome}
              <small><PartyChip sigla={c.partido} />{c.maisGastou && <span className="selo">gastou mais</span>}{c.municipio && <span className="linhas-lugar">{c.municipio}</span>}</small>
            </span>
            <span className="linhas-resultado">
              {c.eleito === undefined ? null : <b className={c.eleito ? "eleito" : undefined}>{c.eleito ? "Eleito" : "Não eleito"}</b>}
              {!detalhar && <small>{c.votos > 0 ? `${inteiro(c.votos)} votos${c.parteVotos != null ? ` (${pct(c.parteVotos, 0)})` : ""}` : "votos não informados"}</small>}
            </span>
            {/* os dois valores juntos: no computador, cada um na sua coluna; no celular, uma faixa de duas colunas */}
            <span className="linhas-valores">
            <span className="linhas-valor">
              {semDado ? <><b>Não informado</b><small>sem prestação de contas</small></> : <><small className="linhas-verbo">Gastou</small><b>{reais(c.gasto)}</b></>}
            </span>
            <span className="linhas-valor">
              {detalhar ? <><small className="linhas-verbo">Por voto</small><b>{porVoto === null ? "Não disponível" : brlCentavos(porVoto)}</b></> : semDado ? <b>Não informado</b> : c.receita <= 0 ? <><small className="linhas-verbo">Recebeu</small><b>R$ 0</b></> : (() => {
                const pub = Math.min(c.receita, c.receita_publica), priv = Math.max(0, c.receita - c.receita_publica);
                return (
                  <>
                    <small className="linhas-verbo">Recebeu</small>
                    <b>{reais(c.receita)}</b>
                    <span className="mini-divisao" aria-hidden="true">
                      <i className="pub" style={{ width: `${Math.round((pub / c.receita) * 100)}%` }} /><i className="priv" style={{ width: `${100 - Math.round((pub / c.receita) * 100)}%` }} />
                    </span>
                    <small><span className="ponto pub" />{reais(pub)} público{priv > 0 && <> · <span className="ponto priv" />{reais(priv)} privado</>}</small>
                  </>
                );
              })()}
            </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

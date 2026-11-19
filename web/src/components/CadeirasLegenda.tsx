import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { inteiro } from "@/lib/format";
import { urlFoto } from "@/lib/foto-candidato";
import {
  nomeProprio, puxadoPor, rotuloPuxador,
  type Disputa, type LinhaCandidato, type ListaCadeiras, type Puxador, type TipoLista,
} from "@/lib/cadeiras";

// Quem puxou quem, na visão de legenda do mapa (deputados, estado escolhido). Componente de servidor: recebe a disputa
// e os puxadores prontos de src/lib/cadeiras.ts e só desenha. Cada cadeira é um quadrado: cheio = pelo quociente,
// tracejado = pelas sobras (a forma diferencia, não só a cor). As fotos vêm de /api/fotos, com as iniciais se faltar.

const decimal = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
// a sigla da lista quebra a linha só nas barras ("PP/PL/SOLIDARIEDADE"), nunca no meio de um partido
const quebraNasBarras = (lista: string) => lista.split("/").join("/\u200b");
const TIPO: Record<TipoLista, string | null> = { partido: null, coligacao: "coligação", federacao: "federação" };

function Foto({ c, tam }: { c: LinhaCandidato; tam: "g" | "p" }) {
  return (
    <span className={`cad-foto ${tam}`}>
      <Avatar nome={nomeProprio(c.nome_urna)} partido={c.partido} foto={urlFoto({ ano: c.ano, ue: c.ue, sequencial: c.sequencial })} />
    </span>
  );
}

function Nome({ c }: { c: LinhaCandidato }) {
  const nome = nomeProprio(c.nome_urna);
  return c.id_candidato ? <Link href={`/candidato/${c.id_candidato}`}>{nome}</Link> : <>{nome}</>;
}

function Assentos({ l }: { l: ListaCadeiras }) {
  return (
    <span className="assentos" role="img" aria-label={`${l.qp} pelo quociente e ${l.media} pelas sobras`}>
      {Array.from({ length: l.qp }, (_, i) => <i key={`q${i}`} className="assento qp" />)}
      {Array.from({ length: l.media }, (_, i) => <i key={`m${i}`} className="assento media" />)}
    </span>
  );
}

function LinhaPuxador({ p }: { p: Puxador }) {
  return (
    <li className="pux" aria-label={rotuloPuxador(p)}>
      <div className="pux-quem">
        <Foto c={p} tam="g" />
        <span className="pux-txt"><b><Nome c={p} /></b><small>{p.partido} · {inteiro(p.votos)} votos</small></span>
        <span className="pux-x">{decimal(p.quocientes)}<small>quocientes</small></span>
      </div>
      <span className="pux-seta" aria-hidden="true">puxou {p.paraOutros} ↓</span>
      <ul className="pux-puxados">
        {p.sentaram.map((s) => (
          <li key={s.id_candidatura}>
            <Foto c={s} tam="p" />
            <span className="pux-txt"><b><Nome c={s} /></b><small>{s.partido} · {inteiro(s.votos)}</small></span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function LinhaLista({ l, puxados }: { l: ListaCadeiras; puxados: Map<number, Puxador> }) {
  return (
    <li>
      <details className="cad-lista">
        <summary>
          <span className="cl-nome"><b>{quebraNasBarras(l.lista)}</b>{TIPO[l.tipo] && <small>{TIPO[l.tipo]}</small>}</span>
          <Assentos l={l} />
          <span className="cl-num">{l.cadeiras}</span>
        </summary>
        <ol className="cl-eleitos">
          {l.eleitos.map((e) => {
            const por = puxados.get(e.id_candidatura);
            return (
              <li key={e.id_candidatura}>
                <Foto c={e} tam="p" />
                <span className="pux-txt"><b><Nome c={e} /></b><small>{e.partido}{por && <> · puxado por {nomeProprio(por.nome_urna)}</>}</small></span>
                {e.resultado === "media" ? <span className="cl-tipo media">sobra</span> : <span />}
                <span className="cl-votos">{inteiro(e.votos)}</span>
              </li>
            );
          })}
          {l.suplente && (
            <li className="cl-suplente">
              <Foto c={l.suplente} tam="p" />
              <span className="pux-txt"><b><Nome c={l.suplente} /></b><small>{l.suplente.partido} · 1º suplente</small></span>
              <span />
              <span className="cl-votos">{inteiro(l.suplente.votos)}</span>
            </li>
          )}
        </ol>
      </details>
    </li>
  );
}

export function QuemPuxouQuem({ disputa, puxadores, cargos }: {
  disputa: Disputa | null; puxadores: Puxador[]; cargos: { rotulo: string; href: string; on: boolean }[];
}) {
  const puxados = puxadoPor(puxadores);
  return (
    <div className="bloco noite s12 quem-puxou">
      <div className="qpq-cab">
        <h3>Quem puxou quem</h3>
        <nav className="segmentos" aria-label="Cargo">
          {cargos.map((c) => <Link key={c.rotulo} scroll={false} href={c.href} aria-current={c.on ? "true" : undefined}>{c.rotulo}</Link>)}
        </nav>
      </div>
      {!disputa || disputa.semResultado ? (
        <p className="muted">O resultado desta eleição ainda não está na base.</p>
      ) : (
        <>
          <p className="muted pequeno">Cada cadeira: <b>{inteiro(disputa.qe)}</b> votos (quociente eleitoral) · {disputa.vagas} vagas</p>
          {puxadores.length > 0 && <ol className="pux-lista">{puxadores.map((p) => <LinhaPuxador key={p.id_candidatura} p={p} />)}</ol>}
          <div className="qpq-sub">
            <h4>Cadeiras por lista</h4>
            <ul className="legenda-assentos" aria-hidden="true">
              <li><i className="assento qp" />quociente</li>
              <li><i className="assento media" />sobra</li>
            </ul>
          </div>
          <ul className="cad-listas">{disputa.listas.map((l) => <LinhaLista key={l.id_lista} l={l} puxados={puxados} />)}</ul>
        </>
      )}
    </div>
  );
}

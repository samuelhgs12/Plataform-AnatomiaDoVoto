import Link from "next/link";
import { setaMedida, type MedidaNosAnos } from "@/lib/dinheiro";

/**
 * O mesmo cargo nas eleições com dados de dinheiro (ex.: vereador em 2020 e 2024), lado a lado: uma linha por medida,
 * uma coluna por ano (barra na escala do maior valor da linha e o número escrito) e a variação do primeiro ao último ano.
 * O ano escolhido fica em destaque; o cabeçalho de cada ano leva a ele. Medidas de `medidasNosAnos` (src/lib/dinheiro.ts).
 * É uma tabela: a leitura não depende da barra. Componente de servidor sem JS.
 */
export function AnosDoCargo({ anos, atual, medidas, hrefAno, titulo }: { anos: number[]; atual: number; medidas: MedidaNosAnos[]; hrefAno: (a: number) => string; titulo: string }) {
  return (
    <div className="tabela-rolar">
      <table className="anos-cargo" aria-label={titulo}>
        <thead>
          <tr>
            <th>Medida</th>
            {anos.map((a) => (
              <th key={a} className={a === atual ? "on" : undefined}>
                <Link href={hrefAno(a)} scroll={false} aria-current={a === atual ? "true" : undefined}>{a}</Link>
              </th>
            ))}
            <th className="num">{anos[0]} → {anos.at(-1)}</th>
          </tr>
        </thead>
        <tbody>
          {medidas.map((m) => {
            const s = setaMedida(m);
            return (
              <tr key={m.chave}>
                <th scope="row">{m.rotulo}</th>
                {m.textos.map((t, i) => (
                  <td key={anos[i]} className={anos[i] === atual ? "on" : undefined}>
                    <span className="ac-trilho" aria-hidden="true"><i style={{ width: `${Math.round(m.partes[i] * 100)}%` }} /></span>
                    <b>{t}</b>
                  </td>
                ))}
                <td className={`num delta${m.variacao === null ? "" : m.variacao > 0 ? " sobe" : m.variacao < 0 ? " desce" : ""}`}>{s ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

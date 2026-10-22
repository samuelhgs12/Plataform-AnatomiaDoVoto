# Esboço das telas

O que cada tela mostra. A aparência (cores, tipografia, layout) está em aberto (`DECISOES.md`); a única decisão de
desenho fechada é que **o mapa é o centro da página inicial**.

Estado: ✅ implementado no esqueleto · 🔲 a fazer.

| Rota | Tela | Estado |
|---|---|---|
| `/` | Início: **mapa da abstenção** no centro (estados → municípios com zoom; ano; painel com a série, os indicadores do Censo 2010 em 2008 e 2012 e a dispersão indicador × abstenção), depois a busca e as análises | ✅ |
| `/candidatos` | Candidatos de uma eleição: padrão = ano mais recente; presidente em ano de eleição geral, prefeito em ano municipal; cargo estadual/municipal sem UF pede a escolha do estado antes de listar. Cards com avatar de iniciais, partido, resultado, votos; paginação | ✅ |
| `/candidato/[id]` | Perfil: cabeçalho + KPIs, carreira (P10), gastos (P9), receitas (P8) | ✅ (💡 custo por voto e percentil: 🔲) |
| `/analises/financiamento` | Recursos públicos × sucesso eleitoral (P8): taxa de eleição por faixa de dinheiro público, parte do dinheiro público com os eleitos, eleito × não eleito típico; contexto: de onde vem o dinheiro, evolução, estados, partidos | ✅ (`/api/analises/q8`) |
| `/analises/pos-mandato` | Fluxo depois do mandato, por UF e ano (P10) | ✅ |
| `/analises/legenda` | Voto de legenda (P5): série histórica por partido e UF, comparação entre ciclos, mudanças nos partidos e tabela | ✅ · 🔲 mapa por município |
| `/analises/retencao` | Retenção por turma de estreia (P10) | 🔲 (dados já em `/api/analises/q10`: `permanencia`) |
| `/analises/trocas` | Trocas de partido por ano e matriz origem × destino (P10) | 🔲 (`/api/analises/q10`: `trocas`) |
| `/analises/propaganda` | Gasto em propaganda por cargo e ano (P9) | 🔲 |
| `/sobre` | Fonte, escopo, como lemos os dados, privacidade | ✅ |

## Perfil do candidato

Cabeçalho com resumo da carreira; carreira eleitoral (P10) com as trocas de partido; gastos de campanha por categoria
com a mediana do mesmo cargo, ano e UF (P9) e as palavras das despesas de propaganda; de onde veio o dinheiro (P8).

## Acessibilidade (pontos de revisão em todo PR)

- Todo gráfico tem texto equivalente (`aria-label`/tabela). Cor nunca é o único código (eleito = ponto **cheio**).
- Contraste mínimo 4,5:1; navegação por teclado nos filtros; `lang="pt-BR"`.

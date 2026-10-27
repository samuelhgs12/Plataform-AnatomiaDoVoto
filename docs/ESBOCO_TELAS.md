# Esboço das telas

O que cada tela mostra. A aparência (cores, tipografia, layout) está em aberto (`DECISOES.md`); a única decisão de
desenho fechada é que **o mapa é o centro da página inicial**.

Estado: ✅ implementado no esqueleto · 🔲 a fazer.

| Rota | Tela | Estado |
|---|---|---|
| `/` | Início: **mapa** no centro com duas visões (`?ver=legenda`). **Abstenção**: estados → municípios com zoom; ano; painel com a série, os indicadores do Censo 2010 em 2008 e 2012 e a dispersão indicador × abstenção. **Voto de legenda** (2018–2024, só por estado): a cor mostra a parte dos votos dada só à legenda, ou, com um partido escolhido (`?p=`), a parte dele entre os votos só na legenda, em faixas fixas; painel com a série, os partidos com mais voto de legenda e o cargo (deputados federal/estadual). Depois, a busca e as análises | ✅ · 🔲 legenda por município |
| `/candidatos` | Candidatos de uma eleição: padrão = ano mais recente; presidente em ano de eleição geral, prefeito em ano municipal; cargo estadual/municipal sem UF pede a escolha do estado antes de listar. Cards com a miniatura da foto do TSE (sem foto, as iniciais), partido, resultado, votos; paginação | ✅ |
| `/candidato/[id]` | Perfil: cabeçalho + KPIs, carreira (P10), receitas (P8), propaganda por categoria (P9) | ✅ (💡 custo por voto e percentil: 🔲) |
| `/analises/financiamento` | Recursos públicos × sucesso eleitoral (P8): taxa de eleição por faixa de dinheiro público, parte do dinheiro público com os eleitos, eleito × não eleito típico; contexto: de onde vem o dinheiro, evolução, estados, partidos | ✅ (`/api/analises/q8`) |
| `/analises/legenda` | Voto de legenda (P5): série histórica por partido e UF, comparação entre ciclos, mudanças nos partidos e tabela | ✅ · 🔲 mapa por município |
| `/analises/retencao` | Retenção por turma de estreia (P10) | 🔲 (dados já em `/api/analises/q10`: `permanencia`) |
| `/analises/trocas` | Trocas de partido por ano e matriz origem × destino (P10) | 🔲 (`/api/analises/q10`: `trocas`) |
| `/sobre` | Cada pergunta respondida e a metodologia dela, em camadas (frase simples, "Como calculamos", "O que isso não mostra", detalhe técnico recolhido com tabelas e SQL); caminho dos dados, matriz anos × dado, regras gerais, o que ficou fora, qualidade, privacidade e fotos. Texto em `src/lib/metodologia.ts` | ✅ |

## Perfil do candidato

Cabeçalho com resumo da carreira; carreira eleitoral (P10) com as trocas de partido; de onde veio o dinheiro (P8); onde
a campanha investiu em propaganda (P9: categorias do TSE, os três tipos e a tabela com os valores exatos). P8 e P9 mostram
a mesma campanha (`?campanha=`). As páginas `/analises/propaganda` e `/analises/pos-mandato` saíram: repetiam a busca de
candidato que o perfil já tem.

## Acessibilidade (pontos de revisão em todo PR)

- Todo gráfico tem texto equivalente (`aria-label`/tabela). Cor nunca é o único código (eleito = ponto **cheio**).
- Contraste mínimo 4,5:1; navegação por teclado nos filtros; `lang="pt-BR"`.

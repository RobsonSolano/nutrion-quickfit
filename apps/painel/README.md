# @quickfit/painel — fase 3

**Ainda não construído.** Esta pasta existe de propósito, vazia.

## Por que a casca existe agora

Se o painel entrasse só na fase 3, `packages/core` seria criado assumindo um único consumidor — e a fronteira do motor sairia errada. Com a casca aqui desde o dia 1, cada import de `@quickfit/core` no totem é escrito sabendo que existe um segundo consumidor. É a diferença entre uma fronteira desenhada e uma fronteira retrofitada.

## O que vai morar aqui

Da spec §10, item 3 — entra quando houver a **segunda academia**. Com uma só, a configuração é feita direto no Supabase Studio, e construir painel antes disso é construir sem saber se academia paga.

| Recurso | Por que precisa do `@quickfit/core` |
|---|---|
| Ligar/desligar equipamento por manutenção | pré-visualiza o treino resultante com `generateWorkout` antes de salvar — é o argumento de venda do *"desligue o Cross Over"* |
| Escolher a cor da academia | `validateAccent` recusa cor abaixo de 4.5:1 e oferece a variante ajustada (spec §6). **Roda aqui, nunca no totem.** |
| Cadastrar exercício próprio da unidade | valida contra o mesmo schema zod de `catalog/` |
| Estatísticas | views sobre `generated_workouts`; nenhuma tabela nova |

## O que NÃO vai morar aqui

Autenticação de aluno. O painel é do gestor; o totem não tem login por desenho (D1/D6).

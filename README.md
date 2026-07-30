# NutriOn QuickFit

Totem de autoatendimento que gera treino personalizado em 3 toques, imprime ficha em cupom e funciona sem internet.

- **Spec:** [`docs/specs/2026-07-28-quickfit-design.md`](docs/specs/2026-07-28-quickfit-design.md) — as 8 decisões travadas, o motor, o schema, as regras de impressão
- **Plano:** [`docs/plans/2026-07-28-quickfit-demo.md`](docs/plans/2026-07-28-quickfit-demo.md) — 18 tarefas da fase 1

Produto separado do Persona Fit: repositório próprio, projeto Supabase próprio, deploy próprio.

## Estrutura

```
packages/core/     motor de geração + catálogo + tipos + tema     ← compartilhado
apps/totem/        kiosk touch, offline-first        (fase 1)
apps/painel/       gestão da academia               (fase 3)
supabase/          migrations, RLS, edge functions
catalog/           CSVs — a fonte de autoria do catálogo
scripts/           export, classificação, seed
```

**Por que monorepo e não dois repositórios.** Totem e painel são deploys separados com públicos opostos, mas ambos precisam do **mesmo** motor. Duplicá-lo faria o código de segurança do produto divergir silenciosamente entre os dois lados. E o painel precisa dele de verdade: o argumento de venda do *"desligue o Cross Over e veja o que muda"* é `generateWorkout` rodando na pré-visualização, antes de o gestor salvar. O validador de contraste do white-label também mora no painel (spec §6) — nunca no totem.

`npm workspaces` puro, sem Turborepo nem nx. A Vercel separa os deploys por *root directory* do mesmo repositório.

## Começando

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
npm install
cp .env.example .env.local     # preencha as chaves
npm run dev
```

O prefixo de PATH não é opcional: o node padrão do shell pode estar desatualizado e o Vite exige 22.12+.

## Comandos

| Comando | O que faz |
|---|---|
| `npm run dev` | totem em desenvolvimento |
| `npm run dev:painel` | painel em desenvolvimento (fase 3) |
| `npm test` | motor, catálogo, tema, máquina de estados, IA |
| `npm run e2e` | smoke do fluxo de 3 toques + ficha completa impressa |
| `npm run typecheck` | `tsc --build` em todos os pacotes |
| `npm run validate:catalog` | valida os CSVs — quebra o build se houver dado inválido |
| `npm run export:raw` | exporta exercícios do Persona Fit → CSV cru |
| `npm run classify` | classificação assistida por Claude (offline, roda uma vez) |
| `npm run seed:catalog` | CSVs → Supabase |
| `npm run db:push` | aplica as migrations |
| `npm run fn:deploy` | publica a Edge Function `embellish` |

## Virar totem

Não há build separado. A mesma URL, aberta assim:

```bash
chrome --kiosk --incognito \
  --overscroll-history-navigation=0 \
  https://<url-da-vercel>
```

## O que não está na fase 1

Por decisão da spec §10, nesta ordem de entrada: agente de impressão térmica, página do QR completa (vídeo, cronômetro, marcar série), painel do gestor, estatísticas, multi-idioma. Nesta fase a academia é configurada direto no Supabase Studio.

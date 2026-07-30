# NutriOn QuickFit — Plano de Implementação (Fase 1: demo comercial)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir a demo comercial do QuickFit — totem web que gera treino personalizado em 3 toques, imprime ficha A4 e roda offline — pronta para ser mostrada a gestores de academia.

**Architecture:** App React/Vite servido pela Vercel, aberto em `chrome --kiosk` quando virar totem. O motor de geração é TypeScript puro sem I/O (`packages/core/src/engine/`), testado com vitest; todo o resto é raso. Catálogo de exercícios é autorado em CSV no repo, classificado uma vez com a API da Anthropic, revisado à mão e semeado num projeto Supabase próprio, de onde o cliente carrega e cacheia em `localStorage`.

**Tech Stack:** React 19 + Vite + TypeScript + Tailwind (via CSS custom properties), vitest, Playwright, Supabase (Postgres + RLS), Vercel.

**Camada de IA — duas velocidades, nenhum orquestrador.** As duas cargas de LLM do produto têm requisitos opostos e por isso arquiteturas diferentes:

| | Classificação do catálogo (task 9) | Enfeite do treino (task 17) |
|---|---|---|
| Quando | uma vez, offline | a cada geração, no totem |
| Decide | equipamento, nível, **contraindicação** | nome do treino + 1 dica por exercício |
| Latência | irrelevante | crítica — o treino já está na tela |
| Se errar | **alguém se machuca** | nome genérico |
| Escolha | Anthropic SDK + `claude-opus-5` + `messages.parse()` com zod | `fetch` para Groq atrás de uma interface `Provider` própria |

**Por que não gateway (OpenRouter, LiteLLM) nem orquestrador (LangChain, Mastra, Vercel AI SDK):** o enfeite é um prompt, sem ferramenta, sem cadeia, sem memória, sem retrieval. Groq/OpenAI/Together/Cerebras todos expõem `/chat/completions` compatível com OpenAI, então trocar de provedor já é trocar base URL + model + key. Um framework para fazer um POST é peso morto num edge runtime com orçamento de cold start; um gateway adiciona um hop para proteger uma chamada que **por desenho pode falhar sem consequência** (D5).

**O investimento que substitui o gateway: cache do enfeite.** A tabela `embellishments` (task 10) chaveia por hash de `(goal, groups, exercise_ids)`. O enfeite de "peito + tríceps, hipertrofia, 45 min" é idêntico toda vez, então ~90% das chamadas desaparecem numa academia real e a latência de p50 vai a zero. Reconsidere um gateway quando houver 10+ academias e necessidade de trocar provedor sem redeploy ou de rate limit por tenant — não antes.

**Spec:** `docs/superpowers/specs/2026-07-28-quickfit-design.md` — leia antes de começar. As 8 decisões travadas (D1–D8) estão na §2.

## Global Constraints

- **Node 22.16.0 via nvm.** Todo comando Bash começa com o prefixo de PATH abaixo. O node do shell pode estar desatualizado.
  ```bash
  export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
  ```
- **`packages/core/src/engine/` tem ZERO dependências.** Sem React, sem Supabase, sem lib externa. É o que torna os testes instantâneos e o motor portável para o servidor no piloto.
- **Filtro de equipamento usa `every`, nunca `some`.** Um exercício só é elegível se **todos** os seus equipamentos existem na unidade.
- **Copy em pt-BR**, tratamento na segunda pessoa ("você"), sem jargão de academia que aluno iniciante não entenda.
- **Alvo de toque mínimo: 96px de altura.** Não 44px.
- **Nenhuma fonte por CDN.** Sora e Inter auto-hospedadas em `woff2` dentro de `public/fonts/`.
- **Cores só via CSS custom properties `--qf-*`.** Nunca hex literal em componente — quebra o white-label.
- **Segredos só em `.env.local`, que está no `.gitignore`.** O `service_role` nunca vai para o cliente nem para o git.
- **Projeto Supabase:** ref `jpgnplzkdbfmjkinfvln`. As chaves estão nas notas do Robson — **rotacione o `sb_secret_...` antes de usar**, ele foi exposto num log de conversa.
- **Toda tarefa termina com `npm test` verde e um commit.**
- **`npm test`, `npm run typecheck` e `git` rodam sempre na RAIZ** (`quickfit/`), nunca dentro de um workspace. Um único vitest e um único tsconfig cobrem `packages/` e `apps/`.
- **`packages/core` nunca importa de `apps/`.** A seta aponta num sentido só. Dentro de core, imports relativos; de `apps/` para core, sempre `@quickfit/core/*`.
- **O alias de `@quickfit/core` existe em três arquivos** — `tsconfig.base.json`, `apps/totem/vite.config.ts` e `vitest.config.ts`. Mexer em um exige mexer nos três; `apps/totem/src/resolve.test.ts` é o que avisa quando divergem.

---

## Estrutura de arquivos

Monorepo com `npm workspaces`. **A casca já existe no repositório** — este plano preenche.

```
quickfit/
  package.json                  workspaces: packages/*, apps/*
  .env.local                    (gitignored)
  .env.example                  no git
  tsconfig.base.json            paths: @quickfit/core/* → packages/core/src/*
  vitest.config.ts              cobre packages/ E apps/
  playwright.config.ts
  README.md

  ┌─ COMPARTILHADO ─────────────────────────────────────────────────────────
  packages/core/                @quickfit/core — totem E painel consomem
    package.json                exports: ./engine, ./catalog, ./theme
    src/
      engine/                   ← MÓDULO FUNDO. sem I/O, sem React.
        types.ts                  Exercise, Input, Scheme, Workout, WorkoutItem
        constants.ts              REST, SETS_REPS, TARGET_EX, MAX_EX…
        filter.ts                 eligible()
        budget.ts                 schemeFor(), costOf()
        rng.ts                    mulberry32(), weightedPick()
        generate.ts               generateWorkout()
        index.ts                  API pública do motor
        __fixtures__/catalog.ts
        *.test.ts

      catalog/
        schema.ts                 zod + parseEquipmentCsv/parseExercisesCsv
        schema.test.ts
        integration.test.ts       catálogo real × motor

      theme/
        types.ts                  Gym, GymTheme — o painel também escreve
        base.ts                   DARK_BASE, LIGHT_BASE, MIN_CONTRAST
        contrast.ts               contrastRatio, bestContrast, validateAccent
        apply.ts                  applyTheme()
        index.ts
        contrast.test.ts

  ┌─ TOTEM (fase 1) ────────────────────────────────────────────────────────
  apps/totem/
    package.json                @quickfit/totem — depende de @quickfit/core
    index.html                  <meta charset="utf-8">, root div
    vite.config.ts
    tailwind.config.js          cores → var(--qf-*)
    public/fonts/               Sora + Inter em woff2 (subset latin)
    src/
      data/
        supabase.ts               cliente único (anon)
        loadCatalog.ts            fetch + cache localStorage + fallback
        saveWorkout.ts            persiste, devolve nanoid curto
      state/
        machine.ts                reducer + Action + MachineState
        useIdleTimeout.ts         volta pra attract em 90s
      screens/
        Attract Parq Blocked Home
        Goal Groups Time Level
        Generating Result Ficha Thin Unavailable SharedWorkout
        labels.ts  useHasMore.ts
      components/
        BigButton.tsx             96px mínimo, aria-pressed
        Cta.tsx
        Boundary.tsx              error boundary: volta ao attract em 5s
      print/
        print.css                 @media print — as 6 regras da spec §7
        qr.ts
      ai/
        embellish.ts              Edge Function, falha em silêncio
        cacheKey.ts               hash de (goal, groups, exercise ids)
      App.tsx  main.tsx  index.css

  ┌─ PAINEL (fase 3 — só a casca) ──────────────────────────────────────────
  apps/painel/
    README.md                   por que a casca existe agora; o que vai morar aqui

  ┌─ COMPARTILHADO POR AMBOS ───────────────────────────────────────────────
  catalog/
    equipment.csv               id,name,category
    exercises.csv               autoria humana — fonte de verdade (versionado)
    exercises.raw.csv           export do Persona Fit (versionado)
    exercises.classified.csv    saída crua do LLM (gitignored)

  scripts/
    validate-catalog.ts         roda no CI
    export-from-app.ts          Persona Fit → exercises.raw.csv
    classify.ts                 raw → classified (Anthropic, offline)
    seed-catalog.ts             CSVs → Supabase

  supabase/
    migrations/
      20260728000000_catalog.sql        equipment, exercises, junções
      20260728000100_gyms.sql           gyms, gym_equipment, view de disponíveis
      20260728000200_workouts.sql       generated_workouts + views de stats
      20260728000300_rls.sql            policies anon + get_workout()
      20260728000400_embellishments.sql cache do enfeite por hash
    functions/embellish/
      index.ts                          handler: cache → provedor → cache
      provider.ts                       interface Provider (OpenAI-compatível)

  docs/
    specs/2026-07-28-quickfit-design.md
    plans/2026-07-28-quickfit-demo.md   este arquivo

  e2e/demo.spec.ts
```

### As duas fronteiras que importam

**1. `packages/core/src/engine/` recebe `Exercise[]` e devolve `Workout`.** Não importa nada de `data/`, `screens/` ou `theme/`. Se um teste do motor precisar de `await`, a fronteira foi violada.

**2. `packages/core` nunca importa de `apps/`.** A seta aponta só num sentido. Foi esta regra que forçou `Gym` e `GymTheme` para `core/theme/types.ts` — eles têm dois consumidores (o painel escreve o tema com validação de contraste, o totem lê), então morar em `apps/totem` inverteria a dependência.

**Dentro de `packages/core`, imports são relativos** (`../engine/types`). **De `apps/` para o core, sempre pelo nome do pacote** (`@quickfit/core/engine`). Um arquivo de core que se auto-referencia pelo nome do pacote é sinal de que ele está na camada errada.

---

## Fase A — Fundação

### Task 1: Scaffold do workspace com teste verde

**Já existe no repositório** (commit `chore: estrutura do monorepo`): a árvore de pastas, o `package.json` raiz com workspaces, `.gitignore`, `.env.example`, `README.md`, `packages/core/package.json` e `apps/painel/README.md`. Esta tarefa preenche o resto.

**Files:**
- Create: `apps/totem/` (via Vite)
- Create: `tsconfig.base.json`, `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `packages/core/src/engine/index.ts`
- Create: `apps/totem/tailwind.config.js`, `apps/totem/postcss.config.js`
- Create: `apps/totem/src/vite-env.d.ts`
- Test: `packages/core/src/engine/smoke.test.ts`

**O gate desta tarefa são três comandos, não dois:** `npm test`, `npm run typecheck` **e** `npm run build`. O `build` entra porque ele usa um compilador diferente do `typecheck` (o `typescript` de `apps/totem`, não o da raiz) — foi o único que pegou o `baseUrl` deprecado e os tipos ambient faltando na primeira execução desta tarefa.

**Interfaces:**
- Consumes: a casca do monorepo já versionada
- Produces: `npm test` executável na raiz; `npm run dev` servindo o totem; `@quickfit/core/engine` resolvível de `apps/totem`

- [ ] **Step 1: Criar o app do totem dentro do workspace**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm create vite@latest apps/totem -- --template react-ts
```

O Vite gera um `package.json` em `apps/totem`. Renomeie o pacote e declare a dependência do core:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm pkg set name="@quickfit/totem" --workspace apps/totem
npm pkg set private=true --workspace apps/totem
npm pkg set dependencies.@quickfit/core="*" --workspace apps/totem
```

- [ ] **Step 2: Instalar dependências nos lugares certos**

Onde cada coisa mora importa: o SDK da Anthropic é ferramenta de script e **nunca** pode entrar no bundle do cliente.

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit

# raiz: ferramentas de build e teste, compartilhadas
npm install -D -w . typescript vitest @vitest/coverage-v8 tsx \
  @playwright/test @types/node

# core: só zod (já declarado no package.json — instala o link)
npm install

# totem: runtime do app
npm install -w @quickfit/totem @supabase/supabase-js qrcode nanoid
npm install -D -w @quickfit/totem tailwindcss@^3 postcss autoprefixer @types/qrcode

# raiz: scripts offline. devDependency de propósito — não vai pro bundle.
npm install -D -w . @anthropic-ai/sdk @supabase/supabase-js
```

Tailwind v3 de propósito: a v4 mudou a configuração de tema para CSS-first e o mapeamento para `var(--qf-*)` fica menos direto.

- [ ] **Step 3: Configurar TypeScript com o alias do core**

`tsconfig.base.json` (na raiz):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": false,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "types": ["vitest/globals", "node"],
    "paths": {
      "@quickfit/core/engine": ["./packages/core/src/engine/index.ts"],
      "@quickfit/core/catalog": ["./packages/core/src/catalog/schema.ts"],
      "@quickfit/core/theme": ["./packages/core/src/theme/index.ts"]
    }
  }
}
```

**Sem `baseUrl`, de propósito.** O TypeScript 6 emite `TS5101` (`baseUrl` está deprecado) e o 7 removeu a opção. Desde o TS 4.4 o `paths` funciona sozinho: os caminhos passam a ser resolvidos em relação ao arquivo que os **declara** — este `tsconfig.base.json`, que está na raiz. Daí o `./` na frente de cada um. O efeito é idêntico ao do `baseUrl: "."`, e sobrevive à próxima major.

`tsconfig.json` (na raiz — é o que `npm run typecheck` usa):

```json
{
  "extends": "./tsconfig.base.json",
  "include": ["packages/*/src/**/*", "apps/*/src/**/*", "scripts/**/*", "e2e/**/*"]
}
```

Substitua o `tsconfig.json` que o Vite gerou em `apps/totem/`:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src"]
}
```

E apague `apps/totem/tsconfig.node.json` e `apps/totem/tsconfig.app.json` se o Vite os gerou — o `tsconfig.base.json` cobre os dois casos, e três arquivos de config para um app pequeno é cerimônia.

Crie também `apps/totem/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

Uma linha, e ela é obrigatória. Sem ela o `tsc` não conhece os tipos ambient do Vite e recusa os imports com efeito colateral de CSS (`import './index.css'`) com `TS2882`. Os templates antigos do `npm create vite` geravam este arquivo; o atual não gera mais — então ele precisa ser criado à mão.

**Uma única versão de `typescript` no repositório.** O Vite instala um `typescript` próprio em `apps/totem`, e o `build` do totem (`tsc -b && vite build`) usa esse, não o da raiz. Se as duas versões divergirem, `npm run typecheck` (raiz) pode ficar verde enquanto `npm run build` quebra — foi exatamente o que aconteceu na primeira execução desta tarefa. Alinhe as duas no mesmo range e verifique os três comandos:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm pkg get devDependencies.typescript --workspace apps/totem   # veja o range que o Vite instalou
npm pkg set devDependencies.typescript="<esse mesmo range>"     # aplica na raiz
npm install
npm test && npm run typecheck && npm run build
```

- [ ] **Step 4: Configurar o Vite para resolver o core como fonte TS**

`apps/totem/vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const core = (p: string) => fileURLToPath(new URL(`../../packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@quickfit/core/engine': core('engine/index.ts'),
      '@quickfit/core/catalog': core('catalog/schema.ts'),
      '@quickfit/core/theme': core('theme/index.ts'),
    },
  },
  // O core é fonte TypeScript, não um pacote publicado. Sem isto o Vite
  // tenta pré-empacotá-lo e falha ao encontrar o build.
  optimizeDeps: { exclude: ['@quickfit/core'] },
  server: { port: 5173 },
  preview: { port: 4173 },
});
```

O alias explícito é redundante com os `paths` do tsconfig para o *type checking*, mas o Vite não lê `paths` — precisa do seu próprio resolve. Manter os dois em sincronia é o custo de não usar um plugin de paths; para três entradas, é mais barato que a dependência.

- [ ] **Step 5: Escrever os testes de fumaça (vão falhar)**

Dois testes, porque há duas coisas que podem estar quebradas na fundação: o vitest roda, e o alias do core resolve de dentro de `apps/`.

`packages/core/src/engine/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('engine', () => {
  it('expõe uma versão', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
```

`apps/totem/src/resolve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
// Import pelo NOME do pacote, como as telas farão. Se o alias estiver errado,
// este teste avisa agora — não como erro de build na task 14.
import { ENGINE_VERSION } from '@quickfit/core/engine';

describe('resolução do workspace', () => {
  it('apps/totem importa @quickfit/core/engine', () => {
    expect(ENGINE_VERSION).toBe('1.0.0');
  });
});
```

- [ ] **Step 6: Configurar o vitest na raiz e rodar para ver falhar**

Um único config na raiz cobre os dois workspaces. Dois configs para uma suíte seria cerimônia.

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const core = (p: string) =>
  fileURLToPath(new URL(`./packages/core/src/${p}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@quickfit/core/engine': core('engine/index.ts'),
      '@quickfit/core/catalog': core('catalog/schema.ts'),
      '@quickfit/core/theme': core('theme/index.ts'),
    },
  },
  test: {
    // `node` porque o motor não precisa de DOM. O que precisa (cache em
    // localStorage) recebe stub via vi.stubGlobal nos próprios testes.
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.{ts,tsx}'],
    globals: true,
  },
});
```

Os scripts `test`, `test:watch` e `typecheck` já estão no `package.json` da raiz.

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit && npm test
```

Esperado: FAIL — `Failed to resolve import "./index"` e `@quickfit/core/engine`.

- [ ] **Step 7: Implementação mínima**

`packages/core/src/engine/index.ts`:

```ts
export const ENGINE_VERSION = '1.0.0';
```

- [ ] **Step 8: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit && npm test && npm run typecheck
```

Esperado: PASS, 2 testes; `typecheck` sem saída.

Se o teste de resolução falhar mas o do core passar, o alias do `vitest.config.ts` não bate com o do `tsconfig.base.json` — são três entradas em dois arquivos, e é o erro mais provável desta tarefa.

- [ ] **Step 9: Configurar Tailwind com os tokens `--qf-*`**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit/apps/totem
npx tailwindcss init -p
```

`apps/totem/tailwind.config.js`:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg:       'var(--qf-bg)',
        surface:  'var(--qf-surface)',
        raised:   'var(--qf-raised)',
        border:   'var(--qf-border)',
        text:     'var(--qf-text)',
        dim:      'var(--qf-dim)',
        accent:   'var(--qf-accent)',
        onAccent: 'var(--qf-on-accent)',
        violet:   'var(--qf-violet)',
        // `danger` também é token, não hex. Não porque a academia troque a cor
        // de erro — ela não troca — mas porque no modo claro `#F43F5E` precisa
        // escurecer para continuar legível, e é o `applyTheme` que decide isso
        // (task 12). Hex aqui congelaria a cor nos dois modos.
        danger:   'var(--qf-danger)',
      },
      fontFamily: {
        display: ['Sora', 'system-ui', 'sans-serif'],
        sans:    ['Inter', 'system-ui', 'sans-serif'],
      },
      minHeight: {
        touch: '96px',   // o alvo mínimo de toque do totem
      },
    },
  },
  plugins: [],
};
```

`apps/totem/src/index.css` (substitui o conteúdo gerado pelo Vite):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --qf-bg: #07080B;
  --qf-surface: #12141A;
  --qf-raised: #1A1D25;
  --qf-border: #1F232B;
  --qf-text: #F4F5F7;
  --qf-dim: #A1A6B2;
  --qf-accent: #39FF14;
  --qf-on-accent: #07080B;
  --qf-violet: #8B5CF6;
  --qf-danger: #F43F5E;
  --qf-accent-glow: rgba(57, 255, 20, 0.22);
}

html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--qf-bg);
  color: var(--qf-text);
  font-family: 'Inter', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  overscroll-behavior: none;
  user-select: none;            /* totem: ninguém seleciona texto com o dedo */
  -webkit-tap-highlight-color: transparent;
}
```

- [ ] **Step 10: Confirmar que o Vite não trouxe lixo versionável**

O `.gitignore` e o `.env.example` já estão no repositório. O que precisa de checagem é o que o `npm create vite` acrescentou — e que nada de segredo entrou:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git status --short
git check-ignore -v .env.local node_modules apps/totem/node_modules apps/totem/dist 2>/dev/null
```

Esperado: nenhum `.env*` e nenhum `node_modules` em `git status`; o `check-ignore` confirma cada um. Se `apps/totem/dist` não estiver coberto, o padrão `dist/` do `.gitignore` já resolve — confirme antes de commitar.

Apague o boilerplate que o Vite gera e que não vamos usar:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit/apps/totem
rm -f src/App.css src/assets/react.svg public/vite.svg
rmdir src/assets 2>/dev/null || true
```

O `src/App.tsx` e o `src/main.tsx` gerados são reescritos na task 14; deixe-os por enquanto para o `npm run dev` continuar servindo.

- [ ] **Step 11: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add -A
git commit -m "chore: app do totem no workspace, com Tailwind e vitest

Alias de @quickfit/core em três lugares que precisam ficar em sincronia:
tsconfig.base.json (types), vite.config.ts (bundle) e vitest.config.ts
(testes). O teste de resolução em apps/totem existe para avisar quando
divergirem.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Fase B — O motor (TDD)

### Task 2: Tipos e filtro de elegibilidade

**Files:**
- Create: `packages/core/src/engine/types.ts`
- Create: `packages/core/src/engine/constants.ts`
- Create: `packages/core/src/engine/filter.ts`
- Test: `packages/core/src/engine/filter.test.ts`

**Interfaces:**
- Consumes: nada do motor ainda
- Produces:
  - `type MuscleGroup = 'peito'|'costas'|'ombros'|'biceps'|'triceps'|'pernas'|'gluteos'|'core'|'cardio'`
  - `type Pattern = 'push-h'|'push-v'|'pull-h'|'pull-v'|'squat'|'hinge'|'lunge'|'iso'|'core'|'cardio'`
  - `type Goal = 'hipertrofia'|'emagrecimento'|'resistencia'|'mobilidade'|'forca'`
  - `type Exercise` e `type Input` (definidos no Step 1)
  - `eligible(catalog: Exercise[], input: Input): Exercise[]`

- [ ] **Step 1: Escrever os tipos** (não é passo de teste — é a interface que as tarefas 3–6 consomem)

`packages/core/src/engine/types.ts`:

```ts
export type MuscleGroup =
  | 'peito' | 'costas' | 'ombros' | 'biceps'
  | 'triceps' | 'pernas' | 'gluteos' | 'core' | 'cardio';

export type Pattern =
  | 'push-h' | 'push-v' | 'pull-h' | 'pull-v'
  | 'squat' | 'hinge' | 'lunge' | 'iso' | 'core' | 'cardio';

export type Goal =
  | 'hipertrofia' | 'emagrecimento' | 'resistencia' | 'mobilidade' | 'forca';

export type Level = 1 | 2 | 3;

/** Tags de contraindicação. O aluno escolhe estas no passo 6 do fluxo completo. */
export type Contra = 'joelho' | 'lombar' | 'ombro' | 'punho' | 'cervical';

export type Exercise = {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  /** ids de equipamento normalizados. `[]` significa peso corporal. */
  equipment: string[];
  level: Level;
  pattern: Pattern;
  isCompound: boolean;
  /** segundos de execução de UMA série. 10–60. */
  avgSecPerSet: number;
  /** só para `pattern: 'cardio'` — duração total em segundos. */
  durationSec?: number;
  contraindications: Contra[];
  cue?: string;
  videoUrl?: string;
};

/**
 * Todos os tempos oferecidos em qualquer fluxo. A união é o conjunto, mas
 * nenhuma tela mostra todos: o atalho "Treino rápido" oferece 20/30/40/50
 * (quem escolhe "rápido" é limitado por tempo) e o "Montar do zero" oferece
 * 20/30/45/60/90 (precisa cobrir perna completa e sessão de força).
 *
 * 40 e 45 nunca aparecem juntos de propósito: ambos caem em 6 exercícios no
 * TARGET_EX, então oferecer os dois seria uma escolha sem consequência.
 */
export type Minutes = 20 | 30 | 40 | 45 | 50 | 60 | 90;

export type Input = {
  goal: Goal;
  groups: MuscleGroup[];
  minutes: Minutes;
  level: Level;
  /** vem de gym_equipment onde is_available = true */
  availableEquipment: string[];
  /**
   * Contraindicações a evitar. SEMPRE `[]` no caminho de atalho — só o
   * passo 6 do "Montar do zero" popula este campo.
   */
  avoid: Contra[];
  /** é isto que faz o treino variar entre gerações */
  seed: number;
};

export type Scheme = {
  sets: number;
  reps: string;
  /** segundos de descanso entre séries */
  rest: number;
  /** alvo de exercícios que o esquema foi dimensionado para caber */
  target: number;
};

export type WorkoutItem = {
  exercise: Exercise;
  sets: number;
  reps: string;
};

export type Workout = {
  items: WorkoutItem[];
  scheme: Scheme;
  /** quantos exercícios sobraram elegíveis depois do filtro */
  poolSize: number;
  budgetSec: number;
  usedSec: number;
  /** teto de exercícios aplicado nesta geração */
  cap: number;
  /** abaixo disto a tela mostra "combinação indisponível" em vez do treino */
  minItems: number;
  /** séries somadas nos compostos porque sobrou tempo */
  extraSets: number;
};
```

- [ ] **Step 2: Escrever as constantes**

`packages/core/src/engine/constants.ts`:

```ts
import type { Goal, Minutes, Scheme } from './types';

export const REST: Record<Goal, number> = {
  forca: 150,
  hipertrofia: 75,
  resistencia: 40,
  emagrecimento: 35,
  mobilidade: 30,
};

export const SETS_REPS: Record<Goal, Pick<Scheme, 'sets' | 'reps'>> = {
  forca:         { sets: 4, reps: '4-6'    },
  hipertrofia:   { sets: 4, reps: '8-12'   },
  resistencia:   { sets: 3, reps: '15-20'  },
  emagrecimento: { sets: 3, reps: '12-15'  },
  mobilidade:    { sets: 2, reps: '30-45s' },
};

/**
 * Quantos exercícios um professor põe numa sessão desse tempo. O motor mira
 * NISSO e deriva as séries — não o contrário. Sem isto, 20 min de hipertrofia
 * com 4 séries de 75s de descanso cabia UM exercício só.
 */
export const TARGET_EX: Record<Minutes, number> = {
  20: 4,
  30: 5,
  40: 6,
  45: 6,   // 40 e 45 caem no mesmo alvo — por isso nunca são oferecidos juntos
  50: 7,
  60: 8,
  90: 9,
};

/** Teto por objetivo. Ficha real de academia tem 4 a 9 exercícios, nunca 19. */
export const MAX_EX: Record<Goal, number> = {
  forca: 6, hipertrofia: 8, resistencia: 9, emagrecimento: 9, mobilidade: 10,
};

/** Não vira treino de perna com 8 aparelhos de perna. */
export const MAX_PER_GROUP = 4;

/** 5 min de aquecimento, sai impresso na ficha. */
export const WARMUP_SEC = 300;

/** Caminhar até o aparelho, ajustar, esperar liberar. */
export const TRANSITION_SEC = 60;

/** Série média, só para dimensionar o esquema em `schemeFor`. */
export const AVG_SEC = 30;
```

- [ ] **Step 3: Escrever os testes do filtro (vão falhar)**

`packages/core/src/engine/filter.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { eligible } from './filter';
import type { Exercise, Input } from './types';

const ex = (over: Partial<Exercise>): Exercise => ({
  id: 'x', name: 'X', primary: 'peito', secondary: [], equipment: [],
  level: 1, pattern: 'iso', isCompound: false, avgSecPerSet: 30,
  contraindications: [], ...over,
});

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito'], minutes: 45, level: 3,
  availableEquipment: ['barra', 'banco', 'halter'], avoid: [], seed: 1, ...over,
});

describe('eligible', () => {
  it('exige TODOS os equipamentos presentes, não apenas um', () => {
    const cat = [
      ex({ id: 'supino', equipment: ['barra', 'banco'] }),
      ex({ id: 'crucifixo-mq', equipment: ['mq-crucifixo'] }),
      ex({ id: 'scott', equipment: ['banco-scott', 'barra'] }),
    ];
    const out = eligible(cat, input());
    expect(out.map(e => e.id)).toEqual(['supino']);
  });

  it('trata equipamento vazio como peso corporal, sempre disponível', () => {
    const cat = [ex({ id: 'flexao', equipment: [] })];
    expect(eligible(cat, input({ availableEquipment: [] }))).toHaveLength(1);
  });

  it('nunca devolve exercício acima do nível declarado', () => {
    const cat = [
      ex({ id: 'facil', level: 1 }),
      ex({ id: 'medio', level: 2 }),
      ex({ id: 'dificil', level: 3 }),
    ];
    const out = eligible(cat, input({ level: 2 }));
    expect(out.map(e => e.id)).toEqual(['facil', 'medio']);
  });

  it('remove exercício com contraindicação que o aluno pediu para evitar', () => {
    const cat = [
      ex({ id: 'agacho', contraindications: ['joelho', 'lombar'] }),
      ex({ id: 'leg', contraindications: [] }),
    ];
    const out = eligible(cat, input({ avoid: ['joelho'] }));
    expect(out.map(e => e.id)).toEqual(['leg']);
  });

  it('aceita exercício cujo grupo SECUNDÁRIO foi pedido', () => {
    const cat = [ex({ id: 'supino', primary: 'peito', secondary: ['triceps'] })];
    expect(eligible(cat, input({ groups: ['triceps'] }))).toHaveLength(1);
  });

  it('descarta exercício que não toca nenhum grupo pedido', () => {
    const cat = [ex({ id: 'rosca', primary: 'biceps', secondary: [] })];
    expect(eligible(cat, input({ groups: ['pernas'] }))).toHaveLength(0);
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/filter.test.ts
```

Esperado: FAIL — `Failed to resolve import "./filter"`.

- [ ] **Step 5: Implementar o filtro**

`packages/core/src/engine/filter.ts`:

```ts
import type { Exercise, Input } from './types';

/**
 * Reduz o catálogo ao que esta unidade e este aluno podem fazer hoje.
 * É aqui que mora a garantia de segurança do produto.
 */
export function eligible(catalog: Exercise[], input: Input): Exercise[] {
  const gymHas = new Set(input.availableEquipment);

  return catalog.filter((ex) => {
    // `every`, não `some`: crucifixo na máquina exige a máquina de crucifixo.
    // Se a academia não tem — ou o gestor desligou por manutenção — o
    // exercício desaparece. Com `some` prescreveríamos aparelho inexistente.
    if (!ex.equipment.every((eq) => gymHas.has(eq))) return false;

    if (ex.level > input.level) return false;
    if (ex.contraindications.some((c) => input.avoid.includes(c))) return false;

    return (
      input.groups.includes(ex.primary) ||
      ex.secondary.some((g) => input.groups.includes(g))
    );
  });
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/filter.test.ts
```

Esperado: PASS, 6 testes.

- [ ] **Step 7: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/engine
git commit -m "feat(engine): tipos, constantes e filtro de elegibilidade

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Esquema derivado do tempo e custo por exercício

**Files:**
- Create: `packages/core/src/engine/budget.ts`
- Test: `packages/core/src/engine/budget.test.ts`

**Interfaces:**
- Consumes: `Exercise`, `Input`, `Scheme`, `Goal` de `./types`; todas as constantes de `./constants`
- Produces:
  - `schemeFor(input: Input): Scheme`
  - `costOf(ex: Exercise, sc: Scheme): number`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`packages/core/src/engine/budget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { schemeFor, costOf } from './budget';
import { REST, SETS_REPS } from './constants';
import type { Exercise, Goal, Input, Minutes } from './types';

/** Em ordem crescente — três testes dependem disso para varrer a escada. */
const ALL_MINUTES: Minutes[] = [20, 30, 40, 45, 50, 60, 90];
const GOALS: Goal[] = ['forca', 'hipertrofia', 'resistencia', 'emagrecimento', 'mobilidade'];

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito'], minutes: 45, level: 3,
  availableEquipment: [], avoid: [], seed: 1, ...over,
});

const ex = (over: Partial<Exercise> = {}): Exercise => ({
  id: 'x', name: 'X', primary: 'peito', secondary: [], equipment: [],
  level: 1, pattern: 'iso', isCompound: false, avgSecPerSet: 30,
  contraindications: [], ...over,
});

describe('schemeFor', () => {
  it('cabe 4 exercícios em 20 min de hipertrofia reduzindo série e descanso', () => {
    // O bug original: 4 séries × 75s de descanso cabia UM exercício em 20 min.
    const sc = schemeFor(input({ minutes: 20, goal: 'hipertrofia' }));
    expect(sc.target).toBe(4);
    expect(sc.sets).toBeLessThanOrEqual(3);
    expect(sc.rest).toBeLessThanOrEqual(60);
    expect(sc.target * (sc.sets * (30 + sc.rest) + 60)).toBeLessThanOrEqual(20 * 60 - 300);
  });

  it('mantém o esquema cheio do objetivo quando o tempo permite', () => {
    const sc = schemeFor(input({ minutes: 90, goal: 'forca' }));
    expect(sc.sets).toBe(4);
    expect(sc.rest).toBe(150);
    expect(sc.reps).toBe('4-6');
  });

  it('preserva as repetições do objetivo mesmo reduzindo séries', () => {
    const sc = schemeFor(input({ minutes: 20, goal: 'resistencia' }));
    expect(sc.reps).toBe('15-20');
  });

  it('nunca desce abaixo de 2 séries', () => {
    for (const minutes of ALL_MINUTES) {
      for (const goal of GOALS) {
        expect(schemeFor(input({ minutes, goal })).sets).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('limita o alvo pelo teto do objetivo, não só pelo tempo', () => {
    // 90 min pede 9; força tem teto 6.
    const sc = schemeFor(input({ minutes: 90, goal: 'forca' }));
    expect(sc.target).toBe(6);
  });

  it('mais tempo nunca produz menos treino, e nunca mais descanso', () => {
    // O defeito que este teste tranca, medido na escada antiga:
    //   força 45 min -> 3 séries × 60s  (volume 18)
    //   força 50 min -> 2 séries × 150s (volume 12)
    // Cinco minutos A MAIS devolviam um treino MENOR. A causa era o penhasco
    // de 150s direto para 60s na escada de descanso.
    for (const goal of GOALS) {
      let volumeAnterior = 0;
      let descansoAnterior = 0;
      for (const minutes of ALL_MINUTES) {
        const sc = schemeFor(input({ minutes, goal }));
        expect(sc.sets * sc.target).toBeGreaterThanOrEqual(volumeAnterior);
        expect(sc.rest).toBeGreaterThanOrEqual(descansoAnterior);
        volumeAnterior = sc.sets * sc.target;
        descansoAnterior = sc.rest;
      }
    }
  });

  it('o descanso fica entre o piso e o descanso base do objetivo', () => {
    // Política escolhida: descanso íntegro, menos série. Um descanso curto
    // demais é o defeito que esta política existe para impedir — o totem não
    // tem professor ao lado para corrigir execução.
    //
    // O limite SUPERIOR é o que tranca a regressão de verdade. Só o piso
    // (`rest >= min(35, base)`) não trancava nada para mobilidade: se o piso
    // virasse `REST_FLOOR` fixo, `restLadder(30)` devolveria `[35]` em vez de
    // `[30]` — e `35 >= 30` passa. O treino de mobilidade ganharia 5s de
    // descanso por série em toda sessão, silenciosamente. Com o teto, falha.
    for (const goal of GOALS) {
      const base = REST[goal];
      const piso = Math.min(35, base);
      for (const minutes of ALL_MINUTES) {
        const { rest } = schemeFor(input({ minutes, goal }));
        expect(rest).toBeGreaterThanOrEqual(piso);
        expect(rest).toBeLessThanOrEqual(base);
      }
    }
  });

  it('devolve o mínimo quando nem o degrau mais apertado cabe', () => {
    // Força em 20 min é o único par dos 35 que esgota a escada. Documentado
    // como teste porque o comportamento é intencional e não óbvio: o esquema
    // NÃO cabe no orçamento, e é o `generateWorkout` que fecha a conta
    // cortando exercício. Se algum dia isto passar a caber, o comentário do
    // fallback fica errado — e este teste avisa.
    const sc = schemeFor(input({ minutes: 20, goal: 'forca' }));
    expect(sc.sets).toBe(2);
    expect(sc.rest).toBe(68);
    expect(sc.target).toBe(4);
    const cabe = sc.target * (sc.sets * (30 + sc.rest) + 60);
    expect(cabe).toBeGreaterThan(20 * 60 - 300);
  });

  it('todo objetivo começa com séries suficientes para o laço rodar', () => {
    // Se um objetivo novo entrar com `sets: 1`, o laço interno
    // (`sets = baseSets; sets >= MIN_SETS`) não executa nenhuma iteração em
    // NENHUM degrau, e todo tempo cai no fallback sem aviso. Guarda barata.
    for (const goal of GOALS) {
      expect(SETS_REPS[goal].sets).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('costOf', () => {
  it('cobra séries × (execução + descanso) + transição', () => {
    const sc = { sets: 4, reps: '8-12', rest: 75, target: 6 };
    expect(costOf(ex({ avgSecPerSet: 35 }), sc)).toBe(4 * (35 + 75) + 60);
  });

  it('cardio cobra a duração cheia, não séries', () => {
    const sc = { sets: 3, reps: '12-15', rest: 35, target: 5 };
    const cardio = ex({ pattern: 'cardio', durationSec: 600, avgSecPerSet: 0 });
    expect(costOf(cardio, sc)).toBe(600 + 60);
  });

  it('confere com a realidade: 45 min de hipertrofia cabe ~5 exercícios', () => {
    const sc = schemeFor(input({ minutes: 45, goal: 'hipertrofia' }));
    const orcamento = 45 * 60 - 300;
    const cabem = Math.floor(orcamento / costOf(ex({ avgSecPerSet: 35 }), sc));
    expect(cabem).toBeGreaterThanOrEqual(5);
    expect(cabem).toBeLessThanOrEqual(7);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/budget.test.ts
```

Esperado: FAIL — `Failed to resolve import "./budget"`.

- [ ] **Step 3: Implementar**

`packages/core/src/engine/budget.ts`:

```ts
import {
  AVG_SEC, MAX_EX, REST, SETS_REPS, TARGET_EX, TRANSITION_SEC, WARMUP_SEC,
} from './constants';
import type { Exercise, Input, Scheme } from './types';

/** Ninguém sai do totem com uma série só. */
const MIN_SETS = 2;

/**
 * Piso absoluto de descanso, em segundos. Só se aplica a objetivos cujo
 * descanso base já é maior que isso — mobilidade descansa 30s e continua
 * descansando 30s.
 */
const REST_FLOOR = 35;

/**
 * Descansos que o motor tenta, do ideal ao mínimo aceitável.
 *
 * A escada é SEMPRE decrescente. A versão anterior era
 * `[baseRest, Math.min(baseRest, 60), 45, 35]`, que para mobilidade virava
 * `[30, 30, 45, 35]` — subia no terceiro degrau. Nunca chegava lá na prática,
 * mas era uma escada mal formada esperando um objetivo novo para quebrar.
 *
 * Os degraus são proporcionais, não absolutos, porque 60s é um corte razoável
 * para hipertrofia e absurdo para força: a escada antiga pulava de 150s direto
 * para 60s, e era esse penhasco que fazia força em 50 min devolver 2 séries
 * enquanto 45 min devolvia 3.
 */
function restLadder(baseRest: number): number[] {
  const floor = Math.min(REST_FLOOR, baseRest);
  const rungs = [baseRest, Math.round(baseRest * 0.6), Math.round(baseRest * 0.45)]
    .map((r) => Math.max(r, floor));
  return [...new Set(rungs)];
}

/**
 * Escolhe séries e descanso MIRANDO no alvo de exercícios do tempo pedido.
 * Sessão curta legitimamente usa menos série — é o que um professor faz com
 * quem tem 20 minutos.
 *
 * Mira, não garante. Existe combinação onde nem o degrau mais apertado faz o
 * alvo caber: força em 20 min quer 4 exercícios e o mínimo (2 séries × 68s)
 * custa 1024s contra 900s de orçamento. Nesse caso devolve o mínimo mesmo
 * assim, e quem faz o orçamento fechar é o `generateWorkout`, que para de
 * escolher quando nada mais cabe em `remaining` — força em 20 min sai com 3
 * exercícios, não 4, e `usedSec <= budgetSec`. O alvo é aspiração; o teto de
 * tempo é do gerador.
 */
export function schemeFor(input: Input): Scheme {
  const target = Math.min(TARGET_EX[input.minutes], MAX_EX[input.goal]);
  const budget = input.minutes * 60 - WARMUP_SEC;
  const { sets: baseSets, reps } = SETS_REPS[input.goal];
  const baseRest = REST[input.goal];

  // Descanso primeiro, série depois: para cada descanso da escada, esgota as
  // séries antes de encurtar o descanso. Decisão do Robson (jul/2026) — o
  // totem não tem professor ao lado, e um descanso curto demais com aluno
  // iniciante vira execução ruim. Volume menor, cada série executável.
  const ladder = restLadder(baseRest);

  for (const rest of ladder) {
    for (let sets = baseSets; sets >= MIN_SETS; sets--) {
      const perEx = sets * (AVG_SEC + rest) + TRANSITION_SEC;
      if (target * perEx <= budget) return { sets, reps, rest, target };
    }
  }

  // Este caminho É alcançado hoje, por exatamente um dos 35 pares: força em
  // 20 min. Nem o degrau mais apertado (2 × 68s = 1024s) cabe nos 900s. Não é
  // defensivo — é o caso real de "o aluno pediu força numa janela curta".
  // Devolve o mínimo e deixa o `generateWorkout` cortar exercício até fechar
  // o orçamento, em vez de encurtar o descanso abaixo do que a política
  // escolhida permite.
  return { sets: MIN_SETS, reps, rest: ladder[ladder.length - 1]!, target };
}

export function costOf(ex: Exercise, sc: Scheme): number {
  if (ex.pattern === 'cardio') {
    return (ex.durationSec ?? 0) + TRANSITION_SEC;
  }
  return sc.sets * (ex.avgSecPerSet + sc.rest) + TRANSITION_SEC;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/budget.test.ts
```

Esperado: PASS, 12 testes.

- [ ] **Step 5: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/engine
git commit -m "feat(engine): esquema de séries derivado do tempo disponível

20 min de hipertrofia cabia 1 exercício com 4x75s. Agora o motor mira no
alvo de exercícios e deriva séries e descanso para caber.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Aleatoriedade determinística

**Files:**
- Create: `packages/core/src/engine/rng.ts`
- Test: `packages/core/src/engine/rng.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:
  - `mulberry32(seed: number): () => number` — gerador em `[0, 1)`
  - `weightedPick<T>(scored: Array<{ item: T; score: number }>, rng: () => number): T`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`packages/core/src/engine/rng.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mulberry32, weightedPick } from './rng';

describe('mulberry32', () => {
  it('mesma seed produz a mesma sequência', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('seeds diferentes produzem sequências diferentes', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('devolve sempre valores em [0, 1)', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 5000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('weightedPick', () => {
  it('sempre devolve um item da lista', () => {
    const rng = mulberry32(3);
    const scored = [
      { item: 'a', score: 1 },
      { item: 'b', score: 1 },
      { item: 'c', score: 1 },
    ];
    for (let i = 0; i < 100; i++) {
      expect(['a', 'b', 'c']).toContain(weightedPick(scored, rng));
    }
  });

  it('respeita o peso: score muito maior domina a amostragem', () => {
    const rng = mulberry32(11);
    const scored = [
      { item: 'raro', score: 1 },
      { item: 'comum', score: 999 },
    ];
    const picks = Array.from({ length: 500 }, () => weightedPick(scored, rng));
    const comuns = picks.filter((p) => p === 'comum').length;
    expect(comuns).toBeGreaterThan(480);
  });

  it('nunca escolhe item com score zero quando há alternativa', () => {
    const rng = mulberry32(5);
    const scored = [
      { item: 'zerado', score: 0 },
      { item: 'valido', score: 1 },
    ];
    const picks = Array.from({ length: 200 }, () => weightedPick(scored, rng));
    expect(picks.every((p) => p === 'valido')).toBe(true);
  });

  it('devolve o único item quando a lista tem tamanho 1', () => {
    expect(weightedPick([{ item: 'só', score: 0 }], mulberry32(1))).toBe('só');
  });

  it('lança em lista vazia em vez de devolver undefined', () => {
    // O `generateWorkout` já garante `candidates.length > 0` antes de chamar,
    // então isto nunca deveria acontecer — mas devolver `undefined` como se
    // fosse um exercício colocaria lixo na ficha em silêncio. Falhar alto.
    expect(() => weightedPick([], mulberry32(1))).toThrow(/vazia/i);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/rng.test.ts
```

Esperado: FAIL — `Failed to resolve import "./rng"`.

- [ ] **Step 3: Implementar**

`packages/core/src/engine/rng.ts`:

```ts
/**
 * Gerador determinístico em [0, 1). É o que permite testar variação:
 * `seed: 42` sempre produz o mesmo treino, então "seeds diferentes geram
 * treinos diferentes" é uma afirmação verificável.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sorteia proporcionalmente ao score. Itens com score 0 nunca são
 * escolhidos, a menos que sejam a única opção.
 */
export function weightedPick<T>(
  scored: Array<{ item: T; score: number }>,
  rng: () => number,
): T {
  if (scored.length === 0) {
    throw new Error('weightedPick: lista vazia');
  }

  const total = scored.reduce((s, x) => s + Math.max(0, x.score), 0);

  // Todos zerados: devolve o último em vez de dividir por zero.
  if (total <= 0) return scored[scored.length - 1].item;

  let r = rng() * total;
  for (const x of scored) {
    r -= Math.max(0, x.score);
    if (r < 0) return x.item;
  }
  return scored[scored.length - 1].item;
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/rng.test.ts
```

Esperado: PASS, 8 testes.

- [ ] **Step 5: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/engine
git commit -m "feat(engine): rng determinístico e sorteio ponderado

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Seleção de exercícios — o coração do produto

**Files:**
- Create: `packages/core/src/engine/generate.ts`
- Modify: `packages/core/src/engine/index.ts` (re-exportar a API pública)
- Test: `packages/core/src/engine/generate.test.ts`
- Create: `packages/core/src/engine/__fixtures__/catalog.ts`

**Interfaces:**
- Consumes: `eligible` de `./filter`; `schemeFor`, `costOf` de `./budget`; `mulberry32`, `weightedPick` de `./rng`; `MAX_EX`, `MAX_PER_GROUP`, `WARMUP_SEC` de `./constants`
- Produces:
  - `generateWorkout(input: Input, catalog: Exercise[]): Workout`
  - `packages/core/src/engine/index.ts` re-exporta: `generateWorkout`, `eligible`, `schemeFor`, `costOf`, `mulberry32`, e todos os tipos

- [ ] **Step 1: Criar o catálogo de teste**

Fixture pequeno e explícito. Não use o CSV real aqui — testes do motor não leem arquivo.

`packages/core/src/engine/__fixtures__/catalog.ts`:

```ts
import type { Exercise } from '../types';

const e = (
  id: string,
  primary: Exercise['primary'],
  pattern: Exercise['pattern'],
  isCompound: boolean,
  equipment: string[],
  over: Partial<Exercise> = {},
): Exercise => ({
  id, name: id, primary, secondary: [], equipment,
  level: 1, pattern, isCompound, avgSecPerSet: 30,
  contraindications: [], ...over,
});

/** 24 exercícios cobrindo 6 grupos, compostos e isolados, com variedade de padrão. */
export const CATALOG: Exercise[] = [
  // peito
  e('supino-barra',   'peito',   'push-h', true,  ['barra', 'banco'], { secondary: ['triceps'], avgSecPerSet: 35 }),
  e('supino-halter',  'peito',   'push-h', true,  ['halter', 'banco'], { secondary: ['triceps'] }),
  e('supino-mq',      'peito',   'push-h', true,  ['mq-supino']),
  e('crucifixo-mq',   'peito',   'iso',    false, ['mq-crucifixo'], { avgSecPerSet: 25 }),
  e('crossover',      'peito',   'iso',    false, ['crossover'], { avgSecPerSet: 25 }),
  // costas
  e('puxada',         'costas',  'pull-v', true,  ['polia-alta'], { secondary: ['biceps'] }),
  e('remada-mq',      'costas',  'pull-h', true,  ['mq-remada'], { secondary: ['biceps'] }),
  e('remada-baixa',   'costas',  'pull-h', true,  ['polia-baixa'], { secondary: ['biceps'], avgSecPerSet: 32 }),
  e('pulldown-corda', 'costas',  'iso',    false, ['polia-alta', 'corda'], { avgSecPerSet: 25 }),
  // triceps
  e('triceps-corda',  'triceps', 'iso',    false, ['polia-alta', 'corda'], { avgSecPerSet: 24 }),
  e('triceps-testa',  'triceps', 'iso',    false, ['barra', 'banco'], { avgSecPerSet: 26 }),
  e('triceps-banco',  'triceps', 'iso',    false, [], { avgSecPerSet: 25 }),
  // biceps
  e('rosca-barra',    'biceps',  'iso',    false, ['barra'], { avgSecPerSet: 25 }),
  e('rosca-alt',      'biceps',  'iso',    false, ['halter'], { avgSecPerSet: 25 }),
  e('rosca-polia',    'biceps',  'iso',    false, ['polia-baixa'], { avgSecPerSet: 24 }),
  // pernas
  e('agacho-livre',   'pernas',  'squat',  true,  ['barra'], { level: 3, avgSecPerSet: 45, contraindications: ['joelho', 'lombar'] }),
  e('leg-press',      'pernas',  'squat',  true,  ['leg-press'], { avgSecPerSet: 38, contraindications: ['joelho'] }),
  e('hack',           'pernas',  'squat',  true,  ['hack'], { level: 2, avgSecPerSet: 40, contraindications: ['joelho'] }),
  e('extensora',      'pernas',  'iso',    false, ['extensora'], { avgSecPerSet: 28, contraindications: ['joelho'] }),
  e('flexora',        'pernas',  'iso',    false, ['flexora'], { avgSecPerSet: 28 }),
  e('stiff',          'pernas',  'hinge',  true,  ['barra'], { level: 2, avgSecPerSet: 38, contraindications: ['lombar'] }),
  // core
  e('prancha',        'core',    'core',   false, [], { avgSecPerSet: 30 }),
  e('abd-polia',      'core',    'core',   false, ['polia-alta', 'corda'], { level: 2, avgSecPerSet: 26 }),
  // cardio
  e('esteira',        'cardio',  'cardio', false, ['esteira'], { avgSecPerSet: 0, durationSec: 600 }),
];

/** Tudo o que o CATALOG acima referencia. */
export const ALL_EQUIPMENT = [
  'barra', 'banco', 'halter', 'mq-supino', 'mq-crucifixo', 'crossover',
  'polia-alta', 'polia-baixa', 'mq-remada', 'corda', 'leg-press', 'hack',
  'extensora', 'flexora', 'esteira',
];
```

- [ ] **Step 2: Escrever os testes (vão falhar)**

`packages/core/src/engine/generate.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateWorkout } from './generate';
import { MAX_EX, MAX_PER_GROUP, WARMUP_SEC } from './constants';
import { CATALOG, ALL_EQUIPMENT } from './__fixtures__/catalog';
import type { Input } from './types';

const input = (over: Partial<Input> = {}): Input => ({
  goal: 'hipertrofia', groups: ['peito', 'triceps'], minutes: 45, level: 3,
  availableEquipment: ALL_EQUIPMENT, avoid: [], seed: 42, ...over,
});

describe('generateWorkout — invariantes de segurança', () => {
  it('nunca prescreve exercício de aparelho que a academia não tem', () => {
    const disponivel = ['halter', 'banco'];
    const w = generateWorkout(input({ availableEquipment: disponivel }), CATALOG);
    for (const it of w.items) {
      expect(it.exercise.equipment.every((eq) => disponivel.includes(eq))).toBe(true);
    }
  });

  it('nunca prescreve acima do nível declarado', () => {
    const w = generateWorkout(input({ groups: ['pernas'], level: 1 }), CATALOG);
    expect(w.items.every((it) => it.exercise.level <= 1)).toBe(true);
    expect(w.items.map((it) => it.exercise.id)).not.toContain('agacho-livre');
  });

  it('nunca prescreve exercício contraindicado', () => {
    const w = generateWorkout(input({ groups: ['pernas'], avoid: ['joelho'] }), CATALOG);
    expect(w.items.every((it) => !it.exercise.contraindications.includes('joelho'))).toBe(true);
  });
});

describe('generateWorkout — volume e tempo', () => {
  it('respeita o orçamento de tempo', () => {
    const w = generateWorkout(input({ minutes: 45 }), CATALOG);
    expect(w.usedSec).toBeLessThanOrEqual(w.budgetSec);
    expect(w.budgetSec).toBe(45 * 60 - WARMUP_SEC);
  });

  it('nunca passa do teto de exercícios do objetivo', () => {
    // O bug original: 90 min com 6 grupos gerava 19 exercícios.
    const w = generateWorkout(
      input({ groups: ['peito', 'costas', 'triceps', 'biceps', 'pernas', 'core'], minutes: 90, goal: 'emagrecimento' }),
      CATALOG,
    );
    expect(w.items.length).toBeLessThanOrEqual(MAX_EX.emagrecimento);
    expect(w.items.length).toBeLessThanOrEqual(w.cap);
  });

  it('nunca passa de 4 exercícios do mesmo grupo muscular', () => {
    const w = generateWorkout(input({ groups: ['pernas'], minutes: 90, goal: 'emagrecimento' }), CATALOG);
    const porGrupo = new Map<string, number>();
    for (const it of w.items) {
      const g = it.exercise.primary;
      porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1);
    }
    for (const n of porGrupo.values()) expect(n).toBeLessThanOrEqual(MAX_PER_GROUP);
  });

  it('20 min de hipertrofia devolve 4 exercícios, não 1', () => {
    const w = generateWorkout(input({ minutes: 20 }), CATALOG);
    expect(w.items.length).toBe(4);
  });

  it('nunca prescreve mais que sets_do_esquema + 1 séries', () => {
    const w = generateWorkout(input({ minutes: 90, goal: 'emagrecimento' }), CATALOG);
    for (const it of w.items) {
      if (it.exercise.pattern === 'cardio') continue;
      expect(it.sets).toBeLessThanOrEqual(w.scheme.sets + 1);
    }
  });

  it('não deixa exercício sem série', () => {
    const w = generateWorkout(input(), CATALOG);
    expect(w.items.every((it) => it.sets >= 1)).toBe(true);
  });
});

describe('generateWorkout — qualidade da prescrição', () => {
  it('cobre todos os grupos pedidos antes de repetir algum', () => {
    const w = generateWorkout(input({ groups: ['peito', 'triceps'], minutes: 45 }), CATALOG);
    const grupos = new Set(w.items.flatMap((it) => [it.exercise.primary, ...it.exercise.secondary]));
    expect(grupos).toContain('peito');
    expect(grupos).toContain('triceps');
  });

  it('não põe composto na segunda metade da sessão', () => {
    // `peito+triceps` de propósito, NÃO `pernas+costas`. O fixture tem 3
    // compostos e 5 isolados para peito+triceps, então a regra é expressável.
    // Para pernas+costas são 7 compostos e 3 isolados: com 8 vagas, no mínimo
    // 5 compostos entram, e 5 não cabem nas 4 primeiras vagas — o limite
    // seria matematicamente impossível e o teste estaria medindo a magreza do
    // fixture, não a regra. Conferido em 200 seeds: com pool folgado o máximo
    // observado é 1; com pool magro, o mínimo é 2.
    const w = generateWorkout(input({ groups: ['peito', 'triceps'], minutes: 60 }), CATALOG);
    const metade = Math.ceil(w.items.length / 2);
    const compostosNaSegundaMetade = w.items
      .slice(metade)
      .filter((it) => it.exercise.isCompound).length;
    expect(compostosNaSegundaMetade).toBeLessThanOrEqual(1);
  });

  it('quando falta isolado, preenche com composto em vez de encurtar o treino', () => {
    // O risco que a porta dura introduz: se ela zerasse o score de todo
    // composto tardio sem exceção, o seletor ficaria sem candidato e o treino
    // sairia curto. `pernas+costas` é justamente o caso de pool magro — tem
    // que chegar ao teto mesmo tendo que usar composto no fim.
    const w = generateWorkout(input({ groups: ['pernas', 'costas'], minutes: 60 }), CATALOG);
    expect(w.items.length).toBe(w.cap);
  });

  it('não repete o mesmo exercício', () => {
    const w = generateWorkout(input({ minutes: 90, goal: 'emagrecimento' }), CATALOG);
    const ids = w.items.map((it) => it.exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seeds diferentes produzem treinos diferentes', () => {
    const a = generateWorkout(input({ seed: 1 }), CATALOG);
    const b = generateWorkout(input({ seed: 2 }), CATALOG);
    expect(a.items.map((i) => i.exercise.id)).not.toEqual(b.items.map((i) => i.exercise.id));
  });

  it('mesma seed produz o mesmo treino', () => {
    const a = generateWorkout(input({ seed: 7 }), CATALOG);
    const b = generateWorkout(input({ seed: 7 }), CATALOG);
    expect(a.items.map((i) => i.exercise.id)).toEqual(b.items.map((i) => i.exercise.id));
  });
});

describe('generateWorkout — casos degenerados', () => {
  it('devolve menos de 3 exercícios quando o pool elegível é pequeno', () => {
    const w = generateWorkout(input({ availableEquipment: ['crossover'] }), CATALOG);
    expect(w.items.length).toBeLessThan(3);
    expect(w.minItems).toBe(3);
  });

  it('sessão só de cardio é válida com 1 item', () => {
    const w = generateWorkout(input({ groups: ['cardio'], minutes: 30, goal: 'emagrecimento' }), CATALOG);
    expect(w.minItems).toBe(1);
    expect(w.items.length).toBeGreaterThanOrEqual(1);
  });

  it('catálogo vazio devolve treino vazio sem lançar', () => {
    const w = generateWorkout(input(), []);
    expect(w.items).toEqual([]);
    expect(w.poolSize).toBe(0);
  });

  it('reporta poolSize para a tela distinguir a causa da falha', () => {
    const w = generateWorkout(input({ availableEquipment: ['crossover'] }), CATALOG);
    expect(w.poolSize).toBeLessThan(6);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/generate.test.ts
```

Esperado: FAIL — `Failed to resolve import "./generate"`.

- [ ] **Step 4: Implementar**

`packages/core/src/engine/generate.ts`:

```ts
import { MAX_EX, MAX_PER_GROUP, WARMUP_SEC } from './constants';
import { costOf, schemeFor } from './budget';
import { eligible } from './filter';
import { mulberry32, weightedPick } from './rng';
import type { Exercise, Input, MuscleGroup, Pattern, Workout, WorkoutItem } from './types';

const MAX_SETS_CEILING = 6;

export function generateWorkout(input: Input, catalog: Exercise[]): Workout {
  const pool = eligible(catalog, input);
  const rng = mulberry32(input.seed);
  const scheme = schemeFor(input);
  const cap = Math.min(MAX_EX[input.goal], scheme.target);
  const budgetSec = input.minutes * 60 - WARMUP_SEC;
  let remaining = budgetSec;

  const picked: Exercise[] = [];
  const usedPatterns = new Map<Pattern, number>();
  const groupCount = new Map<MuscleGroup, number>();

  while (remaining > 0 && picked.length < cap) {
    const candidates = pool
      .filter((ex) => !picked.some((p) => p.id === ex.id))
      .filter((ex) => (groupCount.get(ex.primary) ?? 0) < MAX_PER_GROUP)
      .filter((ex) => costOf(ex, scheme) <= remaining);

    if (candidates.length === 0) break;

    const chosen = weightedPick(
      candidates.map((ex) => ({ item: ex, score: scoreOf(ex, candidates) })),
      rng,
    );

    picked.push(chosen);
    remaining -= costOf(chosen, scheme);
    usedPatterns.set(chosen.pattern, (usedPatterns.get(chosen.pattern) ?? 0) + 1);
    groupCount.set(chosen.primary, (groupCount.get(chosen.primary) ?? 0) + 1);
  }

  const items: WorkoutItem[] = picked.map((exercise) => ({
    exercise,
    sets: exercise.pattern === 'cardio' ? 1 : scheme.sets,
    reps:
      exercise.pattern === 'cardio'
        ? `${(exercise.durationSec ?? 0) / 60} min`
        : scheme.reps,
  }));

  // Sobrou tempo depois do teto? Aumenta VOLUME nos compostos em vez de somar
  // mais aparelho — é o que um professor faz. Round-robin para não empilhar
  // tudo no primeiro exercício, e teto de +1 série: sem ele, 90 min de
  // emagrecimento saía com 9 exercícios × 6 séries = 54 séries.
  const setCap = Math.min(MAX_SETS_CEILING, scheme.sets + 1);
  let extraSets = 0;
  let i = 0;
  let guard = 0;

  while (remaining > 0 && guard++ < 200) {
    const candidates = items.filter(
      (it) => it.exercise.pattern !== 'cardio' && it.sets < setCap,
    );
    // Prefere composto; se não houver (mobilidade, treino só de isolado),
    // aceita qualquer não-cardio em vez de desperdiçar o tempo pedido.
    const compounds = candidates.filter((it) => it.exercise.isCompound);
    const jar = compounds.length > 0 ? compounds : candidates;
    if (jar.length === 0) break;

    const target = jar[i++ % jar.length];
    const cost = target.exercise.avgSecPerSet + scheme.rest;
    if (cost > remaining) break;

    target.sets += 1;
    remaining -= cost;
    extraSets += 1;
  }

  // Sessão só de cardio é treino válido com 1 item: "30 min de esteira" não é
  // treino incompleto. Musculação exige 3 para valer a pena.
  const cardioOnly = pool.length > 0 && pool.every((ex) => ex.pattern === 'cardio');

  return {
    items,
    scheme,
    poolSize: pool.length,
    budgetSec,
    usedSec: budgetSec - remaining,
    cap,
    minItems: cardioOnly ? 1 : 3,
    extraSets,
  };

  function scoreOf(ex: Exercise, candidates: Exercise[]): number {
    let s = 1;

    // Compostos no primeiro TERÇO: o aluno está descansado, então é mais
    // seguro e mais eficaz. Isolados preenchem o final.
    const early = picked.length < Math.max(2, Math.ceil(cap / 3));

    if (early) {
      s *= ex.isCompound ? 4 : 0.3;
    } else if (ex.isCompound) {
      // PORTA DURA, não preferência. Decisão do Robson (jul/2026), medida
      // sobre 1680 gerações: com o multiplicador antigo de 0.5 o composto
      // tardio era só desfavorecido, e a segunda metade tinha 2 ou mais
      // compostos em 24% das sessões — agachamento livre caía no fim em 7.9%
      // delas, com a pessoa exausta e sem professor ao lado. Com a porta,
      // 68% das sessões terminam com ZERO composto tardio e o agachamento
      // tardio cai para 2.4%. A variação não sofre: 184 treinos distintos em
      // 200 contra 187 de antes.
      //
      // Não pode travar o seletor: se TODOS os candidatos forem compostos,
      // `temIsolado` é falso e eles voltam a pontuar. Nunca dá score 0 em
      // todos ao mesmo tempo, então `weightedPick` nunca recebe total 0.
      const temIsolado = candidates.some((c) => !c.isCompound);
      if (temIsolado) return 0;
      s *= 0.5;
    } else {
      s *= 1.4;
    }

    // Cobertura: nenhum grupo dobra antes de todos serem atendidos.
    const untouched = input.groups.filter((g) => !groupCount.has(g));
    if (untouched.length > 0) {
      s *= untouched.includes(ex.primary) ? 5 : 0.2;
    }

    // Não empilha o mesmo padrão de movimento.
    s *= 1 / (1 + (usedPatterns.get(ex.pattern) ?? 0));

    // Não manda o aluno pro mesmo aparelho duas vezes seguidas — fila.
    const last = picked.at(-1);
    if (last && ex.equipment.some((eq) => last.equipment.includes(eq))) {
      s *= 0.4;
    }

    return s;
  }
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/generate.test.ts
```

Esperado: PASS, 19 testes.

Estes 19 testes foram rodados contra esta implementação exata antes de a tarefa ser despachada — o motor real, com `types`/`constants`/`filter`/`budget`/`rng` do repositório. Passam todos. Se algum falhar aqui, a diferença é sua transcrição, não o plano: compare linha por linha antes de mudar qualquer asserção.

Em particular **não relaxe** `não põe composto na segunda metade da sessão`. O limite de 1 é atingível com `peito+triceps` e foi conferido em 200 seeds. Se ele falhar, a porta dura do `scoreOf` não está no lugar.

- [ ] **Step 6: Exportar a API pública do motor**

`packages/core/src/engine/index.ts`:

```ts
export const ENGINE_VERSION = '1.0.0';

export { generateWorkout } from './generate';
export { eligible } from './filter';
export { schemeFor, costOf } from './budget';
export { mulberry32, weightedPick } from './rng';
export * from './constants';
export type * from './types';
```

- [ ] **Step 7: Rodar a suíte inteira e o typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck
```

Esperado: PASS em todos os arquivos; `tsc --noEmit` sem saída.

- [ ] **Step 8: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/engine
git commit -m "feat(engine): seleção de exercícios com teto, cobertura e ordem de compostos

Codifica as quatro regras que um professor aplica sem pensar: composto no
primeiro terço, cobertura antes de repetição, sem empilhar padrão de
movimento, sem mandar pro mesmo aparelho em sequência.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Property test — 1000 combinações aleatórias

O teste mais valioso do conjunto. Testes de exemplo verificam os casos que você imaginou; este verifica os que você não imaginou.

**Files:**
- Test: `packages/core/src/engine/generate.property.test.ts`

**Interfaces:**
- Consumes: `generateWorkout`, `MAX_EX`, `MAX_PER_GROUP` do motor; `CATALOG`, `ALL_EQUIPMENT` do fixture
- Produces: nada — é só teste

- [ ] **Step 1: Escrever o teste (vai falhar se qualquer invariante estiver quebrada)**

`packages/core/src/engine/generate.property.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { generateWorkout } from './generate';
import { MAX_EX, MAX_PER_GROUP } from './constants';
import { mulberry32 } from './rng';
import { CATALOG, ALL_EQUIPMENT } from './__fixtures__/catalog';
import type { Contra, Goal, Input, Level, Minutes, MuscleGroup } from './types';

const GOALS: Goal[] = ['hipertrofia', 'emagrecimento', 'resistencia', 'mobilidade', 'forca'];
const MINUTES: Minutes[] = [20, 30, 40, 45, 50, 60, 90];
/**
 * Os 9 grupos, de propósito — inclusive `ombros` e `gluteos`, que o CATALOG
 * de teste não cobre. Um input pedindo só `ombros` produz pool vazio, e é
 * justamente esse caminho degenerado que precisa ser varrido: o motor tem de
 * devolver treino vazio sem lançar. Não "conserte" removendo os dois.
 */
const GROUPS: MuscleGroup[] = ['peito', 'costas', 'ombros', 'biceps', 'triceps', 'pernas', 'gluteos', 'core', 'cardio'];
const CONTRAS: Contra[] = ['joelho', 'lombar', 'ombro', 'punho', 'cervical'];

/** Gera um Input aleatório mas determinístico a partir de uma seed. */
function randomInput(rng: () => number): Input {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

  /**
   * Fisher-Yates, não `sort(() => rng() - 0.5)`.
   *
   * O sort com comparador inconsistente é um embaralhamento enviesado — não
   * amostra o espaço uniformemente — e consome uma quantidade de `rng()` que
   * depende do algoritmo de ordenação da engine. Num property test isso é
   * duplamente ruim: enviesa a cobertura E amarra o resultado à versão do V8.
   * Fisher-Yates consome exatamente `arr.length - 1` números, sempre.
   */
  const subset = <T,>(arr: T[], max: number): T[] => {
    const n = 1 + Math.floor(rng() * max);
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    return a.slice(0, n);
  };

  return {
    goal: pick(GOALS),
    groups: subset(GROUPS, 4),
    minutes: pick(MINUTES),
    level: (1 + Math.floor(rng() * 3)) as Level,
    availableEquipment: subset(ALL_EQUIPMENT, ALL_EQUIPMENT.length),
    avoid: rng() > 0.7 ? subset(CONTRAS, 2) : [],
    seed: Math.floor(rng() * 1_000_000),
  };
}

describe('generateWorkout — invariantes sobre 1000 inputs aleatórios', () => {
  it('nunca viola nenhuma invariante', () => {
    const rng = mulberry32(20260728);
    const falhas: string[] = [];

    for (let n = 0; n < 1000; n++) {
      const input = randomInput(rng);
      const w = generateWorkout(input, CATALOG);
      const ctx = JSON.stringify({
        goal: input.goal, minutes: input.minutes, level: input.level,
        groups: input.groups, avoid: input.avoid,
        equip: input.availableEquipment.length, seed: input.seed,
      });

      const gymHas = new Set(input.availableEquipment);

      for (const it of w.items) {
        const ex = it.exercise;
        if (!ex.equipment.every((eq) => gymHas.has(eq))) {
          falhas.push(`equipamento indisponível (${ex.id}) — ${ctx}`);
        }
        if (ex.level > input.level) {
          falhas.push(`nível acima do declarado (${ex.id}) — ${ctx}`);
        }
        if (ex.contraindications.some((c) => input.avoid.includes(c))) {
          falhas.push(`contraindicação violada (${ex.id}) — ${ctx}`);
        }
        if (it.sets < 1) {
          falhas.push(`exercício sem série (${ex.id}) — ${ctx}`);
        }
        if (ex.pattern !== 'cardio' && it.sets > w.scheme.sets + 1) {
          falhas.push(`séries acima do teto (${ex.id}: ${it.sets}) — ${ctx}`);
        }
      }

      if (w.usedSec > w.budgetSec) {
        falhas.push(`estourou o orçamento (${w.usedSec} > ${w.budgetSec}) — ${ctx}`);
      }
      if (w.items.length > w.cap || w.items.length > MAX_EX[input.goal]) {
        falhas.push(`acima do teto de exercícios (${w.items.length}) — ${ctx}`);
      }

      const ids = w.items.map((it) => it.exercise.id);
      if (new Set(ids).size !== ids.length) {
        falhas.push(`exercício repetido — ${ctx}`);
      }

      const porGrupo = new Map<string, number>();
      for (const it of w.items) {
        const g = it.exercise.primary;
        porGrupo.set(g, (porGrupo.get(g) ?? 0) + 1);
      }
      for (const [g, count] of porGrupo) {
        if (count > MAX_PER_GROUP) {
          falhas.push(`${count} exercícios do grupo ${g} — ${ctx}`);
        }
      }
    }

    // Mostra no máximo 5 falhas — o suficiente para diagnosticar sem poluir.
    expect(falhas.slice(0, 5)).toEqual([]);
  });

  it('é determinístico: 1000 inputs geram exatamente o mesmo resultado duas vezes', () => {
    const rodar = () => {
      const rng = mulberry32(999);
      return Array.from({ length: 1000 }, () =>
        generateWorkout(randomInput(rng), CATALOG).items.map((it) => it.exercise.id).join(','),
      );
    };
    expect(rodar()).toEqual(rodar());
  });
});
```

- [ ] **Step 2: Rodar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/engine/generate.property.test.ts
```

Esperado: PASS, 2 testes, em menos de 2 segundos (o motor roda em ~0.1ms por geração).

Se falhar, a mensagem traz o `ctx` com os parâmetros exatos que quebraram — reproduza num teste de exemplo em `generate.test.ts` antes de corrigir, para o caso não voltar.

- [ ] **Step 3: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/engine
git commit -m "test(engine): property test com 1000 inputs aleatórios

Afirma as invariantes que testes de exemplo não pegam: equipamento, nível,
contraindicação, orçamento, teto de exercícios, séries e repetição.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Fase C — Catálogo e dados

### Task 7: Schema do catálogo em CSV, validado no CI

O CSV é a fonte de autoria (D3). Se ele puder entrar inválido, o motor recebe lixo e os testes do motor não pegam — eles usam fixture. Este é o portão.

**Files:**
- Create: `packages/core/src/catalog/schema.ts`
- Create: `catalog/equipment.csv`
- Create: `catalog/exercises.csv` (com 3 linhas de exemplo, para o teste ter o que ler)
- Test: `packages/core/src/catalog/schema.test.ts`
- Create: `scripts/validate-catalog.ts`

**Interfaces:**
- Consumes: tipos `Exercise`, `Contra`, `MuscleGroup`, `Pattern` de `../engine/types`
- Produces:
  - `parseEquipmentCsv(text: string): EquipmentRow[]`
  - `parseExercisesCsv(text: string, knownEquipment: Set<string>): Exercise[]` — lança `CatalogError` com linha e coluna
  - `type EquipmentRow = { id: string; name: string; category: string }`

- [ ] **Step 1: Definir o formato do CSV**

Arrays vão numa célula separados por `|`. Sem vírgula dentro de célula — o parser é intencionalmente ingênuo, e uma vírgula extra deve quebrar o build em vez de virar dado silenciosamente errado.

`catalog/equipment.csv`:

```csv
id,name,category
barra,Barra livre,livre
banco,Banco reto,acessorio
banco-incl,Banco inclinado,acessorio
halter,Halteres,livre
mq-supino,Máquina supino,maquina
mq-crucifixo,Máquina crucifixo,maquina
crossover,Cross Over,cabo
polia-alta,Polia alta,cabo
polia-baixa,Polia baixa,cabo
corda,Corda,acessorio
mq-remada,Máquina remada,maquina
barra-fixa,Barra fixa,corporal
leg-press,Leg Press 45°,maquina
hack,Hack machine,maquina
smith,Smith,maquina
extensora,Cadeira extensora,maquina
flexora,Mesa flexora,maquina
gluteo-mq,Máquina glúteo,maquina
abdutora,Cadeira abdutora,maquina
panturrilha,Máquina panturrilha,maquina
banco-scott,Banco Scott,acessorio
kettlebell,Kettlebell,livre
esteira,Esteira,cardio
bike,Bike ergométrica,cardio
eliptico,Elíptico,cardio
```

`catalog/exercises.csv` (semente — a task 9 preenche o resto):

```csv
id,name,primary,secondary,equipment,level,pattern,is_compound,avg_sec_per_set,duration_sec,contraindications,cue
supino-reto,Supino reto com barra,peito,triceps|ombros,barra|banco,2,push-h,true,35,,ombro,Escápulas retraídas; barra na linha do mamilo
leg-press,Leg Press 45°,pernas,gluteos,leg-press,1,squat,true,38,,joelho,Não deixe a lombar sair do apoio
esteira-moderada,Esteira — ritmo moderado,cardio,,esteira,1,cardio,false,0,600,,Mantenha um ritmo em que consiga conversar
```

- [ ] **Step 2: Escrever os testes (vão falhar)**

`packages/core/src/catalog/schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv, CatalogError } from './schema';

// Caminhos relativos ao CWD, não ao arquivo de teste. Isso só é válido por
// causa da Global Constraint "npm test roda sempre na RAIZ" — rodar o vitest
// de dentro de um workspace dá `ENOENT: catalog/equipment.csv`. Se você vir
// esse erro, o problema é de onde você chamou, não do caminho.
const equipCsv = readFileSync('catalog/equipment.csv', 'utf8');
const exCsv = readFileSync('catalog/exercises.csv', 'utf8');

describe('parseEquipmentCsv', () => {
  it('lê o arquivo real do repo', () => {
    const rows = parseEquipmentCsv(equipCsv);
    expect(rows.length).toBeGreaterThan(10);
    expect(rows[0]).toHaveProperty('id');
    expect(rows[0]).toHaveProperty('category');
  });

  it('rejeita id duplicado', () => {
    const bad = 'id,name,category\nbarra,Barra,livre\nbarra,Outra,maquina\n';
    expect(() => parseEquipmentCsv(bad)).toThrow(CatalogError);
  });

  it('rejeita categoria desconhecida', () => {
    const bad = 'id,name,category\nx,X,teletransporte\n';
    expect(() => parseEquipmentCsv(bad)).toThrow(/categoria/i);
  });
});

describe('parseExercisesCsv', () => {
  const known = () => new Set(parseEquipmentCsv(equipCsv).map((e) => e.id));

  it('lê o arquivo real do repo', () => {
    const out = parseExercisesCsv(exCsv, known());
    expect(out.length).toBeGreaterThanOrEqual(3);
  });

  it('separa arrays por pipe', () => {
    const out = parseExercisesCsv(exCsv, known());
    const supino = out.find((e) => e.id === 'supino-reto')!;
    expect(supino.secondary).toEqual(['triceps', 'ombros']);
    expect(supino.equipment).toEqual(['barra', 'banco']);
    expect(supino.contraindications).toEqual(['ombro']);
  });

  it('trata célula vazia como array vazio, não como [""]', () => {
    const out = parseExercisesCsv(exCsv, known());
    const esteira = out.find((e) => e.id === 'esteira-moderada')!;
    expect(esteira.secondary).toEqual([]);
    expect(esteira.contraindications).toEqual([]);
  });

  it('converte is_compound para boolean de verdade', () => {
    const out = parseExercisesCsv(exCsv, known());
    expect(out.find((e) => e.id === 'supino-reto')!.isCompound).toBe(true);
    expect(out.find((e) => e.id === 'esteira-moderada')!.isCompound).toBe(false);
  });

  it('rejeita equipamento que não existe no equipment.csv', () => {
    const bad = exCsv + 'fake,Fake,peito,,teletransportador,1,iso,false,20,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/teletransportador/);
  });

  it('rejeita avg_sec_per_set fora de 10-60 para não-cardio', () => {
    const bad = exCsv + 'lento,Lento,peito,,barra,1,iso,false,900,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/avg_sec_per_set/);
  });

  it('exige duration_sec em exercício de cardio', () => {
    const bad = exCsv + 'bike-x,Bike,cardio,,bike,1,cardio,false,0,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/duration_sec/);
  });

  it('rejeita grupo muscular inválido', () => {
    const bad = exCsv + 'x,X,panturrilha,,barra,1,iso,false,20,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/primary/);
  });

  it('rejeita contraindicação fora do vocabulário', () => {
    const bad = exCsv + 'x,X,peito,,barra,1,iso,false,20,,dedao,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/contraindic/i);
  });

  it('rejeita id de exercício duplicado', () => {
    // O parser tem essa guarda; sem teste ela podia ser removida num refactor
    // sem ninguém notar. Um id duplicado no catálogo faria o motor tratar dois
    // exercícios diferentes como o mesmo na deduplicação do `generateWorkout`.
    const bad = exCsv + 'supino-reto,Outro supino,peito,,barra,1,iso,false,30,,,\n';
    expect(() => parseExercisesCsv(bad, known())).toThrow(/duplicado/i);
  });

  it('aponta o número da linha no erro', () => {
    // A linha é DERIVADA do arquivo, não fixada em 5. Hoje o CSV tem 4 linhas
    // físicas e a linha ruim cai na 5 — mas a task 9 enche o catálogo com 269
    // exercícios, e aí a mesma linha ruim cai na 271. Um `/linha 5/` fixo
    // quebraria nessa task sem que nada em `schema.ts` tivesse regredido.
    const linhaEsperada = exCsv.trim().split('\n').length + 1;
    const bad = exCsv + 'x,X,inexistente,,barra,1,iso,false,20,,,\n';
    try {
      parseExercisesCsv(bad, known());
      expect.unreachable('deveria ter lançado');
    } catch (e) {
      expect((e as CatalogError).message).toMatch(new RegExp(`linha ${linhaEsperada}`));
    }
  });

  it('rejeita is_compound que não seja exatamente true ou false', () => {
    // "1", "ture", "True" e célula vazia viravam `false` em silêncio, e este
    // campo decide a ordem dos exercícios na sessão.
    for (const v of ['1', 'ture', 'True', '']) {
      const bad = exCsv + `z,Z,peito,,barra,1,iso,${v},30,,,\n`;
      expect(() => parseExercisesCsv(bad, known())).toThrow(/is_compound/);
    }
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/catalog/schema.test.ts
```

Esperado: FAIL — `Failed to resolve import "./schema"`.

- [ ] **Step 4: Implementar**

`packages/core/src/catalog/schema.ts`:

```ts
import { z } from 'zod';
// Import relativo: este arquivo VIVE em @quickfit/core, então não se
// auto-referencia pelo nome do pacote.
// Só `Exercise`. Os vocabulários (`GROUPS`, `PATTERNS`, `CONTRAS`) são
// declarados abaixo como const arrays porque o zod precisa dos VALORES em
// runtime, e um `import type` não sobrevive à compilação. Importar
// `MuscleGroup`/`Pattern`/`Contra`/`Level` aqui só para documentar a intenção
// quebra o `noUnusedLocals` com TS6196.
import type { Exercise } from '../engine/types';

export class CatalogError extends Error {}

const GROUPS = [
  'peito', 'costas', 'ombros', 'biceps', 'triceps',
  'pernas', 'gluteos', 'core', 'cardio',
] as const;

const PATTERNS = [
  'push-h', 'push-v', 'pull-h', 'pull-v',
  'squat', 'hinge', 'lunge', 'iso', 'core', 'cardio',
] as const;

const CONTRAS = ['joelho', 'lombar', 'ombro', 'punho', 'cervical'] as const;

const CATEGORIES = ['maquina', 'livre', 'cabo', 'cardio', 'acessorio', 'corporal'] as const;

export type EquipmentRow = { id: string; name: string; category: (typeof CATEGORIES)[number] };

const equipmentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id deve ser kebab-case minúsculo'),
  name: z.string().min(1, 'name não pode ficar vazio'),
  category: z.enum(CATEGORIES, { message: 'categoria inválida' }),
});

const exerciseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id deve ser kebab-case minúsculo'),
  name: z.string().min(1, 'name não pode ficar vazio'),
  primary: z.enum(GROUPS, { message: 'primary inválido' }),
  secondary: z.array(z.enum(GROUPS, { message: 'secondary inválido' })),
  equipment: z.array(z.string()),
  // Cadeia de number em vez de union de literais: `z.union([...], { message })`
  // NÃO aplica a mensagem custom em erro de união — o zod devolve "Invalid
  // input" em inglês, testado. Com min/max a faixa é a mesma e a mensagem sai
  // em pt-BR. O `as Exercise` no fim da função reconcilia `number` com `Level`.
  level: z
    .number({ message: 'level precisa ser um número' })
    .int('level precisa ser inteiro')
    .min(1, 'level precisa ser 1, 2 ou 3')
    .max(3, 'level precisa ser 1, 2 ou 3'),
  pattern: z.enum(PATTERNS, { message: 'pattern inválido' }),
  isCompound: z.boolean(),
  avgSecPerSet: z
    .number({ message: 'avg_sec_per_set precisa ser um número' })
    .int('avg_sec_per_set precisa ser inteiro'),
  durationSec: z
    .number({ message: 'duration_sec precisa ser um número' })
    .int('duration_sec precisa ser inteiro')
    .positive('duration_sec precisa ser positivo')
    .optional(),
  contraindications: z.array(z.enum(CONTRAS, { message: 'contraindicação inválida' })),
  cue: z.string().optional(),
});

/** Parser deliberadamente ingênuo: vírgula dentro de célula deve quebrar o build. */
function rows(text: string): { cols: string[]; line: number }[] {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',').map((c) => c.trim());
  return lines.slice(1).map((raw, i) => {
    const cols = raw.split(',').map((c) => c.trim());
    if (cols.length !== header.length) {
      throw new CatalogError(
        `linha ${i + 2}: esperava ${header.length} colunas, achei ${cols.length}. ` +
          `Vírgula dentro de célula? Use "|" para separar valores múltiplos.`,
      );
    }
    return { cols, line: i + 2 };
  });
}

const list = (cell: string): string[] =>
  cell === '' ? [] : cell.split('|').map((s) => s.trim()).filter(Boolean);

export function parseEquipmentCsv(text: string): EquipmentRow[] {
  const out: EquipmentRow[] = [];
  const seen = new Set<string>();

  for (const { cols, line } of rows(text)) {
    const [id, name, category] = cols;
    const parsed = equipmentSchema.safeParse({ id, name, category });
    if (!parsed.success) {
      throw new CatalogError(`linha ${line}: ${parsed.error.issues[0].message}`);
    }
    if (seen.has(id)) throw new CatalogError(`linha ${line}: id duplicado "${id}"`);
    seen.add(id);
    out.push(parsed.data);
  }
  return out;
}

export function parseExercisesCsv(text: string, knownEquipment: Set<string>): Exercise[] {
  const out: Exercise[] = [];
  const seen = new Set<string>();

  for (const { cols, line } of rows(text)) {
    const [
      id, name, primary, secondary, equipment, level, pattern,
      isCompound, avgSecPerSet, durationSec, contraindications, cue,
    ] = cols;

    // `isCompound === 'true'` sozinho aceita QUALQUER coisa e devolve false em
    // silêncio: "True", "TRUE", "1", "ture", célula vazia — todos viravam
    // `false` sem erro. E `isCompound` é o campo que decide a ORDEM do treino
    // (composto no primeiro terço, task 5), então um typo aqui reordena a
    // sessão inteira sem ninguém notar. O `z.boolean()` do schema não pegava
    // porque valida DEPOIS da coerção, quando o valor já é booleano.
    if (isCompound !== 'true' && isCompound !== 'false') {
      throw new CatalogError(
        `linha ${line} (${id}): is_compound = "${isCompound}", ` +
          `precisa ser exatamente "true" ou "false" (minúsculo).`,
      );
    }

    const candidate = {
      id, name, primary,
      secondary: list(secondary),
      equipment: list(equipment),
      level: Number(level),
      pattern,
      isCompound: isCompound === 'true',
      avgSecPerSet: Number(avgSecPerSet),
      durationSec: durationSec === '' ? undefined : Number(durationSec),
      contraindications: list(contraindications),
      cue: cue === '' ? undefined : cue,
    };

    const parsed = exerciseSchema.safeParse(candidate);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new CatalogError(
        `linha ${line} (${id}): ${issue.path.join('.')} — ${issue.message}`,
      );
    }
    const ex = parsed.data as Exercise;

    if (seen.has(ex.id)) throw new CatalogError(`linha ${line}: id duplicado "${ex.id}"`);
    seen.add(ex.id);

    for (const eq of ex.equipment) {
      if (!knownEquipment.has(eq)) {
        throw new CatalogError(
          `linha ${line} (${ex.id}): equipamento "${eq}" não existe em equipment.csv`,
        );
      }
    }

    if (ex.pattern === 'cardio') {
      if (!ex.durationSec) {
        throw new CatalogError(`linha ${line} (${ex.id}): cardio exige duration_sec`);
      }
    } else if (ex.avgSecPerSet < 10 || ex.avgSecPerSet > 60) {
      throw new CatalogError(
        `linha ${line} (${ex.id}): avg_sec_per_set = ${ex.avgSecPerSet}, ` +
          `fora da faixa 10–60. Uma série não dura isso.`,
      );
    }

    out.push(ex);
  }
  return out;
}
```

- [ ] **Step 5: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/catalog/schema.test.ts
```

Esperado: PASS, 15 testes.

- [ ] **Step 6: Script de validação para o CI**

`scripts/validate-catalog.ts`:

```ts
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from '../packages/core/src/catalog/schema';

try {
  const equip = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
  const known = new Set(equip.map((e) => e.id));
  const ex = parseExercisesCsv(readFileSync('catalog/exercises.csv', 'utf8'), known);

  // Arquivo vazio ou só com header parseia para `[]` sem erro — não há linha
  // para violar a contagem de colunas. Um merge ruim, um `git checkout` errado
  // ou um editor que salvou vazio passariam pelo portão com
  // "OK — 0 equipamentos, 0 exercícios" e exit 0. O piso mora aqui e não no
  // parser porque os testes parseiam strings pequenas de propósito.
  if (equip.length === 0) {
    throw new Error('catalog/equipment.csv não tem nenhuma linha. Arquivo truncado?');
  }
  if (ex.length === 0) {
    throw new Error('catalog/exercises.csv não tem nenhuma linha. Arquivo truncado?');
  }

  const porGrupo = new Map<string, number>();
  for (const e of ex) porGrupo.set(e.primary, (porGrupo.get(e.primary) ?? 0) + 1);

  console.log(`OK — ${equip.length} equipamentos, ${ex.length} exercícios`);
  for (const [g, n] of [...porGrupo].sort()) console.log(`  ${g}: ${n}`);

  // Aviso, não erro: o motor precisa de profundidade para variar o treino.
  for (const [g, n] of porGrupo) {
    if (n < 5) console.warn(`  AVISO: só ${n} exercícios em "${g}" — treino vai repetir`);
  }
} catch (e) {
  console.error(`FALHOU: ${(e as Error).message}`);
  process.exit(1);
}
```

**Nada a instalar nem registrar.** O `tsx` já é devDependency da raiz e o script
`"validate:catalog": "tsx scripts/validate-catalog.ts"` já existe no
`package.json` — ambos entraram na task 1. Confira e siga:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm pkg get scripts.validate:catalog   # deve imprimir o comando acima
```

Se imprimir `{}`, aí sim registre. Não rode `npm install` sem necessidade —
mexer no `package-lock.json` sem motivo suja o diff da review.

- [ ] **Step 7: Rodar a validação**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run validate:catalog
```

Esperado: `OK — 25 equipamentos, 3 exercícios` seguido de avisos de profundidade (esperados nesta fase, o catálogo ainda tem 3 linhas).

- [ ] **Step 8: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add catalog packages/core/src/catalog scripts package.json package-lock.json
git commit -m "feat(catalog): schema do CSV com validação que quebra o build

Equipamento inexistente, avg_sec_per_set absurdo, cardio sem duração e
contraindicação fora do vocabulário passam a ser erro de build, não dado
silenciosamente errado.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Exportar os 269 exercícios do Persona Fit

**Files:**
- Create: `scripts/export-from-app.ts`
- Create: `catalog/exercises.raw.csv` (gerado)
- Modify: `package.json` (script `export:raw`)

**Interfaces:**
- Consumes: `.env.local` com `APP_SUPABASE_URL` e `APP_SUPABASE_SERVICE_ROLE` (projeto do Persona Fit, somente leitura)
- Produces: `catalog/exercises.raw.csv` com as colunas `id,name,group_slug,equipment_text,is_compound,modality` — a entrada da task 9

- [ ] **Step 1: Escrever o script**

`scripts/export-from-app.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';

const url = process.env.APP_SUPABASE_URL;
const key = process.env.APP_SUPABASE_SERVICE_ROLE;

if (!url || !key) {
  console.error('Faltam APP_SUPABASE_URL e APP_SUPABASE_SERVICE_ROLE no .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data, error } = await db
  .from('exercises')
  .select('id, name, is_compound, equipment, modality, exercise_groups(slug)')
  .order('name');

if (error) {
  console.error(`Erro ao ler o Persona Fit: ${error.message}`);
  process.exit(1);
}

const csv = (v: unknown) => String(v ?? '').replace(/,/g, ';').trim();

const slug = (id: string) =>
  id.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const header = 'id,name,group_slug,equipment_text,is_compound,modality';
const lines = (data ?? []).map((r: Record<string, unknown>) => {
  const group = (r.exercise_groups as { slug?: string } | null)?.slug ?? '';
  return [
    slug(String(r.name)),
    csv(r.name),
    csv(group),
    csv(r.equipment),
    r.is_compound ? 'true' : 'false',
    csv(r.modality),
  ].join(',');
});

writeFileSync('catalog/exercises.raw.csv', [header, ...lines].join('\n') + '\n');
console.log(`Exportados ${lines.length} exercícios para catalog/exercises.raw.csv`);
```

Note as duas decisões: o `id` vem do **nome** slugificado, não do UUID do Persona Fit — o QuickFit tem catálogo próprio e um id legível facilita a revisão humana. E vírgulas no texto viram `;` para não quebrar o CSV.

- [ ] **Step 2: Registrar o script**

`package.json` — em `scripts`:

```json
"export:raw": "node --env-file=.env.local ./node_modules/.bin/tsx scripts/export-from-app.ts"
```

- [ ] **Step 3: Preencher as credenciais de leitura no `.env.local`**

Pegue de `app/.env.local` do Persona Fit (`EXPO_PUBLIC_SUPABASE_URL` e a service role do projeto do app) e coloque em `APP_SUPABASE_URL` / `APP_SUPABASE_SERVICE_ROLE`.

- [ ] **Step 4: Rodar o export**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run export:raw
```

Esperado: `Exportados 269 exercícios para catalog/exercises.raw.csv` (o número exato pode diferir — registre o que saiu).

- [ ] **Step 5: Conferir o resultado à mão**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
head -5 catalog/exercises.raw.csv
wc -l catalog/exercises.raw.csv
cut -d, -f3 catalog/exercises.raw.csv | sort | uniq -c | sort -rn
```

Verifique: nenhum `id` vazio, nenhum `group_slug` vazio, e a contagem por grupo faz sentido (peito, costas, pernas devem ser os maiores).

- [ ] **Step 6: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add scripts/export-from-app.ts catalog/exercises.raw.csv package.json
git commit -m "feat(catalog): export dos exercícios do Persona Fit para CSV cru

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Classificação assistida por Claude + revisão humana em duas ondas

O trabalho mais pesado do projeto e o mais crítico: `contraindications` é campo de segurança. O script propõe, **você decide**.

**Files:**
- Create: `scripts/classify.ts`
- Modify: `catalog/exercises.csv` (saída revisada)
- Modify: `package.json` (script `classify`)

**Interfaces:**
- Consumes: `catalog/exercises.raw.csv` (task 8); `catalog/equipment.csv` (task 7); `ANTHROPIC_API_KEY` no `.env.local`
- Produces: `catalog/exercises.csv` no formato exato que `parseExercisesCsv` aceita (task 7)

- [ ] **Step 1: Instalar o SDK da Anthropic**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm install -D @anthropic-ai/sdk
```

É `devDependency` de propósito: o SDK nunca entra no bundle do cliente. Só o script offline usa.

- [ ] **Step 2: Escrever o script de classificação**

`scripts/classify.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseEquipmentCsv } from '../packages/core/src/catalog/schema';

const BATCH = 12;           // saída pequena por chamada = sem risco de truncar
const MODEL = 'claude-opus-5';

const equipment = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
const equipmentIds = equipment.map((e) => e.id);

const Classified = z.object({
  exercises: z.array(
    z.object({
      id: z.string(),
      primary: z.enum([
        'peito', 'costas', 'ombros', 'biceps', 'triceps',
        'pernas', 'gluteos', 'core', 'cardio',
      ]),
      secondary: z.array(
        z.enum([
          'peito', 'costas', 'ombros', 'biceps', 'triceps',
          'pernas', 'gluteos', 'core', 'cardio',
        ]),
      ),
      equipment: z.array(z.enum(equipmentIds as [string, ...string[]])),
      level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      pattern: z.enum([
        'push-h', 'push-v', 'pull-h', 'pull-v',
        'squat', 'hinge', 'lunge', 'iso', 'core', 'cardio',
      ]),
      isCompound: z.boolean(),
      avgSecPerSet: z.number().int().min(0).max(60),
      durationSec: z.number().int().min(0),
      contraindications: z.array(
        z.enum(['joelho', 'lombar', 'ombro', 'punho', 'cervical']),
      ),
      cue: z.string(),
    }),
  ),
});

const SYSTEM = `Você classifica exercícios de academia para um sistema que prescreve
treino automaticamente num totem, sem professor presente. Suas classificações vão
direto para a prescrição de pessoas reais.

Regras:

- "equipment" lista TODOS os aparelhos necessários simultaneamente. Supino reto com
  barra precisa de ["barra","banco"], não só ["barra"]. Peso corporal é [].
  Use exclusivamente ids desta lista: ${equipmentIds.join(', ')}
- "level": 1 = seguro para quem nunca treinou; 2 = exige alguma técnica;
  3 = exige técnica consolidada (agachamento livre, levantamento terra, barra fixa).
- "avgSecPerSet": segundos de execução de UMA série, entre 10 e 60. Isolado leve ~22,
  composto de membro superior ~32, agachamento pesado ~45. Para cardio, use 0.
- "durationSec": só para pattern "cardio" — duração total em segundos. 0 caso contrário.
- "contraindications": este é campo de SEGURANÇA. Marque a articulação que o exercício
  sobrecarrega de forma que alguém com problema ali deveria evitá-lo. Seja conservador:
  na dúvida, marque. Vocabulário: joelho, lombar, ombro, punho, cervical.
- "cue": UMA dica curta de execução em pt-BR, no imperativo, sem ponto final,
  no máximo 60 caracteres. É o que sai impresso na ficha.
- "isCompound": true quando envolve mais de uma articulação.

Devolva um item para CADA exercício recebido, com o mesmo "id".`;

type RawRow = { id: string; name: string; group_slug: string; equipment_text: string; is_compound: string; modality: string };

function readRaw(): RawRow[] {
  const lines = readFileSync('catalog/exercises.raw.csv', 'utf8').trim().split('\n');
  return lines.slice(1).map((l) => {
    const [id, name, group_slug, equipment_text, is_compound, modality] = l.split(',');
    return { id, name, group_slug, equipment_text, is_compound, modality };
  });
}

const cell = (v: string | undefined) => (v ?? '').replace(/,/g, ';').trim();

async function main() {
  const client = new Anthropic();   // lê ANTHROPIC_API_KEY do ambiente
  const raw = readRaw();

  // Retomada: se já existe saída parcial, não reclassifica o que está pronto.
  const done = new Map<string, string>();
  if (existsSync('catalog/exercises.classified.csv')) {
    const lines = readFileSync('catalog/exercises.classified.csv', 'utf8').trim().split('\n');
    for (const l of lines.slice(1)) done.set(l.split(',')[0], l);
    console.log(`Retomando: ${done.size} já classificados`);
  }

  const pending = raw.filter((r) => !done.has(r.id));
  console.log(`${pending.length} exercícios a classificar em lotes de ${BATCH}`);

  for (let i = 0; i < pending.length; i += BATCH) {
    const lote = pending.slice(i, i + BATCH);
    const n = Math.floor(i / BATCH) + 1;
    const total = Math.ceil(pending.length / BATCH);

    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: {
        effort: 'high',
        format: zodOutputFormat(Classified),
      },
      messages: [
        {
          role: 'user',
          content:
            'Classifique estes exercícios. O campo "grupo" e "equipamento (texto livre)" ' +
            'vêm do sistema antigo e podem estar imprecisos — use o nome como fonte principal.\n\n' +
            lote
              .map(
                (r) =>
                  `- id: ${r.id}\n  nome: ${r.name}\n  grupo: ${r.group_slug}\n  ` +
                  `equipamento (texto livre): ${r.equipment_text}\n  modalidade: ${r.modality}`,
              )
              .join('\n'),
        },
      ],
    });

    // Um recusa de classificador aqui indicaria bug no prompt, não caso de
    // política — mas não trate como sucesso silencioso.
    if (response.stop_reason === 'refusal') {
      console.error(`Lote ${n}/${total} recusado (${response.stop_details?.category}). Pulando.`);
      continue;
    }

    const parsed = response.parsed_output;
    if (!parsed) {
      console.error(`Lote ${n}/${total}: saída não validou contra o schema. Pulando.`);
      continue;
    }

    const byId = new Map(lote.map((r) => [r.id, r]));
    for (const c of parsed.exercises) {
      const src = byId.get(c.id);
      if (!src) {
        console.warn(`  id desconhecido devolvido: ${c.id}`);
        continue;
      }
      done.set(
        c.id,
        [
          c.id,
          cell(src.name),
          c.primary,
          c.secondary.join('|'),
          c.equipment.join('|'),
          String(c.level),
          c.pattern,
          String(c.isCompound),
          String(c.pattern === 'cardio' ? 0 : c.avgSecPerSet),
          c.pattern === 'cardio' ? String(c.durationSec || 600) : '',
          c.contraindications.join('|'),
          cell(c.cue),
        ].join(','),
      );
    }

    // Grava a cada lote — se o script morrer, nada é perdido.
    const header =
      'id,name,primary,secondary,equipment,level,pattern,is_compound,' +
      'avg_sec_per_set,duration_sec,contraindications,cue';
    writeFileSync(
      'catalog/exercises.classified.csv',
      [header, ...[...done.values()]].join('\n') + '\n',
    );
    console.log(`Lote ${n}/${total} — ${done.size} classificados no total`);
  }

  console.log('\nPronto: catalog/exercises.classified.csv');
  console.log('AGORA REVISE. Não copie para exercises.csv sem ler.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Três decisões deliberadas no script: escreve num arquivo `.classified.csv` **separado** de `exercises.csv`, para que a revisão seja um passo consciente em vez de acidente; grava a cada lote e retoma de onde parou, porque 23 chamadas de LLM vão falhar em alguma; e usa `messages.parse()` com zod, então formato inválido é rejeitado e refeito pelo SDK em vez de virar CSV quebrado.

Sobre `fallbacks`: o parâmetro server-side de fallback existe para quando classificadores de política recusam um pedido, e é recomendado em código de produção com `claude-opus-5`. Aqui ele foi omitido porque classificar metadado de exercício não toca nenhuma categoria de política — uma recusa indicaria bug no prompt, e o script já registra e pula o lote em vez de gravar dado errado. Se você vir recusas, é sinal para olhar o prompt, não para adicionar fallback.

- [ ] **Step 3: Registrar o script**

`package.json` — em `scripts`:

```json
"classify": "node --env-file=.env.local ./node_modules/.bin/tsx scripts/classify.ts"
```

- [ ] **Step 4: Rodar em um lote só, para conferir a qualidade antes de gastar as 23 chamadas**

Reduza `BATCH` para 12 e adicione temporariamente após `const pending = ...`:

```ts
// TEMPORÁRIO — só o primeiro lote, para inspeção
pending.length = BATCH;
```

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run classify
cat catalog/exercises.classified.csv
```

Leia as 12 linhas. Cheque especificamente: os `equipment` estão completos (supino com `barra|banco`, não só `barra`)? As `contraindications` fazem sentido? Os `cue` estão em pt-BR e curtos?

Se a qualidade estiver ruim, ajuste o `SYSTEM` e rode de novo — apagando `catalog/exercises.classified.csv` antes, senão a retomada pula tudo.

- [ ] **Step 5: Remover o limitador e classificar tudo**

Apague a linha `pending.length = BATCH;` e rode:

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run classify
```

Esperado: ~23 lotes, cada um levando de 20 a 60 segundos. Não é rápido e não precisa ser.

- [ ] **Step 6: Onda 1 da revisão — os ~110 que a demo exercita**

Abra `catalog/exercises.classified.csv` numa planilha. Revise **primeiro** os exercícios dos grupos que os 4 atalhos usam: peito, tríceps, costas, bíceps, pernas, glúteos. Isso libera o desenvolvimento das telas (D7).

Ordem de prioridade dentro da revisão:

1. **`contraindications`** — o único campo em que um erro machuca alguém. Não delegue.
2. **`equipment`** — um erro aqui quebra a promessa central do produto (prescrever aparelho que a academia não tem).
3. **`level`** — um erro aqui prescreve agachamento livre para iniciante.
4. `avgSecPerSet`, `pattern`, `cue` — erram sem consequência grave.

Copie as linhas revisadas para `catalog/exercises.csv`, mantendo o header.

- [ ] **Step 7: Validar o catálogo revisado**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run validate:catalog
```

Esperado: `OK — 25 equipamentos, ~110 exercícios` e nenhum aviso de grupo com menos de 5 exercícios entre os revisados.

- [ ] **Step 8: Rodar a suíte para confirmar que o motor aceita o catálogo real**

Acrescente um teste de integração leve — o único do motor que lê arquivo, e por isso mora fora de `packages/core/src/engine/`:

`packages/core/src/catalog/integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from './schema';
import { generateWorkout } from '../engine';
import type { Input, Minutes } from '@quickfit/core/engine';

const equip = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
const catalog = parseExercisesCsv(
  readFileSync('catalog/exercises.csv', 'utf8'),
  new Set(equip.map((e) => e.id)),
);
const allEquipment = equip.map((e) => e.id);

const ATALHOS: Array<{ label: string; groups: Input['groups']; minutes: Minutes }> = [
  { label: 'Peito + Tríceps', groups: ['peito', 'triceps'], minutes: 45 },
  { label: 'Costas + Bíceps', groups: ['costas', 'biceps'], minutes: 45 },
  { label: 'Perna completa',  groups: ['pernas', 'gluteos'], minutes: 60 },
  { label: 'Treino rápido',   groups: ['peito', 'costas', 'pernas'], minutes: 20 },
];

describe('catálogo real × motor', () => {
  it.each(ATALHOS)('atalho "$label" gera treino completo', ({ groups, minutes }) => {
    const w = generateWorkout(
      { goal: 'hipertrofia', groups, minutes, level: 2, availableEquipment: allEquipment, avoid: [], seed: 1 },
      catalog,
    );
    expect(w.items.length).toBeGreaterThanOrEqual(w.minItems);
  });

  it('o gestor testando combinação esquisita ainda recebe treino', () => {
    // Este é o teste que a spec §12 define como critério de sucesso da demo.
    const w = generateWorkout(
      { goal: 'mobilidade', groups: ['ombros'], minutes: 90, level: 3, availableEquipment: allEquipment, avoid: [], seed: 3 },
      catalog,
    );
    expect(w.items.length).toBeGreaterThanOrEqual(3);
  });
});
```

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test
```

Se `combinação esquisita` falhar, o catálogo revisado ainda não tem profundidade em `ombros` e mobilidade — volte ao Step 6 e revise esses exercícios antes de seguir.

- [ ] **Step 9: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add catalog scripts/classify.ts packages/core/src/catalog package.json package-lock.json
git commit -m "feat(catalog): classificação assistida por Claude + onda 1 revisada

Script propõe via claude-opus-5 com saída validada por zod; contraindicação,
equipamento e nível revisados à mão. Onda 1 cobre os grupos dos 4 atalhos.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: Onda 2 — a cauda (pode rodar em paralelo com as fases D e E)**

Revise os exercícios restantes de `exercises.classified.csv` e acrescente a `exercises.csv`. Rode `npm run validate:catalog && npm test` e commite separado. **Isto não bloqueia nenhuma tarefa seguinte** — é a mitigação de D7.

---

### Task 10: Schema do Supabase e RLS

Sem login no totem, tudo passa pela role `anon`. Escrever as policies erradas aqui expõe a telemetria de todas as academias.

**Files:**
- Create: `supabase/migrations/20260728000000_catalog.sql`
- Create: `supabase/migrations/20260728000100_gyms.sql`
- Create: `supabase/migrations/20260728000200_workouts.sql`
- Create: `supabase/migrations/20260728000300_rls.sql`
- Create: `supabase/migrations/20260728000400_embellishments.sql`
- Create: `supabase/config.toml`

**Interfaces:**
- Consumes: projeto Supabase `jpgnplzkdbfmjkinfvln`
- Produces: tabelas `equipment`, `exercises`, `exercise_secondary_groups`, `exercise_equipment`, `exercise_contraindications`, `gyms`, `gym_equipment`, `generated_workouts`, `embellishments`; view `gym_available_equipment`

- [ ] **Step 1: Ligar o CLI ao projeto**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
supabase init
supabase link --project-ref jpgnplzkdbfmjkinfvln
```

O `link` pede a senha do banco. Se você não a tem, gere uma nova no dashboard em Settings → Database.

- [ ] **Step 2: Migration do catálogo**

`supabase/migrations/20260728000000_catalog.sql`:

```sql
-- Catálogo global, compartilhado por todas as academias.

create table if not exists public.equipment (
  id       text primary key,
  name     text not null,
  category text not null
    check (category in ('maquina','livre','cabo','cardio','acessorio','corporal'))
);

create table if not exists public.exercises (
  id              text primary key,
  name            text not null,
  primary_group   text not null
    check (primary_group in ('peito','costas','ombros','biceps','triceps',
                             'pernas','gluteos','core','cardio')),
  level           smallint not null check (level between 1 and 3),
  pattern         text not null
    check (pattern in ('push-h','push-v','pull-h','pull-v','squat','hinge',
                       'lunge','iso','core','cardio')),
  is_compound     boolean not null default false,
  avg_sec_per_set smallint not null check (avg_sec_per_set between 0 and 60),
  duration_sec    integer check (duration_sec is null or duration_sec > 0),
  cue             text,
  video_url       text,
  -- cardio precisa de duração; o resto precisa de série com tempo plausível
  constraint cardio_tem_duracao check (
    (pattern = 'cardio' and duration_sec is not null)
    or (pattern <> 'cardio' and avg_sec_per_set between 10 and 60)
  )
);

create table if not exists public.exercise_secondary_groups (
  exercise_id text not null references public.exercises(id) on delete cascade,
  group_id    text not null
    check (group_id in ('peito','costas','ombros','biceps','triceps',
                        'pernas','gluteos','core','cardio')),
  primary key (exercise_id, group_id)
);

create table if not exists public.exercise_equipment (
  exercise_id  text not null references public.exercises(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  primary key (exercise_id, equipment_id)
);

create table if not exists public.exercise_contraindications (
  exercise_id text not null references public.exercises(id) on delete cascade,
  tag         text not null
    check (tag in ('joelho','lombar','ombro','punho','cervical')),
  primary key (exercise_id, tag)
);

create index if not exists exercises_primary_group_idx
  on public.exercises (primary_group);

comment on table public.exercises is
  'Catálogo do QuickFit. Fonte de autoria é catalog/exercises.csv no repo.';
```

- [ ] **Step 3: Migration das academias**

`supabase/migrations/20260728000100_gyms.sql`:

```sql
create table if not exists public.gyms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  logo_url     text,
  theme        jsonb not null default '{"accent":"#39FF14","mode":"dark"}'::jsonb,
  trainer_name text,
  trainer_cref text,
  created_at   timestamptz not null default now()
);

create table if not exists public.gym_equipment (
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  equipment_id text not null references public.equipment(id),
  -- o gestor desliga aqui quando o aparelho está em manutenção
  is_available boolean not null default true,
  primary key (gym_id, equipment_id)
);

-- O cliente lê SÓ isto para montar Input.availableEquipment.
create or replace view public.gym_available_equipment as
  select gym_id, equipment_id
    from public.gym_equipment
   where is_available;

comment on view public.gym_available_equipment is
  'Equipamento efetivamente utilizável hoje. É o que alimenta o filtro do motor.';
```

- [ ] **Step 4: Migration dos treinos gerados**

`supabase/migrations/20260728000200_workouts.sql`:

```sql
create table if not exists public.generated_workouts (
  -- nanoid de 10 chars: URL curta gera QR de baixa densidade, que lê rápido
  -- em câmera ruim sob luz forte.
  id           text primary key,
  gym_id       uuid not null references public.gyms(id) on delete cascade,
  input        jsonb not null,
  exercises    jsonb not null,
  parq_blocked boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists generated_workouts_gym_created_idx
  on public.generated_workouts (gym_id, created_at desc);

-- As estatísticas do painel saem de views sobre esta tabela. Nenhuma
-- tabela nova de agregação na fase 1.
create or replace view public.stats_por_hora as
  select gym_id,
         date_trunc('hour', created_at) as hora,
         count(*)                       as treinos,
         count(*) filter (where parq_blocked) as encaminhados
    from public.generated_workouts
   group by 1, 2;
```

- [ ] **Step 5: Migration do cache de enfeite**

`supabase/migrations/20260728000400_embellishments.sql`:

```sql
-- Cache do enfeite de IA. O enfeite de "peito+tríceps, hipertrofia, 45min" é
-- praticamente idêntico toda vez — cachear derruba ~90% das chamadas de LLM
-- numa academia real e leva a latência de p50 a zero.
create table if not exists public.embellishments (
  -- sha256 de (goal, groups ordenados, ids dos exercícios em ordem)
  cache_key  text primary key,
  title      text not null,
  cues       jsonb not null,   -- { "<exercise_id>": "dica curta" }
  model      text not null,
  created_at timestamptz not null default now(),
  hits       integer not null default 0
);

create or replace function public.bump_embellishment_hits(k text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.embellishments set hits = hits + 1 where cache_key = k;
$$;
```

- [ ] **Step 6: Migration de RLS — a mais importante**

`supabase/migrations/20260728000300_rls.sql`:

```sql
-- Não há login no totem. Tudo passa pela role `anon`, então cada policy
-- precisa ser escrita como se fosse pública — porque é.

alter table public.equipment                  enable row level security;
alter table public.exercises                  enable row level security;
alter table public.exercise_secondary_groups  enable row level security;
alter table public.exercise_equipment         enable row level security;
alter table public.exercise_contraindications enable row level security;
alter table public.gyms                       enable row level security;
alter table public.gym_equipment              enable row level security;
alter table public.generated_workouts         enable row level security;
alter table public.embellishments             enable row level security;

-- Catálogo: leitura pública. É dado de domínio, não segredo.
create policy anon_read_equipment  on public.equipment
  for select to anon using (true);
create policy anon_read_exercises  on public.exercises
  for select to anon using (true);
create policy anon_read_secondary  on public.exercise_secondary_groups
  for select to anon using (true);
create policy anon_read_ex_equip   on public.exercise_equipment
  for select to anon using (true);
create policy anon_read_contra     on public.exercise_contraindications
  for select to anon using (true);

-- Academias e equipamento da unidade: leitura pública.
-- `theme` e `trainer_cref` são exibidos no totem, então não são sigilosos.
create policy anon_read_gyms       on public.gyms
  for select to anon using (true);
create policy anon_read_gym_equip  on public.gym_equipment
  for select to anon using (true);

-- Treinos gerados: o totem PODE inserir.
create policy anon_insert_workout on public.generated_workouts
  for insert to anon with check (true);

-- Treinos gerados: leitura SÓ por id, nunca listagem.
--
-- Uma policy `using (true)` de SELECT permitiria `select * from
-- generated_workouts` e qualquer pessoa dumparia a telemetria de todas as
-- academias. A função abaixo devolve UM registro pelo nanoid inadivinhável e
-- é a única porta de leitura — nenhuma policy de SELECT é criada.
create or replace function public.get_workout(workout_id text)
returns table (id text, gym_id uuid, input jsonb, exercises jsonb, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select w.id, w.gym_id, w.input, w.exercises, w.created_at
    from public.generated_workouts w
   where w.id = workout_id
     and not w.parq_blocked
   limit 1;
$$;

grant execute on function public.get_workout(text) to anon;

-- Cache de enfeite: o totem lê e escreve. Não contém dado de aluno.
create policy anon_read_embellishment   on public.embellishments
  for select to anon using (true);
create policy anon_insert_embellishment on public.embellishments
  for insert to anon with check (true);

grant execute on function public.bump_embellishment_hits(text) to anon;
```

- [ ] **Step 7: Aplicar as migrations**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
supabase db push
```

Esperado: `Finished supabase db push.` sem erro.

- [ ] **Step 8: Verificar que `anon` NÃO consegue listar treinos**

Este é o teste que vale a tarefa. Crie um treino falso com a service role e tente listá-lo com a anon.

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
set -a; . ./.env.local; set +a

# 1. Cria uma academia e um treino com a service role
curl -s -X POST "$VITE_SUPABASE_URL/rest/v1/gyms" \
  -H "apikey: $SUPABASE_SERVICE_ROLE" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE" \
  -H "Content-Type: application/json" -H "Prefer: return=representation" \
  -d '{"slug":"teste-rls","name":"Academia Teste"}' | head -c 200; echo

# 2. Tenta LISTAR treinos com a chave anon — deve vir vazio
echo "--- listagem com anon (deve ser []) ---"
curl -s "$VITE_SUPABASE_URL/rest/v1/generated_workouts?select=id" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
echo

# 3. Confirma que o catálogo É legível com anon
echo "--- catálogo com anon (deve ter dados depois do seed) ---"
curl -s "$VITE_SUPABASE_URL/rest/v1/equipment?select=id&limit=3" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
echo
```

Esperado no passo 2: `[]`. Se vier qualquer registro, existe uma policy de SELECT em `generated_workouts` que não deveria existir — remova antes de seguir.

- [ ] **Step 9: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add supabase
git commit -m "feat(db): schema do catálogo, academias, treinos e cache de enfeite

RLS escrita para a role anon (não há login no totem). Treinos são legíveis
apenas por id via get_workout(), nunca listáveis — sem isso qualquer um
dumparia a telemetria de todas as academias.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Semear o catálogo e carregá-lo com cache offline

**Files:**
- Create: `scripts/seed-catalog.ts`
- Create: `apps/totem/src/data/supabase.ts`
- Create: `apps/totem/src/data/loadCatalog.ts`
- Test: `apps/totem/src/data/loadCatalog.test.ts`
- Modify: `package.json` (script `seed:catalog`)

**Interfaces:**
- Consumes: `parseEquipmentCsv`, `parseExercisesCsv` de `../catalog/schema`; tipos do motor
- Produces:
  - `supabase` — cliente único com a chave anon
  - `loadCatalog(): Promise<CatalogBundle>` onde `type CatalogBundle = { exercises: Exercise[]; gym: Gym; availableEquipment: string[]; fromCache: boolean }`
  - `type Gym = { id: string; slug: string; name: string; logoUrl: string | null; theme: GymTheme; trainerName: string | null; trainerCref: string | null }`
  - `type GymTheme = { accent: string; mode: 'dark' | 'light' }`

- [ ] **Step 1: Escrever o script de seed**

`scripts/seed-catalog.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { parseEquipmentCsv, parseExercisesCsv } from '../packages/core/src/catalog/schema';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE;
if (!url || !key) {
  console.error('Faltam VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE no .env.local');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const equipment = parseEquipmentCsv(readFileSync('catalog/equipment.csv', 'utf8'));
const exercises = parseExercisesCsv(
  readFileSync('catalog/exercises.csv', 'utf8'),
  new Set(equipment.map((e) => e.id)),
);

const die = (label: string, error: { message: string } | null) => {
  if (error) {
    console.error(`${label}: ${error.message}`);
    process.exit(1);
  }
};

// 1. Equipamento
die('equipment', (await db.from('equipment').upsert(equipment)).error);
console.log(`equipment: ${equipment.length}`);

// 2. Exercícios (upsert por id — idempotente)
die(
  'exercises',
  (
    await db.from('exercises').upsert(
      exercises.map((e) => ({
        id: e.id,
        name: e.name,
        primary_group: e.primary,
        level: e.level,
        pattern: e.pattern,
        is_compound: e.isCompound,
        avg_sec_per_set: e.avgSecPerSet,
        duration_sec: e.durationSec ?? null,
        cue: e.cue ?? null,
      })),
    )
  ).error,
);
console.log(`exercises: ${exercises.length}`);

// 3. Junções: apaga e reinsere, porque remover um equipamento de um
// exercício no CSV tem que remover a linha no banco.
const ids = exercises.map((e) => e.id);
for (const table of [
  'exercise_secondary_groups',
  'exercise_equipment',
  'exercise_contraindications',
]) {
  die(`limpar ${table}`, (await db.from(table).delete().in('exercise_id', ids)).error);
}

const secondary = exercises.flatMap((e) =>
  e.secondary.map((g) => ({ exercise_id: e.id, group_id: g })),
);
const equip = exercises.flatMap((e) =>
  e.equipment.map((eq) => ({ exercise_id: e.id, equipment_id: eq })),
);
const contra = exercises.flatMap((e) =>
  e.contraindications.map((t) => ({ exercise_id: e.id, tag: t })),
);

if (secondary.length) die('secondary', (await db.from('exercise_secondary_groups').insert(secondary)).error);
if (equip.length)     die('equip',     (await db.from('exercise_equipment').insert(equip)).error);
if (contra.length)    die('contra',    (await db.from('exercise_contraindications').insert(contra)).error);

console.log(`junções: ${secondary.length} secundários, ${equip.length} equipamentos, ${contra.length} contraindicações`);

// 4. Academia da demo, com TODO o equipamento ligado.
const { data: gym, error: gymErr } = await db
  .from('gyms')
  .upsert(
    {
      slug: 'demo',
      name: 'Academia Persona',
      theme: { accent: '#39FF14', mode: 'dark' },
      trainer_name: 'Prof. Marina Alves',
      trainer_cref: 'CREF 012345-G/SP',
    },
    { onConflict: 'slug' },
  )
  .select('id')
  .single();
die('gym', gymErr);

die(
  'gym_equipment',
  (
    await db.from('gym_equipment').upsert(
      equipment.map((e) => ({ gym_id: gym!.id, equipment_id: e.id, is_available: true })),
    )
  ).error,
);
console.log(`academia demo: ${gym!.id} com ${equipment.length} aparelhos ligados`);
console.log('\nSeed completo.');
```

- [ ] **Step 2: Registrar e rodar**

`package.json` — em `scripts`:

```json
"seed:catalog": "node --env-file=.env.local ./node_modules/.bin/tsx scripts/seed-catalog.ts"
```

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run seed:catalog
```

Esperado: contagens conferindo com o CSV, e `Seed completo.`

- [ ] **Step 3: Confirmar que a role anon lê o catálogo semeado**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
set -a; . ./.env.local; set +a
curl -s "$VITE_SUPABASE_URL/rest/v1/exercises?select=id&limit=5" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
echo
```

Esperado: um array com 5 ids. Se vier `[]`, a policy `anon_read_exercises` não foi aplicada.

- [ ] **Step 4: Escrever os testes do carregador (vão falhar)**

`apps/totem/src/data/loadCatalog.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CACHE_KEY, hydrateFromCache, writeCache, type CatalogBundle } from './loadCatalog';
import type { Exercise } from '@quickfit/core/engine';

const ex: Exercise = {
  id: 'supino', name: 'Supino', primary: 'peito', secondary: ['triceps'],
  equipment: ['barra', 'banco'], level: 2, pattern: 'push-h',
  isCompound: true, avgSecPerSet: 35, contraindications: ['ombro'],
};

const bundle: CatalogBundle = {
  exercises: [ex],
  gym: {
    id: 'g1', slug: 'demo', name: 'Academia Persona', logoUrl: null,
    theme: { accent: '#39FF14', mode: 'dark' },
    trainerName: 'Prof. Marina Alves', trainerCref: 'CREF 012345-G/SP',
  },
  availableEquipment: ['barra', 'banco'],
  fromCache: false,
};

// jsdom não é o ambiente padrão do vitest neste projeto, então damos um
// localStorage mínimo.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe('cache do catálogo', () => {
  it('devolve null quando não há nada gravado', () => {
    expect(hydrateFromCache()).toBeNull();
  });

  it('faz round-trip preservando os dados', () => {
    writeCache(bundle);
    const out = hydrateFromCache()!;
    expect(out.exercises).toEqual(bundle.exercises);
    expect(out.gym.name).toBe('Academia Persona');
    expect(out.availableEquipment).toEqual(['barra', 'banco']);
  });

  it('marca fromCache: true na leitura', () => {
    writeCache(bundle);
    expect(hydrateFromCache()!.fromCache).toBe(true);
  });

  it('devolve null quando o JSON está corrompido, em vez de lançar', () => {
    localStorage.setItem(CACHE_KEY, '{lixo');
    expect(hydrateFromCache()).toBeNull();
  });

  it('devolve null quando o formato mudou (sem exercises)', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ gym: bundle.gym }));
    expect(hydrateFromCache()).toBeNull();
  });

  it('devolve null quando o cache está vazio de exercícios', () => {
    writeCache({ ...bundle, exercises: [] });
    expect(hydrateFromCache()).toBeNull();
  });
});
```

- [ ] **Step 5: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/data/loadCatalog.test.ts
```

Esperado: FAIL — `Failed to resolve import "./loadCatalog"`.

- [ ] **Step 6: Implementar o cliente e o carregador**

`apps/totem/src/data/supabase.ts`:

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

/** Cliente único, role anon. Não há login no totem. */
export const supabase = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```

`apps/totem/src/data/loadCatalog.ts`:

```ts
import { supabase } from './supabase';
import type { Contra, Exercise, MuscleGroup, Pattern } from '@quickfit/core/engine';
import type { Gym, GymTheme } from '@quickfit/core/theme';

export const CACHE_KEY = 'qf.catalog.v1';

// `Gym` e `GymTheme` são definidos em @quickfit/core/theme porque o painel
// também os consome. Re-exportados aqui só por conveniência de import nas telas.
export type { Gym, GymTheme } from '@quickfit/core/theme';

export type CatalogBundle = {
  exercises: Exercise[];
  gym: Gym;
  availableEquipment: string[];
  fromCache: boolean;
};

export function writeCache(bundle: CatalogBundle): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...bundle, fromCache: undefined }));
  } catch {
    // Cota cheia ou modo privado. O totem funciona sem cache — só não
    // sobrevive a queda de internet.
  }
}

export function hydrateFromCache(): CatalogBundle | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CatalogBundle>;
    if (!parsed.exercises?.length || !parsed.gym || !parsed.availableEquipment) return null;
    return { ...(parsed as CatalogBundle), fromCache: true };
  } catch {
    return null;
  }
}

type ExerciseRow = {
  id: string;
  name: string;
  primary_group: MuscleGroup;
  level: 1 | 2 | 3;
  pattern: Pattern;
  is_compound: boolean;
  avg_sec_per_set: number;
  duration_sec: number | null;
  cue: string | null;
  video_url: string | null;
  exercise_secondary_groups: { group_id: MuscleGroup }[];
  exercise_equipment: { equipment_id: string }[];
  exercise_contraindications: { tag: Contra }[];
};

/**
 * Busca catálogo + academia + equipamento disponível. Se a rede falhar, cai
 * para o cache. Se não houver cache, lança — a tela mostra "totem
 * indisponível" em vez de tela branca.
 */
export async function loadCatalog(gymSlug = 'demo'): Promise<CatalogBundle> {
  try {
    const [exRes, gymRes] = await Promise.all([
      supabase.from('exercises').select(
        `id, name, primary_group, level, pattern, is_compound, avg_sec_per_set,
         duration_sec, cue, video_url,
         exercise_secondary_groups(group_id),
         exercise_equipment(equipment_id),
         exercise_contraindications(tag)`,
      ),
      supabase
        .from('gyms')
        .select('id, slug, name, logo_url, theme, trainer_name, trainer_cref')
        .eq('slug', gymSlug)
        .single(),
    ]);

    if (exRes.error) throw exRes.error;
    if (gymRes.error) throw gymRes.error;

    const eqRes = await supabase
      .from('gym_available_equipment')
      .select('equipment_id')
      .eq('gym_id', gymRes.data.id);
    if (eqRes.error) throw eqRes.error;

    const exercises: Exercise[] = (exRes.data as ExerciseRow[]).map((r) => ({
      id: r.id,
      name: r.name,
      primary: r.primary_group,
      secondary: r.exercise_secondary_groups.map((s) => s.group_id),
      equipment: r.exercise_equipment.map((e) => e.equipment_id),
      level: r.level,
      pattern: r.pattern,
      isCompound: r.is_compound,
      avgSecPerSet: r.avg_sec_per_set,
      durationSec: r.duration_sec ?? undefined,
      contraindications: r.exercise_contraindications.map((c) => c.tag),
      cue: r.cue ?? undefined,
      videoUrl: r.video_url ?? undefined,
    }));

    if (exercises.length === 0) throw new Error('catálogo vazio no servidor');

    const g = gymRes.data;
    const bundle: CatalogBundle = {
      exercises,
      gym: {
        id: g.id,
        slug: g.slug,
        name: g.name,
        logoUrl: g.logo_url,
        theme: (g.theme ?? { accent: '#39FF14', mode: 'dark' }) as GymTheme,
        trainerName: g.trainer_name,
        trainerCref: g.trainer_cref,
      },
      availableEquipment: eqRes.data.map((e) => e.equipment_id),
      fromCache: false,
    };

    writeCache(bundle);
    return bundle;
  } catch (err) {
    const cached = hydrateFromCache();
    if (cached) {
      console.warn('Catálogo veio do cache — rede indisponível.', err);
      return cached;
    }
    throw new Error(
      'Não foi possível carregar o catálogo e não há cache local.',
      { cause: err },
    );
  }
}
```

- [ ] **Step 7: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/data/loadCatalog.test.ts && npm run typecheck
```

Esperado: PASS, 6 testes; typecheck limpo.

- [ ] **Step 8: Verificar o carregamento real no browser**

Adicione temporariamente ao `apps/totem/src/main.tsx`, antes do `render`:

```ts
import { loadCatalog } from './data/loadCatalog';
loadCatalog().then((b) =>
  console.log('catálogo:', b.exercises.length, 'exercícios;', b.availableEquipment.length, 'aparelhos;', b.gym.name),
);
```

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run dev
```

Abra o console do browser. Esperado: as três contagens conferindo com o seed. Depois **desligue a rede** (DevTools → Network → Offline) e recarregue: deve aparecer `Catálogo veio do cache` e as mesmas contagens.

Remova o trecho temporário do `main.tsx` depois de conferir.

- [ ] **Step 9: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add scripts/seed-catalog.ts apps/totem/src/data package.json
git commit -m "feat(data): seed do catálogo e carregamento com cache offline

O totem carrega uma vez e cacheia em localStorage. Se a internet da academia
cair, o treino continua saindo — é a metade do D5 que não depende de LLM.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Fase D — Interface

### Task 12: White-label com validação de contraste

D8: a academia mexe em uma cor, o logo e o modo. Tudo o mais é seu, fixo e testado.

**Files:**
- Create: `packages/core/src/theme/types.ts`
- Create: `packages/core/src/theme/contrast.ts`
- Create: `packages/core/src/theme/base.ts`
- Create: `packages/core/src/theme/apply.ts`
- Create: `packages/core/src/theme/index.ts`
- Test: `packages/core/src/theme/contrast.test.ts`

**Interfaces:**
- Consumes: nada de fora de `@quickfit/core`
- Produces:
  - `type GymTheme = { accent: string; mode: 'dark' | 'light' }` e `type Gym` — **definidos aqui**, não em `apps/totem`
  - `MIN_CONTRAST = 4.5`
  - `contrastRatio(a: string, b: string): number` — razão WCAG, 1 a 21
  - `bestContrast(color: string, options: string[]): string`
  - `validateAccent(accent: string, mode: 'dark' | 'light'): { ok: boolean; ratio: number; suggestion?: string }`
  - `applyTheme(theme: GymTheme): void`
  - `DARK_BASE`, `LIGHT_BASE`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`packages/core/src/theme/contrast.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { contrastRatio, bestContrast, validateAccent } from './contrast';
import { DARK_BASE, LIGHT_BASE } from './base';

describe('contrastRatio', () => {
  it('preto contra branco é 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
  });

  it('cor contra ela mesma é 1:1', () => {
    expect(contrastRatio('#39FF14', '#39FF14')).toBeCloseTo(1, 2);
  });

  it('é simétrico', () => {
    expect(contrastRatio('#39FF14', '#07080B')).toBeCloseTo(
      contrastRatio('#07080B', '#39FF14'),
      4,
    );
  });

  it('aceita hex de 3 dígitos', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });

  it('é insensível a maiúsculas', () => {
    expect(contrastRatio('#39ff14', '#07080B')).toBeCloseTo(
      contrastRatio('#39FF14', '#07080b'),
      4,
    );
  });
});

describe('bestContrast', () => {
  it('escolhe preto sobre o verde neon', () => {
    expect(bestContrast('#39FF14', ['#07080B', '#FFFFFF'])).toBe('#07080B');
  });

  it('escolhe branco sobre um violeta escuro', () => {
    expect(bestContrast('#6D28D9', ['#07080B', '#FFFFFF'])).toBe('#FFFFFF');
  });
});

describe('validateAccent', () => {
  it('aprova o verde neon no modo escuro', () => {
    const r = validateAccent('#39FF14', 'dark');
    expect(r.ok).toBe(true);
    expect(r.ratio).toBeGreaterThan(4.5);
  });

  it('aprova laranja no modo escuro', () => {
    expect(validateAccent('#FF6B1A', 'dark').ok).toBe(true);
  });

  it('reprova grafite no modo escuro e sugere alternativa', () => {
    const r = validateAccent('#2B313C', 'dark');
    expect(r.ok).toBe(false);
    expect(r.ratio).toBeLessThan(4.5);
    expect(r.suggestion).toBeDefined();
  });

  it('a sugestão devolvida sempre passa a validação', () => {
    for (const cor of ['#2B313C', '#1A1D25', '#3D3D3D', '#0F1115']) {
      const r = validateAccent(cor, 'dark');
      expect(r.ok).toBe(false);
      expect(validateAccent(r.suggestion!, 'dark').ok).toBe(true);
    }
  });

  it('reprova amarelo claro no modo claro', () => {
    expect(validateAccent('#FFE100', 'light').ok).toBe(false);
  });

  it('rejeita hex inválido em vez de devolver NaN', () => {
    expect(() => validateAccent('vermelho', 'dark')).toThrow(/hex/i);
  });
});

describe('danger por modo', () => {
  // O motivo de `--qf-danger` existir como token: o vermelho do escuro reprova
  // no claro. Se alguém "simplificar" para um hex único, este teste cai.
  it('o danger de cada modo passa 4.5:1 contra o fundo daquele modo', () => {
    expect(contrastRatio(DARK_BASE.danger, DARK_BASE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_BASE.danger, LIGHT_BASE.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('o danger do escuro reprovaria no claro — é por isso que são dois', () => {
    expect(contrastRatio(DARK_BASE.danger, LIGHT_BASE.bg)).toBeLessThan(4.5);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/theme/contrast.test.ts
```

Esperado: FAIL — `Failed to resolve import "./contrast"`.

- [ ] **Step 3: Implementar tipos, contraste e base**

`packages/core/src/theme/types.ts`:

```ts
/**
 * Estes tipos vivem em @quickfit/core porque têm DOIS consumidores: o painel
 * escreve o tema (com validação de contraste) e o totem o lê. Se morassem em
 * apps/totem, o core dependeria do app — inversão de dependência que a
 * separação totem/painel expôs.
 */
export type GymTheme = {
  accent: string;
  mode: 'dark' | 'light';
};

export type Gym = {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  theme: GymTheme;
  trainerName: string | null;
  trainerCref: string | null;
};
```

`packages/core/src/theme/base.ts`:

```ts
/** Herdado do tailwind.config.js do Persona Fit. Fixo — a academia não mexe. */
export const DARK_BASE = {
  bg: '#07080B',
  surface: '#12141A',
  raised: '#1A1D25',
  border: '#1F232B',
  text: '#F4F5F7',
  dim: '#A1A6B2',
  violet: '#8B5CF6',
  danger: '#F43F5E',
} as const;

export const LIGHT_BASE = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  raised: '#F0F2F5',
  border: '#DCE0E6',
  text: '#0B0D12',
  dim: '#5B6270',
  violet: '#6D28D9',
  danger: '#BE123C',
} as const;

/**
 * Por que `danger` muda entre os modos, medido (WCAG, fórmula do contrast.ts):
 *
 *   #F43F5E  sobre #07080B (escuro) = 5.45:1  ✓
 *   #F43F5E  sobre #F7F8FA (claro)  = 3.46:1  ✗ reprova para texto normal
 *   #BE123C  sobre #F7F8FA (claro)  = 5.91:1  ✓
 *
 * É o único caso onde a mudança de modo não é cosmética: o mesmo vermelho que
 * funciona no escuro fica ilegível no claro. Daí `--qf-danger` ser token e não
 * hex no `tailwind.config.js` — a academia não escolhe esta cor, mas o modo
 * escolhe. O chip de contraindicação (`bg-danger text-white`) fica em 3.67:1 no
 * escuro e 6.29:1 no claro: passa AA porque o alvo de toque tem 96px e o rótulo
 * conta como texto grande (mínimo 3:1), não como corpo de texto.
 */

/** Mínimo WCAG AA para texto grande. Abaixo disto o painel recusa a cor. */
export const MIN_CONTRAST = 4.5;
```

`packages/core/src/theme/contrast.ts`:

```ts
import { DARK_BASE, LIGHT_BASE, MIN_CONTRAST } from './base';

function toRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Cor inválida: "${hex}". Use hex de 3 ou 6 dígitos.`);
  }
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export function bestContrast(color: string, options: string[]): string {
  return options.reduce((best, o) =>
    contrastRatio(color, o) > contrastRatio(color, best) ? o : best,
  );
}

export function rgba(hex: string, alpha: number): string {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Clareia (modo escuro) ou escurece (modo claro) até passar o mínimo. */
function nudge(hex: string, mode: 'dark' | 'light'): string | undefined {
  const bg = mode === 'dark' ? DARK_BASE.bg : LIGHT_BASE.bg;
  let [r, g, b] = toRgb(hex);

  for (let step = 0; step < 32; step++) {
    if (mode === 'dark') {
      r = Math.min(255, Math.round(r + (255 - r) * 0.15) + 4);
      g = Math.min(255, Math.round(g + (255 - g) * 0.15) + 4);
      b = Math.min(255, Math.round(b + (255 - b) * 0.15) + 4);
    } else {
      r = Math.max(0, Math.round(r * 0.85) - 4);
      g = Math.max(0, Math.round(g * 0.85) - 4);
      b = Math.max(0, Math.round(b * 0.85) - 4);
    }
    const candidate =
      '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (contrastRatio(candidate, bg) >= MIN_CONTRAST) return candidate;
  }
  return undefined;
}

/**
 * Roda no PAINEL DO GESTOR, nunca no totem. Se a cor da academia reprovar,
 * o painel oferece a variante ajustada — o gestor sente que personalizou e
 * você garante que dá para ler sob luz de galpão.
 */
export function validateAccent(
  accent: string,
  mode: 'dark' | 'light',
): { ok: boolean; ratio: number; suggestion?: string } {
  const bg = mode === 'dark' ? DARK_BASE.bg : LIGHT_BASE.bg;
  const ratio = contrastRatio(accent, bg);
  if (ratio >= MIN_CONTRAST) return { ok: true, ratio };
  return { ok: false, ratio, suggestion: nudge(accent, mode) };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- packages/core/src/theme/contrast.test.ts
```

Esperado: PASS, 15 testes.

- [ ] **Step 5: Implementar `applyTheme`**

`packages/core/src/theme/apply.ts`:

```ts
import type { GymTheme } from './types';
import { DARK_BASE, LIGHT_BASE } from './base';
import { bestContrast, rgba, validateAccent } from './contrast';

/**
 * Roda uma vez no boot, antes do primeiro paint. Escreve as custom
 * properties que o Tailwind consome — nenhum componente conhece hex.
 */
export function applyTheme(theme: GymTheme): void {
  const base = theme.mode === 'dark' ? DARK_BASE : LIGHT_BASE;
  const root = document.documentElement.style;

  for (const [k, v] of Object.entries(base)) {
    root.setProperty(`--qf-${k}`, v);
  }

  // Defesa em profundidade: o painel já valida, mas se um tema ruim chegar
  // ao banco por SQL manual, o totem cai para o accent padrão em vez de
  // exibir um botão ilegível.
  const check = validateAccent(theme.accent, theme.mode);
  const accent = check.ok ? theme.accent : (check.suggestion ?? '#39FF14');
  if (!check.ok) {
    console.warn(
      `Accent "${theme.accent}" tem contraste ${check.ratio.toFixed(2)}:1 — ` +
        `usando "${accent}".`,
    );
  }

  root.setProperty('--qf-accent', accent);
  root.setProperty('--qf-on-accent', bestContrast(accent, ['#07080B', '#FFFFFF']));
  root.setProperty('--qf-accent-glow', rgba(accent, 0.22));
  root.setProperty('color-scheme', theme.mode);
}
```

- [ ] **Step 6: Exportar a API pública do tema**

`packages/core/src/theme/index.ts`:

```ts
export * from './types';
export { DARK_BASE, LIGHT_BASE, MIN_CONTRAST } from './base';
export { contrastRatio, bestContrast, rgba, validateAccent } from './contrast';
export { applyTheme } from './apply';
```

Este é o caminho declarado em `packages/core/package.json` → `exports['./theme']`. Sem ele, `import { applyTheme } from '@quickfit/core/theme'` não resolve.

- [ ] **Step 7: Rodar a suíte e o typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck
```

- [ ] **Step 8: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add packages/core/src/theme
git commit -m "feat(theme): white-label de uma cor com validação de contraste

Accent abaixo de 4.5:1 é recusado e substituído pela variante ajustada. É a
regra que protege o produto numa academia que você nunca vai visitar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Máquina de estados do fluxo e idle timeout

Kiosk não tem botão de voltar do browser, e o aluno abandona no meio. A máquina é o que garante que o próximo aluno não vê os dados do anterior.

**Files:**
- Create: `apps/totem/src/state/machine.ts`
- Create: `apps/totem/src/state/useIdleTimeout.ts`
- Test: `apps/totem/src/state/machine.test.ts`

**Interfaces:**
- Consumes: tipos do motor (`Goal`, `MuscleGroup`, `Level`, `Contra`, `Input`, `Workout`)
- Produces:
  - `type Screen = 'attract'|'parq'|'blocked'|'home'|'goal'|'groups'|'time'|'level'|'generating'|'result'|'thin'|'ficha'`
  - `type MachineState` e `type Action` (definidos no Step 2)
  - `initialState: MachineState`
  - `reducer(state: MachineState, action: Action): MachineState`
  - `toInput(state: MachineState, availableEquipment: string[]): Input`
  - `SHORTCUTS: Shortcut[]`
  - `useIdleTimeout(onIdle: () => void, active: boolean, ms?: number): void`

- [ ] **Step 1: Escrever os testes (vão falhar)**

`apps/totem/src/state/machine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reducer, initialState, toInput, SHORTCUTS, type MachineState } from './machine';

const run = (actions: Parameters<typeof reducer>[1][], from = initialState): MachineState =>
  actions.reduce(reducer, from);

describe('fluxo de atalho — 3 toques', () => {
  it('attract → parq → home → result em 3 toques', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(s.screen).toBe('generating');
    expect(s.taps).toBe(3);
    expect(s.path).toBe('atalho');
  });

  it('o atalho preenche objetivo, grupos e tempo de uma vez', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(s.groups).toEqual(SHORTCUTS[0].groups);
    expect(s.minutes).toBe(SHORTCUTS[0].minutes);
    expect(s.goal).toBe(SHORTCUTS[0].goal);
  });

  it('atalho nunca popula `avoid` — só o passo 6 do caminho completo faz isso', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 1 },
    ]);
    expect(toInput(s, ['barra']).avoid).toEqual([]);
  });

  it('só o "Treino rápido" tem askTime — os outros três geram direto', () => {
    const comAskTime = SHORTCUTS.filter((s) => s.askTime);
    expect(comAskTime).toHaveLength(1);
    expect(comAskTime[0].label).toBe('Treino rápido');
  });
});

describe('atalho "Treino rápido" — pede o tempo antes de gerar', () => {
  const idx = SHORTCUTS.findIndex((s) => s.askTime);

  const ateOTempo = () =>
    run([{ type: 'TOUCH_ATTRACT' }, { type: 'PARQ_NONE' }, { type: 'PICK_SHORTCUT', index: idx }]);

  it('vai para a tela de tempo, não direto para a geração', () => {
    const s = ateOTempo();
    expect(s.screen).toBe('time');
    expect(s.path).toBe('atalho');
  });

  it('escolher o tempo gera na hora — no atalho não há pergunta de nível', () => {
    const s = reducer(ateOTempo(), { type: 'PICK_TIME', minutes: 40 });
    expect(s.screen).toBe('generating');
    expect(s.minutes).toBe(40);
  });

  it('custa 4 toques, um mais que os outros atalhos', () => {
    const rapido = reducer(ateOTempo(), { type: 'PICK_TIME', minutes: 30 });
    const direto = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 0 },
    ]);
    expect(rapido.taps).toBe(4);
    expect(direto.taps).toBe(3);
  });

  it('BACK da tela de tempo volta para a home, não para os grupos', () => {
    // A mesma tela `time` volta para `groups` no caminho completo — coberto
    // pelo teste de BACK em "caminho completo".
    const s = reducer(ateOTempo(), { type: 'BACK' });
    expect(s.screen).toBe('home');
  });
});

describe('triagem PAR-Q', () => {
  it('marcar qualquer condição leva a blocked e NÃO gera treino', () => {
    const s = run([{ type: 'TOUCH_ATTRACT' }, { type: 'PARQ_TOGGLE', index: 0 }]);
    expect(s.screen).toBe('blocked');
    expect(s.parq).toEqual([0]);
  });

  it('desmarcar a última condição volta para a triagem', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_TOGGLE', index: 1 },
      { type: 'PARQ_TOGGLE', index: 1 },
    ]);
    expect(s.screen).toBe('parq');
    expect(s.parq).toEqual([]);
  });

  it('"nenhuma das anteriores" limpa as marcações e libera', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_TOGGLE', index: 0 },
      { type: 'PARQ_NONE' },
    ]);
    expect(s.screen).toBe('home');
    expect(s.parq).toEqual([]);
  });
});

describe('caminho completo', () => {
  it('percorre os 4 passos e chega a generating', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'hipertrofia' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'CONFIRM_GROUPS' },
      { type: 'PICK_TIME', minutes: 45 },
      { type: 'PICK_LEVEL', level: 2 },
    ]);
    expect(s.screen).toBe('generating');
    expect(s.path).toBe('completo');
  });

  it('não deixa confirmar grupos sem escolher nenhum', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'CONFIRM_GROUPS' },
    ]);
    expect(s.screen).toBe('groups');
  });

  it('alterna grupo dentro e fora da seleção', () => {
    let s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'TOGGLE_GROUP', group: 'costas' },
    ]);
    expect(s.groups).toEqual(['peito', 'costas']);
    s = reducer(s, { type: 'TOGGLE_GROUP', group: 'peito' });
    expect(s.groups).toEqual(['costas']);
  });

  it('"não sei" no nível assume intermediário', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'hipertrofia' },
      { type: 'TOGGLE_GROUP', group: 'peito' },
      { type: 'CONFIRM_GROUPS' },
      { type: 'PICK_TIME', minutes: 45 },
      { type: 'PICK_LEVEL', level: 2 },
    ]);
    expect(s.level).toBe(2);
  });

  it('BACK volta um passo sem perder a seleção anterior', () => {
    let s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'OPEN_CUSTOM' },
      { type: 'PICK_GOAL', goal: 'forca' },
      { type: 'TOGGLE_GROUP', group: 'pernas' },
      { type: 'CONFIRM_GROUPS' },
    ]);
    expect(s.screen).toBe('time');
    s = reducer(s, { type: 'BACK' });
    expect(s.screen).toBe('groups');
    expect(s.groups).toEqual(['pernas']);
  });
});

describe('resultado e reset', () => {
  it('treino magro vai para a tela thin, não para result', () => {
    const s = reducer(
      { ...initialState, screen: 'generating' },
      { type: 'GENERATED', workout: { items: [], minItems: 3 } as never },
    );
    expect(s.screen).toBe('thin');
  });

  it('treino completo vai para result', () => {
    const s = reducer(
      { ...initialState, screen: 'generating' },
      { type: 'GENERATED', workout: { items: [1, 2, 3], minItems: 3 } as never },
    );
    expect(s.screen).toBe('result');
  });

  it('REGENERATE incrementa a seed e volta a gerar', () => {
    const antes = { ...initialState, screen: 'result' as const, seed: 5 };
    const s = reducer(antes, { type: 'REGENERATE' });
    expect(s.seed).toBe(6);
    expect(s.screen).toBe('generating');
  });

  it('RESET descarta TODO o estado do aluno anterior', () => {
    const sujo: MachineState = {
      ...initialState,
      screen: 'result',
      parq: [0, 1],
      groups: ['peito', 'costas'],
      avoid: ['joelho'],
      taps: 17,
      workout: { items: [] } as never,
      goal: 'forca',
      minutes: 90,
      level: 3,
    };
    const s = reducer(sujo, { type: 'RESET' });
    expect(s.screen).toBe('attract');
    expect(s.parq).toEqual([]);
    expect(s.groups).toEqual([]);
    expect(s.avoid).toEqual([]);
    expect(s.taps).toBe(0);
    expect(s.workout).toBeNull();
    // a seed sobrevive de propósito: o próximo aluno não repete o treino
    expect(s.seed).toBe(sujo.seed);
  });
});

describe('toInput', () => {
  it('monta o Input que o motor espera', () => {
    const s = run([
      { type: 'TOUCH_ATTRACT' },
      { type: 'PARQ_NONE' },
      { type: 'PICK_SHORTCUT', index: 2 },
    ]);
    const input = toInput(s, ['barra', 'banco']);
    expect(input.availableEquipment).toEqual(['barra', 'banco']);
    expect(input.groups).toEqual(SHORTCUTS[2].groups);
    expect(input.seed).toBe(s.seed);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/state/machine.test.ts
```

Esperado: FAIL — `Failed to resolve import "./machine"`.

- [ ] **Step 3: Implementar a máquina**

`apps/totem/src/state/machine.ts`:

```ts
import type { Contra, Goal, Input, Level, Minutes, MuscleGroup, Workout } from '@quickfit/core/engine';

export type Screen =
  | 'attract' | 'parq' | 'blocked' | 'home'
  | 'goal' | 'groups' | 'time' | 'level'
  | 'generating' | 'result' | 'thin' | 'ficha';

export type Shortcut = {
  label: string;
  sub: string;
  groups: MuscleGroup[];
  /** Tempo assumido. Ignorado quando `askTime` é true. */
  minutes: Minutes;
  goal: Goal;
  /**
   * Quando true, o atalho abre a tela de tempo antes de gerar. Só o "Treino
   * rápido" usa: quem escolhe "rápido" está limitado por tempo, e assumir 20
   * min para quem tem 45 entrega menos treino do que a pessoa podia fazer.
   * Custo: este atalho leva 4 toques, os outros três levam 3.
   */
  askTime?: true;
};

/** Os 4 atalhos da home. D4: a maioria dos alunos sai em 3 toques por aqui. */
export const SHORTCUTS: Shortcut[] = [
  { label: 'Peito + Tríceps', sub: '45 min', groups: ['peito', 'triceps'],  minutes: 45, goal: 'hipertrofia' },
  { label: 'Costas + Bíceps', sub: '45 min', groups: ['costas', 'biceps'],  minutes: 45, goal: 'hipertrofia' },
  { label: 'Perna completa',  sub: '60 min', groups: ['pernas', 'gluteos'], minutes: 60, goal: 'hipertrofia' },
  {
    label: 'Treino rápido',
    sub: 'você escolhe o tempo',
    groups: ['peito', 'costas', 'pernas'],
    minutes: 20,
    goal: 'emagrecimento',
    askTime: true,
  },
];

/** As 3 condições críticas do PAR-Q reduzido (D6). */
export const PARQ_QUESTIONS = [
  'Dor no peito ao se esforçar',
  'Tontura ou desmaio recente',
  'Médico pediu para você não treinar',
] as const;

export type MachineState = {
  screen: Screen;
  path: 'atalho' | 'completo';
  parq: number[];
  goal: Goal;
  groups: MuscleGroup[];
  minutes: Minutes;
  level: Level;
  avoid: Contra[];
  seed: number;
  taps: number;
  workout: Workout | null;
  workoutId: string | null;
};

export const initialState: MachineState = {
  screen: 'attract',
  path: 'atalho',
  parq: [],
  goal: 'hipertrofia',
  groups: [],
  minutes: 45,
  level: 2,
  avoid: [],
  seed: 1,
  taps: 0,
  workout: null,
  workoutId: null,
};

export type Action =
  | { type: 'TOUCH_ATTRACT' }
  | { type: 'PARQ_TOGGLE'; index: number }
  | { type: 'PARQ_NONE' }
  | { type: 'PICK_SHORTCUT'; index: number }
  | { type: 'OPEN_CUSTOM' }
  | { type: 'PICK_GOAL'; goal: Goal }
  | { type: 'TOGGLE_GROUP'; group: MuscleGroup }
  | { type: 'CONFIRM_GROUPS' }
  | { type: 'PICK_TIME'; minutes: Minutes }
  | { type: 'PICK_LEVEL'; level: Level }
  | { type: 'TOGGLE_AVOID'; tag: Contra }
  | { type: 'GENERATED'; workout: Workout }
  | { type: 'WORKOUT_SAVED'; id: string }
  | { type: 'REGENERATE' }
  | { type: 'OPEN_FICHA' }
  | { type: 'BACK' }
  | { type: 'RESET' };

/**
 * De onde cada tela volta. `time` depende do caminho: no atalho ela veio da
 * home, no completo veio da seleção de grupos.
 */
const BACK_TO: Partial<Record<Screen, Screen>> = {
  goal: 'home',
  groups: 'goal',
  level: 'time',
  ficha: 'result',
};

const backFrom = (state: MachineState): Screen | undefined =>
  state.screen === 'time'
    ? (state.path === 'atalho' ? 'home' : 'groups')
    : BACK_TO[state.screen];

export function reducer(state: MachineState, action: Action): MachineState {
  const tap = (s: MachineState): MachineState => ({ ...s, taps: s.taps + 1 });

  switch (action.type) {
    case 'TOUCH_ATTRACT':
      return tap({ ...state, screen: 'parq' });

    case 'PARQ_TOGGLE': {
      const parq = state.parq.includes(action.index)
        ? state.parq.filter((i) => i !== action.index)
        : [...state.parq, action.index];
      // Marcar qualquer condição bloqueia na hora. Desmarcar a última libera.
      return tap({ ...state, parq, screen: parq.length > 0 ? 'blocked' : 'parq' });
    }

    case 'PARQ_NONE':
      return tap({ ...state, parq: [], screen: 'home' });

    case 'PICK_SHORTCUT': {
      const sc = SHORTCUTS[action.index];
      if (!sc) return state;
      return tap({
        ...state,
        path: 'atalho',
        goal: sc.goal,
        groups: sc.groups,
        minutes: sc.minutes,
        avoid: [],          // atalho nunca popula avoid
        // "Treino rápido" pede o tempo antes de gerar; os outros três já o têm.
        screen: sc.askTime ? 'time' : 'generating',
      });
    }

    case 'OPEN_CUSTOM':
      return tap({ ...state, path: 'completo', screen: 'goal' });

    case 'PICK_GOAL':
      return tap({ ...state, goal: action.goal, screen: 'groups' });

    case 'TOGGLE_GROUP': {
      const groups = state.groups.includes(action.group)
        ? state.groups.filter((g) => g !== action.group)
        : [...state.groups, action.group];
      return tap({ ...state, groups });
    }

    case 'CONFIRM_GROUPS':
      if (state.groups.length === 0) return state;   // o botão está desabilitado
      return tap({ ...state, screen: 'time' });

    case 'PICK_TIME':
      // No atalho o tempo é a última pergunta; no caminho completo ainda falta
      // o nível.
      return tap({
        ...state,
        minutes: action.minutes,
        screen: state.path === 'atalho' ? 'generating' : 'level',
      });

    case 'PICK_LEVEL':
      return tap({ ...state, level: action.level, screen: 'generating' });

    case 'TOGGLE_AVOID': {
      const avoid = state.avoid.includes(action.tag)
        ? state.avoid.filter((t) => t !== action.tag)
        : [...state.avoid, action.tag];
      return tap({ ...state, avoid });
    }

    case 'GENERATED':
      return {
        ...state,
        workout: action.workout,
        workoutId: null,
        screen: action.workout.items.length >= action.workout.minItems ? 'result' : 'thin',
      };

    case 'WORKOUT_SAVED':
      return { ...state, workoutId: action.id };

    case 'REGENERATE':
      return tap({ ...state, seed: state.seed + 1, screen: 'generating' });

    case 'OPEN_FICHA':
      return tap({ ...state, screen: 'ficha' });

    case 'BACK': {
      const to = backFrom(state);
      return to ? tap({ ...state, screen: to }) : state;
    }

    case 'RESET':
      // Descarta TODO o estado do aluno. A seed sobrevive de propósito: o
      // próximo aluno com o mesmo pedido não recebe o mesmo treino.
      return { ...initialState, seed: state.seed };
  }
}

export function toInput(state: MachineState, availableEquipment: string[]): Input {
  return {
    goal: state.goal,
    groups: state.groups,
    minutes: state.minutes,
    level: state.level,
    availableEquipment,
    avoid: state.avoid,
    seed: state.seed,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/state/machine.test.ts
```

Esperado: PASS, 21 testes.

- [ ] **Step 5: Implementar o idle timeout**

`apps/totem/src/state/useIdleTimeout.ts`:

```ts
import { useEffect, useRef } from 'react';

const IDLE_MS = 90_000;

/**
 * Aluno abandona no meio do fluxo o tempo todo. Sem isto, o próximo vê a
 * triagem PAR-Q do anterior já respondida.
 */
export function useIdleTimeout(onIdle: () => void, active: boolean, ms = IDLE_MS): void {
  const timer = useRef<number | undefined>(undefined);
  const cb = useRef(onIdle);
  cb.current = onIdle;

  useEffect(() => {
    if (!active) return;

    const reset = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => cb.current(), ms);
    };

    reset();
    const events = ['pointerdown', 'keydown', 'touchstart'] as const;
    for (const e of events) window.addEventListener(e, reset, { passive: true });

    return () => {
      window.clearTimeout(timer.current);
      for (const e of events) window.removeEventListener(e, reset);
    };
  }, [active, ms]);
}
```

- [ ] **Step 6: Rodar a suíte e o typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck
```

- [ ] **Step 7: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add apps/totem/src/state
git commit -m "feat(state): máquina do fluxo com PAR-Q bloqueante e idle timeout

RESET descarta todo o estado do aluno; a seed sobrevive para o próximo não
receber o mesmo treino. O bloqueio do PAR-Q impede o motor de rodar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Componentes base e o caminho de 3 toques ponta a ponta

Ao fim desta tarefa o totem **funciona**: attract → PAR-Q → atalho → treino na tela. É o primeiro momento em que existe algo demonstrável.

**Referência visual:** o protótipo validado está em `/tmp/claude-1000/-home-robson-www--estudos-pessoal-nutrion/5ace61d8-50bc-456a-8188-01d62cb6e9c3/scratchpad/quickfit-prototipo.html`. Ele já resolveu o dimensionamento das telas, o véu de scroll e a escala tipográfica — copie as decisões visuais dele em vez de redesenhar. A diferença: no protótipo tudo escala com `cqw` porque o totem é uma caixa dentro de uma página; aqui o app **é** a viewport, então use `vh`/`vw` e a escala em px da spec §6.

**Files:**
- Create: `apps/totem/src/components/BigButton.tsx`
- Create: `apps/totem/src/components/Cta.tsx`
- Create: `apps/totem/src/components/Boundary.tsx`
- Create: `apps/totem/src/screens/Attract.tsx`
- Create: `apps/totem/src/screens/Parq.tsx`
- Create: `apps/totem/src/screens/Blocked.tsx`
- Create: `apps/totem/src/screens/Home.tsx`
- Create: `apps/totem/src/screens/Generating.tsx`
- Create: `apps/totem/src/screens/Thin.tsx`
- Create: `apps/totem/src/screens/Unavailable.tsx`
- Modify: `apps/totem/src/App.tsx`
- Modify: `apps/totem/src/main.tsx`
- Modify: `index.html`
- Create: `public/fonts/` (Sora + Inter em woff2)

**Interfaces:**
- Consumes: `reducer`, `initialState`, `toInput`, `SHORTCUTS`, `PARQ_QUESTIONS` de `./state/machine`; `useIdleTimeout`; `loadCatalog`, `CatalogBundle`; `applyTheme`; `generateWorkout`
- Produces:
  - `<BigButton title sub pressed onClick />` — alvo de 96px, `aria-pressed` quando `pressed !== undefined`
  - `<Cta variant="solid"|"ghost" />`
  - `<App />` monta a máquina, carrega o catálogo, aplica o tema e despacha por tela

- [ ] **Step 1: Baixar e instalar as fontes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
mkdir -p public/fonts
# Baixe os woff2 latin de Sora (600, 800) e Inter (400, 600) de
# https://gwfh.mranftl.com/fonts (subset latin) e salve em public/fonts/:
#   sora-600.woff2  sora-800.woff2  inter-400.woff2  inter-600.woff2
ls -la public/fonts/
```

Esperado: 4 arquivos `.woff2`. **Não** use `<link>` para Google Fonts — o totem numa academia com internet ruim renderizaria em Times New Roman na frente do gestor (spec §6).

Acrescente ao topo de `apps/totem/src/index.css`, antes dos `@tailwind`:

```css
@font-face {
  font-family: 'Sora'; font-style: normal; font-weight: 600;
  font-display: block; src: url('/fonts/sora-600.woff2') format('woff2');
}
@font-face {
  font-family: 'Sora'; font-style: normal; font-weight: 800;
  font-display: block; src: url('/fonts/sora-800.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter'; font-style: normal; font-weight: 400;
  font-display: block; src: url('/fonts/inter-400.woff2') format('woff2');
}
@font-face {
  font-family: 'Inter'; font-style: normal; font-weight: 600;
  font-display: block; src: url('/fonts/inter-600.woff2') format('woff2');
}
```

`font-display: block` de propósito: melhor uma pausa curta que o gestor ver a fonte trocar no meio da demo.

- [ ] **Step 2: Ajustar o `index.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#07080B" />
    <title>QuickFit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/apps/totem/src/main.tsx"></script>
  </body>
</html>
```

`maximum-scale=1, user-scalable=no` porque num totem o pinch-zoom acidental deixa a tela num estado do qual o aluno não sabe sair.

- [ ] **Step 3: Escrever os componentes base**

`apps/totem/src/components/BigButton.tsx`:

```tsx
type Props = {
  title: string;
  sub?: string;
  pressed?: boolean;
  onClick: () => void;
};

/**
 * Alvo de toque de 96px, não os 44px de mobile: dedo grosso, mão suada,
 * pessoa em pé a 60–80cm da tela (spec §6).
 */
export function BigButton({ title, sub, pressed, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={[
        'flex min-h-touch flex-col justify-center gap-1 rounded-2xl px-6 py-5 text-left',
        'border transition-colors active:scale-[0.985]',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent',
        pressed
          ? 'border-accent bg-raised shadow-[inset_0_0_0_2px_var(--qf-accent)]'
          : 'border-border bg-surface hover:border-accent hover:bg-raised',
      ].join(' ')}
    >
      <span className="font-display text-[32px] font-semibold leading-tight tracking-tight">
        {title}
        {pressed ? <span className="text-accent"> ✓</span> : null}
      </span>
      {sub ? <span className="text-[20px] text-dim">{sub}</span> : null}
    </button>
  );
}
```

`apps/totem/src/components/Cta.tsx`:

```tsx
type Props = {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'solid' | 'ghost';
  disabled?: boolean;
};

export function Cta({ children, onClick, variant = 'solid', disabled }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'flex min-h-touch w-full items-center justify-center gap-3 rounded-2xl px-6',
        'font-display font-extrabold tracking-tight transition-[filter,transform]',
        'active:scale-[0.99] disabled:opacity-35',
        'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2',
        variant === 'solid'
          ? 'bg-accent text-onAccent text-[30px] hover:brightness-110 focus-visible:outline-text'
          : 'border border-border bg-transparent text-[24px] font-semibold text-dim hover:border-accent hover:text-text focus-visible:outline-accent',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 4: Escrever as quatro telas do caminho de 3 toques**

`apps/totem/src/screens/Attract.tsx`:

```tsx
export function Attract({ gymName, onTouch }: { gymName: string; onTouch: () => void }) {
  return (
    <button
      type="button"
      onClick={onTouch}
      aria-label="Toque para começar"
      className="relative flex h-full w-full flex-col items-center justify-center gap-8 text-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48% 42% at 50% 44%, var(--qf-accent-glow), transparent 72%)',
        }}
      />
      <Mark size={140} />
      <h1 className="font-display text-[72px] font-extrabold leading-[1.05] tracking-tight">
        Monte seu treino
        <br />
        em 1 minuto
      </h1>
      <p className="animate-pulse text-[28px] uppercase tracking-[0.1em] text-dim motion-reduce:animate-none">
        Toque na tela para começar
      </p>
      <p className="absolute bottom-10 text-[20px] text-dim">{gymName}</p>
    </button>
  );
}

export function Mark({ size = 52 }: { size?: number }) {
  return (
    <div
      aria-hidden
      className="relative flex-none rounded-full border-accent"
      style={{ width: size, height: size, borderWidth: Math.max(3, size * 0.075) }}
    >
      <span
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
        style={{ width: size * 0.33, height: size * 0.33 }}
      />
    </div>
  );
}
```

`apps/totem/src/screens/Parq.tsx`:

```tsx
import { PARQ_QUESTIONS } from '../state/machine';
import { Cta } from '../components/Cta';

type Props = {
  marked: number[];
  onToggle: (i: number) => void;
  onNone: () => void;
};

/** D6: uma tela, 1 toque no caminho felizeu, e responde a objeção do gestor. */
export function Parq({ marked, onToggle, onNone }: Props) {
  return (
    <div className="flex h-full flex-col gap-6">
      <h2 className="font-display text-[56px] font-extrabold leading-tight tracking-tight text-balance">
        Algum destes se aplica a você hoje?
      </h2>

      <div className="flex flex-col gap-3">
        {PARQ_QUESTIONS.map((q, i) => {
          const on = marked.includes(i);
          return (
            <button
              key={q}
              type="button"
              onClick={() => onToggle(i)}
              aria-pressed={on}
              className={[
                'flex min-h-[88px] w-full items-center gap-5 rounded-2xl border px-6 text-left',
                'focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent',
                on ? 'border-danger bg-surface' : 'border-border bg-surface hover:border-dim',
              ].join(' ')}
            >
              <span
                aria-hidden
                className={[
                  'grid h-9 w-9 flex-none place-items-center rounded-md border-2 text-xl font-extrabold',
                  on ? 'border-danger bg-danger text-white' : 'border-dim',
                ].join(' ')}
              >
                {on ? '✕' : ''}
              </span>
              <span className="text-[28px] font-semibold">{q}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto">
        <Cta onClick={onNone}>Nenhuma das anteriores &nbsp;→</Cta>
      </div>
    </div>
  );
}
```

`apps/totem/src/screens/Blocked.tsx`:

```tsx
import { Cta } from '../components/Cta';

export function Blocked({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex h-full flex-col gap-8">
      <div className="my-auto rounded-xl border-l-4 border-warn bg-warn/10 px-8 py-7">
        <h2 className="font-display text-[44px] font-extrabold leading-tight tracking-tight">
          Fale com o professor da unidade
        </h2>
        <p className="mt-5 text-[26px] leading-relaxed text-dim">
          Pelo que você marcou, seu treino de hoje precisa ser montado por um
          profissional. Procure a recepção — leva menos de dois minutos.
        </p>
      </div>
      <Cta variant="ghost" onClick={onReset}>
        Voltar ao início
      </Cta>
    </div>
  );
}
```

`apps/totem/src/screens/Home.tsx`:

```tsx
import { SHORTCUTS } from '../state/machine';
import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';

type Props = { onShortcut: (i: number) => void; onCustom: () => void };

export function Home({ onShortcut, onCustom }: Props) {
  return (
    <div className="flex h-full flex-col gap-6">
      <h2 className="font-display text-[56px] font-extrabold leading-tight tracking-tight">
        Como vai ser hoje?
      </h2>

      <div className="grid flex-1 grid-cols-2 content-start gap-4">
        {SHORTCUTS.map((sc, i) => (
          <BigButton
            key={sc.label}
            title={sc.label}
            sub={sc.sub}
            onClick={() => onShortcut(i)}
          />
        ))}
      </div>

      <Cta variant="ghost" onClick={onCustom}>
        ⚙ &nbsp;Montar do zero
      </Cta>
    </div>
  );
}
```

- [ ] **Step 5: Telas de transição e de falha**

`apps/totem/src/screens/Generating.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Mark } from './Attract';

const STEPS = [
  'filtrando exercícios disponíveis nesta unidade…',
  'encaixando no seu tempo…',
  'ordenando por padrão de movimento…',
];

export function Generating() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 260);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-6 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(48% 42% at 50% 44%, var(--qf-accent-glow), transparent 72%)',
        }}
      />
      <div className="animate-pulse motion-reduce:animate-none">
        <Mark size={96} />
      </div>
      <h2 className="font-display text-[42px] font-extrabold tracking-tight">
        Montando seu treino
      </h2>
      <p aria-live="polite" className="text-[24px] text-dim">
        {STEPS[i]}
      </p>
    </div>
  );
}
```

`apps/totem/src/screens/Thin.tsx`:

```tsx
import { Cta } from '../components/Cta';

type Props = { poolSize: number; onBack: () => void; onReset: () => void };

/**
 * A mensagem tem que dizer a CAUSA CERTA: falta de aparelho é diferente de
 * combinação apertada. Errar aqui faz o gestor achar que a academia dele é pobre.
 */
export function Thin({ poolSize, onBack, onReset }: Props) {
  const causa =
    poolSize < 6
      ? 'Esta unidade não tem aparelhos suficientes para montar um treino seguro com essa combinação.'
      : 'Não deu para montar um treino completo com esse tempo e essa combinação.';

  return (
    <div className="flex h-full flex-col gap-8">
      <div className="my-auto rounded-xl border-l-4 border-warn bg-warn/10 px-8 py-7">
        <h2 className="font-display text-[40px] font-extrabold leading-tight tracking-tight">
          Combinação indisponível
        </h2>
        <p className="mt-5 text-[26px] leading-relaxed text-dim">
          {causa} Tente outro grupo muscular ou fale com o professor da unidade.
        </p>
      </div>
      <div className="flex gap-4">
        <Cta onClick={onBack}>Escolher outro</Cta>
        <Cta variant="ghost" onClick={onReset}>Sair</Cta>
      </div>
    </div>
  );
}
```

`apps/totem/src/screens/Unavailable.tsx`:

```tsx
/** Nenhum caminho termina em tela branca (spec §8). */
export function Unavailable() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <h2 className="font-display text-[48px] font-extrabold tracking-tight">
        Totem indisponível
      </h2>
      <p className="max-w-[24ch] text-[26px] leading-relaxed text-dim">
        Procure a recepção para montar seu treino de hoje.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Montar o `App`**

`apps/totem/src/App.tsx`:

```tsx
import { useEffect, useReducer, useState } from 'react';
import { generateWorkout } from '@quickfit/core/engine';
import { loadCatalog, type CatalogBundle } from './data/loadCatalog';
import { applyTheme } from '@quickfit/core/theme';
import { initialState, reducer, toInput } from './state/machine';
import { useIdleTimeout } from './state/useIdleTimeout';
import { Attract, Mark } from './screens/Attract';
import { Parq } from './screens/Parq';
import { Blocked } from './screens/Blocked';
import { Home } from './screens/Home';
import { Generating } from './screens/Generating';
import { Thin } from './screens/Thin';
import { Unavailable } from './screens/Unavailable';

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [bundle, setBundle] = useState<CatalogBundle | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    loadCatalog()
      .then((b) => {
        applyTheme(b.gym.theme);
        setBundle(b);
      })
      .catch((e) => {
        console.error(e);
        setFailed(true);
      });
  }, []);

  // Gera assim que a tela `generating` aparece. O motor é sincronizado; o
  // delay é só para a animação não piscar.
  useEffect(() => {
    if (state.screen !== 'generating' || !bundle) return;
    const t = window.setTimeout(() => {
      const workout = generateWorkout(toInput(state, bundle.availableEquipment), bundle.exercises);
      dispatch({ type: 'GENERATED', workout });
    }, 820);
    return () => window.clearTimeout(t);
  }, [state.screen, state.seed, bundle]);

  useIdleTimeout(() => dispatch({ type: 'RESET' }), state.screen !== 'attract');

  if (failed) return <Shell><Unavailable /></Shell>;
  if (!bundle) return <Shell><div className="grid h-full place-items-center"><Mark size={96} /></div></Shell>;

  const gym = bundle.gym;

  return (
    <Shell>
      {state.screen === 'attract' && (
        <Attract gymName={gym.name} onTouch={() => dispatch({ type: 'TOUCH_ATTRACT' })} />
      )}

      {state.screen !== 'attract' && (
        <div className="flex h-full flex-col gap-6 p-10">
          <Header gymName={gym.name} />
          <div className="min-h-0 flex-1">
            {state.screen === 'parq' && (
              <Parq
                marked={state.parq}
                onToggle={(i) => dispatch({ type: 'PARQ_TOGGLE', index: i })}
                onNone={() => dispatch({ type: 'PARQ_NONE' })}
              />
            )}
            {state.screen === 'blocked' && <Blocked onReset={() => dispatch({ type: 'RESET' })} />}
            {state.screen === 'home' && (
              <Home
                onShortcut={(i) => dispatch({ type: 'PICK_SHORTCUT', index: i })}
                onCustom={() => dispatch({ type: 'OPEN_CUSTOM' })}
              />
            )}
            {state.screen === 'generating' && <Generating />}
            {state.screen === 'thin' && (
              <Thin
                poolSize={state.workout?.poolSize ?? 0}
                onBack={() => dispatch({ type: 'PARQ_NONE' })}
                onReset={() => dispatch({ type: 'RESET' })}
              />
            )}
            {/* result, ficha e o caminho completo entram nas tasks 15 e 16 */}
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="h-full w-full overflow-hidden bg-bg text-text">{children}</main>;
}

function Header({ gymName }: { gymName: string }) {
  return (
    <div className="flex flex-none items-center gap-4">
      <Mark />
      <div>
        <div className="font-display text-[26px] font-bold tracking-tight">{gymName}</div>
        <div className="text-[16px] uppercase tracking-[0.1em] text-dim">QuickFit</div>
      </div>
    </div>
  );
}
```

`apps/totem/src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6.5: Error boundary — nenhum erro não tratado deixa tela branca**

Spec §8, última linha. Um totem sem operador precisa se recuperar sozinho.

`apps/totem/src/components/Boundary.tsx`:

```tsx
import { Component, type ReactNode } from 'react';

type Props = { children: ReactNode; onReset: () => void };
type State = { crashed: boolean };

/**
 * Último recurso. Se algo não previsto lançar durante o render, o totem volta
 * para a tela inicial em 5 segundos em vez de ficar branco até alguém notar.
 */
export class Boundary extends Component<Props, State> {
  state: State = { crashed: false };

  static getDerivedStateFromError(): State {
    return { crashed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Erro não tratado no totem:', error);
    window.setTimeout(() => {
      this.setState({ crashed: false });
      this.props.onReset();
    }, 5000);
  }

  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 text-center">
        <h2 className="font-display text-[44px] font-extrabold tracking-tight">
          Algo deu errado
        </h2>
        <p className="max-w-[26ch] text-[24px] text-dim">
          Voltando ao início em alguns segundos. Se persistir, procure a recepção.
        </p>
      </div>
    );
  }
}
```

Envolva o conteúdo no `App.tsx`, dentro do `Shell`:

```tsx
import { Boundary } from './components/Boundary';

// dentro do return, envolvendo tudo depois do <Shell>:
<Shell>
  <Boundary onReset={() => dispatch({ type: 'RESET' })}>
    {/* ...as telas... */}
  </Boundary>
</Shell>
```

Verifique lançando de propósito: adicione `if (state.taps === 2) throw new Error('teste');` no topo do `App`, toque duas vezes, confirme que a tela de recuperação aparece e que o totem volta ao attract em 5s. **Remova a linha depois.**

- [ ] **Step 7: Rodar e clicar o caminho de 3 toques**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run dev
```

No browser, em janela de 1280×800: toque na tela → "Nenhuma das anteriores" → "Peito + Tríceps". Deve aparecer a tela de geração e depois cair em `result` (ainda vazia — a task 15 a implementa) ou em `thin`.

Confirme no console: nenhum erro, e a fonte Sora carregada (DevTools → Network → filtro `woff2`).

- [ ] **Step 8: Rodar a suíte e o typecheck**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck && npm run build
```

O `build` entra aqui porque é a primeira tarefa com JSX — erro de tipo em componente só aparece no build.

- [ ] **Step 9: Commit**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
git add src index.html public
git commit -m "feat(ui): caminho de 3 toques — attract, PAR-Q, atalhos e geração

Alvos de 96px, fontes auto-hospedadas, idle timeout de 90s e nenhum caminho
terminando em tela branca.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Caminho completo e tela de resultado com scroll

O scroll da lista não é detalhe: com 9 exercícios a lista estoura a dobra, e sem véu e contador o aluno não sabe que há mais.

**Files:**
- Create: `apps/totem/src/screens/Goal.tsx`
- Create: `apps/totem/src/screens/Groups.tsx`
- Create: `apps/totem/src/screens/Time.tsx`
- Create: `apps/totem/src/screens/Level.tsx`
- Create: `apps/totem/src/screens/Result.tsx`
- Create: `apps/totem/src/screens/useHasMore.ts`
- Test: `apps/totem/src/screens/labels.test.ts`
- Create: `apps/totem/src/screens/labels.ts`
- Modify: `apps/totem/src/App.tsx`

**Interfaces:**
- Consumes: `Action`, `MachineState` de `../state/machine`; `Workout` do motor
- Produces:
  - `GROUP_LABEL`, `GOAL_OPTIONS`, `LEVEL_OPTIONS`, `TIME_OPTIONS_FULL`, `TIME_OPTIONS_QUICK`
  - `describeWorkout(w: Workout): { exercicios: number; series: number; minutos: number }`
  - `useHasMore(ref: RefObject<HTMLElement>): { hasMore: boolean; below: number }`

- [ ] **Step 1: Escrever os testes dos rótulos e do resumo (vão falhar)**

`apps/totem/src/screens/labels.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  GROUP_LABEL, GOAL_OPTIONS, LEVEL_OPTIONS,
  TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK, describeWorkout,
} from './labels';
import { TARGET_EX } from '@quickfit/core/engine';
import type { Workout } from '@quickfit/core/engine';

describe('rótulos', () => {
  it('todo grupo muscular tem rótulo em pt-BR', () => {
    const grupos = ['peito','costas','ombros','biceps','triceps','pernas','gluteos','core','cardio'] as const;
    for (const g of grupos) {
      expect(GROUP_LABEL[g]).toBeTruthy();
      expect(GROUP_LABEL[g]).not.toBe(g);   // "core" não pode aparecer como "core"
    }
  });

  it('abdômen é o rótulo de core — "core" é jargão', () => {
    expect(GROUP_LABEL.core).toBe('Abdômen');
  });

  it('oferece uma opção "Não sei" que assume intermediário', () => {
    const naoSei = LEVEL_OPTIONS.find((o) => o.label === 'Não sei');
    expect(naoSei).toBeDefined();
    expect(naoSei!.level).toBe(2);
  });

  it('todo objetivo tem descrição sem jargão', () => {
    for (const o of GOAL_OPTIONS) {
      expect(o.sub.length).toBeGreaterThan(3);
      expect(o.sub).not.toMatch(/hipertrofia|catabolismo/i);
    }
  });

  it('o caminho completo cobre perna longa e sessão de força', () => {
    expect(TIME_OPTIONS_FULL).toEqual([20, 30, 45, 60, 90]);
  });

  it('o atalho rápido oferece só tempos curtos', () => {
    expect(TIME_OPTIONS_QUICK).toEqual([20, 30, 40, 50]);
    expect(Math.max(...TIME_OPTIONS_QUICK)).toBeLessThan(60);
  });

  it('nenhuma tela oferece dois tempos com o mesmo alvo de exercícios', () => {
    // 40 e 45 caem ambos em 6. Oferecer os dois na mesma tela seria uma
    // escolha sem consequência para o aluno.
    for (const escada of [TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK]) {
      const alvos = escada.map((m) => TARGET_EX[m]);
      expect(new Set(alvos).size).toBe(alvos.length);
    }
  });
});

describe('describeWorkout', () => {
  const w = (items: Array<{ sets: number }>, usedSec: number): Workout =>
    ({ items: items.map((i) => ({ ...i, exercise: {}, reps: '8-12' })), usedSec } as never);

  it('conta exercícios e soma séries', () => {
    const d = describeWorkout(w([{ sets: 4 }, { sets: 4 }, { sets: 3 }], 1800));
    expect(d.exercicios).toBe(3);
    expect(d.series).toBe(11);
  });

  it('soma os 5 min de aquecimento na duração exibida', () => {
    const d = describeWorkout(w([{ sets: 3 }], 1800));
    expect(d.minutos).toBe(35);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/screens/labels.test.ts
```

Esperado: FAIL — `Failed to resolve import "./labels"`.

- [ ] **Step 3: Implementar rótulos e resumo**

`apps/totem/src/screens/labels.ts`:

```ts
import type { Goal, Level, Minutes, MuscleGroup, Workout } from '@quickfit/core/engine';

/** Nunca mostre o id ao aluno. "core" é jargão; "Abdômen" é português. */
export const GROUP_LABEL: Record<MuscleGroup, string> = {
  peito: 'Peito',
  costas: 'Costas',
  ombros: 'Ombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  pernas: 'Pernas',
  gluteos: 'Glúteos',
  core: 'Abdômen',
  cardio: 'Cardio',
};

export const GOAL_OPTIONS: Array<{ goal: Goal; label: string; sub: string }> = [
  { goal: 'hipertrofia',   label: 'Ganhar massa',    sub: 'músculo mais volumoso' },
  { goal: 'emagrecimento', label: 'Emagrecer',       sub: 'gastar mais caloria' },
  { goal: 'forca',         label: 'Ficar mais forte', sub: 'levantar mais peso' },
  { goal: 'resistencia',   label: 'Ter mais fôlego', sub: 'aguentar mais tempo' },
  { goal: 'mobilidade',    label: 'Soltar o corpo',  sub: 'mais amplitude e menos dor' },
  { goal: 'hipertrofia',   label: 'Não sei',         sub: 'a gente decide para você' },
];

export const TIME_OPTIONS_FULL: Minutes[] = [20, 30, 45, 60, 90];
export const TIME_OPTIONS_QUICK: Minutes[] = [20, 30, 40, 50];

export const LEVEL_OPTIONS: Array<{ level: Level; label: string; sub: string }> = [
  { level: 1, label: 'Iniciante',     sub: 'até 6 meses treinando' },
  { level: 2, label: 'Intermediário', sub: '6 meses a 2 anos' },
  { level: 3, label: 'Avançado',      sub: 'mais de 2 anos' },
  { level: 2, label: 'Não sei',       sub: 'assumimos intermediário' },
];

const WARMUP_MIN = 5;

export function describeWorkout(w: Workout): {
  exercicios: number;
  series: number;
  minutos: number;
} {
  return {
    exercicios: w.items.length,
    series: w.items.reduce((s, it) => s + it.sets, 0),
    minutos: Math.round(w.usedSec / 60) + WARMUP_MIN,
  };
}

export function groupsLabel(groups: MuscleGroup[]): string {
  return groups.map((g) => GROUP_LABEL[g]).join(' + ');
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/screens/labels.test.ts
```

Esperado: PASS, 9 testes.

- [ ] **Step 5: Escrever as quatro telas do caminho completo**

`apps/totem/src/screens/Goal.tsx`:

```tsx
import { BigButton } from '../components/BigButton';
import { GOAL_OPTIONS } from './labels';
import type { Goal as GoalType } from '@quickfit/core/engine';

type Props = { onPick: (g: GoalType) => void; onBack: () => void };

export function Goal({ onPick, onBack }: Props) {
  return (
    <StepShell step={1} title="Qual seu objetivo?" onBack={onBack}>
      <div className="grid grid-cols-3 content-start gap-4">
        {GOAL_OPTIONS.map((o) => (
          <BigButton key={o.label} title={o.label} sub={o.sub} onClick={() => onPick(o.goal)} />
        ))}
      </div>
    </StepShell>
  );
}

export function StepShell({
  step, title, hint, onBack, children, footer,
}: {
  /** Omitido no fluxo de atalho: lá não há "passo 3 de 4". */
  step?: number;
  title: string;
  hint?: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-none items-center justify-between">
        <span className="text-[18px] uppercase tracking-[0.1em] text-dim">
          {step ? `Passo ${step} de 4` : ''}
        </span>
        <button
          type="button"
          onClick={onBack}
          className="min-h-[64px] rounded-xl px-5 text-[22px] text-dim hover:text-text focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent"
        >
          ← Voltar
        </button>
      </div>
      <h2 className="flex-none font-display text-[56px] font-extrabold leading-tight tracking-tight">
        {title}
      </h2>
      {hint ? <p className="flex-none text-[24px] text-dim">{hint}</p> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer ? <div className="flex-none">{footer}</div> : null}
    </div>
  );
}
```

`apps/totem/src/screens/Groups.tsx`:

```tsx
import { BigButton } from '../components/BigButton';
import { Cta } from '../components/Cta';
import { StepShell } from './Goal';
import { GROUP_LABEL } from './labels';
import type { MuscleGroup } from '@quickfit/core/engine';

type Props = {
  selected: MuscleGroup[];
  onToggle: (g: MuscleGroup) => void;
  onConfirm: () => void;
  onBack: () => void;
};

export function Groups({ selected, onToggle, onConfirm, onBack }: Props) {
  const n = selected.length;
  return (
    <StepShell
      step={2}
      title="O que você vai treinar?"
      hint="Pode escolher mais de um."
      onBack={onBack}
      footer={
        <Cta onClick={onConfirm} disabled={n === 0}>
          {n === 0 ? 'Escolha ao menos um grupo' : `Continuar com ${n} grupo${n > 1 ? 's' : ''} →`}
        </Cta>
      }
    >
      <div className="grid grid-cols-3 content-start gap-3">
        {(Object.keys(GROUP_LABEL) as MuscleGroup[]).map((g) => (
          <BigButton
            key={g}
            title={GROUP_LABEL[g]}
            pressed={selected.includes(g)}
            onClick={() => onToggle(g)}
          />
        ))}
      </div>
    </StepShell>
  );
}
```

`apps/totem/src/screens/Time.tsx`:

```tsx
import { BigButton } from '../components/BigButton';
import { StepShell } from './Goal';
import { TIME_OPTIONS_FULL, TIME_OPTIONS_QUICK } from './labels';
import type { Minutes } from '@quickfit/core/engine';

type Props = {
  onPick: (m: Minutes) => void;
  onBack: () => void;
  /** 'atalho' mostra a escada curta e não numera o passo. */
  variant: 'atalho' | 'completo';
};

export function Time({ onPick, onBack, variant }: Props) {
  const quick = variant === 'atalho';
  const options = quick ? TIME_OPTIONS_QUICK : TIME_OPTIONS_FULL;

  return (
    <StepShell
      step={quick ? undefined : 3}
      title="Quanto tempo você tem?"
      hint={quick ? 'A gente monta um treino de corpo inteiro nesse tempo.' : undefined}
      onBack={onBack}
    >
      <div className="grid grid-cols-2 content-start gap-4">
        {options.map((m) => (
          <BigButton key={m} title={`${m} min`} onClick={() => onPick(m)} />
        ))}
      </div>
    </StepShell>
  );
}
```

`apps/totem/src/screens/Level.tsx`:

```tsx
import { BigButton } from '../components/BigButton';
import { StepShell } from './Goal';
import { LEVEL_OPTIONS } from './labels';
import type { Level as LevelType } from '@quickfit/core/engine';

type Props = { onPick: (l: LevelType) => void; onBack: () => void };

export function Level({ onPick, onBack }: Props) {
  return (
    <StepShell step={4} title="Qual sua experiência?" onBack={onBack}>
      <div className="grid grid-cols-2 content-start gap-4">
        {LEVEL_OPTIONS.map((o) => (
          <BigButton key={o.label} title={o.label} sub={o.sub} onClick={() => onPick(o.level)} />
        ))}
      </div>
    </StepShell>
  );
}
```

- [ ] **Step 6: Hook do véu de scroll**

`apps/totem/src/screens/useHasMore.ts`:

```ts
import { useCallback, useEffect, useState, type RefObject } from 'react';

/**
 * Num totem a barra de rolagem é a única dica de que existe mais conteúdo.
 * Este hook alimenta o véu e o contador "↓ mais N exercícios".
 */
export function useHasMore(ref: RefObject<HTMLElement | null>): {
  hasMore: boolean;
  below: number;
} {
  const [state, setState] = useState({ hasMore: false, below: 0 });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const hidden = el.scrollHeight - el.clientHeight - el.scrollTop;
    if (hidden <= 4) {
      setState({ hasMore: false, below: 0 });
      return;
    }
    const below = Array.from(el.children).filter(
      (c) => (c as HTMLElement).offsetTop - el.scrollTop + (c as HTMLElement).offsetHeight
        > el.clientHeight + 2,
    ).length;
    setState({ hasMore: true, below });
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      ro.disconnect();
    };
  }, [ref, measure]);

  return state;
}
```

- [ ] **Step 7: Tela de resultado**

`apps/totem/src/screens/Result.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Cta } from '../components/Cta';
import { useHasMore } from './useHasMore';
import { describeWorkout, groupsLabel } from './labels';
import type { Workout } from '@quickfit/core/engine';

type Props = {
  workout: Workout;
  groupsTitle: string;
  levelLabel: string;
  embellishTitle: string | null;
  onPrint: () => void;
  onRegenerate: () => void;
  onExit: () => void;
};

export function Result({
  workout, groupsTitle, levelLabel, embellishTitle, onPrint, onRegenerate, onExit,
}: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const { hasMore, below } = useHasMore(listRef);
  const d = describeWorkout(workout);
  const dense = workout.items.length > 7;

  // Nova geração começa do topo, senão o aluno vê o meio da lista.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [workout]);

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="flex flex-none items-start justify-between gap-6">
        <div>
          <h2 className="font-display text-[42px] font-extrabold leading-tight tracking-tight">
            {embellishTitle ?? `Treino A — ${groupsTitle}`}
          </h2>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[20px] text-dim">
            <span><b className="text-text">{d.exercicios}</b> exercícios</span>
            <span><b className="text-text">{d.series}</b> séries</span>
            <span>~<b className="text-text">{d.minutos}</b> min com aquecimento</span>
            <span>nível <b className="text-text">{levelLabel}</b></span>
          </div>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="min-h-[64px] flex-none rounded-xl px-5 text-[22px] text-dim hover:text-text focus-visible:outline focus-visible:outline-4 focus-visible:outline-accent"
        >
          ✕ Sair
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          className={[
            'absolute inset-0 flex flex-col overflow-y-auto pr-2',
            dense ? 'gap-2' : 'gap-3',
            '[scrollbar-color:var(--qf-accent)_var(--qf-surface)] [scrollbar-width:thin]',
          ].join(' ')}
          style={{ scrollbarGutter: 'stable' }}
        >
          {workout.items.map((it, i) => (
            <div
              key={it.exercise.id}
              className={[
                'flex flex-none items-center gap-5 rounded-lg border-l-4 border-accent bg-surface',
                dense ? 'px-5 py-2' : 'px-5 py-3',
              ].join(' ')}
            >
              <span className="w-10 flex-none font-display text-[22px] font-extrabold tabular-nums text-accent">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate font-semibold ${dense ? 'text-[22px]' : 'text-[26px]'}`}>
                  {it.exercise.name}
                </span>
                <span className="block truncate text-[17px] text-dim">
                  {it.exercise.cue ?? it.exercise.equipment.join(' · ')}
                </span>
              </span>
              <span className={`flex-none font-display font-extrabold tabular-nums ${dense ? 'text-[24px]' : 'text-[30px]'}`}>
                {it.exercise.pattern === 'cardio' ? it.reps : `${it.sets}×${it.reps}`}
              </span>
            </div>
          ))}
        </div>

        {hasMore && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
              style={{ background: 'linear-gradient(to top, var(--qf-bg), transparent)' }}
            />
            <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-4 py-1 text-[17px] font-extrabold text-onAccent">
              ↓ mais {below} exercício{below > 1 ? 's' : ''} — role a lista
            </span>
          </>
        )}
      </div>

      <p className="flex-none text-[18px] text-dim">
        Descanso de {workout.scheme.rest}s entre séries
        {embellishTitle ? ' · nome e dicas escritos pela IA' : ''}
      </p>

      <div className="flex flex-none gap-4">
        <Cta onClick={onPrint}>🖨 &nbsp;Imprimir ficha</Cta>
        <Cta variant="ghost" onClick={onRegenerate}>↻ &nbsp;Gerar outro</Cta>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Ligar tudo no `App.tsx`**

Acrescente os imports e os blocos condicionais dentro da `div` de conteúdo, depois de `thin`:

```tsx
import { Goal } from './screens/Goal';
import { Groups } from './screens/Groups';
import { Time } from './screens/Time';
import { Level } from './screens/Level';
import { Result } from './screens/Result';
import { groupsLabel, LEVEL_OPTIONS } from './screens/labels';
```

```tsx
{state.screen === 'goal' && (
  <Goal
    onPick={(goal) => dispatch({ type: 'PICK_GOAL', goal })}
    onBack={() => dispatch({ type: 'BACK' })}
  />
)}
{state.screen === 'groups' && (
  <Groups
    selected={state.groups}
    onToggle={(group) => dispatch({ type: 'TOGGLE_GROUP', group })}
    onConfirm={() => dispatch({ type: 'CONFIRM_GROUPS' })}
    onBack={() => dispatch({ type: 'BACK' })}
  />
)}
{state.screen === 'time' && (
  <Time
    variant={state.path}
    onPick={(minutes) => dispatch({ type: 'PICK_TIME', minutes })}
    onBack={() => dispatch({ type: 'BACK' })}
  />
)}
{state.screen === 'level' && (
  <Level
    onPick={(level) => dispatch({ type: 'PICK_LEVEL', level })}
    onBack={() => dispatch({ type: 'BACK' })}
  />
)}
{state.screen === 'result' && state.workout && (
  <Result
    workout={state.workout}
    groupsTitle={groupsLabel(state.groups)}
    levelLabel={LEVEL_OPTIONS.find((o) => o.level === state.level)!.sub}
    embellishTitle={null}
    onPrint={() => dispatch({ type: 'OPEN_FICHA' })}
    onRegenerate={() => dispatch({ type: 'REGENERATE' })}
    onExit={() => dispatch({ type: 'RESET' })}
  />
)}
```

- [ ] **Step 9: Verificar o pior caso no browser**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run dev
```

Percorra: toque → nenhuma das anteriores → **Montar do zero** → Emagrecer → marque 6 grupos → 90 min → Avançado.

Confirme: aparecem no máximo 9 exercícios (não 19), a lista rola, o véu e o chip "↓ mais N exercícios" aparecem, e "Gerar outro" muda o treino.

- [ ] **Step 10: Rodar tudo e commitar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck && npm run build
git add src
git commit -m "feat(ui): caminho completo dos 4 passos e resultado com scroll

Lista rola com véu e contador — num totem a única dica de que há mais
conteúdo. Rótulos em pt-BR sem jargão ("Abdômen", não "core").

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: Ficha A4, impressão e QR

`overflow: auto` na pré-visualização **corta conteúdo no papel**. É o defeito mais perigoso do produto porque a tela mostra certo.

**Files:**
- Create: `apps/totem/src/print/print.css`
- Create: `apps/totem/src/print/qr.ts`
- Create: `apps/totem/src/screens/Ficha.tsx`
- Test: `apps/totem/src/print/qr.test.ts`
- Modify: `apps/totem/src/index.css` (importar `print.css`)
- Modify: `apps/totem/src/App.tsx`

**Interfaces:**
- Consumes: `Workout`, `Gym`, `describeWorkout`, `groupsLabel`
- Produces:
  - `workoutUrl(id: string): string`
  - `qrDataUrl(text: string): Promise<string>`
  - `<Ficha workout gym groupsTitle workoutId onBack />`

- [ ] **Step 1: Escrever os testes do QR (vão falhar)**

`apps/totem/src/print/qr.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { qrDataUrl, workoutUrl } from './qr';

describe('workoutUrl', () => {
  it('monta uma URL curta na origem atual', () => {
    const url = workoutUrl('abc1234567', 'https://quickfit.vercel.app');
    expect(url).toBe('https://quickfit.vercel.app/w/abc1234567');
  });

  it('não duplica a barra quando a base já termina em /', () => {
    expect(workoutUrl('x', 'https://a.com/')).toBe('https://a.com/w/x');
  });
});

describe('qrDataUrl', () => {
  it('devolve um data URL de PNG', async () => {
    const out = await qrDataUrl('https://quickfit.vercel.app/w/abc1234567');
    expect(out.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('URL curta gera QR de baixa densidade', async () => {
    // O nanoid de 10 chars existe para isto: QR pequeno lê rápido em câmera
    // ruim sob luz forte.
    const curto = await qrDataUrl('https://quickfit.vercel.app/w/abc1234567');
    const longo = await qrDataUrl('https://quickfit.vercel.app/w/' + 'x'.repeat(300));
    expect(curto.length).toBeLessThan(longo.length);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/print/qr.test.ts
```

Esperado: FAIL — `Failed to resolve import "./qr"`.

- [ ] **Step 3: Implementar o QR**

`apps/totem/src/print/qr.ts`:

```ts
import QRCode from 'qrcode';

/**
 * O default é lido de `window` mas com guarda: sem ela, importar este módulo
 * em ambiente `node` (é o que o vitest usa) explode com `ReferenceError` no
 * primeiro teste que chamar sem `base`. A guarda deixa a função utilizável nos
 * dois mundos sem ninguém precisar montar um DOM falso só para testar
 * concatenação de string.
 */
export function workoutUrl(
  id: string,
  base = typeof window === 'undefined' ? '' : window.location.origin,
): string {
  return `${base.replace(/\/$/, '')}/w/${id}`;
}

/** Gerado no cliente — não depende de serviço externo, funciona offline. */
export async function qrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    scale: 6,
    color: { dark: '#14170F', light: '#FFFFFF' },
  });
}
```

- [ ] **Step 4: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/print/qr.test.ts
```

Esperado: PASS, 4 testes.

- [ ] **Step 5: Escrever a folha de impressão — as 6 regras não-negociáveis**

`apps/totem/src/print/print.css`:

```css
/* Cada regra aqui nasceu de defeito real medido no protótipo, não de teoria.
   Ver spec §7. */
@media print {
  @page { size: A4 portrait; margin: 14mm; }

  /* 1. Nenhum controle de tela vai pro papel. Sem isto, os botões
        "Imprimir" e "Voltar" saem impressos na ficha. */
  .no-print { display: none !important; }

  /* 2. Fundo branco em toda a cadeia de ancestrais, senão o cinza da
        interface vaza como um bloco no meio da folha. */
  html, body, #root, .qf-shell, .qf-ficha { background: #fff !important; }
  body { color: #14170f !important; }

  /* 3. O ponto de tudo: a pré-visualização rola para caber na tela do totem.
        Se o overflow vazar para a impressão, EXERCÍCIO DESAPARECE DO PAPEL
        sem aviso — o defeito mais perigoso, porque a tela mostra certo. */
  .qf-sheet, .qf-sheet-body {
    overflow: visible !important;
    height: auto !important;
    max-height: none !important;
    position: static !important;
  }

  .qf-shell, .qf-ficha {
    height: auto !important;
    overflow: visible !important;
    padding: 0 !important;
    display: block !important;
  }

  .qf-sheet {
    box-shadow: none !important;
    max-width: none !important;
    width: auto !important;
    padding: 0 !important;
    font-size: 10pt !important;
  }

  /* 4. Cabeçalho da tabela repete em cada página impressa. */
  .qf-sheet thead { display: table-header-group; }

  /* 5. Nenhum exercício parte no meio entre páginas. */
  .qf-sheet tr { break-inside: avoid; page-break-inside: avoid; }

  /* 6. O rodapé de homologação CREF repete em TODA página. Não pode existir
        folha impressa sem ele — é o que sustenta a ficha juridicamente. */
  .qf-sheet-footer {
    position: fixed !important;
    left: 0; right: 0; bottom: 0;
    background: #fff !important;
    border-top: .8pt solid #c8ccc3 !important;
    padding-top: 5pt !important;
    font-size: 7.5pt !important;
  }

  .qf-sheet .gym  { font-size: 16pt !important; }
  .qf-sheet .tag  { font-size: 7.5pt !important; }
  .qf-sheet table { font-size: 9.5pt !important; width: 100%; border-collapse: collapse; }
  .qf-sheet th    { font-size: 7pt !important; padding: 4pt 2pt !important; }
  .qf-sheet td    { padding: 6pt 2pt !important; }
  .qf-sheet .eqp  { font-size: 8pt !important; }
  .qf-sheet img.qr { width: 54pt !important; height: 54pt !important; }
}
```

Acrescente ao fim de `apps/totem/src/index.css`:

```css
@import './print/print.css';
```

- [ ] **Step 6: Escrever a tela da ficha**

`apps/totem/src/screens/Ficha.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Cta } from '../components/Cta';
import { qrDataUrl, workoutUrl } from '../print/qr';
import { describeWorkout } from './labels';
import type { Gym } from '../data/loadCatalog';
import type { Workout } from '@quickfit/core/engine';

type Props = {
  workout: Workout;
  gym: Gym;
  groupsTitle: string;
  workoutId: string | null;
  onBack: () => void;
};

export function Ficha({ workout, gym, groupsTitle, workoutId, onBack }: Props) {
  const [qr, setQr] = useState<string | null>(null);
  const d = describeWorkout(workout);

  useEffect(() => {
    if (!workoutId) return;
    qrDataUrl(workoutUrl(workoutId)).then(setQr).catch(() => setQr(null));
  }, [workoutId]);

  const hoje = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date());

  return (
    <div className="qf-ficha flex h-full flex-col items-center gap-5 bg-[#3a3d36] p-6">
      <div className="qf-sheet flex min-h-0 w-full max-w-[820px] flex-1 flex-col gap-4 bg-white p-10 text-[#14170f] shadow-2xl">
        <div className="flex flex-none items-start justify-between border-b border-[#14170f] pb-3">
          <div>
            <div className="gym font-display text-[30px] font-extrabold tracking-tight">
              {gym.name}
            </div>
            <div className="tag text-[13px] uppercase tracking-[0.12em] text-[#5c6356]">
              Ficha gerada no QuickFit · {hoje}
            </div>
          </div>
          <div className="text-right">
            <div className="tag text-[13px] uppercase tracking-[0.12em] text-[#5c6356]">Treino A</div>
            <div className="text-[20px] font-extrabold">{groupsTitle}</div>
          </div>
        </div>

        <div className="tag flex-none text-[13px] uppercase tracking-[0.12em] text-[#5c6356]">
          Aquecimento 5 min · duração estimada {d.minutos} min · descanso {workout.scheme.rest}s entre séries
        </div>

        {/* Rola na TELA; na impressão o print.css zera o overflow. */}
        <div className="qf-sheet-body min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="w-8 border-b border-[#c8ccc3] px-1 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#5c6356]"></th>
                <th className="border-b border-[#c8ccc3] px-1 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#5c6356]">Exercício</th>
                <th className="border-b border-[#c8ccc3] px-1 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#5c6356]">Séries</th>
                <th className="border-b border-[#c8ccc3] px-1 py-2 text-left text-[11px] font-bold uppercase tracking-[0.1em] text-[#5c6356]">Carga usada</th>
              </tr>
            </thead>
            <tbody>
              {workout.items.map((it, i) => (
                <tr key={it.exercise.id} className="border-b border-[#e6e9e2]">
                  <td className="px-1 py-3 align-top text-[#8b9284]">{i + 1}</td>
                  <td className="px-1 py-3 align-top">
                    <span className="font-bold">{it.exercise.name}</span>
                    <br />
                    <span className="eqp text-[13px] text-[#5c6356]">
                      {it.exercise.equipment.join(' · ') || 'peso corporal'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-1 py-3 align-top font-extrabold tabular-nums">
                    {it.exercise.pattern === 'cardio' ? it.reps : `${it.sets}×${it.reps}`}
                  </td>
                  <td className="whitespace-nowrap px-1 py-3 align-top tracking-[0.1em] text-[#8b9284]">
                    {it.exercise.pattern === 'cardio'
                      ? '—'
                      : Array(it.sets).fill('____').join(' ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Espaço em branco numa ficha de papel tem uso real. */}
          <div className="mt-8">
            <div className="tag text-[13px] uppercase tracking-[0.12em] text-[#5c6356]">Anotações</div>
            <div className="mt-4 flex flex-col gap-7">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="block border-b border-[#d8dcd4]" />
              ))}
            </div>
          </div>
        </div>

        <div className="qf-sheet-footer mt-auto flex flex-none items-end gap-6 border-t border-[#c8ccc3] pt-3 text-[13px] text-[#5c6356]">
          <div className="flex-1">
            <p className="mb-1">
              <b className="text-[#14170f]">Use carga que deixe 2 repetições de reserva</b> na última série.
            </p>
            {gym.trainerName && gym.trainerCref && (
              <p className="mb-1">
                Sugestão de treino homologada por{' '}
                <b className="text-[#14170f]">{gym.trainerName} — {gym.trainerCref}</b>.
              </p>
            )}
            <p>Sentiu dor, tontura ou falta de ar? Interrompa e procure a recepção.</p>
          </div>
          {qr ? (
            <div className="text-center">
              <img src={qr} alt="QR do treino" className="qr h-24 w-24" />
              <div className="tag mt-1 text-[11px] uppercase tracking-[0.1em]">vídeos e cronômetro</div>
            </div>
          ) : (
            <div className="max-w-[22ch] text-right text-[12px]">
              QR indisponível — leve a ficha impressa.
            </div>
          )}
        </div>
      </div>

      <div className="no-print flex w-full max-w-[820px] flex-none gap-4">
        <Cta onClick={() => window.print()}>🖨 &nbsp;Imprimir agora</Cta>
        <Cta variant="ghost" onClick={onBack}>← Voltar ao treino</Cta>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Ligar no `App.tsx` e marcar o shell**

Adicione a classe `qf-shell` ao `<main>` do `Shell`, e o bloco da ficha:

```tsx
function Shell({ children }: { children: React.ReactNode }) {
  return <main className="qf-shell h-full w-full overflow-hidden bg-bg text-text">{children}</main>;
}
```

```tsx
{state.screen === 'ficha' && state.workout && (
  <Ficha
    workout={state.workout}
    gym={gym}
    groupsTitle={groupsLabel(state.groups)}
    workoutId={state.workoutId}
    onBack={() => dispatch({ type: 'BACK' })}
  />
)}
```

E envolva o `Header` e o cabeçalho das telas com `no-print` — a ficha imprime sozinha:

```tsx
<div className="no-print"><Header gymName={gym.name} /></div>
```

- [ ] **Step 8: Verificar a impressão de verdade**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run dev
```

Gere um treino de 9 exercícios (Montar do zero → Emagrecer → 6 grupos → 90 min → Avançado), abra a ficha, e aperte **Ctrl+P**. Na pré-visualização do Chrome, confirme:

1. **1 página** — não 2, não 3
2. **Todos os 9 exercícios** presentes, nenhum cortado
3. **Rodapé com CREF visível** e o aviso de segurança
4. **Nenhum botão** ("Imprimir agora", "Voltar ao treino") impresso
5. **Nenhum bloco cinza** no meio da folha
6. Área de "Anotações" com as linhas

Se algum exercício faltar, o `overflow` vazou — confira que `.qf-sheet-body` está recebendo `overflow: visible !important` no `@media print`.

- [ ] **Step 9: Rodar tudo e commitar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck && npm run build
git add src
git commit -m "feat(print): ficha A4 com rodapé CREF em toda página

A pré-visualização rola; a impressão zera o overflow. Sem isso, exercício
desaparece do papel sem aviso — a tela mostra certo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Fase E — IA e entrega

### Task 17: Enfeite de IA com cache, atrás de um adaptador de provedor

D5: o LLM nunca está no caminho crítico. Ele chega **depois** do treino estar na tela e desiste em silêncio.

**Files:**
- Create: `apps/totem/src/ai/cacheKey.ts`
- Create: `apps/totem/src/ai/embellish.ts`
- Create: `supabase/functions/embellish/provider.ts`
- Create: `supabase/functions/embellish/index.ts`
- Test: `apps/totem/src/ai/cacheKey.test.ts`
- Test: `apps/totem/src/ai/embellish.test.ts`
- Modify: `apps/totem/src/App.tsx`

**Interfaces:**
- Consumes: `Workout` do motor; `supabase` de `../data/supabase`
- Produces:
  - `cacheKey(goal: Goal, groups: MuscleGroup[], exerciseIds: string[]): Promise<string>`
  - `type Embellishment = { title: string; cues: Record<string, string> }`
  - `embellish(workout: Workout, goal: Goal, groups: MuscleGroup[]): Promise<Embellishment | null>` — **nunca lança**
  - Edge Function `embellish`: `POST { goal, groups, exercises: [{id,name}] }` → `{ title, cues }`

- [ ] **Step 1: Escrever os testes da chave de cache (vão falhar)**

`apps/totem/src/ai/cacheKey.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cacheKey } from './cacheKey';

describe('cacheKey', () => {
  it('é estável para a mesma entrada', async () => {
    const a = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino', 'triceps-corda']);
    const b = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino', 'triceps-corda']);
    expect(a).toBe(b);
  });

  it('ignora a ordem dos grupos — "peito+tríceps" é o mesmo treino', async () => {
    const a = await cacheKey('hipertrofia', ['peito', 'triceps'], ['supino']);
    const b = await cacheKey('hipertrofia', ['triceps', 'peito'], ['supino']);
    expect(a).toBe(b);
  });

  it('RESPEITA a ordem dos exercícios — a ordem é parte da prescrição', async () => {
    const a = await cacheKey('hipertrofia', ['peito'], ['supino', 'crucifixo']);
    const b = await cacheKey('hipertrofia', ['peito'], ['crucifixo', 'supino']);
    expect(a).not.toBe(b);
  });

  it('muda quando o objetivo muda', async () => {
    const a = await cacheKey('hipertrofia', ['peito'], ['supino']);
    const b = await cacheKey('forca', ['peito'], ['supino']);
    expect(a).not.toBe(b);
  });

  it('devolve hex de 64 chars (sha-256)', async () => {
    const k = await cacheKey('forca', ['costas'], ['puxada']);
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/ai/cacheKey.test.ts
```

Esperado: FAIL — `Failed to resolve import "./cacheKey"`.

- [ ] **Step 3: Implementar a chave**

`apps/totem/src/ai/cacheKey.ts`:

```ts
import type { Goal, MuscleGroup } from '@quickfit/core/engine';

/**
 * Grupos entram ordenados (peito+tríceps é o mesmo treino que tríceps+peito),
 * mas a ORDEM dos exercícios é preservada — ela é parte da prescrição, e a
 * dica do primeiro exercício não serve para o quinto.
 */
export async function cacheKey(
  goal: Goal,
  groups: MuscleGroup[],
  exerciseIds: string[],
): Promise<string> {
  const payload = JSON.stringify({
    goal,
    groups: [...groups].sort(),
    exercises: exerciseIds,
  });
  const bytes = new TextEncoder().encode(payload);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
```

- [ ] **Step 4: Escrever os testes do enfeite (vão falhar)**

O contrato que importa: **nunca lança e nunca demora**.

`apps/totem/src/ai/embellish.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Workout } from '@quickfit/core/engine';

const rpc = vi.fn();
const from = vi.fn();
const invoke = vi.fn();

vi.mock('../data/supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...a),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const { embellish } = await import('./embellish');

const workout = {
  items: [
    { exercise: { id: 'supino', name: 'Supino reto' }, sets: 4, reps: '8-12' },
    { exercise: { id: 'tri-corda', name: 'Tríceps corda' }, sets: 3, reps: '8-12' },
  ],
} as unknown as Workout;

const semCache = () => ({
  select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
  insert: async () => ({ error: null }),
});

beforeEach(() => {
  rpc.mockReset(); from.mockReset(); invoke.mockReset();
});

describe('embellish', () => {
  it('devolve o cache sem chamar a Edge Function', async () => {
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { title: 'Peito Pesado', cues: { supino: 'Escápulas retraídas' } },
            error: null,
          }),
        }),
      }),
    });
    rpc.mockResolvedValue({ error: null });

    const out = await embellish(workout, 'hipertrofia', ['peito']);
    expect(out?.title).toBe('Peito Pesado');
    expect(invoke).not.toHaveBeenCalled();
  });

  it('chama a Edge Function quando não há cache e grava o resultado', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({
      data: { title: 'Empurrada Forte', cues: { supino: 'Desça controlado' } },
      error: null,
    });

    const out = await embellish(workout, 'hipertrofia', ['peito']);
    expect(out?.title).toBe('Empurrada Forte');
    expect(invoke).toHaveBeenCalledOnce();
  });

  it('devolve null quando a Edge Function falha — nunca lança', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({ data: null, error: new Error('502') });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('devolve null quando a Edge Function lança — nunca propaga', async () => {
    from.mockReturnValue(semCache());
    invoke.mockRejectedValue(new Error('rede caiu'));

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('devolve null quando o banco falha — nunca lança', async () => {
    from.mockImplementation(() => { throw new Error('sem RLS'); });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });

  it('desiste em 2s e devolve null', async () => {
    from.mockReturnValue(semCache());
    invoke.mockImplementation(() => new Promise(() => {}));   // nunca resolve

    const t0 = Date.now();
    const out = await embellish(workout, 'hipertrofia', ['peito'], 120);
    expect(out).toBeNull();
    expect(Date.now() - t0).toBeLessThan(1000);
  });

  it('descarta resposta sem título', async () => {
    from.mockReturnValue(semCache());
    invoke.mockResolvedValue({ data: { cues: {} }, error: null });

    await expect(embellish(workout, 'hipertrofia', ['peito'])).resolves.toBeNull();
  });
});
```

- [ ] **Step 5: Implementar o enfeite**

`apps/totem/src/ai/embellish.ts`:

```ts
import { supabase } from '../data/supabase';
import { cacheKey } from './cacheKey';
import type { Goal, MuscleGroup, Workout } from '@quickfit/core/engine';

export type Embellishment = { title: string; cues: Record<string, string> };

const TIMEOUT_MS = 2000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function valid(x: unknown): x is Embellishment {
  const e = x as Embellishment | null;
  return !!e && typeof e.title === 'string' && e.title.length > 0 && typeof e.cues === 'object';
}

/**
 * Camada deliberadamente descartável (D5). O treino já está na tela quando
 * isto roda; se falhar, der timeout ou não houver internet, o aluno não vê
 * diferença além do nome genérico. NUNCA lança.
 */
export async function embellish(
  workout: Workout,
  goal: Goal,
  groups: MuscleGroup[],
  timeoutMs = TIMEOUT_MS,
): Promise<Embellishment | null> {
  try {
    const ids = workout.items.map((it) => it.exercise.id);
    const key = await cacheKey(goal, groups, ids);

    // 1. Cache. É isto que leva a latência de p50 a zero numa academia real.
    const cached = await withTimeout(
      supabase
        .from('embellishments')
        .select('title, cues')
        .eq('cache_key', key)
        .maybeSingle()
        .then((r) => r.data),
      timeoutMs,
    );

    if (valid(cached)) {
      void supabase.rpc('bump_embellishment_hits', { k: key });
      return cached;
    }

    // 2. Provedor, via Edge Function (a chave nunca vai para o bundle).
    const res = await withTimeout(
      supabase.functions.invoke('embellish', {
        body: {
          goal,
          groups,
          exercises: workout.items.map((it) => ({
            id: it.exercise.id,
            name: it.exercise.name,
          })),
        },
      }),
      timeoutMs,
    );

    if (!res || res.error || !valid(res.data)) return null;
    const out = res.data;

    // 3. Grava para a próxima. Falha de escrita não é problema do aluno.
    void supabase
      .from('embellishments')
      .insert({ cache_key: key, title: out.title, cues: out.cues, model: 'edge' });

    return out;
  } catch {
    return null;
  }
}
```

- [ ] **Step 6: Rodar e ver passar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test -- apps/totem/src/ai
```

Esperado: PASS, 12 testes.

- [ ] **Step 7: Escrever o adaptador de provedor da Edge Function**

`supabase/functions/embellish/provider.ts`:

```ts
/**
 * Interface mínima de provedor. Groq, OpenAI, Together e Cerebras todos
 * expõem /chat/completions compatível com OpenAI — trocar de provedor é
 * trocar 3 variáveis de ambiente, não migrar de framework. É por isso que
 * não há gateway nem orquestrador aqui.
 */
export type Provider = {
  name: string;
  complete(system: string, user: string): Promise<string>;
};

export function openAiCompatible(opts: {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}): Provider {
  return {
    name: opts.name,
    async complete(system, user) {
      const res = await fetch(`${opts.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 900,
          temperature: 0.8,   // é enfeite: variação aqui é desejável
        }),
      });

      if (!res.ok) {
        throw new Error(`${opts.name} respondeu ${res.status}: ${await res.text()}`);
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content;
      if (typeof text !== 'string') throw new Error(`${opts.name}: resposta sem conteúdo`);
      return text;
    },
  };
}

/** Troque estas três env vars para migrar de provedor. */
export function providerFromEnv(): Provider {
  const apiKey = Deno.env.get('LLM_API_KEY');
  if (!apiKey) throw new Error('LLM_API_KEY ausente');

  return openAiCompatible({
    name: Deno.env.get('LLM_NAME') ?? 'groq',
    baseUrl: Deno.env.get('LLM_BASE_URL') ?? 'https://api.groq.com/openai/v1',
    apiKey,
    model: Deno.env.get('LLM_MODEL') ?? 'llama-3.3-70b-versatile',
  });
}
```

- [ ] **Step 8: Escrever o handler**

`supabase/functions/embellish/index.ts`:

```ts
import { providerFromEnv } from './provider.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

const SYSTEM = `Você escreve o nome de um treino de academia e uma dica curta de
execução para cada exercício, em português do Brasil.

Devolva EXCLUSIVAMENTE um objeto JSON com esta forma:
{"title": "...", "cues": {"<id do exercício>": "..."}}

Regras:
- "title": no máximo 40 caracteres, sem emoji, sem ponto final. Deve soar como
  algo que um professor escreveria no topo da ficha. Exemplos de tom:
  "Peito e Tríceps — Volume", "Perna Completa", "Costas Pesadas".
- "cues": uma dica por exercício, no imperativo, máximo 60 caracteres, sem
  ponto final. Fale de execução ou postura, nunca de carga.
- Use exatamente os ids recebidos como chaves de "cues".
- Não invente exercício, não sugira substituição, não comente o treino.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  try {
    const { goal, groups, exercises } = await req.json();

    if (!Array.isArray(exercises) || exercises.length === 0) {
      return json({ error: 'invalid_body' }, 400);
    }

    const provider = providerFromEnv();

    const user =
      `Objetivo: ${goal}\nGrupos: ${(groups ?? []).join(', ')}\n\nExercícios:\n` +
      exercises.map((e: { id: string; name: string }) => `- ${e.id}: ${e.name}`).join('\n');

    const raw = await provider.complete(SYSTEM, user);
    const parsed = JSON.parse(raw);

    // Sanitiza: descarta chave que não corresponde a exercício enviado e
    // trunca no limite. O modelo não decide o formato da ficha.
    const validIds = new Set(exercises.map((e: { id: string }) => e.id));
    const cues: Record<string, string> = {};
    for (const [id, cue] of Object.entries(parsed?.cues ?? {})) {
      if (validIds.has(id) && typeof cue === 'string') {
        cues[id] = cue.slice(0, 60).replace(/\.$/, '');
      }
    }

    const title = String(parsed?.title ?? '').slice(0, 40).replace(/\.$/, '');
    if (!title) return json({ error: 'no_title' }, 502);

    return json({ title, cues });
  } catch (e) {
    // O cliente trata qualquer não-200 como "sem enfeite" e segue.
    console.error('embellish falhou:', e);
    return json({ error: 'provider_failed' }, 502);
  }
});
```

- [ ] **Step 9: Configurar os segredos e publicar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
supabase secrets set LLM_API_KEY="<sua GROQ_API_KEY>"
supabase secrets set LLM_BASE_URL="https://api.groq.com/openai/v1"
supabase secrets set LLM_MODEL="llama-3.3-70b-versatile"
supabase secrets set LLM_NAME="groq"
supabase functions deploy embellish
```

- [ ] **Step 10: Testar a função publicada**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
set -a; . ./.env.local; set +a
time curl -s -X POST "$VITE_SUPABASE_URL/functions/v1/embellish" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"goal":"hipertrofia","groups":["peito","triceps"],
       "exercises":[{"id":"supino-reto","name":"Supino reto com barra"},
                    {"id":"tri-corda","name":"Tríceps corda"}]}'
echo
```

Esperado: JSON com `title` e `cues` para os dois ids, em menos de 2 segundos. Se o `title` vier em inglês ou com emoji, ajuste o `SYSTEM` e republique.

- [ ] **Step 11: Ligar no `App.tsx`**

Adicione o estado e o efeito, e passe o título ao `Result`:

```tsx
import { embellish, type Embellishment } from './ai/embellish';

// dentro do App, junto dos outros useState:
const [flair, setFlair] = useState<Embellishment | null>(null);

// depois do efeito de geração:
useEffect(() => {
  if (state.screen !== 'result' || !state.workout) return;
  setFlair(null);
  // Não há await no caminho da UI: o treino já está renderizado.
  embellish(state.workout, state.goal, state.groups).then(setFlair);
}, [state.screen, state.workout, state.goal, state.groups]);
```

No bloco do `Result`, troque `embellishTitle={null}` por `embellishTitle={flair?.title ?? null}`.

E no `Result.tsx`, use a dica da IA quando existir, caindo para o `cue` do catálogo:

```tsx
// na assinatura de Props, acrescente:
cues?: Record<string, string>;

// na linha do exercício, troque a segunda linha por:
<span className="block truncate text-[17px] text-dim">
  {cues?.[it.exercise.id] ?? it.exercise.cue ?? it.exercise.equipment.join(' · ')}
</span>
```

Passe `cues={flair?.cues}` no `App.tsx`.

- [ ] **Step 12: Verificar a degradação com a rede desligada**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run dev
```

Gere um treino com internet: o título deve mudar de "Treino A — Peito + Tríceps" para o nome escrito pela IA em ~1-2s. Gere o **mesmo** treino de novo: deve vir instantâneo (cache).

Agora **desligue a rede** (DevTools → Network → Offline) e gere outro. O treino tem que aparecer normalmente com o título genérico, sem erro visível e sem spinner preso.

- [ ] **Step 13: Rodar tudo e commitar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm test && npm run typecheck && npm run build
git add apps/totem/src/ai supabase/functions src
git commit -m "feat(ai): enfeite opcional com cache, atrás de adaptador de provedor

Cache por hash de (objetivo, grupos, exercícios) derruba ~90% das chamadas
e leva a latência de p50 a zero. Provedor é um fetch OpenAI-compatível — sem
gateway nem orquestrador para um único prompt. Falha em silêncio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 18: Persistir o treino, smoke test e deploy

**Files:**
- Create: `apps/totem/src/data/saveWorkout.ts`
- Create: `apps/totem/src/screens/SharedWorkout.tsx`
- Create: `e2e/demo.spec.ts`
- Create: `playwright.config.ts`
- Create: `vercel.json`
- Create: `README.md`
- Modify: `apps/totem/src/App.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: `supabase`; `Workout`, `Input`; `nanoid`
- Produces:
  - `saveWorkout(gymId: string, input: Input, workout: Workout, parqBlocked?: boolean): Promise<string | null>`
  - rota `/w/:id` renderizando `<SharedWorkout />`
  - `npm run e2e`

- [ ] **Step 1: Implementar a persistência**

`apps/totem/src/data/saveWorkout.ts`:

```ts
import { customAlphabet } from 'nanoid';
import { supabase } from './supabase';
import type { Input, Workout } from '@quickfit/core/engine';

// 10 chars sem ambíguos (0/O, 1/l/I): URL curta gera QR de baixa densidade,
// que lê rápido em câmera ruim sob luz forte.
const nanoid = customAlphabet('23456789abcdefghijkmnpqrstuvwxyz', 10);

/**
 * Nunca lança. Se falhar, o treino aparece e imprime — só o QR fica
 * indisponível, com aviso na ficha (spec §8).
 */
export async function saveWorkout(
  gymId: string,
  input: Input,
  workout: Workout,
  parqBlocked = false,
): Promise<string | null> {
  try {
    const id = nanoid();
    const { error } = await supabase.from('generated_workouts').insert({
      id,
      gym_id: gymId,
      input,
      exercises: workout.items.map((it) => ({
        id: it.exercise.id,
        name: it.exercise.name,
        equipment: it.exercise.equipment,
        sets: it.sets,
        reps: it.reps,
        cue: it.exercise.cue ?? null,
        video_url: it.exercise.videoUrl ?? null,
      })),
      parq_blocked: parqBlocked,
    });
    if (error) throw error;
    return id;
  } catch (e) {
    console.warn('Não foi possível salvar o treino — QR indisponível.', e);
    return null;
  }
}
```

- [ ] **Step 2: Página mínima do QR**

`apps/totem/src/screens/SharedWorkout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { supabase } from '../data/supabase';

type Row = {
  id: string;
  exercises: Array<{ name: string; sets: number; reps: string; cue: string | null; equipment: string[] }>;
};

/**
 * Versão mínima da página do QR. Vídeo, cronômetro e marcar série entram no
 * piloto (spec §10, item 2) — aqui basta o aluno abrir e ver o treino.
 */
export function SharedWorkout({ id }: { id: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase
      .rpc('get_workout', { workout_id: id })
      .then(({ data, error }) => {
        const first = Array.isArray(data) ? data[0] : data;
        if (error || !first) setFailed(true);
        else setRow(first as Row);
      })
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <h1 className="font-display text-3xl font-extrabold">Treino não encontrado</h1>
        <p className="mt-3 text-dim">
          O link pode ter expirado. Gere um treino novo no totem da academia.
        </p>
      </main>
    );
  }

  if (!row) return <main className="p-8 text-dim">Carregando…</main>;

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Seu treino</h1>
      <ol className="mt-6 flex flex-col gap-3">
        {row.exercises.map((e, i) => (
          <li key={i} className="rounded-lg border-l-4 border-accent bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold">{e.name}</span>
              <span className="font-display font-extrabold tabular-nums">
                {e.sets}×{e.reps}
              </span>
            </div>
            <p className="mt-1 text-sm text-dim">
              {e.cue ?? e.equipment.join(' · ') ?? 'peso corporal'}
            </p>
          </li>
        ))}
      </ol>
      <p className="mt-8 text-sm text-dim">
        Use carga que deixe 2 repetições de reserva na última série. Sentiu dor,
        tontura ou falta de ar? Interrompa e procure a recepção.
      </p>
    </main>
  );
}
```

- [ ] **Step 3: Rotear `/w/:id` sem instalar router**

No `App.tsx`, antes de qualquer outra coisa no componente:

```tsx
import { SharedWorkout } from './screens/SharedWorkout';

// no topo do App():
const shared = window.location.pathname.match(/^\/w\/([0-9a-z]{6,20})$/);
if (shared) return <SharedWorkout id={shared[1]} />;
```

Uma regex resolve. Um router para uma rota seria a mesma decisão errada que um orquestrador para um prompt.

- [ ] **Step 4: Salvar o treino ao gerá-lo**

No efeito de geração do `App.tsx`, depois do `dispatch({ type: 'GENERATED', workout })`:

```tsx
saveWorkout(bundle.gym.id, toInput(state, bundle.availableEquipment), workout)
  .then((id) => { if (id) dispatch({ type: 'WORKOUT_SAVED', id }); });
```

E registre o bloqueio do PAR-Q para o gestor ver nas estatísticas — adicione um efeito:

```tsx
useEffect(() => {
  if (state.screen !== 'blocked' || !bundle) return;
  const vazio = { items: [], scheme: { sets: 0, reps: '', rest: 0, target: 0 },
    poolSize: 0, budgetSec: 0, usedSec: 0, cap: 0, minItems: 0, extraSets: 0 };
  void saveWorkout(bundle.gym.id, toInput(state, bundle.availableEquipment), vazio as never, true);
}, [state.screen, bundle]);
```

- [ ] **Step 5: Escrever o smoke test**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm install -D @playwright/test
npx playwright install chromium
```

`playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1280, height: 800 },   // proporção de totem
    baseURL: 'http://localhost:4173',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

`e2e/demo.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('caminho felizeu: 3 toques até o treino, e a ficha imprime em 1 página', async ({ page }) => {
  await page.goto('/');

  // 1
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  // 2
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  // 3
  await page.getByRole('button', { name: /peito \+ tríceps/i }).click();

  await expect(page.getByText(/montando seu treino/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });

  // O treino tem exercícios de verdade
  const linhas = page.locator('[class*="border-l-4"]');
  expect(await linhas.count()).toBeGreaterThanOrEqual(3);

  // Ficha: todos os exercícios no papel, rodapé CREF presente, 1 página
  await page.getByRole('button', { name: /imprimir ficha/i }).click();
  await expect(page.getByText(/homologada por/i)).toBeVisible();

  const linhasTela = await page.locator('.qf-sheet tbody tr').count();
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  const paginas = Number(
    pdf.toString('latin1').match(/\/Type\s*\/Pages[\s\S]{0,200}?\/Count\s+(\d+)/)?.[1] ?? -1,
  );

  expect(linhasTela).toBeGreaterThanOrEqual(3);
  expect(paginas).toBe(1);
});

test('"Treino rápido" pede o tempo: 4 toques, escada curta, sem pergunta de nível', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  await page.getByRole('button', { name: /treino rápido/i }).click();

  // Escada curta: 20/30/40/50, e nada de 60 ou 90 — ninguém chama isso de rápido
  await expect(page.getByRole('button', { name: '40 min' })).toBeVisible();
  await expect(page.getByRole('button', { name: '60 min' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '90 min' })).toHaveCount(0);

  await page.getByRole('button', { name: '40 min' }).click();

  // Vai direto para o treino: no atalho não há passo de nível
  await expect(page.getByRole('button', { name: /^Iniciante/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });
});

test('PAR-Q reprovado encaminha ao professor e NÃO gera treino', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /dor no peito/i }).click();

  await expect(page.getByText(/fale com o professor da unidade/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toHaveCount(0);
});

test('montar do zero com 90 min não passa de 9 exercícios', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Toque para começar' }).click();
  await page.getByRole('button', { name: /nenhuma das anteriores/i }).click();
  await page.getByRole('button', { name: /montar do zero/i }).click();
  await page.getByRole('button', { name: /emagrecer/i }).click();

  for (const g of ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas']) {
    await page.getByRole('button', { name: new RegExp(`^${g}`) }).click();
  }
  await page.getByRole('button', { name: /continuar com 6 grupos/i }).click();
  await page.getByRole('button', { name: '90 min' }).click();
  await page.getByRole('button', { name: /^Avançado/ }).click();

  await expect(page.getByRole('button', { name: /imprimir ficha/i })).toBeVisible({ timeout: 10_000 });
  const linhas = await page.locator('[class*="border-l-4"]').count();
  expect(linhas).toBeLessThanOrEqual(9);   // era 19 antes do teto
});
```

Registre o script no `package.json`:

```json
"e2e": "playwright test",
"preview": "vite preview --port 4173"
```

- [ ] **Step 6: Rodar o smoke test**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run e2e
```

Esperado: 3 testes passando. **Atenção ao harness:** se você adicionar `page.emulateMedia({ media: 'screen' })` em algum teste, isso **sobrepõe** o print media do `page.pdf()` e o PDF sai com a folha de tela — foi o que produziu um diagnóstico falso de "3 páginas" no protótipo. Não chame `emulateMedia` nestes testes.

- [ ] **Step 7: Configurar o deploy**

`vercel.json`:

```json
{
  "rewrites": [{ "source": "/w/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/fonts/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

O `rewrites` é obrigatório: sem ele `/w/abc123` dá 404 na Vercel, porque não existe arquivo nesse caminho.

- [ ] **Step 8: Publicar**

Use a conta pessoal (RobsonSolano/hotmail), não a da empresa.

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npx vercel login          # se ainda não estiver logado na conta pessoal
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_ANON_KEY production
npx vercel --prod
```

- [ ] **Step 9: Verificar a demo publicada**

Abra a URL da Vercel e percorra os 3 toques. Depois:

1. Gere um treino, abra a ficha, escaneie o QR com o celular — deve abrir `/w/<id>` com o treino
2. Recarregue com o celular no modo avião depois de já ter carregado uma vez — o totem deve funcionar do cache

- [ ] **Step 10: Escrever o README com o modo kiosk**

`README.md`:

```markdown
# NutriOn QuickFit

Totem de autoatendimento que gera treino personalizado em 3 toques.
Spec: `../docs/superpowers/specs/2026-07-28-quickfit-design.md`

## Desenvolvimento

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev
```

## Comandos

| Comando | O que faz |
|---|---|
| `npm test` | motor, catálogo, tema, máquina de estados, IA |
| `npm run e2e` | smoke do fluxo + impressão em 1 página |
| `npm run validate:catalog` | valida os CSVs (roda no CI) |
| `npm run seed:catalog` | CSV → Supabase |
| `npm run classify` | classificação assistida por Claude (offline, uma vez) |
| `npm run export:raw` | exporta exercícios do Persona Fit |

## Virar totem

Não há build separado. A mesma URL, aberta assim:

```bash
chrome --kiosk --incognito --disable-pinch \
  --overscroll-history-navigation=0 \
  https://<url-da-vercel>
```

`--incognito` garante que o `localStorage` não acumule entre reinícios de forma
inesperada; o cache do catálogo é reconstruído no primeiro boot com internet.

## O que NÃO está aqui (spec §10)

Agente de impressão térmica, página do QR completa (vídeo, cronômetro),
painel do gestor e estatísticas. Nesta fase a academia é configurada
direto no Supabase Studio.
```

- [ ] **Step 11: Rodar tudo uma última vez e commitar**

```bash
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
cd /home/robson/www/_estudos/pessoal/nutrion/quickfit
npm run validate:catalog && npm test && npm run typecheck && npm run build && npm run e2e
git add -A
git commit -m "feat: persistência do treino, página do QR, smoke test e deploy

Fecha a fase 1. O treino é salvo com nanoid curto, o QR abre /w/:id, e o
smoke afirma os 3 toques e a ficha em 1 página A4.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Critério de aceite da fase 1

A demo passa quando, na frente de um gestor:

1. Três toques levam da tela apagada ao treino completo
2. Ele toca em **"Montar do zero"**, escolhe **ombros + mobilidade, 90 minutos, avançado, só máquinas** — e ainda sai um treino cheio e coerente (spec §12)
3. Ele desliga um aparelho no Supabase Studio e os exercícios daquele aparelho desaparecem na geração seguinte
4. A ficha imprime em **1 página A4**, com todos os exercícios e o rodapé CREF
5. Você desliga o wifi e o totem continua gerando treino

O item 2 é o que decide a venda. Se falhar, o gargalo é profundidade de catálogo — volte à onda 2 da task 9.

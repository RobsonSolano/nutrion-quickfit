# NutriOn QuickFit — Design

**Data:** 2026-07-28
**Status:** aprovado nas seções 1–3, seção 4 escrita direto aqui a pedido do dev
**Escopo desta spec:** demo comercial sem hardware (fase 1 de 5)

---

## 1. Contexto

O QuickFit é um sistema de autoatendimento que gera treino personalizado na hora,
num totem touchscreen de academia, sem app, sem login e sem esperar professor.

Produto **separado** do Persona Fit: repositório próprio, projeto Supabase próprio,
deploy próprio. Marca guarda-chuva NutriOn. Zero acoplamento — se o QuickFit for
licenciado ou vendido separado no futuro, ele sai inteiro.

### Referências de mercado

| Fonte | O que ensinou |
|---|---|
| [Tecnofit — totem para academia](https://www.tecnofit.com.br/blog/totem-para-academia/) | O totem incumbente faz check-in biométrico/facial, vendas self-service, agendamento de aula e **consulta** de treino existente. Não gera treino. E só funciona acoplado ao software de gestão deles. |
| [NextFit — ficha de treino](https://blog.nextfit.com.br/ficha-de-treino-de-academia/) | Ficha real tem campos de carga em branco, dura 4–6 semanas, divisão ABC/ABCDE, e a prescrição é ato de profissional de educação física. Impressão térmica em formato cupom já é prática consolidada. |

**Posicionamento que sai disso:** a lacuna é geração, não consulta. E o QuickFit não
precisa integrar com o ERP de ninguém — o que derruba a maior barreira de venda do
incumbente.

---

## 2. Decisões travadas

| # | Decisão | Alternativas descartadas | Por quê |
|---|---|---|---|
| D1 | **Web app em modo kiosk**, não executável | Electron/Tauri (`.exe`), app Android/Expo | Deploy = `git push`; corrige bug em 30 academias sem visita técnica; roda em qualquer hardware touch. O `.exe` só adicionaria manutenção de instalador e auto-update. |
| D2 | **Projeto Supabase novo** (`jpgnplzkdbfmjkinfvln`) | Schema no Supabase do Persona Fit; MongoDB; catálogo só em JSON | Desacopla os dois produtos (migration do QuickFit não pode quebrar o app em produção). Postgres porque a consulta central é relacional: *"exercícios cujos equipamentos estejam **todos** presentes na academia X"* é join + `NOT EXISTS`. RLS dá multi-tenant de graça no piloto. |
| D3 | **Catálogo autorado em arquivo, servido pelo banco** | Só banco (migrations SQL); só arquivo | Enriquecer 269 exercícios é trabalho de planilha: CSV dá diff revisável em bloco no git. O banco é fonte de runtime desde o dia 1, então não há migração-retrabalho. O painel do gestor, quando existir, escreve no mesmo banco. |
| D4 | **Atalhos na home + fluxo completo atrás de "Montar do zero"** | Os 7 passos como caminho único; fluxo enxuto de 3 telas densas | 7 passos custa 6–8 toques e 5 pontos de desistência, contradizendo a promessa de "menos de um minuto". Atalhos resolvem 80% em 2 toques; os 7 passos continuam existindo para quem quer controle. |
| D5 | **Regras montam, LLM enfeita, com degradação silenciosa** | Só regras; LLM monta tudo (como `coach-generate-plan` do app) | Motor determinístico: <100ms, R$0, offline, nunca sai do catálogo, testável. LLM só dá nome ao treino e uma dica por exercício — se falhar, o treino já está na tela. Pitch "motor próprio + IA" é literalmente verdade. |
| D6 | **PAR-Q de 1 tela + homologação por professor CREF** | Só termo no rodapé; PAR-Q completo de 7 perguntas; nada na demo | Prescrição é ato privativo de profissional de educação física (CONFEF). Custa 1 toque (botão "nenhuma das anteriores") e responde a objeção que mais provavelmente mata a venda. PAR-Q completo mata a promessa de tempo e o aluno clica "não" em tudo sem ler, anulando a proteção. |
| D7 | **269 exercícios reclassificados, revisão em duas ondas** | ~110 exercícios de cobertura; ~50 só dos atalhos | Escolha do dev: não refazer no piloto. Mitigação obrigatória: onda 1 = os ~110 que a demo exercita (libera desenvolvimento), onda 2 = a cauda. Senão o CSV vira gargalo antes de haver o que mostrar. |
| D8 | **White-label estreito: 1 cor + logo + modo**, com validação de contraste | Tema livre para a academia | Se a academia escolher uma cor ilegível sob luz de galpão, o problema é seu, numa unidade que você nunca vai visitar. Fundo, superfícies, bordas e hierarquia de texto são fixos e testados. |

---

## 3. Arquitetura

### Localização

```
nutrion/
  app/        Persona Fit (Expo)   — não tocamos
  hotsite/    landing (Vercel)     — não tocamos
  quickfit/   ← novo, git próprio
```

### Stack

| Camada | Escolha | Nota |
|---|---|---|
| UI | React 19 + Vite + TypeScript | |
| Estilo | Tailwind + CSS custom properties | properties são o mecanismo de white-label |
| Navegação | máquina de estados própria + 1 rota (`/w/:id`) | kiosk não tem back button; router de site seria peso morto |
| Motor | TypeScript puro, zero dependências | |
| Dados | Supabase (Postgres + RLS) | acesso via role `anon` — não há login no totem |
| LLM | Groq **via Supabase Edge Function** | chamada direta do browser exporia a API key no bundle |
| Testes | vitest (motor, unit) + Playwright (fluxo, smoke) | |
| Deploy | Vercel, `git push` na main | conta pessoal (ver memória `reference_git_deploy_accounts`) |
| Kiosk | `chrome --kiosk --incognito <url>` | zero código adicional |

### Módulos

O desenho tem **um módulo fundo** (`engine/`) e o resto raso.

```
src/
  engine/            ← FUNDO. sem I/O, sem React, sem Supabase.
    types.ts
    filter.ts          eligible(catalog, input) → Exercise[]
    budget.ts          costOf(exercise, goal) → segundos
    generate.ts        generateWorkout(input, catalog) → Workout
    rng.ts             mulberry32 — aleatório determinístico por seed
    *.test.ts

  catalog/           ← autoria dos dados
    exercises.csv      editado à mão / assistido por LLM
    equipment.csv
    schema.ts          zod; valida no CI, quebra o build se inválido

  data/              ← única camada que conhece Supabase
    loadCatalog.ts     fetch + cache em localStorage
    saveWorkout.ts     persiste, devolve id curto (pro QR)

  state/machine.ts   ← triagem → escolha → geração → resultado
  screens/           ← UI, burra de propósito
  print/             ← template A4 + @media print
  ai/embellish.ts    ← opcional. falha em silêncio.
  theme/apply.ts     ← white-label
```

**A fronteira que importa:** `engine/` recebe um `Exercise[]` e devolve um `Workout`.
Não sabe que Supabase existe. Consequências:

- testar *"treino de 45min para peito+tríceps em academia sem Cross Over"* é teste
  unitário puro — sem rede, sem banco, milissegundos
- trocar a fonte de dados não toca no motor
- no piloto, o mesmo motor pode rodar no servidor sem reescrita

`ai/` é deliberadamente descartável. Se falhar, der timeout ou não houver internet,
a tela mostra o treino que o motor já produziu.

### Fluxo de dados

```
totem liga
  └→ data/loadCatalog  ──→ Supabase        (1× por dia)
                        └→ localStorage    (fallback offline)

aluno toca
  └→ state/machine: PAR-Q → objetivo/grupo/tempo/nível
       └→ engine/generateWorkout(input, catalog)     ~7ms, SEMPRE
            └→ screens/Result  ← pinta AQUI
                 ├→ ai/embellish()      ~1.5s, opcional, falha em silêncio
                 ├→ data/saveWorkout()  → id curto, pro QR
                 └→ print/A4 via window.print()
```

O resultado aparece **antes** do LLM e **antes** de salvar. O aluno nunca espera rede.

---

## 4. O motor

### Tipos

```ts
export type MuscleGroup = 'peito' | 'costas' | 'ombros' | 'biceps'
  | 'triceps' | 'pernas' | 'gluteos' | 'core' | 'cardio';

export type Pattern = 'push-horizontal' | 'push-vertical' | 'pull-horizontal'
  | 'pull-vertical' | 'squat' | 'hinge' | 'lunge' | 'isolation' | 'core' | 'cardio';

export type Exercise = {
  id: string;
  name: string;
  primary: MuscleGroup;
  secondary: MuscleGroup[];
  equipment: string[];           // ids normalizados. [] = peso corporal
  level: 1 | 2 | 3;
  pattern: Pattern;
  isCompound: boolean;
  avgSecPerSet: number;          // 15 (isolado leve) → 45 (agachamento pesado)
  contraindications: string[];   // 'joelho' | 'lombar' | 'ombro' | 'punho' | 'cervical'
  cue?: string;                  // dica curta de execução
  videoUrl?: string;             // usado só na página do QR
};

export type Input = {
  goal: 'hipertrofia' | 'emagrecimento' | 'resistencia' | 'mobilidade' | 'forca';
  groups: MuscleGroup[];
  minutes: 20 | 30 | 45 | 60 | 90;
  level: 1 | 2 | 3;
  availableEquipment: string[];  // vem de gym_equipment
  avoid: string[];               // tags de contraindicação a evitar. SEMPRE `[]` no
                                 // caminho de atalho — só o passo 6 do "Montar do
                                 // zero" popula este campo.
  seed: number;                  // é isso que faz o treino variar
};
```

### Passo 1 — filtrar

```ts
export function eligible(catalog: Exercise[], input: Input): Exercise[] {
  const gymHas = new Set(input.availableEquipment);

  return catalog.filter(ex => {
    // `every`, não `some`: crucifixo na máquina exige a máquina de crucifixo.
    // Se a academia não tem (ou o gestor desligou por manutenção), o exercício
    // desaparece. Com `some` você prescreveria em aparelho inexistente.
    if (!ex.equipment.every(eq => gymHas.has(eq))) return false;

    if (ex.level > input.level) return false;
    if (ex.contraindications.some(c => input.avoid.includes(c))) return false;

    return input.groups.includes(ex.primary)
        || ex.secondary.some(g => input.groups.includes(g));
  });
}
```

### Passo 2 — esquema e orçamento de tempo

```ts
const REST: Record<Input['goal'], number> = {
  forca: 150, hipertrofia: 75, resistencia: 40, emagrecimento: 35, mobilidade: 30,
};

const SETS_REPS: Record<Input['goal'], { sets: number; reps: string }> = {
  forca:         { sets: 4, reps: '4-6'    },
  hipertrofia:   { sets: 4, reps: '8-12'   },
  resistencia:   { sets: 3, reps: '15-20'  },
  emagrecimento: { sets: 3, reps: '12-15'  },
  mobilidade:    { sets: 2, reps: '30-45s' },
};

// Quantos exercícios um professor põe numa sessão desse tempo, e o teto por
// objetivo. Ficha real de academia tem 4 a 9 exercícios — nunca 19.
const TARGET_EX  = { 20: 4, 30: 5, 45: 6, 60: 8, 90: 9 } as const;
const MAX_EX     = { forca: 6, hipertrofia: 8, resistencia: 9, emagrecimento: 9, mobilidade: 10 };
const MAX_PER_GROUP = 4;     // não vira treino de perna com 8 aparelhos de perna

const WARMUP_SEC = 300;      // 5 min de aquecimento, sai na ficha
const TRANSITION_SEC = 60;   // caminhar até o aparelho, ajustar, esperar liberar
const AVG_SEC = 30;          // série média, só para dimensionar o esquema

export type Scheme = { sets: number; reps: string; rest: number; target: number };

// O esquema se adapta ao TEMPO, não só ao objetivo. Sessão curta legitimamente
// usa menos série e descanso menor — é o que um professor faz com quem tem
// 20 minutos.
export function schemeFor(input: Input): Scheme {
  const target = Math.min(TARGET_EX[input.minutes], MAX_EX[input.goal]);
  const budget = input.minutes * 60 - WARMUP_SEC;
  const { sets: baseSets, reps } = SETS_REPS[input.goal];
  const baseRest = REST[input.goal];

  for (const rest of [baseRest, Math.min(baseRest, 60), 45, 35]) {
    for (let sets = baseSets; sets >= 2; sets--) {
      if (target * (sets * (AVG_SEC + rest) + TRANSITION_SEC) <= budget) {
        return { sets, reps, rest, target };
      }
    }
  }
  return { sets: 2, reps, rest: 35, target };
}

export function costOf(ex: Exercise, sc: Scheme): number {
  return ex.pattern === 'cardio'
    ? ex.durationSec! + TRANSITION_SEC
    : sc.sets * (ex.avgSecPerSet + sc.rest) + TRANSITION_SEC;
}
```

**Por que o esquema é derivado e não fixo.** A primeira versão fixava séries e
descanso por objetivo, e 20 min de hipertrofia (4 séries × 75s de descanso) cabia
**um exercício só**. Mirar no alvo de exercícios e derivar as séries resolve: 20 min
de hipertrofia vira 4 exercícios de 2×8-12 com 45s, que é um treino expresso legítimo.

**Conferência com a realidade** (medida no protótipo, catálogo de 53 exercícios):

| Pedido | Saída |
|---|---|
| peito+tríceps, 20 min, hipertrofia | 4 exercícios, 2×8-12, 45s, 14 de 15 min |
| peito+tríceps, 45 min, hipertrofia | 6 exercícios, 3×8-12, 75s, 39 de 40 min |
| costas, 90 min, força | 5 exercícios, 5×4-6, 150s, 80 de 85 min |
| 6 grupos, 90 min, emagrecimento | 9 exercícios, 4×12-15, 35s, 49 de 85 min |

O último caso usa 49 dos 85 minutos disponíveis. **Isso é proposital:** encher 85
minutos exigiria volume que ninguém aguenta. A ficha informa a duração real.

### Passo 3 — selecionar

```ts
export function generateWorkout(input: Input, catalog: Exercise[]): Workout {
  const pool = eligible(catalog, input);
  const rng = mulberry32(input.seed);
  const sc = schemeFor(input);
  const cap = Math.min(MAX_EX[input.goal], sc.target);
  const budget = input.minutes * 60 - WARMUP_SEC;
  let remaining = budget;

  const picked: Exercise[] = [];
  const usedPatterns = new Map<Pattern, number>();
  const groupCount = new Map<MuscleGroup, number>();

  while (remaining > 0 && picked.length < cap) {
    const candidates = pool
      .filter(ex => !picked.some(p => p.id === ex.id))
      .filter(ex => (groupCount.get(ex.primary) ?? 0) < MAX_PER_GROUP)
      .filter(ex => costOf(ex, sc) <= remaining);

    if (candidates.length === 0) break;

    const chosen = weightedPick(candidates.map(ex => ({ ex, score: scoreOf(ex) })), rng);

    picked.push(chosen);
    remaining -= costOf(chosen, sc);
    usedPatterns.set(chosen.pattern, (usedPatterns.get(chosen.pattern) ?? 0) + 1);
    groupCount.set(chosen.primary, (groupCount.get(chosen.primary) ?? 0) + 1);
  }

  const items = picked.map(ex => ({
    ex,
    sets: ex.pattern === 'cardio' ? 1 : sc.sets,
    reps: ex.pattern === 'cardio' ? `${ex.durationSec! / 60} min` : sc.reps,
  }));

  // Sobrou tempo depois do teto? Aumenta VOLUME nos compostos em vez de somar
  // aparelho — round-robin, e com teto de +1 série. Sem esse teto, 90 min de
  // emagrecimento saía com 9 exercícios × 6 séries = 54 séries.
  const setCap = sc.sets + 1;
  let i = 0, guard = 0;
  while (remaining > 0 && guard++ < 200) {
    const eligibleItems = items.filter(it => it.ex.pattern !== 'cardio' && it.sets < setCap);
    const compounds = eligibleItems.filter(it => it.ex.isCompound);
    const jar = compounds.length ? compounds : eligibleItems;   // mobilidade não tem composto
    if (!jar.length) break;
    const t = jar[i++ % jar.length];
    const c = t.ex.avgSecPerSet + sc.rest;
    if (c > remaining) break;
    t.sets++; remaining -= c;
  }

  // Sessão só de cardio é treino válido com 1 item: "30 min de esteira" não é
  // treino incompleto. Musculação exige 3 para valer a pena.
  const cardioOnly = pool.length > 0 && pool.every(ex => ex.pattern === 'cardio');

  return assemble(items, input, sc, {
    poolSize: pool.length, budget, used: budget - remaining,
    cap, minItems: cardioOnly ? 1 : 3,
  });

  function scoreOf(ex: Exercise): number {
    let s = 1;

    // compostos no primeiro TERÇO (aluno descansado = mais seguro e mais eficaz),
    // isolados preenchendo o final. Com o gate antigo de `picked.length < 2`,
    // agachamento livre aparecia como 14º exercício de uma sessão longa.
    const early = picked.length < Math.max(2, Math.ceil(cap / 3));
    s *= early ? (ex.isCompound ? 4 : 0.3) : (ex.isCompound ? 0.5 : 1.4);

    // cobertura: nenhum grupo dobra antes de todos serem atendidos
    const untouched = input.groups.filter(g => !groupCount.has(g));
    if (untouched.length > 0) s *= untouched.includes(ex.primary) ? 5 : 0.2;

    // não empilha o mesmo padrão de movimento
    s *= 1 / (1 + (usedPatterns.get(ex.pattern) ?? 0));

    // não manda o aluno pro mesmo aparelho duas vezes seguidas (fila)
    const last = picked.at(-1);
    if (last && ex.equipment.some(eq => last.equipment.includes(eq))) s *= 0.4;

    return s;
  }
}
```

Os quatro pesos são regras que um professor aplica sem pensar. **Codificá-las é o
produto** — não é o LLM que faz isso.

O `weightedPick` com `seed` responde ao *"a cada geração o treino muda"*: mesmo input,
seed diferente, treino diferente. E como o seed é explícito, o teste é reprodutível.

Quando `items.length < minItems`, a tela explica a **causa certa**: `poolSize < 6`
significa falta de aparelho na unidade; acima disso, a combinação de tempo e grupo é
que não fecha. Mensagem errada aqui faz o gestor achar que a academia dele é pobre.

### Passo 4 — a carga

**Limitação honesta: sem histórico do aluno, o motor não prescreve carga.** Chutar quilo
para desconhecido é irresponsável. A ficha faz como ficha de papel real:

```
Supino reto — barra livre          4 × 8-12
carga: ______  ______  ______  ______
↳ use carga que te deixe 2 reps de reserva na última série
```

Campo em branco + orientação de RIR. Isso é vantagem de venda, não buraco: a ficha
impressa vira o registro do aluno.

---

## 5. Dados

### Schema

```sql
-- catálogo global (compartilhado por todas as academias)
create table equipment (
  id       text primary key,        -- 'leg-press-45'
  name     text not null,           -- 'Leg Press 45°'
  category text not null            -- maquina | livre | cabo | cardio | acessorio | corporal
);

create table exercises (
  id              text primary key,
  name            text not null,
  primary_group   text not null,
  level           smallint not null check (level between 1 and 3),
  pattern         text not null,
  is_compound     boolean not null default false,
  avg_sec_per_set smallint not null,
  cue             text,
  video_url       text
);

create table exercise_secondary_groups (
  exercise_id text references exercises(id) on delete cascade,
  group_id    text not null,
  primary key (exercise_id, group_id)
);

create table exercise_equipment (
  exercise_id  text references exercises(id) on delete cascade,
  equipment_id text references equipment(id),
  primary key (exercise_id, equipment_id)
);

create table exercise_contraindications (
  exercise_id text references exercises(id) on delete cascade,
  tag         text not null,
  primary key (exercise_id, tag)
);

-- por academia
create table gyms (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  logo_url     text,
  theme        jsonb not null default '{"accent":"#39FF14","mode":"dark"}'::jsonb,
  trainer_name text,
  trainer_cref text,
  created_at   timestamptz not null default now()
);

create table gym_equipment (
  gym_id       uuid references gyms(id) on delete cascade,
  equipment_id text references equipment(id),
  is_available boolean not null default true,   -- gestor desliga "em manutenção"
  primary key (gym_id, equipment_id)
);

-- telemetria + origem do QR
create table generated_workouts (
  id         text primary key,       -- nanoid de 10 chars: QR pequeno e legível
  gym_id     uuid not null references gyms(id),
  input      jsonb not null,
  exercises  jsonb not null,
  parq_blocked boolean not null default false,
  created_at timestamptz not null default now()
);
```

`generated_workouts.id` é nanoid curto de propósito: URL curta gera QR de baixa
densidade, que lê rápido em câmera de celular ruim sob luz forte.

As estatísticas do painel (grupos mais buscados, horários de pico, equipamento mais
usado) saem de **views** sobre `generated_workouts` — nenhuma tabela nova.

### RLS

Não há login no totem, então tudo passa pela role `anon`:

| Tabela | anon pode |
|---|---|
| `equipment`, `exercises`, `exercise_*` | `select` |
| `gyms`, `gym_equipment` | `select` |
| `generated_workouts` | `insert`; `select` **só por id** (nanoid inadivinhável) |

Explicitamente: `anon` **não** pode listar `generated_workouts`. Sem isso, qualquer um
dumpa a telemetria de todas as academias.

#### Como verificar o RLS sem se enganar

Verificado contra o banco real em 29/jul/2026, depois da task 10. Duas armadilhas
custaram tempo e valem ficar escritas:

**1. `DELETE` e `PATCH` bloqueados por RLS devolvem `204`, não `403`.** O PostgREST
executa a instrução; o RLS filtra para zero linhas; a resposta é "sucesso, nada a
fazer". Ler o código HTTP e concluir que a `anon` conseguiu apagar é o erro fácil —
eu cometi. A única checagem que vale é **ler o dado de volta com a service role
depois**.

**2. Um `[]` obtido de tabela vazia não prova nada.** Antes de testar "a `anon`
consegue listar?", insira uma linha com a service role. Sem isso o teste passa
mesmo com o RLS desligado.

O resultado da verificação, para servir de baseline:

| operação com `anon` | HTTP | efeito real |
|---|---|---|
| listar `generated_workouts` | 200 | `[]` — bloqueado |
| `get_workout(id)` existente | 200 | devolve a linha |
| `get_workout(id)` inexistente | 200 | `[]`, sem vazamento |
| inserir treino | 201 | permitido |
| inserir com `Prefer: return=representation` | **401** | esperado — devolver a linha exige `select`, que não existe |
| apagar treino existente | 204 | **linha intacta** |
| alterar treino existente | 204 | **dado intacto** |
| escrever em `equipment` | 401 | bloqueado |

A linha do `return=representation` é a que mais engana no código do app: um
`.insert(...).select()` no supabase-js pede representação e falha com 401, que parece
erro de autenticação e é de RLS. O `saveWorkout` só desestrutura `{ error }` de
propósito — **não adicione `.select()` ali.**

### Enriquecimento do catálogo

O `public.exercises` do Persona Fit hoje tem `name`, `equipment` (texto livre),
`is_compound`, `modality`. Falta praticamente tudo que o motor precisa. O caminho:

1. `scripts/export-from-app.ts` — puxa os 269 do Supabase do Persona Fit → CSV cru
2. `scripts/classify.ts` — passa o CSV pelo LLM em lotes, pedindo os campos faltantes
   (equipamento normalizado, secundários, nível, padrão, `avg_sec_per_set`,
   contraindicações). Roda **uma vez**, offline, sem pressa.
3. **Revisão humana do CSV** — onda 1: os ~110 que a demo exercita. Onda 2: a cauda.
4. `npm run seed:catalog` — valida com zod e faz upsert no Supabase do QuickFit

O passo 3 é onde entra o olho de quem entende de treino. O LLM erra `avg_sec_per_set` e
contraindicação com frequência; errar contraindicação é o erro que machuca alguém.

---

## 6. Identidade visual e white-label

### Tema padrão (herdado da Persona Fit)

```
--qf-bg          #07080B
--qf-surface     #12141A
--qf-border      #1F232B
--qf-text        #F4F5F7
--qf-text-dim    #A1A6B2
--qf-accent      #39FF14    ← a única coisa que a academia troca
--qf-violet      #8B5CF6    ← só gradiente e detalhe
```

Diferença proposital em relação ao app: no totem o **violet sai do papel de cor de
ação**. Quando a academia trocar o accent pelo laranja dela, verde + violeta + laranja
briga. Uma cor de ação só, o resto neutro.

### Mecanismo

```ts
type GymTheme = { accent: string; logoUrl: string; mode: 'dark' | 'light' };

// theme/apply.ts — roda 1× no boot, antes do primeiro paint
export function applyTheme(theme: GymTheme) {
  const base = theme.mode === 'dark' ? DARK_BASE : LIGHT_BASE;
  const r = document.documentElement.style;
  for (const [k, v] of Object.entries(base)) r.setProperty(`--qf-${k}`, v);
  r.setProperty('--qf-accent', theme.accent);
  r.setProperty('--qf-on-accent', bestContrast(theme.accent, ['#07080B', '#FFFFFF']));
  r.setProperty('--qf-accent-glow', rgba(theme.accent, 0.25));
}
```

Tailwind aponta para as properties (`accent: 'var(--qf-accent)'`), então no JSX você
escreve `bg-accent text-onAccent` e nunca pensa em tema de novo.

Validação no momento em que o gestor salva — **no painel, nunca no totem**:

```ts
if (contrastRatio(accent, BASE[mode].bg) < 4.5) {
  throw new ThemeError('Essa cor não tem contraste suficiente para leitura em totem.');
}
```

Se reprovar, o painel oferece a variante mais escura/clara da mesma cor. O gestor sente
que personalizou; você garante que dá para ler.

### Tipografia: o totem não é um site

O aluno lê de pé, a 60–80cm, sob luz de galpão, possivelmente sem óculos, apressado.

| Elemento | Totem | (web normal) |
|---|---|---|
| Título de tela | 56px / 700 | 32px |
| Rótulo de botão grande | 32px / 600 | 16px |
| Nome de exercício na ficha | 28px / 600 | 16px |
| Séries × reps | 40px / 700 | 18px |
| Texto de apoio | 20px / 400 | 14px |
| **Altura mínima de alvo de toque** | **96px** | 40px |

96px, não os 44px de mobile: dedo grosso, mão suada, pessoa em pé.

**Sora** nos títulos, **Inter** no corpo, as duas **auto-hospedadas em woff2 no bundle**.
Nunca Google Fonts por CDN — o totem numa academia com internet ruim renderizaria em
Times New Roman na frente do gestor.

---

## 7. Impressão

### Demo (agora)

`window.print()` + folha `@media print` sobre um template A4. Nada mais. O template
esconde o chrome da UI e imprime: logo da academia, dados do treino, tabela de
exercícios com campos de carga em branco, área de anotações, QR code e rodapé de
homologação CREF.

QR gerado no cliente com a lib `qrcode` — não depende de serviço externo.

**Regras não-negociáveis do `@media print`.** Todas nasceram de defeito real medido no
protótipo, não de teoria:

| Regra | Por quê |
|---|---|
| `.sheet-body { overflow: visible; height: auto; max-height: none }` | A pré-visualização rola para caber na tela do totem. Se o `overflow: auto` vazar para a impressão, **exercício desaparece do papel sem aviso** — o mais perigoso dos defeitos, porque a tela mostra certo. |
| `thead { display: table-header-group }` | Cabeçalho da tabela repete em cada página impressa. |
| `tr { break-inside: avoid }` | Nenhum exercício parte no meio entre páginas. |
| `.sheet-ft { position: fixed; bottom: 0 }` | O rodapé de homologação CREF repete em **toda** página. Não pode existir folha impressa sem ele. |
| esconder todo controle (`.qf-cta`, `.qf-row`, `.side`) | Sem isso os botões "Imprimir" e "Voltar" saem impressos na ficha. |
| `background: #fff` em toda a cadeia de ancestrais | Senão o cinza da página de apoio vaza como um bloco no meio da folha. |

**Verificado:** 9 exercícios, 5 exercícios e 4 exercícios geram **1 página A4** cada,
com todas as linhas presentes e o rodapé CREF legível. Conferido gerando PDF de verdade
e contando `/Count` no objeto `/Pages`, não por inspeção visual.

Um alerta para quem for automatizar essa checagem: `page.emulateMedia({media:'screen'})`
**sobrepõe** o print media do `page.pdf()` e faz o PDF sair com a folha de tela. Isso
custou um diagnóstico falso de "3 páginas" na primeira rodada.

### Piloto (depois)

Impressora térmica ESC/POS, formato cupom. O browser não fala com impressora USB, então
entra um **agente local**: Node + `node-thermal-printer`, instalado como serviço, ouvindo
em `localhost:9100`. O totem faz `POST http://localhost:9100/print`.

**Risco conhecido a resolver no piloto:** página em HTTPS chamando `http://localhost`
cai nas regras de Private Network Access do Chrome. Caminhos possíveis, em ordem de
preferência:

1. o agente responde ao preflight com `Access-Control-Allow-Private-Network: true`
2. o agente serve HTTPS com certificado confiado localmente
3. a página é servida do próprio localhost no totem

Não resolver isso agora — só não descobrir no dia da instalação.

---

## 8. Tratamento de erro

Totem sem operador precisa se recuperar sozinho. Nenhum caminho termina em tela branca.

| Falha | Comportamento |
|---|---|
| Catálogo não carrega | usa cache do localStorage |
| Catálogo não carrega **e** não há cache | tela "Totem indisponível — procure a recepção" |
| LLM falha ou passa de 2s | segue sem enfeite, **sem mostrar erro ao aluno** |
| `saveWorkout` falha | treino aparece e imprime; QR indisponível com aviso "leve a ficha impressa" |
| Motor acha < 3 exercícios | tela "Essa combinação não está disponível nesta unidade — tente outro grupo". **Não entrega treino ruim.** |
| PAR-Q reprovado | tela de encaminhamento ao professor; registra o evento (o gestor vê nas estatísticas) |
| Aluno abandona no meio | idle timeout de 90s volta para a tela inicial e **descarta o estado** — o próximo não vê dados do anterior |
| Erro não tratado | error boundary volta para a home e reporta |

---

## 9. Testes

**Motor (vitest, unit).** Afirmações sobre treino, não sobre código:

```ts
it('nunca prescreve exercício de aparelho que a academia não tem');
it('respeita o orçamento de tempo com 10% de margem');
it('cobre todos os grupos pedidos antes de repetir algum');
it('seeds diferentes produzem treinos diferentes');
it('nunca prescreve acima do nível declarado');
it('devolve menos de 3 exercícios quando o pool elegível é pequeno');

// os que nasceram de defeito encontrado no protótipo
it('nunca passa do teto de exercícios do objetivo');           // saía 19
it('nunca passa de 4 exercícios do mesmo grupo muscular');
it('20 min de hipertrofia devolve 4 exercícios, não 1');       // esquema derivado
it('não põe composto na segunda metade da sessão');            // agachamento era o 14º
it('nunca prescreve mais que sets_do_esquema + 1 séries');     // saía 6×9 = 54 séries
it('sessão só de cardio é válida com 1 item');
```

O bloqueio por PAR-Q **não é teste do motor** — a triagem vive em `state/machine.ts` e
impede o motor de rodar. Ele é testado no smoke de fluxo (abaixo).

**Property test** sobre o motor — o mais valioso do conjunto: 1000 inputs aleatórios,
afirmando as invariantes (nunca excede tempo, nunca usa equipamento indisponível, nunca
excede nível, nunca repete exercício). Pega o caso esquisito que teste de exemplo não pega.

**Catálogo (CI).** zod valida o CSV; build quebra se um exercício tiver equipamento
inexistente ou `avg_sec_per_set` fora de 10–60.

**Fluxo (Playwright, smoke).** Dois caminhos:

- feliz: PAR-Q → atalho → resultado → PDF, afirmando que foram **3 toques**
- bloqueado: marcar uma condição no PAR-Q leva à tela de encaminhamento e o motor
  **nunca é chamado**

---

## 10. Fora de escopo, em ordem de entrada

| Ordem | Item | Entra quando |
|---|---|---|
| 1 | Agente de impressão térmica | primeiro piloto instalado |
| 2 | Página do QR (`/w/:id`): vídeo, cronômetro, marcar série | primeiro piloto (é o que impressiona aluno jovem) |
| 3 | Painel do gestor: equipamentos, tema, CREF | segunda academia (com uma, você configura via Supabase Studio) |
| 4 | Estatísticas | quando houver dado suficiente para o gráfico não ser vazio |
| 5 | Multi-idioma, white-label de rede, comodato de totem | conversa com rede grande |
| 6 | **Treino prescrito pelo professor, consultado por código** | depois do painel, e só se academia pedir — ver análise abaixo |

Na demo, a configuração da academia é feita por você direto no Supabase Studio.

### Item 6 — o que muda ao consultar treino prescrito (levantado pelo Robson, jul/2026)

A ideia: o responsável da academia cadastra alunos e os treinos deles (A, B, C); o aluno chega, digita um código de acesso e escolhe qual treino vai fazer hoje.

**Isso é uma mudança de produto, não uma feature.** Três consequências que precisam de decisão antes de qualquer linha de código:

**1. É o modelo do concorrente.** A §1 posiciona o QuickFit contra o totem da Tecnofit exatamente porque o deles faz *consulta* de treino já existente e exige acoplamento com ERP. Fazer as duas coisas é defensável — provavelmente é o que academia paga, porque professor quer a prescrição dele respeitada — mas muda a venda de "instala e funciona no mesmo dia" para "alguém cadastra todos os alunos antes". O gerador é o que torna o produto demonstrável em 30 segundos com zero dado. Se o cadastro virar pré-requisito, esse argumento morre.

**2. Os 6 primeiros dígitos do CPF não servem como chave.** Espaço de 10⁶. Probabilidade de alguma colisão, por número de alunos na unidade:

| alunos | P(colisão) |
|---|---|
| 500 | 11,7% |
| 1.000 | 39,3% |
| 2.000 | 86,5% |
| 3.000 | 98,9% |

E isso assumindo distribuição uniforme, que o CPF não tem: os primeiros dígitos são sequenciais por época de emissão e o nono indica a região fiscal, então alunos da mesma cidade com idades parecidas **agrupam**. Na prática é pior.

Pior que a colisão: não é segredo. Quem sabe o CPF de outro aluno vê o treino dele.

**Alternativa que preserva o "sem app":** código atribuído pela academia — 6 caracteres alfanuméricos (36⁶ ≈ 2,2 bilhões), gerado com restrição de unicidade no banco, impresso na carteirinha. Sem colisão por construção, revogável se vazar, e não derivado de dado pessoal.

**3. Transforma um produto sem PII num produto com PII.** Hoje o totem não guarda nada pessoal, e é por isso que o RLS da §5 é simples: role `anon`, `get_workout(id)` como `SECURITY DEFINER`, `generated_workouts` não listável. Guardar alunos e fragmento de documento traz LGPD — base legal, retenção, direito de exclusão — e o código de acesso passa a ser credencial que identifica pessoa. É superfície de compliance, não mudança de schema.

**Por que entra depois do painel (item 3):** alguém tem que cadastrar. Sem painel, não há onde. E deixar para depois do painel significa decidir isso já sabendo se academia paga.

---

## 11. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Revisar 269 exercícios vira gargalo e o projeto morre na planilha | alta | duas ondas (D7); onda 1 libera o desenvolvimento |
| CREF/CONFEF: PAR-Q + homologação mitiga, não elimina | alta | conversar com advogado **antes de cobrar da primeira academia** — não antes da demo |
| LLM erra contraindicação na classificação e alguém se machuca | alta | contraindicação é campo de revisão humana obrigatória, sem exceção |
| Private Network Access bloqueia impressão térmica | média | três caminhos mapeados (§7); resolver no piloto, não na instalação |
| Aluno não confia em treino gerado por máquina | média | rodapé com nome e CREF do professor da unidade; a demo mede se o gestor deixa instalar |
| Academia quer integração com o ERP dela | baixa | o QuickFit funciona standalone por desenho — é vantagem, não dívida |

---

## 12. Como se mede o sucesso desta fase

A demo tem **um** trabalho: fazer um gestor de academia dizer *"quero isso instalado
aqui"*. Não é código bonito, não é cobertura de teste.

Ela passa se aguentar o gestor tocando em "Montar do zero" e escolhendo uma combinação
esquisita na sua frente — ombros + mobilidade, 90 minutos, avançado, só máquinas — e
ainda assim sair um treino cheio e coerente.

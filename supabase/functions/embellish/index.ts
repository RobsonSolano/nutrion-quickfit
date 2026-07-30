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

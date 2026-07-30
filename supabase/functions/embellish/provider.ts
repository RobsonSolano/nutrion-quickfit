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

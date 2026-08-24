/**
 * Serverová vrstva pro Lovable AI Gateway.
 * Klíč se čte pouze zde (uvnitř handlerů) a nikdy se nedostane do frontendu.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
export const CHAT_MODEL = "google/gemini-3-flash";

export class AiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

function friendlyMessage(status: number, raw: string): string {
  if (status === 402) return "AI kredity ve workspace byly vyčerpány. Doplň je v nastavení Lovable a zkus to znovu.";
  if (status === 403) return "AI služba je pro tento workspace zablokovaná (limit nebo administrátorské nastavení).";
  if (status === 429) return "AI služba je momentálně přetížená. Zkus to prosím za chvíli znovu.";
  if (status === 401) return "AI služba není správně nakonfigurovaná (chybí platný klíč na serveru).";
  if (status >= 500) return "AI služba dočasně neodpovídá. Zkus to prosím znovu.";
  return `AI požadavek se nepodařilo zpracovat: ${raw.slice(0, 300)}`;
}

interface GatewayOptions {
  system: string;
  prompt: string;
  /** Přesné JSON schéma pro strukturovaný výstup (nepovinné). */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
}

/**
 * Streamované volání gatewaye — nutné, protože generování dlouhých scénářů
 * běží desítky sekund. Text se skládá z SSE delt, žádný časový limit.
 */
export async function callGateway({ system, prompt, jsonSchema }: GatewayOptions): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("Na serveru chybí konfigurace AI služby (LOVABLE_API_KEY).", 401);

  const body: Record<string, unknown> = {
    model: CHAT_MODEL,
    stream: true,
    messages: [
      { role: "system", content: system },
      { role: "user", content: prompt },
    ],
  };
  if (jsonSchema) {
    body["response_format"] = {
      type: "json_schema",
      json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema },
    };
  }

  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const raw = await res.text().catch(() => "");
    throw new AiError(friendlyMessage(res.status, raw), res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const evt = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
          error?: { message?: string };
        };
        if (evt.error) throw new AiError(evt.error.message ?? "AI generování selhalo.", 500);
        const delta = evt.choices?.[0]?.delta?.content;
        if (typeof delta === "string") out += delta;
      } catch (err) {
        if (err instanceof AiError) throw err;
        /* ignore nekompletní / neznámé eventy */
      }
    }
  }

  const text = out.trim();
  if (!text) throw new AiError("AI nevrátila žádný text. Zkus to prosím znovu.", 500);
  return text;
}

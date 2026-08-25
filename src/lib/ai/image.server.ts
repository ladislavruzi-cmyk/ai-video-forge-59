/**
 * Serverová vrstva pro generování obrázků scén přes Lovable AI Gateway.
 * Klíč LOVABLE_API_KEY se čte pouze zde, uvnitř handlerů — nikdy ve frontendu.
 */
import { AiError } from "./gateway.server";

const IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
export const IMAGE_MODEL = "google/gemini-3-pro-image";

function friendlyMessage(status: number, raw: string): string {
  if (status === 402)
    return "AI kredity ve workspace byly vyčerpány. Doplň je v nastavení Lovable a zkus to znovu.";
  if (status === 403) return "Generování obrázků je pro tento workspace zablokované (limit nebo nastavení administrátora).";
  if (status === 429) return "Obrazová AI je momentálně přetížená. Zkus to prosím za chvíli znovu.";
  if (status === 401) return "Obrazová AI není správně nakonfigurovaná (chybí platný klíč na serveru).";
  if (status >= 500) return "Obrazová AI dočasně neodpovídá. Zkus to prosím znovu.";
  return `Obrázek se nepodařilo vygenerovat: ${raw.slice(0, 300)}`;
}

/** Vrátí base64 PNG data vygenerovaného obrázku. */
export async function generateSceneImage(prompt: string, aspectRatio: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("Na serveru chybí konfigurace AI služby (LOVABLE_API_KEY).", 401);

  const fullPrompt = [
    prompt.trim(),
    `Aspect ratio ${aspectRatio}.`,
    "Cinematic, photorealistic quality, high detail, no text, no watermarks, no captions.",
  ].join(" ");

  const res = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      messages: [{ role: "user", content: fullPrompt }],
      modalities: ["image", "text"],
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new AiError(friendlyMessage(res.status, raw), res.status);
  }

  const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const b64 = json.data?.[0]?.b64_json;
  if (b64) return b64;

  const url = json.data?.[0]?.url;
  if (url) {
    const img = await fetch(url);
    if (!img.ok) throw new AiError("Vygenerovaný obrázek se nepodařilo stáhnout.", 502);
    const bytes = new Uint8Array(await img.arrayBuffer());
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  throw new AiError("Obrazová AI nevrátila žádný obrázek. Zkus to prosím znovu.", 500);
}

/** Dekóduje base64 na binární data pro upload do úložiště. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(",") ? b64.slice(b64.indexOf(",") + 1) : b64;
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

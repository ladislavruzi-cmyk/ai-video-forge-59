/**
 * Serverová vrstva pro generování dabingu (TTS) přes Lovable AI Gateway.
 * Klíč LOVABLE_API_KEY se čte pouze zde a nikdy se nedostane do frontendu.
 */
import { AiError } from "./gateway.server";

const SPEECH_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";
export const TTS_MODEL = "openai/gpt-4o-mini-tts";
const SAMPLE_RATE = 24000;

/** Mapování hlasů z projektu na hlasy modelu. */
const VOICE_MAP: Record<string, string> = {
  "Mužský – hluboký": "onyx",
  "Mužský – přirozený": "ash",
  "Ženský – přirozený": "shimmer",
  "Ženský – dramatický": "sage",
};

export function mapVoice(voice: string): string {
  return VOICE_MAP[voice] ?? "onyx";
}

function instructionsFor(voice: string, language: string): string {
  const tone =
    voice === "Ženský – dramatický"
      ? "Dramatický, emotivní přednes s výraznou dynamikou."
      : voice === "Mužský – hluboký"
        ? "Hluboký, klidný a autoritativní přednes."
        : "Přirozený, důvěryhodný a plynulý přednes.";
  return [
    `Mluv plynule a naprosto přirozeně v jazyce: ${language}.`,
    "Používej správnou nativní výslovnost, přirozené frázování a intonaci rodilého mluvčího.",
    "Styl dokumentárního komentáře pro YouTube: srozumitelné tempo, jasná artikulace, přirozené pauzy mezi větami.",
    tone,
  ].join(" ");
}

function friendlyMessage(status: number, raw: string): string {
  if (status === 402)
    return "AI kredity ve workspace byly vyčerpány. Doplň je v nastavení Lovable a zkus to znovu.";
  if (status === 403) return "Generování dabingu je pro tento workspace zablokované (limit nebo nastavení administrátora).";
  if (status === 429) return "Hlasová AI je momentálně přetížená. Zkus to prosím za chvíli znovu.";
  if (status === 401) return "Hlasová AI není správně nakonfigurovaná (chybí platný klíč na serveru).";
  if (status === 404) return "Generování řeči není pro tento workspace povolené.";
  if (status >= 500) return "Hlasová AI dočasně neodpovídá. Zkus to prosím znovu.";
  return `Dabing se nepodařilo vygenerovat: ${raw.slice(0, 300)}`;
}

/** Rozdělí text na části bezpečně pod limitem modelu, na hranicích vět. */
export function chunkNarration(text: string, maxChars = 1500): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/gu) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = "";
  };
  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      flush();
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars).trim());
      }
      continue;
    }
    if (current.length + sentence.length > maxChars) flush();
    current += sentence;
  }
  flush();
  return chunks.filter(Boolean);
}

/** Zabalí surová PCM data (24 kHz, 16 bit, mono) do WAV souboru. */
function pcmToWav(pcm: Uint8Array): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + pcm.length, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, pcm.length, true);

  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

async function synthesizeChunk(
  apiKey: string,
  text: string,
  voice: string,
  language: string,
): Promise<Uint8Array> {
  const res = await fetch(SPEECH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: TTS_MODEL,
      input: text,
      voice: mapVoice(voice),
      instructions: instructionsFor(voice, language),
      response_format: "pcm",
    }),
  });

  if (!res.ok) {
    const raw = await res.text().catch(() => "");
    throw new AiError(friendlyMessage(res.status, raw), res.status);
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0) throw new AiError("Hlasová AI nevrátila žádné audio. Zkus to prosím znovu.", 502);
  return bytes;
}

export interface NarrationAudio {
  wav: Uint8Array;
  seconds: number;
}

/** Vygeneruje kompletní audio pro narraci scény (v případě potřeby po částech). */
export async function synthesizeNarration(
  narration: string,
  voice: string,
  language: string,
): Promise<NarrationAudio> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiError("Na serveru chybí konfigurace AI služby (LOVABLE_API_KEY).", 401);

  const chunks = chunkNarration(narration.trim());
  if (chunks.length === 0) throw new AiError("Scéna nemá text k namluvení.", 400);

  const parts: Uint8Array[] = [];
  for (const chunk of chunks) {
    parts.push(await synthesizeChunk(apiKey, chunk, voice, language));
  }

  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const pcm = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    pcm.set(part, offset);
    offset += part.length;
  }

  return {
    wav: pcmToWav(pcm),
    seconds: Math.round((pcm.length / 2 / SAMPLE_RATE) * 10) / 10,
  };
}

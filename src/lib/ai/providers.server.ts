/**
 * Serverová vrstva pro budoucí AI integrace.
 *
 * Tento soubor běží POUZE na serveru (přípona .server.ts). API klíče se
 * čtou z process.env uvnitř handlerů — nikdy se nedostanou do frontendu.
 * Zatím pouze reportuje, které integrace jsou nakonfigurované.
 */

export interface IntegrationSpec {
  id: string;
  name: string;
  purpose: string;
  envVar: string;
}

export const INTEGRATIONS: IntegrationSpec[] = [
  { id: "script", name: "Generování scénáře", purpose: "LLM pro scénář a rozpad scén", envVar: "SCRIPT_API_KEY" },
  { id: "image", name: "AI obrázky", purpose: "Vizuály jednotlivých scén", envVar: "IMAGE_API_KEY" },
  { id: "video", name: "AI video", purpose: "Animace a video klipy", envVar: "VIDEO_API_KEY" },
  { id: "tts", name: "Text-to-speech", purpose: "Dabing ve vybraném hlasu", envVar: "TTS_API_KEY" },
  { id: "music", name: "Generování hudby", purpose: "Podkres a zvukové efekty", envVar: "MUSIC_API_KEY" },
  { id: "subtitles", name: "Titulky", purpose: "Časování a překlad titulků", envVar: "SUBTITLES_API_KEY" },
  { id: "render", name: "Video rendering", purpose: "Sestavení a kódování videa", envVar: "RENDER_API_KEY" },
  { id: "youtube", name: "YouTube API", purpose: "Upload a metadata videa", envVar: "YOUTUBE_API_KEY" },
];

export interface IntegrationStatus extends IntegrationSpec {
  configured: boolean;
}

export function readIntegrationStatus(): IntegrationStatus[] {
  return INTEGRATIONS.map((spec) => ({
    ...spec,
    configured: Boolean(process.env[spec.envVar]),
  }));
}

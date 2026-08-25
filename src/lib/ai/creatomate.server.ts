/**
 * Creatomate REST API — skutečný render MP4 ze scén projektu.
 * Volá se pouze ze serverových funkcí; API klíč nikdy neopouští server.
 */

export interface RenderScene {
  index: number;
  title: string;
  imageUrl: string;
  audioUrl: string;
  /** Skutečná délka dabingu (s). */
  audioDuration: number;
  /** Délka vizuálu včetně přechodu (s). */
  visualDuration: number;
  /** Začátek scény na časové ose (s). */
  startTime: number;
  /** Délka přechodu do další scény (s). */
  transitionSeconds: number;
  transition: string;
}

export interface ProviderRender {
  id: string;
  status: string;
  url: string | null;
  error: string | null;
}

const API_VERSIONS = ["v2", "v1"] as const;

function apiKey(): string {
  const key = process.env["CREATOMATE_API_KEY"];
  if (!key) {
    throw new Error(
      "Chybí CREATOMATE_API_KEY. Ulož klíč mezi serverové Secrets a spusť render znovu.",
    );
  }
  return key;
}

/** Fade-in délka nastupující scény podle přechodu předchozí scény. */
function fadeIn(prev: RenderScene | undefined): number {
  if (!prev) return 0;
  return Math.max(0, Math.min(prev.transitionSeconds || 0, prev.visualDuration));
}

/**
 * Sestaví Creatomate RenderScript z uložených dat projektu.
 * Časy scén se berou přesně z tabulky synchronizace — nic se nepřepočítává.
 */
export function buildRenderSource(
  scenes: RenderScene[],
  aspectRatio: string,
): Record<string, unknown> {
  const vertical = aspectRatio === "9:16";
  const ordered = scenes.slice().sort((a, b) => a.index - b.index);

  const elements = ordered.map((scene, i) => {
    const fade = fadeIn(ordered[i - 1]);
    return {
      type: "composition",
      track: 1,
      time: Number(scene.startTime.toFixed(2)),
      duration: Number(scene.visualDuration.toFixed(2)),
      elements: [
        {
          type: "image",
          source: scene.imageUrl,
          fit: "cover",
          x: "50%",
          y: "50%",
          width: "100%",
          height: "100%",
          ...(fade > 0
            ? { animations: [{ type: "fade", time: 0, duration: fade, easing: "linear" }] }
            : {}),
        },
        {
          type: "audio",
          source: scene.audioUrl,
          time: 0,
          duration: Number(scene.audioDuration.toFixed(2)),
        },
      ],
    };
  });

  return {
    output_format: "mp4",
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
    frame_rate: 30,
    fill_color: "#000000",
    elements,
  };
}

async function callApi(
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  let last: { ok: boolean; status: number; body: unknown } = {
    ok: false,
    status: 0,
    body: null,
  };

  for (const version of API_VERSIONS) {
    const res = await fetch(`https://api.creatomate.com/${version}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    last = { ok: res.ok, status: res.status, body };
    // Jiná verze API se zkouší jen když endpoint neexistuje.
    if (res.status !== 404 && res.status !== 405) return last;
  }
  return last;
}

function providerMessage(body: unknown, status: number): string {
  const asRecord = (body ?? {}) as Record<string, unknown>;
  const raw =
    (typeof asRecord["message"] === "string" && asRecord["message"]) ||
    (typeof asRecord["error"] === "string" && asRecord["error"]) ||
    (typeof body === "string" && body) ||
    "";

  if (status === 401 || status === 403) {
    return "Render služba odmítla přihlášení — CREATOMATE_API_KEY je neplatný nebo bez oprávnění.";
  }
  if (status === 402) {
    return "Render služba nemá dostatek kreditu na tento render.";
  }
  if (status === 429) {
    return "Render služba je vytížená (limit požadavků). Zkus render spustit za chvíli znovu.";
  }
  return raw
    ? `Render služba odmítla požadavek (HTTP ${status}): ${raw}`
    : `Render služba odmítla požadavek (HTTP ${status}).`;
}

function normalize(row: Record<string, unknown>): ProviderRender {
  return {
    id: String(row["id"] ?? ""),
    status: String(row["status"] ?? "unknown"),
    url: typeof row["url"] === "string" ? row["url"] : null,
    error:
      typeof row["error_message"] === "string"
        ? row["error_message"]
        : typeof row["error"] === "string"
          ? row["error"]
          : null,
  };
}

/** Odešle render job. Vrací identifikátor renderu u služby. */
export async function createRender(source: Record<string, unknown>): Promise<ProviderRender> {
  const { ok, status, body } = await callApi("/renders", {
    method: "POST",
    body: JSON.stringify({ source }),
  });

  if (!ok) throw new Error(providerMessage(body, status));

  const rows = Array.isArray(body) ? body : [body];
  const first = rows[0] as Record<string, unknown> | undefined;
  if (!first?.["id"]) throw new Error("Render služba nevrátila identifikátor renderu.");
  return normalize(first);
}

/** Zjistí aktuální stav renderu u služby. */
export async function fetchRender(renderId: string): Promise<ProviderRender> {
  const { ok, status, body } = await callApi(`/renders/${renderId}`, { method: "GET" });
  if (!ok) throw new Error(providerMessage(body, status));
  const row = (Array.isArray(body) ? body[0] : body) as Record<string, unknown> | null;
  if (!row) throw new Error("Render služba nevrátila stav renderu.");
  return normalize(row);
}

/** Sjednocení stavů služby na stavy aplikace. */
export function mapStatus(status: string): "rendering" | "done" | "error" {
  const s = status.toLowerCase();
  if (s === "succeeded") return "done";
  if (s === "failed" || s === "cancelled" || s === "canceled") return "error";
  return "rendering";
}

export const RENDER_STAGE_LABEL: Record<string, string> = {
  planned: "Příprava scén",
  waiting: "Čeká ve frontě render služby",
  transcribing: "Načítání vizuálů a dabingu",
  rendering: "Renderování videa",
  saving: "Finalizace MP4",
  succeeded: "Video připraveno",
  failed: "Render selhal",
};

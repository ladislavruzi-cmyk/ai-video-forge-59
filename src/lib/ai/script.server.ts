import { callGateway } from "./gateway.server";
import type { VideoBrief } from "@/lib/studio/types";

/** Slova za minutu mluveného komentáře. */
export const WORDS_PER_MINUTE = 145;

export function targetWords(minutes: number): { min: number; max: number; mid: number } {
  const min = Math.round(minutes * 130);
  const max = Math.round(minutes * 160);
  return { min, max, mid: Math.round((min + max) / 2) };
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

function styleGuidance(style: string): string {
  const s = style.toLowerCase();
  if (s.includes("filmov") || s.includes("tajemn") || s.includes("horor")) {
    return "Piš atmosféricky a napínavě, pracuj s obrazností, tempem a napětím. Přeháněj atmosféru, ne fakta.";
  }
  if (s.includes("dokument") || s.includes("vědeck") || s.includes("vzděláv")) {
    return "Piš věcně a přesně. Domněnky a hypotézy jasně označuj jako hypotézy, nikdy je nepředstavuj jako fakta. Uváděj souvislosti a kontext.";
  }
  if (s.includes("motiv")) return "Piš energicky, s jasným poselstvím a výzvou k akci.";
  return "Piš přehledně a poutavě pro široké publikum.";
}

function briefSummary(brief: VideoBrief, minutes: number): string {
  return [
    `Téma: ${brief.topic}`,
    `Cílová délka videa: ${minutes} minut`,
    `Jazyk: ${brief.language}`,
    `Styl: ${brief.style}`,
    `Typ hlasu vypravěče: ${brief.voice}`,
    `Poměr stran: ${brief.aspectRatio}`,
    `Hudba: ${brief.music}`,
  ].join("\n");
}

export async function generateScript(brief: VideoBrief, minutes: number): Promise<string> {
  const words = targetWords(minutes);
  const system = [
    "Jsi profesionální scenárista YouTube videí.",
    "Vracíš POUZE text komentáře vypravěče — žádné poznámky, žádný markdown, žádné hranaté popisy scén.",
    "Text piš v jazyce, který je uveden v zadání.",
    styleGuidance(brief.style),
  ].join(" ");

  const prompt = `${briefSummary(brief, minutes)}

Napiš kompletní scénář (mluvený komentář) pro toto video.

POVINNÁ STRUKTURA:
1. Poutavý hook v prvních dvou až třech větách.
2. Úvod do tématu a proč je důležité.
3. Hlavní část rozdělená na tematické kapitoly (každou uveď krátkým nadpisem na samostatném řádku ve formátu "KAPITOLA: název").
4. Zajímavé informace, souvislosti a postupné budování příběhu.
5. Závěr s přirozeným zakončením vhodným pro YouTube (výzva k odběru a komentáři).

DÉLKA: text musí mít ${words.min}–${words.max} slov (cílově přibližně ${words.mid} slov). Toto je nejdůležitější požadavek — nezkracuj text.
Nepiš žádné technické instrukce, jen plynulý mluvený text s odstavci a nadpisy kapitol.`;

  return callGateway({ system, prompt });
}

export interface RawScene {
  scene_number: number;
  title: string;
  narration: string;
  visual_prompt: string;
  estimated_duration: number;
  transition: string;
  mood: string;
}

const SCENE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scenes"],
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "scene_number",
          "title",
          "narration",
          "visual_prompt",
          "estimated_duration",
          "transition",
          "mood",
        ],
        properties: {
          scene_number: { type: "integer" },
          title: { type: "string" },
          narration: { type: "string" },
          visual_prompt: { type: "string" },
          estimated_duration: { type: "integer" },
          transition: { type: "string" },
          mood: { type: "string" },
        },
      },
    },
  },
} as const;

const VISUAL_RULES = `Vizuální prompt piš VŽDY v angličtině, jako jeden odstavec připravený k odeslání do AI image/video API.
Musí obsahovat: prostředí, hlavní objekt nebo postavu, dění ve scéně, práci kamery (typ záběru a pohyb), světlo, atmosféru, filmový styl a poměr stran.`;

export async function splitIntoScenes(
  brief: VideoBrief,
  minutes: number,
  script: string,
): Promise<RawScene[]> {
  const totalSeconds = minutes * 60;
  const targetCount = Math.max(4, Math.min(40, Math.round(totalSeconds / 28)));

  const system = [
    "Jsi zkušený režisér a storyboard editor.",
    "Rozděluješ hotový scénář na scény a vracíš pouze strukturovaná data podle schématu.",
    VISUAL_RULES,
  ].join(" ");

  const prompt = `${briefSummary(brief, minutes)}

Rozděl následující scénář na přibližně ${targetCount} scén (20–35 sekund na scénu).

PRAVIDLA:
- Vlastnost narration musí obsahovat PŘESNÝ text ze scénáře (nadpisy kapitol vynech). Nic nevynechávej ani nepřepisuj — dohromady musí scény pokrývat celý scénář v původním pořadí.
- title je krátký název scény v jazyce videa.
- visual_prompt v angličtině podle pravidel, s poměrem stran ${brief.aspectRatio}.
- estimated_duration je odhad v sekundách podle množství textu (mluvené tempo ${WORDS_PER_MINUTE} slov/min). Součet musí být přibližně ${totalSeconds} sekund.
- transition: např. Fade, Cut, Dissolve, Zoom, Whip pan.
- mood: např. Tense, Calm, Mysterious, Epic, Hopeful.

SCÉNÁŘ:
"""
${script}
"""`;

  const raw = await callGateway({
    system,
    prompt,
    jsonSchema: { name: "scene_breakdown", schema: SCENE_SCHEMA as unknown as Record<string, unknown> },
  });

  const parsed = JSON.parse(raw) as { scenes?: RawScene[] };
  const scenes = parsed.scenes ?? [];
  if (!scenes.length) throw new Error("AI nevrátila žádné scény.");
  return scenes;
}

export async function regenerateSceneRaw(
  brief: VideoBrief,
  minutes: number,
  scene: RawScene,
): Promise<RawScene> {
  const system = [
    "Jsi zkušený režisér a scenárista. Přepracováváš jednu jedinou scénu videa.",
    "Vracíš pouze strukturovaná data podle schématu.",
    VISUAL_RULES,
    styleGuidance(brief.style),
  ].join(" ");

  const prompt = `${briefSummary(brief, minutes)}

Přepracuj tuto scénu — zachovej její roli v příběhu a přibližnou délku ${scene.estimated_duration} sekund,
ale napiš svěží narraci, nový název, nový vizuální prompt (poměr stran ${brief.aspectRatio}), náladu a přechod.
Vrať právě jednu scénu s scene_number ${scene.scene_number}.

PŮVODNÍ SCÉNA:
Název: ${scene.title}
Narrace: ${scene.narration}
Vizuál: ${scene.visual_prompt}
Nálada: ${scene.mood}
Přechod: ${scene.transition}`;

  const raw = await callGateway({
    system,
    prompt,
    jsonSchema: { name: "scene_breakdown", schema: SCENE_SCHEMA as unknown as Record<string, unknown> },
  });
  const parsed = JSON.parse(raw) as { scenes?: RawScene[] };
  const next = parsed.scenes?.[0];
  if (!next) throw new Error("AI nevrátila přepracovanou scénu.");
  return { ...next, scene_number: scene.scene_number };
}

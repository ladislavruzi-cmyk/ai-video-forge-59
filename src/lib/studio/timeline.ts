import type { Scene } from "./types";

/**
 * Délka přechodu mezi scénami podle typu přechodu.
 * Střih (Cut) je bez prodlevy, ostatní přechody potřebují krátké překrytí.
 */
export function transitionSeconds(transition: string | undefined): number {
  const t = (transition ?? "").toLowerCase();
  if (!t || t.includes("cut") || t.includes("střih")) return 0;
  if (t.includes("fade to black") || t.includes("dissolve") || t.includes("prolín")) return 0.8;
  if (t.includes("whoosh") || t.includes("zoom") || t.includes("slide") || t.includes("pan")) return 0.5;
  return 0.4;
}

export interface MediaFacts {
  sceneId: string;
  audioSeconds: number;
}

/**
 * Sestaví časovou osu z reálných délek dabingu. Délka vizuálu = délka dabingu
 * + přechod do další scény. Scény bez použitelných dat zůstanou bez časů,
 * ale nezastaví výpočet ostatních.
 */
export function buildTimeline(scenes: Scene[], facts: Map<string, number>): Scene[] {
  let cursor = 0;
  return scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((scene, i, arr) => {
      const audio = facts.get(scene.id);
      if (!audio || audio <= 0) return scene;

      const isLast = i === arr.length - 1;
      const trans = isLast ? 0 : transitionSeconds(scene.transition);
      const audioDuration = Math.round(audio * 100) / 100;
      const visualDuration = Math.round((audioDuration + trans) * 100) / 100;
      const startTime = Math.round(cursor * 100) / 100;
      const endTime = Math.round((cursor + visualDuration) * 100) / 100;
      cursor = endTime;

      return {
        ...scene,
        audioDuration,
        audioSeconds: audioDuration,
        visualDuration,
        startTime,
        endTime,
        transitionSeconds: trans,
        seconds: Math.max(1, Math.round(audioDuration)),
        syncStatus: "done" as const,
        syncError: null,
      };
    });
}

export function formatSeconds(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const m = Math.floor(value / 60);
  const s = value % 60;
  return `${m}:${s.toFixed(1).padStart(4, "0")}`;
}

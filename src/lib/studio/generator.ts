import {
  WORKFLOW_BLUEPRINT,
  countWords,
  type Scene,
  type SoundTrack,
  type VideoBrief,
  type WorkflowStep,
} from "./types";

export const WORDS_PER_MINUTE = 145;

export function buildSteps(): WorkflowStep[] {
  return WORKFLOW_BLUEPRINT.map((s) => ({ ...s, status: "waiting", progress: 0 }));
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

/** Přepočítá délky scén podle množství textu a doladí je na cílovou délku videa. */
export function normalizeScenes(raw: RawScene[], targetSeconds: number): Scene[] {
  const base = raw.map((s, i) => {
    const words = countWords(s.narration);
    const fromText = Math.max(4, Math.round((words / WORDS_PER_MINUTE) * 60));
    const seconds = s.estimated_duration > 0 ? Math.round((fromText + s.estimated_duration) / 2) : fromText;
    return { raw: s, index: i + 1, seconds };
  });

  const sum = base.reduce((a, b) => a + b.seconds, 0) || 1;
  const factor = targetSeconds / sum;

  return base.map(({ raw: s, index, seconds }) => ({
    id: `scene-${index}`,
    index,
    title: s.title?.trim() || `Scéna ${index}`,
    narration: s.narration?.trim() ?? "",
    visualPrompt: s.visual_prompt?.trim() ?? "",
    seconds: Math.max(3, Math.round(seconds * factor)),
    mood: s.mood?.trim() || "Neutral",
    transition: s.transition?.trim() || "Cut",
    status: "done" as const,
    visualStatus: "waiting" as const,
    imagePath: null,
    visualError: null,

}

export function toRawScene(scene: Scene): RawScene {
  return {
    scene_number: scene.index,
    title: scene.title,
    narration: scene.narration,
    visual_prompt: scene.visualPrompt,
    estimated_duration: scene.seconds,
    transition: scene.transition,
    mood: scene.mood,
  };
}

export function buildTracks(brief: VideoBrief, sceneCount: number): SoundTrack[] {
  return [
    ...(brief.music === "Bez hudby"
      ? []
      : [
          {
            id: "music-main",
            name: `${brief.music} podkres — hlavní stopa`,
            kind: "Hudba" as const,
            note: "Loop, -18 LUFS, ducking pod dabingem",
          },
          {
            id: "music-outro",
            name: `${brief.music} outro`,
            kind: "Hudba" as const,
            note: "Fade out posledních 8 s",
          },
        ]),
    {
      id: "sfx-whoosh",
      name: "Přechody mezi scénami (whoosh)",
      kind: "Efekt" as const,
      note: `${Math.max(0, sceneCount - 1)}× použito`,
    },
    { id: "sfx-amb", name: "Ambientní ruch pozadí", kind: "Efekt" as const, note: "Celá délka videa" },
    { id: "sfx-impact", name: "Impact u zlomových scén", kind: "Efekt" as const, note: "3× použito" },
  ];
}

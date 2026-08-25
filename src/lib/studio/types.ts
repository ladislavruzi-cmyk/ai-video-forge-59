export type StepStatus = "waiting" | "running" | "done" | "error";

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  waiting: "Čeká",
  running: "Probíhá",
  done: "Dokončeno",
  error: "Chyba",
};

export type VideoLength = "1-3" | "5" | "10" | "20" | "40" | "custom";

export interface VideoBrief {
  topic: string;
  length: VideoLength;
  customMinutes: number;
  language: string;
  style: string;
  voice: string;
  aspectRatio: "16:9" | "9:16";
  music: string;
}

export interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  status: StepStatus;
  progress: number;
  /** Krok zatím není napojený na AI API. */
  pending?: boolean;
}

export const VISUAL_STATUS_LABEL: Record<StepStatus, string> = {
  waiting: "Čeká",
  running: "Generuje se",
  done: "Hotovo",
  error: "Chyba",
};

export interface Scene {
  id: string;
  index: number;
  title: string;
  narration: string;
  visualPrompt: string;
  seconds: number;
  mood: string;
  transition: string;
  status: StepStatus;
  /** Stav generování vizuálu scény. */
  visualStatus?: StepStatus;
  /** Cesta k obrázku v privátním úložišti. */
  imagePath?: string | null;
  visualError?: string | null;
}


export interface SoundTrack {
  id: string;
  name: string;
  kind: "Hudba" | "Efekt";
  note: string;
}

export interface VideoProject {
  id: string;
  title: string;
  brief: VideoBrief;
  createdAt: string;
  state: "Rozpracováno" | "Připraveno k exportu" | "Exportováno";
  totalSeconds: number;
  wordCount: number;
  scenes: Scene[];
  script: string;
  tracks: SoundTrack[];
  subtitlesEnabled: boolean;
  steps: WorkflowStep[];
}

export const LENGTH_OPTIONS: { value: VideoLength; label: string; minutes: number }[] = [
  { value: "1-3", label: "1–3 minuty", minutes: 2 },
  { value: "5", label: "5 minut", minutes: 5 },
  { value: "10", label: "10 minut", minutes: 10 },
  { value: "20", label: "20 minut", minutes: 20 },
  { value: "40", label: "40 minut", minutes: 40 },
  { value: "custom", label: "Vlastní délka", minutes: 7 },
];

export const LANGUAGE_OPTIONS = [
  "Čeština",
  "Slovenština",
  "Angličtina",
  "Němčina",
  "Polština",
];

export const STYLE_OPTIONS = [
  "Dokumentární",
  "Filmový",
  "Tajemný",
  "Historický",
  "Vědecký",
  "Hororový",
  "Vzdělávací",
  "Motivující",
];

export const VOICE_OPTIONS = [
  "Mužský – hluboký",
  "Mužský – přirozený",
  "Ženský – přirozený",
  "Ženský – dramatický",
];

export const MUSIC_OPTIONS = [
  "Bez hudby",
  "Atmosférická",
  "Filmová",
  "Napínavá",
  "Tajemná",
  "Motivující",
];

export const WORKFLOW_BLUEPRINT: { id: string; title: string; description: string; pending?: boolean }[] = [
  { id: "analyza", title: "Analýza tématu", description: "Rozbor tématu, cílové skupiny a klíčových bodů" },
  { id: "scenar", title: "Vytvoření scénáře", description: "AI generuje kompletní komentář" },
  { id: "sceny", title: "Rozdělení scén", description: "AI rozpad scénáře na strukturované scény" },
  { id: "vizualy", title: "Vytvoření vizuálů", description: "Připraveno k napojení API", pending: true },
  { id: "dabing", title: "Generování dabingu", description: "Připraveno k napojení API", pending: true },
  { id: "sync", title: "Synchronizace obrazu a zvuku", description: "Připraveno k napojení API", pending: true },
  { id: "hudba", title: "Přidání hudby a efektů", description: "Připraveno k napojení API", pending: true },
  { id: "titulky", title: "Vytvoření titulků", description: "Připraveno k napojení API", pending: true },
  { id: "render", title: "Renderování videa", description: "Připraveno k napojení API", pending: true },
  { id: "export", title: "Export pro YouTube", description: "Připraveno k napojení API", pending: true },
];

export function briefMinutes(brief: VideoBrief): number {
  if (brief.length === "custom") return Math.max(1, brief.customMinutes);
  return LENGTH_OPTIONS.find((o) => o.value === brief.length)?.minutes ?? 5;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length;
}

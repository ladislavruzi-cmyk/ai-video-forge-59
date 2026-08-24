import {
  WORKFLOW_BLUEPRINT,
  briefMinutes,
  type Scene,
  type SoundTrack,
  type VideoBrief,
  type VideoProject,
  type WorkflowStep,
} from "./types";

/**
 * Lokální simulace generování. Nahradí se voláním serverových funkcí
 * ve `src/lib/ai/pipeline.functions.ts`, jakmile budou připojena AI API.
 */

const SCENE_TEMPLATES = [
  { title: "Úvodní hook", visual: "Široký atmosférický záběr, pomalý nájezd kamery" },
  { title: "Představení tématu", visual: "Archivní materiál s jemným zrnem" },
  { title: "První záhada", visual: "Detail mapy s dramatickým osvětlením" },
  { title: "Historický kontext", visual: "Rekonstrukce historické scény, teplé tóny" },
  { title: "Klíčové svědectví", visual: "Dokumentární portrét, hloubka ostrosti" },
  { title: "Vědecké vysvětlení", visual: "Datová vizualizace a schémata" },
  { title: "Zlom v příběhu", visual: "Rychlý střih, kontrastní světlo" },
  { title: "Nové důkazy", visual: "Makro detaily dokumentů a artefaktů" },
  { title: "Vyvrácené teorie", visual: "Rozdělená obrazovka s porovnáním" },
  { title: "Co víme dnes", visual: "Letecké záběry lokace, denní světlo" },
  { title: "Otevřené otázky", visual: "Pomalý přejezd nad prázdnou krajinou" },
  { title: "Závěr a výzva", visual: "Kamera se vzdaluje, tmavý fade" },
];

function narration(topic: string, title: string, i: number): string {
  const lines = [
    `Existuje téma, které dodnes rozděluje odborníky i veřejnost: ${topic}. To, co se dozvíte v následujících minutách, mění celý pohled na věc.`,
    `Abychom pochopili, o co skutečně jde, musíme se vrátit na začátek. ${topic} má totiž historii delší, než by kdokoli čekal.`,
    `První skutečná záhada se objevuje právě zde. Záznamy si navzájem odporují a chybí jakékoli vysvětlení.`,
    `V dobovém kontextu působilo vše jinak. Lidé neměli technologie, kterými dnes ověřujeme fakta.`,
    `Svědecké výpovědi jsou zásadní. Právě ony přinesly detail, který dlouho nikdo nedokázal vysvětlit.`,
    `Věda ale nabízí střízlivější pohled. Data ukazují, že mnohé lze vysvětlit fyzikou a statistikou.`,
    `A pak přišel moment, který všechno změnil. Jedna nová informace obrátila celý výklad naruby.`,
    `Nové důkazy se objevily až s moderními metodami. Analýza odhalila to, co dřív zůstávalo skryté.`,
    `Řada populárních teorií se mezitím zhroutila. Bez důkazů zůstává jen atraktivní vyprávění.`,
    `Jak tedy dnes ${topic} chápeme? Odpověď je méně senzační, ale mnohem zajímavější.`,
    `Přesto zůstávají otázky, na které nikdo neodpověděl. A možná právě to je nejsilnější část příběhu.`,
    `Pokud vás téma zaujalo, dejte odběr a napište do komentářů, čemu věříte vy.`,
  ];
  return lines[i % lines.length].replace("{title}", title);
}

export function buildSteps(): WorkflowStep[] {
  return WORKFLOW_BLUEPRINT.map((s) => ({ ...s, status: "waiting", progress: 0 }));
}

export function buildProject(brief: VideoBrief): VideoProject {
  const minutes = briefMinutes(brief);
  const totalSeconds = minutes * 60;
  const sceneCount = Math.min(SCENE_TEMPLATES.length, Math.max(4, Math.round(minutes * 1.6)));
  const per = Math.round(totalSeconds / sceneCount);
  const topic = brief.topic.trim() || "Nové téma";

  const scenes: Scene[] = Array.from({ length: sceneCount }, (_, i) => {
    const tpl = SCENE_TEMPLATES[i % SCENE_TEMPLATES.length];
    return {
      id: `scene-${i + 1}`,
      index: i + 1,
      title: tpl.title,
      narration: narration(topic, tpl.title, i),
      visualPrompt: `${brief.style.toLowerCase()} styl — ${tpl.visual}`,
      seconds: per,
      status: "done",
    };
  });

  const tracks: SoundTrack[] = [
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
    { id: "sfx-whoosh", name: "Přechody mezi scénami (whoosh)", kind: "Efekt", note: `${scenes.length - 1}× použito` },
    { id: "sfx-amb", name: "Ambientní ruch pozadí", kind: "Efekt", note: "Celá délka videa" },
    { id: "sfx-impact", name: "Impact u zlomových scén", kind: "Efekt", note: "3× použito" },
  ];

  const script = scenes
    .map((s) => `SCÉNA ${s.index} — ${s.title}\n${s.narration}`)
    .join("\n\n");

  return {
    id: `proj-${Date.now().toString(36)}`,
    title: topic,
    brief,
    createdAt: new Date().toISOString(),
    state: "Připraveno k exportu",
    totalSeconds,
    scenes,
    script,
    tracks,
    subtitlesEnabled: true,
    steps: buildSteps().map((s) => ({ ...s, status: "done", progress: 100 })),
  };
}

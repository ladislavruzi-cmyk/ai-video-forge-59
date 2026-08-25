import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  buildSteps,
  buildTracks,
  normalizeScenes,
  toRawScene,
  type RawScene,
} from "./generator";
import {
  briefMinutes,
  countWords,
  type Scene,
  type VideoBrief,
  type VideoProject,
  type WorkflowStep,
} from "./types";
import { generateScenesFn, generateScriptFn, regenerateSceneFn } from "@/lib/ai/pipeline.functions";
import { generateSceneVisualFn } from "@/lib/ai/visuals.functions";
import { generateSceneVoiceFn } from "@/lib/ai/voice.functions";
import {
  cancelVisualJobsFn,
  enqueueVisualJobsFn,
  processVisualQueueFn,
} from "@/lib/ai/queue.functions";
import { inspectSceneMediaFn, type SceneMediaResult } from "@/lib/ai/sync.functions";
import { buildTimeline } from "./timeline";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchActiveVisualJobs,
  fetchProjects,
  removeProject,
  saveProject,
} from "./projects.repo";


function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/fetch|network|Failed to fetch/i.test(raw)) {
    return "Nepodařilo se spojit se serverem. Zkontroluj připojení a zkus to znovu.";
  }
  return raw || "Generování selhalo. Zkus to prosím znovu.";
}

export type VisualBatchMode = "missing" | "errors" | "all";

export interface VisualBatchState {
  projectId: string;
  running: boolean;
  total: number;
  completed: number;
  failed: number;
  currentIndex: number | null;
}

interface StudioContextValue {
  projects: VideoProject[];
  steps: WorkflowStep[];
  running: boolean;
  error: string | null;
  activeBrief: VideoBrief | null;
  lastProjectId: string | null;
  startWorkflow: (brief: VideoBrief) => void;
  resetWorkflow: () => void;
  retryFailedStep: () => void;
  getProject: (id: string) => VideoProject | undefined;
  updateProject: (id: string, patch: Partial<VideoProject>) => void;
  deleteProject: (id: string) => void;
  regenerateScript: (id: string) => Promise<string | null>;
  regenerateScene: (id: string, sceneId: string) => Promise<string | null>;
  generateVisual: (id: string, sceneId: string) => Promise<string | null>;
  generateVoice: (id: string, sceneId: string) => Promise<string | null>;
  visualBatch: VisualBatchState | null;
  generateVisualsBatch: (id: string, mode: VisualBatchMode) => Promise<void>;
  cancelVisualBatch: () => void;
  /** Synchronizace obrazu a zvuku — vrací počet úspěšných a chybných scén. */
  syncScenes: (id: string, sceneIds?: string[]) => Promise<{ synced: number; failed: number }>;
}



const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>(() => buildSteps());
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeBrief, setActiveBrief] = useState<VideoBrief | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const creep = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef = useRef<WorkflowStep[]>(steps);
  stepsRef.current = steps;
  const projectsRef = useRef<VideoProject[]>(projects);
  projectsRef.current = projects;
  const [visualBatch, setVisualBatch] = useState<VisualBatchState | null>(null);
  const [resumeProjectId, setResumeProjectId] = useState<string | null>(null);
  const batchRef = useRef(false);
  const cancelRef = useRef(false);

  const callScript = useServerFn(generateScriptFn);
  const callScenes = useServerFn(generateScenesFn);
  const callScene = useServerFn(regenerateSceneFn);
  const callVisual = useServerFn(generateSceneVisualFn);
  const callVoice = useServerFn(generateSceneVoiceFn);
  const callEnqueue = useServerFn(enqueueVisualJobsFn);
  const callProcessQueue = useServerFn(processVisualQueueFn);
  const callCancelJobs = useServerFn(cancelVisualJobsFn);
  const callInspect = useServerFn(inspectSceneMediaFn);


  useEffect(() => {
    void fetchProjects()
      .then(async (list) => {
        setProjects(list);
        // Nedoběhnutá serverová fronta se po otevření aplikace sama rozjede dál.
        const jobs = await fetchActiveVisualJobs().catch(() => []);
        setResumeProjectId(jobs[0]?.projectId ?? null);
      })
      .catch(() => {
        /* nepřihlášený nebo offline — gate routy uživatele přesměruje */
      });
  }, []);

  const stopCreep = useCallback(() => {
    if (creep.current) clearInterval(creep.current);
    creep.current = null;
  }, []);

  useEffect(() => stopCreep, [stopCreep]);

  const patchStep = useCallback((id: string, patch: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  /** Rozjede krok a nechá progress pomalu narůstat, dokud AI pracuje. */
  const beginStep = useCallback(
    (id: string) => {
      stopCreep();
      patchStep(id, { status: "running", progress: 6 });
      creep.current = setInterval(() => {
        setSteps((prev) =>
          prev.map((s) =>
            s.id === id && s.status === "running"
              ? { ...s, progress: Math.min(92, s.progress + Math.random() * 4 + 1) }
              : s,
          ),
        );
      }, 400);
    },
    [patchStep, stopCreep],
  );

  const finishStep = useCallback(
    (id: string) => {
      stopCreep();
      patchStep(id, { status: "done", progress: 100 });
    },
    [patchStep, stopCreep],
  );

  const failStep = useCallback(
    (id: string) => {
      stopCreep();
      patchStep(id, { status: "error" });
    },
    [patchStep, stopCreep],
  );

  const run = useCallback(
    async (brief: VideoBrief) => {
      const minutes = briefMinutes(brief);
      setError(null);
      setRunning(true);
      setSteps(buildSteps());
      let current = "analyza";

      try {
        beginStep("analyza");
        await new Promise((r) => setTimeout(r, 700));
        finishStep("analyza");

        current = "scenar";
        beginStep("scenar");
        const { script } = (await callScript({ data: { brief, minutes } })) as { script: string };
        finishStep("scenar");

        current = "sceny";
        beginStep("sceny");
        const { scenes: rawScenes } = (await callScenes({
          data: { brief, minutes, script },
        })) as { scenes: RawScene[] };
        finishStep("sceny");

        const scenes = normalizeScenes(rawScenes, minutes * 60);
        const project: VideoProject = {
          id: `proj-${Date.now().toString(36)}`,
          title: brief.topic.trim() || "Nové téma",
          brief,
          createdAt: new Date().toISOString(),
          state: "Rozpracováno",
          totalSeconds: scenes.reduce((a, s) => a + s.seconds, 0),
          wordCount: countWords(script),
          scenes,
          script,
          tracks: buildTracks(brief, scenes.length),
          subtitlesEnabled: true,
          steps: [],
        };

        await saveProject(project);
        setProjects((cur) => [project, ...cur]);
        setLastProjectId(project.id);

        // Kroky 4–10 zatím nejsou napojeny na AI API — ponecháme je ve stavu ČEKÁ.
        const snapshot = stepsRef.current.map((st) => ({ ...st }));
        const finished: VideoProject = {
          ...project,
          steps: snapshot,
          state: "Rozpracováno",
        };
        await saveProject(finished);
        setProjects((list) => list.map((p) => (p.id === finished.id ? finished : p)));
      } catch (err) {
        failStep(current);
        setError(errorMessage(err));
      } finally {
        stopCreep();
        setRunning(false);
      }
    },
    [beginStep, callScenes, callScript, failStep, finishStep, stopCreep],
  );

  const startWorkflow = useCallback(
    (brief: VideoBrief) => {
      setActiveBrief(brief);
      setLastProjectId(null);
      void run(brief);
    },
    [run],
  );

  const resetWorkflow = useCallback(() => {
    stopCreep();
    setRunning(false);
    setSteps(buildSteps());
    setLastProjectId(null);
    setActiveBrief(null);
    setError(null);
  }, [stopCreep]);

  const retryFailedStep = useCallback(() => {
    if (activeBrief) void run(activeBrief);
  }, [activeBrief, run]);

  const updateProject = useCallback(
    (id: string, patch: Partial<VideoProject>) => {
      setProjects((cur) => {
        const next = cur.map((p) => (p.id === id ? { ...p, ...patch } : p));
        const updated = next.find((p) => p.id === id);
        if (updated) void saveProject(updated).catch(() => undefined);
        return next;
      });
    },
    [],
  );

  /** Bezpečná aktualizace jedné scény — pracuje vždy s nejnovějším stavem. */
  const patchScene = useCallback((id: string, sceneId: string, patch: Partial<Scene>) => {
    setProjects((cur) => {
      const next = cur.map((p) =>
        p.id === id
          ? { ...p, scenes: p.scenes.map((s) => (s.id === sceneId ? { ...s, ...patch } : s)) }
          : p,
      );
      const updated = next.find((p) => p.id === id);
      if (updated) void saveProject(updated).catch(() => undefined);
      return next;
    });
  }, []);

  /** Vygeneruje vizuál jedné scény. Chyba jedné scény neovlivní ostatní. */
  const generateVisual = useCallback(
    async (id: string, sceneId: string): Promise<string | null> => {
      const project = projects.find((p) => p.id === id);
      const target = project?.scenes.find((s) => s.id === sceneId);
      if (!project || !target) return "Scéna nenalezena.";
      const prompt = target.visualPrompt.trim();
      if (prompt.length < 3) return "Scéna nemá vizuální prompt. Nejdřív ji regeneruj nebo prompt doplň.";

      patchScene(id, sceneId, { visualStatus: "running", visualError: null });
      try {
        const { path } = (await callVisual({
          data: {
            projectId: project.id,
            sceneId,
            prompt,
            aspectRatio: project.brief.aspectRatio,
          },
        })) as { path: string };
        patchScene(id, sceneId, { visualStatus: "done", imagePath: path, visualError: null });
        return null;
      } catch (err) {
        const message = errorMessage(err);
        patchScene(id, sceneId, { visualStatus: "error", visualError: message });
        return message;
      }
    },
    [callVisual, patchScene, projects],
  );

  /**
   * Hromadné generování vizuálů běží jako SERVEROVÁ FRONTA (tabulka visual_jobs).
   * Aplikace scény jen zařadí; jednu po druhé je zpracovává server — buď na
   * pokyn otevřené stránky, nebo naplánovaná serverová úloha každou minutu.
   * Zavření nebo obnovení stránky proto běh nezruší a hotové scény se nikdy
   * negenerují znovu.
   */
  const generateVisualsBatch = useCallback(
    async (id: string, mode: VisualBatchMode): Promise<void> => {
      if (batchRef.current) return;
      const project = projectsRef.current.find((p) => p.id === id);
      if (!project) return;

      const queue = project.scenes.filter((s) => {
        if (mode === "all") return true;
        if (mode === "errors") return (s.visualStatus ?? "waiting") === "error" || !s.imagePath;
        // "missing" — pokračovat pouze u scén bez uloženého vizuálu
        return !s.imagePath;
      });

      const payload = queue
        .filter((s) => s.visualPrompt.trim().length >= 3)
        .map((s) => ({ sceneId: s.id, index: s.index, prompt: s.visualPrompt.trim() }));

      if (payload.length === 0) {
        setVisualBatch({ projectId: id, running: false, total: 0, completed: 0, failed: 0, currentIndex: null });
        return;
      }

      batchRef.current = true;
      cancelRef.current = false;
      setVisualBatch({
        projectId: id,
        running: true,
        total: payload.length,
        completed: 0,
        failed: 0,
        currentIndex: payload[0]?.index ?? null,
      });

      try {
        await callEnqueue({
          data: { projectId: id, scenes: payload, aspectRatio: project.brief.aspectRatio },
        });
        // Scény hned označíme jako zařazené, ať UI nelže po obnovení stránky.
        for (const item of payload) {
          patchScene(id, item.sceneId, { visualStatus: "running", visualError: null });
        }
      } catch (err) {
        batchRef.current = false;
        setError(errorMessage(err));
        setVisualBatch(null);
        return;
      }

      // Fronta se posouvá na serveru; tady jen dokola žádáme o další scénu
      // a hlídáme skutečný stav v databázi.
      while (!cancelRef.current) {
        const { data: jobs } = await supabase
          .from("visual_jobs")
          .select("scene_id, scene_index, status")
          .eq("project_id", id)
          .in("status", ["pending", "running", "done", "error"]);

        const rows = (jobs ?? []) as { scene_id: string; scene_index: number; status: string }[];
        const mine = rows.filter((r) => payload.some((p) => p.sceneId === r.scene_id));
        const done = mine.filter((r) => r.status === "done").length;
        const failed = mine.filter((r) => r.status === "error").length;
        const current = mine.find((r) => r.status === "running");

        setVisualBatch((b) =>
          b
            ? {
                ...b,
                completed: done + failed,
                failed,
                currentIndex: current?.scene_index ?? b.currentIndex,
              }
            : b,
        );

        const remaining = mine.filter((r) => r.status === "pending" || r.status === "running").length;
        if (remaining === 0) break;

        try {
          await callProcessQueue({ data: undefined });
        } catch {
          // Server je zaneprázdněný nebo požadavek vypršel — frontu dotlačí
          // naplánovaná serverová úloha, jen chvíli počkáme.
          await new Promise((r) => setTimeout(r, 4000));
        }

        const refreshed = await fetchProjects().catch(() => null);
        if (refreshed) setProjects(refreshed);
      }

      const refreshed = await fetchProjects().catch(() => null);
      if (refreshed) setProjects(refreshed);

      batchRef.current = false;
      setVisualBatch((b) => (b ? { ...b, running: false, currentIndex: null } : b));
    },
    [callEnqueue, callProcessQueue, patchScene],
  );

  useEffect(() => {
    if (!resumeProjectId) return;
    setResumeProjectId(null);
    void generateVisualsBatch(resumeProjectId, "missing");
  }, [generateVisualsBatch, resumeProjectId]);

  const cancelVisualBatch = useCallback(() => {
    cancelRef.current = true;
    const id = visualBatch?.projectId;
    if (id) void callCancelJobs({ data: { projectId: id } }).catch(() => undefined);
  }, [callCancelJobs, visualBatch]);

  /**
   * Synchronizace obrazu a zvuku. Server přečte skutečné uložené soubory scén
   * (obrázek + WAV) a vrátí reálné délky; z nich sestavíme časovou osu.
   * Nic se negeneruje ani nemaže. Chyba jedné scény nezastaví ostatní.
   */
  const syncScenes = useCallback(
    async (id: string, sceneIds?: string[]): Promise<{ synced: number; failed: number }> => {
      const project = projectsRef.current.find((p) => p.id === id);
      if (!project) return { synced: 0, failed: 0 };

      const targets = sceneIds
        ? project.scenes.filter((s) => sceneIds.includes(s.id))
        : project.scenes;
      if (targets.length === 0) return { synced: 0, failed: 0 };

      let results: SceneMediaResult[] = [];
      try {
        const res = (await callInspect({
          data: {
            projectId: id,
            scenes: targets.map((s) => ({
              sceneId: s.id,
              audioPath: s.audioPath ?? null,
              imagePath: s.imagePath ?? null,
            })),
          },
        })) as { results: SceneMediaResult[] };
        results = res.results;
      } catch (err) {
        const message = errorMessage(err);
        setProjects((cur) =>
          cur.map((p) =>
            p.id === id
              ? {
                  ...p,
                  scenes: p.scenes.map((s) =>
                    targets.some((t) => t.id === s.id)
                      ? { ...s, syncStatus: "error" as const, syncError: message }
                      : s,
                  ),
                }
              : p,
          ),
        );
        return { synced: 0, failed: targets.length };
      }

      const byScene = new Map(results.map((r) => [r.sceneId, r]));

      // Skutečné délky: nově zjištěné + dříve úspěšně zjištěné u ostatních scén.
      const facts = new Map<string, number>();
      for (const scene of project.scenes) {
        const fresh = byScene.get(scene.id);
        if (fresh) {
          if (fresh.ok && fresh.audioSeconds) facts.set(scene.id, fresh.audioSeconds);
        } else if (scene.audioDuration) {
          facts.set(scene.id, scene.audioDuration);
        }
      }

      const withTimeline = buildTimeline(project.scenes, facts).map((scene) => {
        const fresh = byScene.get(scene.id);
        if (fresh && !fresh.ok) {
          return { ...scene, syncStatus: "error" as const, syncError: fresh.error };
        }
        return scene;
      });

      const synced = withTimeline.filter((s) => s.syncStatus === "done").length;
      const failed = results.filter((r) => !r.ok).length;
      const totalSeconds = Math.round(
        withTimeline.reduce((max, s) => Math.max(max, s.endTime ?? 0), 0),
      );

      const next: VideoProject = {
        ...project,
        scenes: withTimeline,
        totalSeconds: totalSeconds > 0 ? totalSeconds : project.totalSeconds,
        timeline: {
          syncedAt: new Date().toISOString(),
          totalSeconds,
          sceneCount: project.scenes.length,
          syncedScenes: synced,
          failedScenes: withTimeline.filter((s) => s.syncStatus === "error").length,
        },
      };

      setProjects((cur) => cur.map((p) => (p.id === id ? next : p)));
      await saveProject(next).catch(() => undefined);
      return { synced, failed };
    },
    [callInspect],
  );



  /** Vygeneruje dabing jedné scény. Chyba jedné scény neovlivní ostatní. */
  const generateVoice = useCallback(
    async (id: string, sceneId: string): Promise<string | null> => {
      const project = projects.find((p) => p.id === id);
      const target = project?.scenes.find((s) => s.id === sceneId);
      if (!project || !target) return "Scéna nenalezena.";
      const narration = target.narration.trim();
      if (narration.length < 3) return "Scéna nemá text k namluvení.";

      patchScene(id, sceneId, { audioStatus: "running", audioError: null });
      try {
        const { path, seconds } = (await callVoice({
          data: {
            projectId: project.id,
            sceneId,
            narration,
            voice: project.brief.voice,
            language: project.brief.language,
          },
        })) as { path: string; seconds: number };
        patchScene(id, sceneId, {
          audioStatus: "done",
          audioPath: path,
          audioSeconds: seconds,
          audioError: null,
        });
        return null;
      } catch (err) {
        const message = errorMessage(err);
        patchScene(id, sceneId, { audioStatus: "error", audioError: message });
        return message;
      }
    },
    [callVoice, patchScene, projects],
  );



  const regenerateScript = useCallback(
    async (id: string): Promise<string | null> => {
      const project = projects.find((p) => p.id === id);
      if (!project) return "Projekt nenalezen.";
      const minutes = briefMinutes(project.brief);
      try {
        const { script } = (await callScript({ data: { brief: project.brief, minutes } })) as {
          script: string;
        };
        const { scenes: rawScenes } = (await callScenes({
          data: { brief: project.brief, minutes, script },
        })) as { scenes: RawScene[] };
        const scenes = normalizeScenes(rawScenes, minutes * 60);
        updateProject(id, {
          script,
          scenes,
          wordCount: countWords(script),
          totalSeconds: scenes.reduce((a, s) => a + s.seconds, 0),
        });
        return null;
      } catch (err) {
        return errorMessage(err);
      }
    },
    [callScenes, callScript, projects, updateProject],
  );

  const regenerateScene = useCallback(
    async (id: string, sceneId: string): Promise<string | null> => {
      const project = projects.find((p) => p.id === id);
      const target = project?.scenes.find((s) => s.id === sceneId);
      if (!project || !target) return "Scéna nenalezena.";
      try {
        const { scene } = (await callScene({
          data: {
            brief: project.brief,
            minutes: briefMinutes(project.brief),
            scene: toRawScene(target),
          },
        })) as { scene: RawScene };
        const next: Scene = {
          ...target,
          title: scene.title?.trim() || target.title,
          narration: scene.narration?.trim() || target.narration,
          visualPrompt: scene.visual_prompt?.trim() || target.visualPrompt,
          seconds: scene.estimated_duration > 0 ? Math.round(scene.estimated_duration) : target.seconds,
          mood: scene.mood?.trim() || target.mood,
          transition: scene.transition?.trim() || target.transition,
        };
        const scenes = project.scenes.map((s) => (s.id === sceneId ? next : s));
        updateProject(id, { scenes, totalSeconds: scenes.reduce((a, s) => a + s.seconds, 0) });
        return null;
      } catch (err) {
        return errorMessage(err);
      }
    },
    [callScene, projects, updateProject],
  );

  const value = useMemo<StudioContextValue>(
    () => ({
      projects,
      steps,
      running,
      error,
      activeBrief,
      lastProjectId,
      startWorkflow,
      resetWorkflow,
      retryFailedStep,
      getProject: (id) => projects.find((p) => p.id === id),
      updateProject,
      deleteProject: (id) => {
        setProjects((cur) => cur.filter((p) => p.id !== id));
        void removeProject(id).catch(() => undefined);
      },
      regenerateScript,
      regenerateScene,
      generateVisual,
      generateVoice,
      visualBatch,
      generateVisualsBatch,
      cancelVisualBatch,
      syncScenes,
    }),
    [
      projects,
      steps,
      running,
      error,
      activeBrief,
      lastProjectId,
      startWorkflow,
      resetWorkflow,
      retryFailedStep,
      updateProject,
      regenerateScript,
      regenerateScene,
      generateVisual,
      generateVoice,
      visualBatch,
      generateVisualsBatch,
      cancelVisualBatch,
      syncScenes,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio musí být použit uvnitř StudioProvider");
  return ctx;
}

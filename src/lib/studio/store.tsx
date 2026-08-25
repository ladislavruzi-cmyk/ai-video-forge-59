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
import { fetchProjects, removeProject, saveProject } from "./projects.repo";


function errorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/fetch|network|Failed to fetch/i.test(raw)) {
    return "Nepodařilo se spojit se serverem. Zkontroluj připojení a zkus to znovu.";
  }
  return raw || "Generování selhalo. Zkus to prosím znovu.";
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

  const callScript = useServerFn(generateScriptFn);
  const callScenes = useServerFn(generateScenesFn);
  const callScene = useServerFn(regenerateSceneFn);
  const callVisual = useServerFn(generateSceneVisualFn);


  useEffect(() => {
    void fetchProjects()
      .then(setProjects)
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

    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio musí být použit uvnitř StudioProvider");
  return ctx;
}

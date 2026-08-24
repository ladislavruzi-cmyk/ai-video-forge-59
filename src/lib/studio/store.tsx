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
import { buildProject, buildSteps } from "./generator";
import type { StepStatus, VideoBrief, VideoProject, WorkflowStep } from "./types";

const STORAGE_KEY = "ai-yt-studio-projects";

interface StudioContextValue {
  projects: VideoProject[];
  steps: WorkflowStep[];
  running: boolean;
  activeBrief: VideoBrief | null;
  lastProjectId: string | null;
  startWorkflow: (brief: VideoBrief) => void;
  resetWorkflow: () => void;
  retryFailedStep: () => void;
  getProject: (id: string) => VideoProject | undefined;
  updateProject: (id: string, patch: Partial<VideoProject>) => void;
  deleteProject: (id: string) => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StudioProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>(() => buildSteps());
  const [running, setRunning] = useState(false);
  const [activeBrief, setActiveBrief] = useState<VideoBrief | null>(null);
  const [lastProjectId, setLastProjectId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setProjects(JSON.parse(raw) as VideoProject[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: VideoProject[]) => {
    setProjects(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => stop, [stop]);

  const run = useCallback(
    (brief: VideoBrief) => {
      stop();
      setRunning(true);
      let index = 0;
      setSteps(buildSteps().map((s, i) => (i === 0 ? { ...s, status: "running" as StepStatus } : s)));

      timer.current = setInterval(() => {
        setSteps((prev) => {
          const next = prev.map((s) => ({ ...s }));
          const current = next[index];
          if (!current) return prev;
          current.status = "running";
          current.progress = Math.min(100, current.progress + 18 + Math.random() * 22);
          if (current.progress >= 100) {
            current.progress = 100;
            current.status = "done";
            index += 1;
            if (index >= next.length) {
              stop();
              setRunning(false);
              const project = buildProject(brief);
              setProjects((cur) => {
                const merged = [project, ...cur];
                try {
                  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
                } catch {
                  /* ignore */
                }
                return merged;
              });
              setLastProjectId(project.id);
            } else {
              next[index]!.status = "running";
            }
          }
          return next;
        });
      }, 260);
    },
    [stop],
  );

  const startWorkflow = useCallback(
    (brief: VideoBrief) => {
      setActiveBrief(brief);
      setLastProjectId(null);
      run(brief);
    },
    [run],
  );

  const resetWorkflow = useCallback(() => {
    stop();
    setRunning(false);
    setSteps(buildSteps());
    setLastProjectId(null);
    setActiveBrief(null);
  }, [stop]);

  const retryFailedStep = useCallback(() => {
    if (activeBrief) run(activeBrief);
  }, [activeBrief, run]);

  const value = useMemo<StudioContextValue>(
    () => ({
      projects,
      steps,
      running,
      activeBrief,
      lastProjectId,
      startWorkflow,
      resetWorkflow,
      retryFailedStep,
      getProject: (id) => projects.find((p) => p.id === id),
      updateProject: (id, patch) =>
        persist(projects.map((p) => (p.id === id ? { ...p, ...patch } : p))),
      deleteProject: (id) => persist(projects.filter((p) => p.id !== id)),
    }),
    [projects, steps, running, activeBrief, lastProjectId, startWorkflow, resetWorkflow, retryFailedStep, persist],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error("useStudio musí být použit uvnitř StudioProvider");
  return ctx;
}

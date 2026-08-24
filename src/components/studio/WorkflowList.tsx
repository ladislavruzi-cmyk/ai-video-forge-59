import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { STEP_STATUS_LABEL, type WorkflowStep } from "@/lib/studio/types";

const STATUS_TEXT: Record<WorkflowStep["status"], string> = {
  waiting: "text-status-waiting",
  running: "text-status-running",
  done: "text-status-done",
  error: "text-status-error",
};

export function WorkflowList({ steps }: { steps: WorkflowStep[] }) {
  const done = steps.filter((s) => s.status === "done").length;
  const overall = Math.round((steps.reduce((a, s) => a + s.progress, 0) / (steps.length * 100)) * 100);

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Workflow generování</h2>
          <p className="text-xs text-muted-foreground">
            {done} z {steps.length} kroků dokončeno
          </p>
        </div>
        <span className="font-mono text-xs text-brand">{overall}%</span>
      </div>

      <ol className="space-y-2">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`flex items-center gap-4 rounded-xl border p-3 transition-colors ${
              step.status === "running"
                ? "border-brand/40 bg-surface ring-1 ring-brand/20"
                : step.status === "error"
                  ? "border-status-error/40 bg-surface"
                  : step.status === "done"
                    ? "border-border/60 bg-surface/60"
                    : "border-border/40 bg-surface/30 opacity-60"
            }`}
          >
            <div className="grid size-7 shrink-0 place-items-center rounded-full border border-border/60 bg-background/40">
              {step.status === "done" ? (
                <Check className="size-3.5 text-status-done" />
              ) : step.status === "running" ? (
                <Loader2 className="size-3.5 animate-spin text-status-running" />
              ) : step.status === "error" ? (
                <AlertTriangle className="size-3.5 text-status-error" />
              ) : (
                <span className="text-[10px] font-semibold text-muted-foreground">{i + 1}</span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-sm font-medium">{step.title}</p>
                <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider ${STATUS_TEXT[step.status]}`}>
                  {STEP_STATUS_LABEL[step.status]}
                </span>
              </div>
              <p className="truncate text-[11px] text-muted-foreground">{step.description}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-background/70">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    step.status === "error"
                      ? "bg-status-error"
                      : step.status === "done"
                        ? "bg-status-done"
                        : "bg-brand"
                  }`}
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

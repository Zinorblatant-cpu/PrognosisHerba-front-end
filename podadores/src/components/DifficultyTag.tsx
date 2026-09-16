import { Mountain } from "lucide-react";

export function DifficultyTag({ dificuldade }: { dificuldade: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-bg-secondary px-2.5 py-0.5 text-xs font-medium capitalize text-fg-muted">
      <Mountain size={11} />
      {dificuldade}
    </span>
  );
}

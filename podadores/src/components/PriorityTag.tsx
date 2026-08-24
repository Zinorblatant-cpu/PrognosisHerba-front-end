const ESTILOS: Record<string, string> = {
  alta: "bg-danger/10 text-danger border-danger/25",
  media: "bg-warning/10 text-warning border-warning/25",
  baixa: "bg-success/10 text-success border-success/25",
};

const ESTILO_PADRAO = "bg-fg-muted/10 text-fg-muted border-fg-muted/25";

export function PriorityTag({ prioridade }: { prioridade: string }) {
  const estilo = ESTILOS[prioridade] ?? ESTILO_PADRAO;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${estilo}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {prioridade}
    </span>
  );
}

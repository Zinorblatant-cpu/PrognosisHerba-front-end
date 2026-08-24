type Nivel = "Alto" | "Médio" | "Baixo" | "Informativo" | "alta" | "media" | "baixa" | "alto" | "medio" | "baixo";

const ESTILOS: Record<string, string> = {
  Alto: "bg-danger/10 text-danger border-danger/25",
  alto: "bg-danger/10 text-danger border-danger/25",
  alta: "bg-danger/10 text-danger border-danger/25",
  Médio: "bg-warning/10 text-warning border-warning/25",
  medio: "bg-warning/10 text-warning border-warning/25",
  media: "bg-warning/10 text-warning border-warning/25",
  Baixo: "bg-success/10 text-success border-success/25",
  baixo: "bg-success/10 text-success border-success/25",
  baixa: "bg-success/10 text-success border-success/25",
  Informativo: "bg-fg-muted/10 text-fg-muted border-fg-muted/25",
};

export function Tag({ nivel, label }: { nivel: Nivel | string; label?: string }) {
  const estilo = ESTILOS[nivel] ?? ESTILOS.Informativo;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${estilo}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? nivel}
    </span>
  );
}

export function StatusTag({ status }: { status: "Programado" | "Pendente" | "Concluído" }) {
  const estilo =
    status === "Pendente"
      ? "bg-warning/10 text-warning border-warning/25"
      : "bg-success/10 text-success border-success/25";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${estilo}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

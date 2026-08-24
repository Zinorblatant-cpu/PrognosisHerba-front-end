import { Sprout } from "lucide-react";
import { formatarEquipe } from "../lib/formato";

export function SeletorEquipe({
  equipes,
  onSelecionar,
}: {
  equipes: string[];
  onSelecionar: (equipeId: string) => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(166,255,0,0.2)]">
        <Sprout size={28} />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">Qual é a sua equipe?</h1>
        <p className="mt-2 text-sm text-fg-muted">Escolha para ver a agenda de poda de hoje.</p>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-2.5">
        {equipes.map((equipeId) => (
          <button
            key={equipeId}
            onClick={() => onSelecionar(equipeId)}
            className="rounded-xl border border-border bg-bg-card px-5 py-3.5 text-base font-medium text-fg transition hover:border-primary/50 hover:bg-bg-card-raised hover:text-primary"
          >
            {formatarEquipe(equipeId)}
          </button>
        ))}
      </div>
    </div>
  );
}

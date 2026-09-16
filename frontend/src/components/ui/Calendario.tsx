import type { MesCalendario } from "../../lib/calendario";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function Calendario({ meses }: { meses: MesCalendario[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {meses.map((mes) => (
        <div key={mes.label} className="rounded-xl border border-border bg-bg-secondary p-3">
          <p className="mb-2 text-sm font-semibold text-fg">{mes.label}</p>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium uppercase text-fg-faint">
            {DIAS_SEMANA.map((dia) => (
              <span key={dia} className="py-1">
                {dia}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {mes.semanas.map((semana, indiceSemana) =>
              semana.map((dia, indiceDia) =>
                dia === null ? (
                  <div key={`${indiceSemana}-${indiceDia}`} />
                ) : (
                  <div
                    key={dia.iso}
                    className={`flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border text-xs font-medium ${
                      dia.totalLocais > 0
                        ? "border-danger/40 bg-danger/15 text-danger"
                        : "border-border bg-bg-card text-fg-muted"
                    }`}
                  >
                    <span>{Number(dia.iso.slice(8, 10))}</span>
                    {dia.totalLocais > 0 && (
                      <span className="font-mono-tabular text-[10px] leading-none">{dia.totalLocais}</span>
                    )}
                  </div>
                ),
              ),
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

import { PriorityTag } from "./PriorityTag";
import { diaDaSemana, formatarDiaMes, formatarEquipe } from "../lib/formato";
import type { AlocacaoPublicada, LocalAlocadoComStatus } from "../lib/types";

export function Agenda({
  dados,
  equipeId,
  pendente,
  onTrocarEquipe,
  onAlternarConclusao,
}: {
  dados: AlocacaoPublicada;
  equipeId: string;
  pendente: string | null;
  onTrocarEquipe: () => void;
  onAlternarConclusao: (dia: string, local: LocalAlocadoComStatus) => void;
}) {
  const dias = dados.alocacoes
    .filter((a) => a.equipeId === equipeId)
    .slice()
    .sort((a, b) => a.dia.localeCompare(b.dia));

  const totalLocais = dias.reduce((soma, d) => soma + d.locais.length, 0);
  const totalConcluidos = dias.reduce((soma, d) => soma + d.locais.filter((l) => l.concluido).length, 0);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">PrognosisHerba</p>
          <h1 className="mt-1 text-xl font-bold text-fg">{formatarEquipe(equipeId)}</h1>
        </div>
        <button
          onClick={onTrocarEquipe}
          className="text-xs font-medium text-fg-muted underline-offset-2 hover:text-primary hover:underline"
        >
          Trocar equipe
        </button>
      </header>

      <div className="mb-6 rounded-xl border border-border bg-bg-card px-4 py-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-fg-muted">Progresso</span>
          <span className="font-mono-tabular text-fg">
            {totalConcluidos}/{totalLocais}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: totalLocais === 0 ? "0%" : `${(totalConcluidos / totalLocais) * 100}%` }}
          />
        </div>
      </div>

      {dias.length === 0 ? (
        <p className="text-sm text-fg-muted">Nenhum local alocado para a sua equipe nesta alocação.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {dias.map((d) => (
            <section key={d.dia}>
              <h2 className="mb-2 text-sm font-semibold text-fg-muted">
                {formatarDiaMes(d.dia)} · {diaDaSemana(d.dia)}
              </h2>
              <div className="flex flex-col gap-2">
                {d.locais.map((local) => {
                  const chave = `${d.dia}__${local.localId}`;
                  return (
                    <label
                      key={local.localId}
                      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        local.concluido ? "border-success/30 bg-success/5" : "border-border bg-bg-card"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={local.concluido}
                        disabled={pendente === chave}
                        onChange={() => onAlternarConclusao(d.dia, local)}
                        className="h-5 w-5 shrink-0 accent-primary"
                      />
                      <span
                        className={`flex-1 text-sm font-medium ${
                          local.concluido ? "text-fg-muted line-through" : "text-fg"
                        }`}
                      >
                        {local.localId}
                      </span>
                      <PriorityTag prioridade={local.prioridade} />
                    </label>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import { DifficultyTag } from "./DifficultyTag";
import { PriorityTag } from "./PriorityTag";
import { diaDaSemana, ehHoje, formatarDiaMes, formatarEquipe } from "../lib/formato";
import { ordenarLocais } from "../lib/locais";
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
  const tudoConcluido = totalLocais > 0 && totalConcluidos === totalLocais;

  const secaoHojeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    secaoHojeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [equipeId, dados]);

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      <header
        className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 backdrop-blur-md"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1.5rem)" }}
      >
        <div className="flex items-center justify-between">
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
        </div>

        <div className="my-4 rounded-xl border border-border bg-bg-card px-4 py-3">
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
          {tudoConcluido && <p className="mt-2 text-xs font-medium text-success">Tudo concluído por aqui! 🌿</p>}
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        {dias.length === 0 ? (
          <p className="text-sm text-fg-muted">Nenhum local alocado para a sua equipe nesta alocação.</p>
        ) : (
          <div className="flex flex-col gap-6">
            {dias.map((d) => {
              const hoje = ehHoje(d.dia);
              const feitosDia = d.locais.filter((l) => l.concluido).length;
              return (
                <section key={d.dia} ref={hoje ? secaoHojeRef : undefined}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-semibold text-fg-muted">
                        {formatarDiaMes(d.dia)} · {diaDaSemana(d.dia)}
                      </h2>
                      {hoje && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          Hoje
                        </span>
                      )}
                    </div>
                    <span className="font-mono-tabular text-xs text-fg-faint">
                      {feitosDia}/{d.locais.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {ordenarLocais(d.locais).map((local) => {
                      const chave = `${d.dia}__${local.localId}`;
                      return (
                        <label
                          key={local.localId}
                          className={`flex flex-col gap-2 rounded-2xl border px-4 py-4 transition active:scale-[0.98] ${
                            local.concluido ? "border-success/30 bg-success/5" : "border-border bg-bg-card"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={local.concluido}
                              disabled={pendente === chave}
                              onChange={() => onAlternarConclusao(d.dia, local)}
                              className="h-6 w-6 shrink-0 accent-primary"
                            />
                            <span
                              className={`flex-1 text-sm font-medium ${
                                local.concluido ? "text-fg-muted line-through" : "text-fg"
                              }`}
                            >
                              {local.localId}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 pl-9">
                            <PriorityTag prioridade={local.prioridade} />
                            <DifficultyTag dificuldade={local.dificuldade} />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, CalendarDays } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { EstadoVazio } from "../components/ui/Estado";
import { Tag } from "../components/ui/Tag";
import { Button } from "../components/ui/Button";
import { useAlocacao } from "../state/AlocacaoContext";
import type { LocalAlocado } from "../lib/types";

const DIAS_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const CORES_PRIORIDADE: Record<string, string> = {
  alta: "border-danger/40 bg-danger/10 text-danger",
  media: "border-warning/40 bg-warning/10 text-warning",
  baixa: "border-success/40 bg-success/10 text-success",
};

const COR_PRIORIDADE_PADRAO = "border-primary/30 bg-primary/10 text-primary";

/** "2026-09-14" -> data local à meia-noite (evita o deslocamento de fuso do parse ISO puro). */
function parseData(iso: string) {
  return new Date(`${iso}T00:00:00`);
}

/** "2026-09-14" -> "14/09" */
function formatarDiaMes(iso: string) {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

function diaDaSemana(iso: string) {
  return DIAS_SEMANA[parseData(iso).getDay()];
}

/** Dias inteiros entre duas datas (positivo = `ate` vem depois de `de`). */
function diffEmDias(de: string, ate: string) {
  return Math.round((parseData(ate).getTime() - parseData(de).getTime()) / 86_400_000);
}

function pluralDias(quantidade: number) {
  return quantidade === 1 ? "dia" : "dias";
}

function textoFolga(folga: number) {
  if (folga > 0) return `${folga} ${pluralDias(folga)} de folga`;
  if (folga === 0) return "no limite";
  const dias = -folga;
  return `${dias} ${pluralDias(dias)} atrasado`;
}

/** "equipe_4" -> "Equipe 4" */
function formatarEquipe(equipeId: string) {
  const legivel = equipeId.replace(/_/g, " ");
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

export function Cronograma() {
  const { resultado } = useAlocacao();

  const grade = useMemo(() => {
    if (!resultado) return { equipes: [], dias: [], totalLocais: 0, porEquipeDia: new Map<string, LocalAlocado[]>() };
    const equipes = Array.from(new Set(resultado.alocacoes.map((a) => a.equipeId))).sort();
    const dias = Array.from(new Set(resultado.alocacoes.map((a) => a.dia))).sort();
    const porEquipeDia = new Map(resultado.alocacoes.map((a) => [`${a.equipeId}__${a.dia}`, a.locais]));
    const totalLocais = resultado.alocacoes.reduce((soma, a) => soma + a.locais.length, 0);
    return { equipes, dias, porEquipeDia, totalLocais };
  }, [resultado]);

  /** localId -> data-limite da poda (semana em que a previsão cruza o limiar). */
  const dataLimitePorLocal = useMemo(
    () => new Map((resultado?.locaisDerivados ?? []).map((loc) => [loc.id, loc.dataAlvo])),
    [resultado],
  );

  if (!resultado) {
    return (
      <div>
        <PageHeader title="Cronograma" subtitle="Grade de alocação equipe × dia" />
        <EstadoVazio
          icon={<CalendarDays size={22} />}
          mensagem="Nenhuma alocação foi gerada ainda. Vá até Otimização e rode o solver a partir das previsões da IA."
          acao={
            <Link to="/otimizacao">
              <Button>Ir para Otimização</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const resumo = [
    `${grade.totalLocais} ${grade.totalLocais === 1 ? "local" : "locais"}`,
    `${grade.equipes.length} ${grade.equipes.length === 1 ? "equipe" : "equipes"}`,
    `${grade.dias.length} ${grade.dias.length === 1 ? "dia útil" : "dias úteis"}`,
  ].join(" · ");

  return (
    <div>
      <PageHeader
        title="Cronograma"
        subtitle={`Período: ${resultado.periodo.inicio} a ${resultado.periodo.fim}`}
      />

      <Card className="mb-4">
        <CardHeader title="Grade de alocação" subtitle={`Equipe × dia útil — ${resumo}`} />

        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-bg-card-raised text-xs tracking-wide text-fg-muted uppercase">
                <th className="sticky left-0 z-20 border-b border-border bg-bg-card-raised px-4 py-3 font-semibold">
                  Equipe
                </th>
                {grade.dias.map((dia) => (
                  <th
                    key={dia}
                    className="border-b border-l border-border px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    <span className="block text-sm text-fg">{formatarDiaMes(dia)}</span>
                    <span className="block text-[11px] font-normal text-fg-faint">{diaDaSemana(dia)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grade.equipes.map((equipe) => (
                <tr key={equipe} className="group align-top transition-colors hover:bg-white/[0.02]">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-b border-border bg-bg-card px-4 py-3 text-left font-medium text-fg whitespace-nowrap transition-colors group-hover:bg-bg-card-raised"
                  >
                    {formatarEquipe(equipe)}
                  </th>
                  {grade.dias.map((dia) => {
                    const locais = grade.porEquipeDia.get(`${equipe}__${dia}`) ?? [];
                    return (
                      <td key={dia} className="border-b border-l border-border px-3 py-3">
                        {locais.length === 0 ? (
                          <span className="text-fg-faint">—</span>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {locais.map((loc) => {
                              const dataLimite = dataLimitePorLocal.get(loc.localId);
                              const folga = dataLimite ? diffEmDias(dia, dataLimite) : null;
                              const atrasado = folga !== null && folga < 0;
                              return (
                                <div
                                  key={loc.localId}
                                  className={`rounded-lg border px-2.5 py-1.5 ${
                                    CORES_PRIORIDADE[loc.prioridade] ?? COR_PRIORIDADE_PADRAO
                                  }`}
                                >
                                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                    <span className="font-semibold">{loc.localId}</span>
                                  </div>
                                  {dataLimite && (
                                    <div
                                      className={`mt-1 flex items-center gap-1 text-[11px] whitespace-nowrap ${
                                        atrasado ? "text-danger" : "text-fg-muted"
                                      }`}
                                    >
                                      <CalendarClock size={11} className="shrink-0" />
                                      <span className="font-mono-tabular">até {formatarDiaMes(dataLimite)}</span>
                                      {folga !== null && (
                                        <span className={atrasado ? "" : "text-fg-faint"}>
                                          · {textoFolga(folga)}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-xs text-fg-faint">
          <span className="text-fg-muted">até dd/mm</span> = data-limite da poda: semana em que a previsão da IA
          indica que a vegetação atinge o limiar. A folga compara essa data com o dia agendado.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Não alocados"
          subtitle="Locais que ficaram de fora por falta de capacidade no período"
        />
        {resultado.naoAlocados.length === 0 ? (
          <p className="text-sm text-fg-muted">Todos os locais derivados da previsão foram alocados.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.naoAlocados.map((loc) => {
              const dataLimite = dataLimitePorLocal.get(loc.localId);
              return (
                <li
                  key={loc.localId}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border pt-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-fg">{loc.localId}</span>
                    {dataLimite && (
                      <span className="flex items-center gap-1 text-xs text-danger">
                        <CalendarClock size={12} className="shrink-0" />
                        <span className="font-mono-tabular">poda até {formatarDiaMes(dataLimite)}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Tag nivel={loc.prioridade} />
                    <span className="text-fg-muted capitalize">{loc.dificuldade}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

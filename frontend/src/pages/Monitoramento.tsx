import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { StatusTag } from "../components/ui/Tag";
import { Button } from "../components/ui/Button";
import { getAlocacaoAtual, ApiError } from "../lib/api";
import type { AlocacaoDiaComStatus, AlocacaoPublicada } from "../lib/types";

const INTERVALO_ATUALIZACAO_MS = 8000;

/** "equipe_4" -> "Equipe 4" */
function formatarEquipe(equipeId: string) {
  const legivel = equipeId.replace(/_/g, " ");
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

function agruparPorEquipe(alocacoes: AlocacaoDiaComStatus[]) {
  const mapa = new Map<string, AlocacaoDiaComStatus[]>();
  for (const aloc of alocacoes) {
    const lista = mapa.get(aloc.equipeId) ?? [];
    lista.push(aloc);
    mapa.set(aloc.equipeId, lista);
  }
  return Array.from(mapa.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([equipeId, dias]) => ({
      equipeId,
      dias: dias.slice().sort((a, b) => a.dia.localeCompare(b.dia)),
    }));
}

export function Monitoramento() {
  const [dados, setDados] = useState<AlocacaoPublicada | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const atual = await getAlocacaoAtual();
      setDados(atual);
      setErro(null);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Erro ao carregar o monitoramento.");
    } finally {
      setCarregando(false);
      setAtualizadoEm(new Date());
    }
  }, []);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const porEquipe = useMemo(() => (dados ? agruparPorEquipe(dados.alocacoes) : []), [dados]);

  const progresso = useMemo(() => {
    if (!dados) return { total: 0, concluidos: 0 };
    let total = 0;
    let concluidos = 0;
    for (const aloc of dados.alocacoes) {
      for (const local of aloc.locais) {
        total += 1;
        if (local.concluido) concluidos += 1;
      }
    }
    return { total, concluidos };
  }, [dados]);

  const porcentagem = progresso.total === 0 ? 0 : Math.round((progresso.concluidos / progresso.total) * 100);

  return (
    <div>
      <PageHeader
        title="Monitoramento"
        subtitle="Acompanha, em tempo real, quais locais as equipes já marcaram como concluídos"
        action={
          <Button variant="secondary" onClick={carregar} disabled={carregando}>
            <RefreshCw size={14} className={carregando ? "animate-spin" : ""} />
            Atualizar agora
          </Button>
        }
      />

      {erro && (
        <Card className="mb-4">
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      )}

      {!dados ? (
        !erro && (
          <Card>
            <p className="text-sm text-fg-muted">
              Nenhuma alocação foi publicada ainda. Rode a Otimização para começar a monitorar.
            </p>
          </Card>
        )
      ) : (
        <>
          <Card className="mb-4">
            <CardHeader
              title="Progresso geral"
              subtitle={`Publicado em ${formatarDataHora(dados.publicadoEm)} · Período: ${dados.periodo.inicio} a ${dados.periodo.fim}`}
            />
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-muted">
                {progresso.concluidos} de {progresso.total} locais concluídos
              </span>
              <span className="font-mono-tabular text-fg">{porcentagem}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${porcentagem}%` }}
              />
            </div>
            {atualizadoEm && (
              <p className="mt-3 text-xs text-fg-faint">Atualizado às {atualizadoEm.toLocaleTimeString("pt-BR")}</p>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {porEquipe.map(({ equipeId, dias }) => (
              <Card key={equipeId}>
                <CardHeader title={formatarEquipe(equipeId)} />
                <div className="space-y-3">
                  {dias.map((aloc) => (
                    <div key={aloc.dia}>
                      <p className="mb-1.5 font-mono-tabular text-xs text-fg-faint">{aloc.dia}</p>
                      <ul className="space-y-1.5">
                        {aloc.locais.map((local) => (
                          <li
                            key={local.localId}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-1.5 text-sm"
                          >
                            <span className="text-fg">{local.localId}</span>
                            <StatusTag status={local.concluido ? "Concluído" : "Pendente"} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

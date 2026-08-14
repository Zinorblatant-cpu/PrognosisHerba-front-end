import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Tag } from "../components/ui/Tag";
import { Button } from "../components/ui/Button";
import { useAlocacao } from "../state/AlocacaoContext";

export function Cronograma() {
  const { resultado } = useAlocacao();

  const grade = useMemo(() => {
    if (!resultado) return { equipes: [], dias: [] };
    const equipes = Array.from(new Set(resultado.alocacoes.map((a) => a.equipeId))).sort();
    const dias = Array.from(new Set(resultado.alocacoes.map((a) => a.dia))).sort();
    const porEquipeDia = new Map(resultado.alocacoes.map((a) => [`${a.equipeId}__${a.dia}`, a.locais]));
    return { equipes, dias, porEquipeDia };
  }, [resultado]);

  if (!resultado) {
    return (
      <div>
        <PageHeader title="Cronograma" subtitle="Grade de alocação equipe × dia" />
        <Card>
          <p className="mb-4 text-sm text-fg-muted">
            Nenhuma alocação foi gerada ainda. Vá até Otimização e rode o solver a partir das previsões da IA.
          </p>
          <Link to="/otimizacao">
            <Button>Ir para Otimização</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Cronograma"
        subtitle={`Mês de referência: ${String(resultado.mesReferencia.mes).padStart(2, "0")}/${resultado.mesReferencia.ano}`}
      />

      <Card className="mb-4 overflow-x-auto">
        <CardHeader title="Grade de alocação" subtitle="Equipe × dia útil" />
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="text-xs text-fg-muted">
              <th className="pb-2 pr-4 font-normal">Equipe</th>
              {grade.dias.map((dia) => (
                <th key={dia} className="pb-2 pr-4 font-normal whitespace-nowrap">
                  {dia.slice(5)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grade.equipes.map((equipe) => (
              <tr key={equipe} className="border-t border-border align-top">
                <td className="py-2 pr-4 font-medium text-fg whitespace-nowrap">{equipe}</td>
                {grade.dias.map((dia) => {
                  const locais = grade.porEquipeDia?.get(`${equipe}__${dia}`) ?? [];
                  return (
                    <td key={dia} className="py-2 pr-4">
                      <div className="flex flex-col gap-1">
                        {locais.map((loc) => (
                          <span
                            key={loc.localId}
                            className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs text-primary whitespace-nowrap"
                          >
                            {loc.localId}
                          </span>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader
          title="Não alocados"
          subtitle="Locais que ficaram de fora por falta de capacidade no mês"
        />
        {resultado.naoAlocados.length === 0 ? (
          <p className="text-sm text-fg-muted">Todos os locais derivados da previsão foram alocados.</p>
        ) : (
          <ul className="space-y-2">
            {resultado.naoAlocados.map((loc) => (
              <li key={loc.localId} className="flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-fg">{loc.localId}</span>
                <div className="flex gap-2">
                  <Tag nivel={loc.prioridade} />
                  <span className="text-fg-muted capitalize">{loc.dificuldade}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

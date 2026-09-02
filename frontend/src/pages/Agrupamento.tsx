import { useEffect, useState } from "react";
import { Network, TriangleAlert, TrendingUp, Route } from "lucide-react";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "../components/ui/Estado";
import { Tag } from "../components/ui/Tag";
import { getClusterizacao, ApiError } from "../lib/api";
import type { Clusterizacao as AgrupamentoDados } from "../lib/types";

/** Rótulo do cluster → nível de cor do `Tag` (mesma paleta de prioridade). */
const NIVEL_POR_ROTULO: Record<string, string> = {
  "acima do limiar": "alto",
  crítico: "alto",
  atenção: "medio",
  estável: "baixo",
};

function formatarTendencia(cmPorSemana: number) {
  return `${cmPorSemana >= 0 ? "+" : ""}${cmPorSemana.toFixed(2)} cm/sem`;
}

export function Agrupamento() {
  const [dados, setDados] = useState<AgrupamentoDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    getClusterizacao()
      .then(setDados)
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Erro ao carregar o agrupamento."));
  }, []);

  if (erro) {
    return (
      <div>
        <PageHeader title="Agrupamento de regiões" subtitle="Regiões com perfil de crescimento parecido" />
        <EstadoErro mensagem={erro} />
      </div>
    );
  }

  if (!dados) {
    return (
      <div>
        <PageHeader title="Agrupamento de regiões" subtitle="Regiões com perfil de crescimento parecido" />
        <EstadoCarregando mensagem="Carregando agrupamento..." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Agrupamento de regiões"
        subtitle="Regiões juntadas por rota, altura atual e ritmo de crescimento"
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <p>{dados.avisoRota}</p>
      </div>

      {dados.clusters.length === 0 ? (
        <EstadoVazio
          icon={<Network size={22} />}
          mensagem="Não há regiões suficientes nas previsões para formar grupos."
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {dados.clusters.map((cluster) => (
              <Card key={cluster.clusterId}>
                <CardHeader
                  title={`Grupo ${cluster.clusterId + 1}`}
                  subtitle={`${cluster.regioes.length} ${cluster.regioes.length === 1 ? "região" : "regiões"}`}
                  action={<Tag nivel={NIVEL_POR_ROTULO[cluster.rotulo] ?? "Informativo"} label={cluster.rotulo} />}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2">
                    <p className="text-xs text-fg-muted">Altura média</p>
                    <p className="font-mono-tabular mt-0.5 text-lg text-fg">
                      {cluster.alturaMediaCm.toFixed(2)} cm
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-bg-secondary px-3 py-2">
                    <p className="text-xs text-fg-muted">Tendência média</p>
                    <p className="font-mono-tabular mt-0.5 text-lg text-primary">
                      {formatarTendencia(cluster.tendenciaMediaCmPorSemana)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {cluster.regioes.map((idRegiao) => (
                    <span
                      key={idRegiao}
                      className="rounded-md border border-border bg-bg-card-raised px-2 py-0.5 font-mono-tabular text-xs text-fg-muted"
                    >
                      {idRegiao}
                    </span>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-fg-faint">
                  <Route size={12} className="shrink-0" />
                  {cluster.rotas.join(" · ")}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader
              title="Indicadores por região"
              subtitle="Tendência medida dentro do ciclo de crescimento corrente (desde a última poda)"
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="text-xs text-fg-muted">
                    <th className="pb-2 font-normal">Região</th>
                    <th className="pb-2 font-normal">Rota</th>
                    <th className="pb-2 font-normal">Altura atual</th>
                    <th className="pb-2 font-normal">Tendência</th>
                    <th className="pb-2 font-normal">Desde a última poda</th>
                    <th className="pb-2 font-normal">Grupo</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.regioes.map((regiao) => (
                    <tr
                      key={regiao.idRegiao}
                      className="border-t border-border transition-colors hover:bg-white/[0.02]"
                    >
                      <td className="py-2 text-fg">{regiao.idRegiao}</td>
                      <td className="py-2 text-fg-muted">
                        <span className="flex items-center gap-1.5">
                          {regiao.rota}
                          {regiao.rotaSimulada && (
                            <span className="rounded border border-warning/30 px-1 text-[10px] text-warning">
                              simulada
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="font-mono-tabular py-2 text-fg-muted">
                        {regiao.alturaAtualCm.toFixed(2)} cm
                      </td>
                      <td className="font-mono-tabular py-2 text-primary">
                        <span className="flex items-center gap-1.5">
                          <TrendingUp size={13} className="shrink-0" />
                          {formatarTendencia(regiao.tendenciaCmPorSemana)}
                        </span>
                      </td>
                      <td className="font-mono-tabular py-2 text-fg-muted">
                        {regiao.semanasDesdeUltimaPoda}{" "}
                        {regiao.semanasDesdeUltimaPoda === 1 ? "semana" : "semanas"}
                      </td>
                      <td className="py-2 text-fg-muted">Grupo {regiao.clusterId + 1}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

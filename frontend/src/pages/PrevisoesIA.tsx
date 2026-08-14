import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "../components/layout/AppShell";
import { Card, CardHeader } from "../components/ui/Card";
import { Tag } from "../components/ui/Tag";
import { getPrevisoes } from "../lib/api";
import { ApiError } from "../lib/api";
import type { PrevisaoRegiao } from "../lib/types";

const LIMIAR_PODA_CM = 10;

export function PrevisoesIA() {
  const [previsoes, setPrevisoes] = useState<PrevisaoRegiao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [regiaoSelecionada, setRegiaoSelecionada] = useState<string | null>(null);

  useEffect(() => {
    getPrevisoes()
      .then((dados) => {
        setPrevisoes(dados);
        setRegiaoSelecionada(dados[0]?.idRegiao ?? null);
      })
      .catch((e) => setErro(e instanceof ApiError ? e.message : "Erro ao carregar previsões."));
  }, []);

  const regiao = useMemo(
    () => previsoes?.find((r) => r.idRegiao === regiaoSelecionada) ?? null,
    [previsoes, regiaoSelecionada],
  );

  const dadosGrafico = useMemo(
    () =>
      regiao?.semanas.map((s) => ({
        data: s.data.slice(5),
        altura: s.alturaPrevistaCm,
        nivelAlerta: s.nivelAlerta,
      })) ?? [],
    [regiao],
  );

  if (erro) {
    return (
      <div>
        <PageHeader title="Previsões IA" subtitle="Crescimento previsto para as próximas 12 semanas, por região" />
        <Card>
          <p className="text-sm text-danger">{erro}</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Previsões IA" subtitle="Crescimento previsto para as próximas 12 semanas, por região" />

      {!previsoes ? (
        <Card>
          <p className="text-sm text-fg-muted">Carregando previsões...</p>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {previsoes.map((r) => (
              <button
                key={r.idRegiao}
                onClick={() => setRegiaoSelecionada(r.idRegiao)}
                className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                  r.idRegiao === regiaoSelecionada
                    ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(166,255,0,0.15)]"
                    : "border-border bg-bg-card text-fg-muted hover:border-border-strong hover:text-fg"
                }`}
              >
                {r.idRegiao}
              </button>
            ))}
          </div>

          {regiao && (
            <div className="grid grid-cols-3 gap-4">
              <Card className="col-span-2">
                <CardHeader
                  title={`Altura prevista — ${regiao.idRegiao}`}
                  subtitle={`Inclinação do terreno: ${regiao.inclinacaoGraus}° · Área de risco: ${regiao.areaDeRisco}`}
                />
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dadosGrafico} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="alturaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a6ff00" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#a6ff00" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1c1c1c" vertical={false} />
                    <XAxis
                      dataKey="data"
                      stroke="#6b7280"
                      fontSize={12}
                      fontFamily="JetBrains Mono, monospace"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="#6b7280"
                      fontSize={12}
                      fontFamily="JetBrains Mono, monospace"
                      tickLine={false}
                      axisLine={false}
                      unit="cm"
                    />
                    <Tooltip
                      contentStyle={{
                        background: "#101010",
                        border: "1px solid #343434",
                        borderRadius: 10,
                        fontSize: 12,
                        boxShadow: "0 12px 24px -12px rgba(0,0,0,0.7)",
                      }}
                      labelStyle={{ color: "#f5f5f5", fontFamily: "JetBrains Mono, monospace" }}
                      itemStyle={{ color: "#a6ff00" }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12, color: "#9ca3af" }} />
                    <ReferenceLine
                      y={LIMIAR_PODA_CM}
                      stroke="#ff4d4f"
                      strokeDasharray="4 4"
                      label={{
                        value: `Limiar de poda (${LIMIAR_PODA_CM}cm)`,
                        position: "insideTopLeft",
                        fill: "#ff4d4f",
                        fontSize: 11,
                        fontFamily: "JetBrains Mono, monospace",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="altura"
                      name="Altura prevista (cm)"
                      stroke="#a6ff00"
                      strokeWidth={2.5}
                      fill="url(#alturaFill)"
                      dot={{ r: 3, fill: "#a6ff00", strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: "#a6ff00", stroke: "#050505", strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Card>

              <Card>
                <CardHeader title="Semana a semana" />
                <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {regiao.semanas.map((s) => (
                    <div
                      key={s.data}
                      className="flex items-center justify-between rounded-lg border border-border bg-bg-secondary px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-mono-tabular text-fg">{s.data}</p>
                        <p className="font-mono-tabular text-xs text-fg-muted">{s.alturaPrevistaCm.toFixed(2)} cm</p>
                      </div>
                      <Tag nivel={s.nivelAlerta} />
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

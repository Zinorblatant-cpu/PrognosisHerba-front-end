import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  SlidersHorizontal,
  CalendarDays,
  ArrowRight,
  MapPin,
  Users,
  TriangleAlert,
} from "lucide-react";
import { KpiCard } from "../components/ui/KpiCard";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { useAlocacao } from "../state/AlocacaoContext";

const FUNCOES = [
  {
    to: "/previsoes",
    icon: TrendingUp,
    numero: "01",
    title: "Previsões IA",
    description: "Crescimento previsto para as próximas 12 semanas, por região, com alerta de limiar de poda.",
  },
  {
    to: "/otimizacao",
    icon: SlidersHorizontal,
    numero: "02",
    title: "Otimização",
    description: "Gera a alocação ótima de equipes de poda a partir das previsões, via solver PuLP.",
  },
  {
    to: "/cronograma",
    icon: CalendarDays,
    numero: "03",
    title: "Cronograma",
    description: "Visualiza a grade de alocação equipe × dia produzida pela otimização.",
  },
];

export function Home() {
  const { resultado } = useAlocacao();

  const status = useMemo(() => {
    if (!resultado) return null;
    const equipes = new Set(resultado.alocacoes.map((a) => a.equipeId));
    const dias = new Set(resultado.alocacoes.map((a) => a.dia));
    const totalLocais = resultado.alocacoes.reduce((soma, a) => soma + a.locais.length, 0);
    return {
      totalLocais,
      totalEquipes: equipes.size,
      totalDias: dias.size,
      naoAlocados: resultado.naoAlocados.length,
      mesReferencia: resultado.mesReferencia,
    };
  }, [resultado]);

  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-12 py-10 text-center">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">PrognosisHerba</p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-fg">O que você quer fazer?</h1>
        <p className="mt-2.5 text-sm text-fg-muted">Escolha uma das três etapas do fluxo de manejo de poda.</p>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-5 text-left sm:grid-cols-3">
        {FUNCOES.map(({ to, icon: Icon, numero, title, description }) => (
          <Link
            key={to}
            to={to}
            className="group flex flex-col rounded-2xl border border-border bg-bg-card p-6 transition hover:border-primary/40 hover:bg-bg-card-raised hover:shadow-[0_0_0_1px_rgba(166,255,0,0.15),0_16px_32px_-16px_rgba(0,0,0,0.7)]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon size={22} />
              </div>
              <span className="font-mono-tabular text-xs text-fg-faint">{numero}</span>
            </div>
            <h2 className="mt-5 text-lg font-semibold text-fg">{title}</h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-fg-muted">{description}</p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-70 transition group-hover:gap-2.5 group-hover:opacity-100">
              Abrir <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>

      <div className="w-full max-w-4xl text-left">
        <Card>
          <CardHeader
            title="Status ao vivo"
            subtitle={
              status
                ? `Mês de referência: ${String(status.mesReferencia.mes).padStart(2, "0")}/${status.mesReferencia.ano}`
                : "Nenhuma alocação foi gerada nesta sessão ainda"
            }
          />

          {!status ? (
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-fg-muted">
                Rode a Otimização a partir das previsões da IA para ver aqui a última alocação gerada.
              </p>
              <Link to="/otimizacao">
                <Button variant="secondary">Ir para Otimização</Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <KpiCard label="Locais alocados" value={String(status.totalLocais)} icon={<MapPin size={20} />} />
                <KpiCard label="Equipes em campo" value={String(status.totalEquipes)} icon={<Users size={20} />} />
                <KpiCard label="Dias úteis" value={String(status.totalDias)} icon={<CalendarDays size={20} />} />
                <KpiCard
                  label="Não alocados"
                  value={String(status.naoAlocados)}
                  icon={<TriangleAlert size={20} />}
                />
              </div>
              <Link to="/cronograma" className="mt-4 inline-block">
                <Button variant="secondary">Ver cronograma completo →</Button>
              </Link>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

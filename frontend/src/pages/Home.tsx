import { Link } from "react-router-dom";
import { TrendingUp, SlidersHorizontal, CalendarDays, ArrowRight } from "lucide-react";

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
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col items-center justify-center gap-12 text-center">
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
    </div>
  );
}

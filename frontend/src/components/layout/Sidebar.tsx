import { NavLink } from "react-router-dom";
import {
  TrendingUp,
  SlidersHorizontal,
  CalendarDays,
  LayoutGrid,
  Sprout,
  MonitorCheck,
  Network,
  Camera,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: LayoutGrid, end: true },
  { to: "/previsoes", label: "Previsões IA", icon: TrendingUp },
  { to: "/otimizacao", label: "Otimização", icon: SlidersHorizontal },
  { to: "/cronograma", label: "Cronograma", icon: CalendarDays },
  { to: "/agrupamento", label: "Agrupamento", icon: Network },
  { to: "/monitoramento", label: "Monitoramento", icon: MonitorCheck },
  { to: "/analise-grama", label: "Análise de grama", icon: Camera },
];

/**
 * Abaixo de `lg` a sidebar vira uma gaveta off-canvas controlada por `aberta`
 * (o AppShell desenha o backdrop e o botão de menu); de `lg` para cima ela
 * volta a ser a coluna fixa de sempre.
 */
export function Sidebar({ aberta = false, aoNavegar }: { aberta?: boolean; aoNavegar?: () => void }) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-bg px-4 py-6 transition-transform duration-200 ease-out lg:static lg:z-auto lg:h-screen lg:translate-x-0 lg:overflow-visible lg:transition-none ${
        aberta ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(166,255,0,0.2)]">
          <Sprout size={19} />
        </div>
        <div className="leading-tight">
          <span className="block text-base font-bold text-fg">
            Prognosis<span className="text-primary">Herba</span>
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-fg-faint">Manejo de poda</span>
        </div>
        <button
          type="button"
          onClick={aoNavegar}
          aria-label="Fechar menu"
          className="ml-auto -mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-muted transition hover:bg-bg-card hover:text-fg lg:hidden"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={aoNavegar}
            className={({ isActive }) =>
              `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-fg-muted hover:bg-bg-card hover:text-fg"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${
                    isActive ? "opacity-100" : "opacity-0"
                  }`}
                />
                <Icon size={18} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 rounded-lg border border-border bg-bg-card px-3 py-2.5 text-[11px] text-fg-faint">
        Previsões · Otimização · Cronograma
      </div>
    </aside>
  );
}

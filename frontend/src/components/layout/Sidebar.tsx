import { NavLink } from "react-router-dom";
import {
  TrendingUp,
  SlidersHorizontal,
  CalendarDays,
  LayoutGrid,
  Sprout,
  MonitorCheck,
  Network,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Início", icon: LayoutGrid, end: true },
  { to: "/previsoes", label: "Previsões IA", icon: TrendingUp },
  { to: "/otimizacao", label: "Otimização", icon: SlidersHorizontal },
  { to: "/cronograma", label: "Cronograma", icon: CalendarDays },
  { to: "/agrupamento", label: "Agrupamento", icon: Network },
  { to: "/monitoramento", label: "Monitoramento", icon: MonitorCheck },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-52 shrink-0 flex-col border-r border-border bg-bg px-3 py-6 lg:w-64 lg:px-4">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-[0_0_0_1px_rgba(166,255,0,0.2)]">
          <Sprout size={19} />
        </div>
        <div className="leading-tight">
          <span className="block text-base font-bold text-fg">
            Prognosis<span className="text-primary">Herba</span>
          </span>
          <span className="block text-[11px] font-medium uppercase tracking-wider text-fg-faint">Manejo de poda</span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
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

      <div className="rounded-lg border border-border bg-bg-card px-3 py-2.5 text-[11px] text-fg-faint">
        Previsões · Otimização · Cronograma
      </div>
    </aside>
  );
}

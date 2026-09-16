import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Menu, Sprout } from "lucide-react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const [menuAberto, setMenuAberto] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuAberto(false);
  }, [pathname]);

  return (
    <div className="flex h-screen bg-bg">
      <Sidebar open={menuAberto} onClose={() => setMenuAberto(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header
          className="flex items-center gap-3 border-b border-border px-4 pb-3 md:hidden"
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        >
          <button
            type="button"
            onClick={() => setMenuAberto(true)}
            aria-label="Abrir menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-fg-muted hover:text-fg"
          >
            <Menu size={18} />
          </button>
          <span className="flex items-center gap-1.5 text-sm font-bold text-fg">
            <Sprout size={16} className="text-primary" />
            Prognosis<span className="text-primary">Herba</span>
          </span>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-5 md:px-8 md:py-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

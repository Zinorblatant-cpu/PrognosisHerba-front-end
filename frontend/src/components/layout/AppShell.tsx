import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen bg-bg">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border pb-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-fg sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

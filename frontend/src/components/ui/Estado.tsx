import type { ReactNode } from "react";
import { Loader2, TriangleAlert, Inbox } from "lucide-react";
import { Card } from "./Card";

/**
 * Estados de carregamento / erro / vazio das páginas. Antes cada página
 * repetia um `<Card><p className="text-sm text-fg-muted">...</p></Card>`
 * com um texto solto — mesma ideia, três aparências diferentes.
 */

export function EstadoCarregando({ mensagem }: { mensagem: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3 py-2 text-sm text-fg-muted">
        <Loader2 size={18} className="shrink-0 animate-spin text-primary" />
        {mensagem}
      </div>
    </Card>
  );
}

export function EstadoErro({ mensagem, className = "" }: { mensagem: string; className?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start gap-3 py-2 text-sm text-danger">
        <TriangleAlert size={18} className="mt-0.5 shrink-0" />
        <p>{mensagem}</p>
      </div>
    </Card>
  );
}

export function EstadoVazio({
  mensagem,
  acao,
  icon,
}: {
  mensagem: string;
  acao?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-bg-secondary text-fg-faint">
          {icon ?? <Inbox size={22} />}
        </div>
        <p className="max-w-md text-sm leading-relaxed text-fg-muted">{mensagem}</p>
        {acao}
      </div>
    </Card>
  );
}

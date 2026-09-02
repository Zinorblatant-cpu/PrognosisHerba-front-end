import type { ReactNode } from "react";
import { Card } from "./Card";

export function KpiCard({
  label,
  value,
  delta,
  deltaLabel,
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between transition-colors hover:border-border-strong">
      <div>
        <p className="text-sm text-fg-muted">{label}</p>
        <p className="font-mono-tabular mt-2 text-3xl font-bold text-fg">{value}</p>
        {delta && (
          <p className="mt-2 text-xs text-primary">
            <span className="mr-1">▲</span>
            {delta} <span className="text-fg-muted">{deltaLabel}</span>
          </p>
        )}
      </div>
      {icon && <div className="text-primary">{icon}</div>}
    </Card>
  );
}

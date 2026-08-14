import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
  const variants: Record<Variant, string> = {
    primary:
      "bg-primary text-bg shadow-[0_0_0_1px_rgba(166,255,0,0.25),0_6px_16px_-6px_rgba(166,255,0,0.4)] hover:shadow-[0_0_0_1px_rgba(166,255,0,0.4),0_0_24px_0_rgba(166,255,0,0.45)]",
    secondary: "border border-border text-fg hover:border-primary/60 hover:text-primary hover:bg-primary/5",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

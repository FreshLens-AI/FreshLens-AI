import type { ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "brand";

export function Badge({
  children,
  dot = true,
  tone = "neutral",
}: {
  children: ReactNode;
  dot?: boolean;
  tone?: BadgeTone;
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot ? <span className="badge__dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

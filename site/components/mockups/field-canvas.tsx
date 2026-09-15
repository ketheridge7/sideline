import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FieldCanvas({
  className,
  children,
  dim = false,
}: {
  className?: string;
  children?: ReactNode;
  dim?: boolean;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-[#0c2418]", className)}>
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, rgba(56,140,72,0.78) 0%, rgba(18,64,36,0.88) 52%, #07080a 100%),
            repeating-linear-gradient(
              90deg,
              rgba(255,255,255,0.08) 0px,
              rgba(255,255,255,0.08) 1px,
              transparent 1px,
              transparent 9.09%
            )
          `,
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-[12%_18%] rounded-[2px] border border-white/10"
        aria-hidden="true"
      />
      <div className="absolute inset-y-[12%] left-1/2 w-px bg-white/15" aria-hidden="true" />
      <div
        className="absolute left-1/2 top-1/2 h-[22%] w-[14%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15"
        aria-hidden="true"
      />
      <PlayerMarks />
      {dim ? <div className="absolute inset-0 z-[1] bg-bg/25" aria-hidden="true" /> : null}
      <div className="absolute inset-0 z-10">{children}</div>
    </div>
  );
}

function PlayerMarks() {
  const spots = [
    { x: "28%", y: "42%" },
    { x: "34%", y: "58%" },
    { x: "40%", y: "36%" },
    { x: "46%", y: "62%" },
    { x: "54%", y: "40%" },
    { x: "61%", y: "55%" },
    { x: "68%", y: "38%" },
    { x: "72%", y: "60%" },
  ];
  return (
    <div className="absolute inset-0" aria-hidden="true">
      {spots.map((spot) => (
        <span
          key={`${spot.x}-${spot.y}`}
          className="absolute h-2.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/55 shadow-[0_0_8px_rgba(0,0,0,0.45)]"
          style={{ left: spot.x, top: spot.y }}
        />
      ))}
    </div>
  );
}

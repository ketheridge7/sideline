import Image from "next/image";
import { WORDMARK_TEXT } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * Same lock as the desktop companion: broadcast S v2 plus ice SIDELINE.
 * Mark file matches `src/renderer/assets/broadcast-s.svg`.
 */
export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const mark = compact ? 28 : 36;
  return (
    <span className={cn("flex items-center gap-2", className)} data-wordmark="sideline" data-mark="broadcast-s">
      <Image
        src="/broadcast-s.svg"
        alt=""
        width={mark}
        height={mark}
        aria-hidden="true"
        className="shrink-0"
        style={{ width: mark, height: mark }}
      />
      <span
        className="font-cond font-extrabold uppercase leading-none"
        style={{ color: "#f4f7f2", letterSpacing: "0.11em", fontSize: compact ? 20 : 24 }}
      >
        {WORDMARK_TEXT}
      </span>
    </span>
  );
}

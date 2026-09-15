import Image from "next/image";
import { WORDMARK_ASPECT } from "@/lib/brand";
import { cn } from "@/lib/cn";

/**
 * Kevin-confirmed lock: the packaging lime-stripe icon is the only Sideline logo.
 * Nav/footer render the official wordmark (that mark + SIDELINE + mint→lime underline).
 * Favicon uses `public/icon.png` / `icon.svg`. Do not substitute a hexagon S, dual-bar S,
 * or any invented mark.
 */
export function BrandMark({
  compact = false,
  className,
  priority = false,
}: {
  compact?: boolean;
  className?: string;
  priority?: boolean;
}) {
  const height = compact ? 28 : 36;
  const width = Math.round(height * WORDMARK_ASPECT);
  return (
    <Image
      src="/wordmark.png"
      alt="Sideline"
      width={width}
      height={height}
      className={cn("block", className)}
      priority={priority}
    />
  );
}

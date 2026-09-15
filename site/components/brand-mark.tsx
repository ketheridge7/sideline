import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Official packaging mark only: mint→lime left stripe + geometric white S
 * on near-black squircle. Wordmark is that mark + SIDELINE with a lime underline.
 * Do not substitute hexagon S, dual-bar S, or sportsbook gold.
 */
export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  const size = compact ? 28 : 36;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/icon.png"
        alt=""
        width={size}
        height={size}
        className="rounded-[22%]"
        priority
      />
      <span className="relative pb-1">
        <span className="font-cond text-xl font-extrabold uppercase tracking-[0.16em] text-text sm:text-[1.35rem]">
          Sideline
        </span>
        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-lime" aria-hidden="true" />
      </span>
    </span>
  );
}

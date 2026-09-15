import Image from "next/image";
import { cn } from "@/lib/cn";

export function BrandMark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/icon.png"
        alt=""
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className="rounded-[7px]"
        priority
      />
      <span className="font-cond text-xl font-extrabold uppercase italic tracking-[0.14em] text-text sm:text-2xl">
        Sideline
      </span>
      <span className="hidden h-[3px] w-6 bg-lime sm:block" aria-hidden="true" />
    </span>
  );
}

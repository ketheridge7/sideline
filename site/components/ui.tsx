import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type ButtonVariant = "lime" | "ghost" | "line";

const variantClass: Record<ButtonVariant, string> = {
  lime: "bg-lime text-bg hover:bg-[#c8ff66]",
  ghost: "border border-white/15 bg-white/5 text-text hover:border-white",
  line: "border border-line text-muted hover:border-you hover:text-text",
};

export function CtaLink({
  href,
  children,
  variant = "lime",
  className,
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
  external?: boolean;
}) {
  const classNames = cn(
    "inline-flex items-center justify-center gap-2 rounded-full px-5 pt-2 pb-3 text-sm font-semibold tracking-tight transition-colors",
    variantClass[variant],
    className,
  );

  if (external) {
    return (
      <a href={href} className={classNames} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classNames}>
      {children}
    </Link>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line bg-card px-1.5 py-0.5 font-cond text-[11px] font-bold tracking-[0.08em] text-text">
      {children}
    </kbd>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-cond text-4xl font-extrabold uppercase leading-none tracking-[0.06em] text-lime sm:text-5xl">
      {children}
    </p>
  );
}

export function SectionTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        "mt-3 max-w-3xl text-xl font-medium leading-snug tracking-tight text-text sm:text-2xl",
        className,
      )}
    >
      {children}
    </h2>
  );
}

import Image from "next/image";
import { cn } from "@/lib/cn";
import { PRODUCT_STILLS, type ProductStill as Still, type ProductStillId } from "@/lib/stills";

export function ProductStill({
  still,
  preload = false,
  className,
  frameClassName,
  sizes = "(min-width: 1024px) 56vw, 100vw",
}: {
  still: ProductStillId;
  preload?: boolean;
  className?: string;
  frameClassName?: string;
  sizes?: string;
}) {
  const image: Still = PRODUCT_STILLS[still];
  return (
    <figure className={className}>
      <div className={cn("overflow-hidden rounded-xl border border-line bg-card", frameClassName)}>
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          preload={preload}
          sizes={sizes}
          className="h-auto w-full"
        />
      </div>
      {image.caption ? (
        <figcaption className="mt-2 text-right font-cond text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

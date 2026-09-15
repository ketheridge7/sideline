import Image from "next/image";
import { cn } from "@/lib/cn";
import { PRODUCT_STILLS, STILL_SIZE, type ProductStillId } from "@/lib/stills";

export function ProductStill({
  still,
  priority = false,
  className,
  sizes = "(min-width: 1024px) 56vw, 100vw",
}: {
  still: ProductStillId;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const image = PRODUCT_STILLS[still];
  return (
    <figure className={cn("overflow-hidden rounded-xl border border-line bg-card", className)}>
      <Image
        src={image.src}
        alt={image.alt}
        width={STILL_SIZE.width}
        height={STILL_SIZE.height}
        priority={priority}
        sizes={sizes}
        className="h-auto w-full"
      />
    </figure>
  );
}

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
          src={image.mobileSrc}
          alt={image.alt}
          width={image.mobileWidth}
          height={image.mobileHeight}
          sizes="100vw"
          preload={preload}
          className="h-auto w-full lg:hidden"
        />
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          preload={preload}
          sizes={sizes}
          className="hidden h-auto w-full lg:block"
        />
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed text-muted">{image.caption}</figcaption>
    </figure>
  );
}

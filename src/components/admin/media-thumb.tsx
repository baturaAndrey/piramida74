import { Picture } from "@/components/media/picture";
import type { MediaDto } from "@/lib/admin/media-dto";
import { cn } from "@/lib/utils";

type MediaThumbProps = {
  asset: MediaDto;
  /** Атрибут `sizes` для выбора варианта; миниатюры сетки ~160–200 px */
  sizes?: string;
  className?: string;
};

/** Квадратная миниатюра ассета (object-cover) с blur-заглушкой. */
export function MediaThumb({ asset, sizes = "200px", className }: MediaThumbProps) {
  return (
    <div className={cn("bg-muted aspect-square overflow-hidden rounded-md", className)}>
      <Picture
        asset={asset}
        sizes={sizes}
        alt={asset.alt || asset.originalName}
        className="h-full w-full object-cover"
        pictureClassName="block h-full w-full"
      />
    </div>
  );
}

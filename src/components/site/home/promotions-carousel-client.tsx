"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import { LeadDialogTrigger } from "@/components/leads/lead-dialog";
import { Picture } from "@/components/media/picture";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import type { PublicMedia } from "@/lib/queries/types";
import { cn } from "@/lib/utils";

export type PromotionSlide = {
  id: string;
  title: string;
  shortText: string;
  cover: PublicMedia | null;
};

type PromotionsCarouselClientProps = {
  items: PromotionSlide[];
};

const ARROW_CLASS =
  "bg-primary hover:bg-primary-dark absolute top-1/2 z-10 hidden size-16 -translate-y-1/2 items-center justify-center rounded-full text-white transition-colors xl:flex";
/**
 * Стрелки (64px) стоят по центру бокового «коридора» `--arrow-lane` между краем рамки и карточкой.
 * Коридор не уже 70px (стрелка + 3px зазора с каждой стороны), поэтому стрелка никогда
 * не заходит на карточку. При поле ≥70px (≥1366) коридор = `--gutter` и карточки стоят по сетке;
 * при поле 40px (1280–1365) недостающие 30px добираются внутренним отступом карусели.
 */
const ARROW_LANE = "xl:[--arrow-lane:max(var(--gutter),70px)]";
const ARROW_LANE_INSET = "xl:px-[calc(var(--arrow-lane)-var(--gutter))]";
const ARROW_OFFSET_LEFT = "left-[calc(var(--arrow-lane)/-2-32px)]";
const ARROW_OFFSET_RIGHT = "right-[calc(var(--arrow-lane)/-2-32px)]";

/** Подписка на события embla для `useSyncExternalStore` (без setState в эффектах). */
function useEmblaSnapshot<T>(
  api: CarouselApi | undefined,
  read: (api: CarouselApi) => T,
  initial: T
) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!api) return () => {};
      api.on("select", onChange);
      api.on("reInit", onChange);
      return () => {
        api.off("select", onChange);
        api.off("reInit", onChange);
      };
    },
    [api]
  );
  return useSyncExternalStore(
    subscribe,
    () => (api ? read(api) : initial),
    () => initial
  );
}

/** Карусель акций: 2 карточки с `lg`, 1 с «выглядывающей» следующей на мобильном; стрелки с `xl`, точки. */
export function PromotionsCarouselClient({ items }: PromotionsCarouselClientProps) {
  const [api, setApi] = useState<CarouselApi>();
  const interactive = items.length > 1;
  const snapCount = useEmblaSnapshot(api, (a) => a?.scrollSnapList().length ?? 0, 0);
  const selected = useEmblaSnapshot(api, (a) => a?.selectedScrollSnap() ?? 0, 0);

  return (
    <div className={cn(interactive && [ARROW_LANE, ARROW_LANE_INSET])}>
      {interactive ? (
        <p className="text-muted-foreground mb-3 flex items-center justify-center gap-2 text-xs lg:hidden">
          <span>Листайте влево/вправо</span>
          <MoveHorizontal aria-hidden="true" className="text-success size-4" />
        </p>
      ) : null}

      <Carousel
        setApi={setApi}
        opts={{ loop: interactive, align: "start", active: interactive }}
        aria-label="Специальные предложения"
      >
        <CarouselContent className="-ml-8">
          {items.map((item, index) => (
            <CarouselItem
              key={item.id}
              aria-label={`${index + 1} из ${items.length}`}
              className="basis-[88%] pl-8 lg:basis-1/2"
            >
              <PromotionCard item={item} />
            </CarouselItem>
          ))}
        </CarouselContent>

        {interactive ? (
          <>
            <button
              type="button"
              aria-label="Предыдущая акция"
              onClick={() => api?.scrollPrev()}
              className={cn(ARROW_CLASS, ARROW_OFFSET_LEFT)}
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Следующая акция"
              onClick={() => api?.scrollNext()}
              className={cn(ARROW_CLASS, ARROW_OFFSET_RIGHT)}
            >
              <ChevronRight aria-hidden="true" className="size-5" />
            </button>
          </>
        ) : null}
      </Carousel>

      {interactive && snapCount > 1 ? (
        <div className="mt-[clamp(20px,3vw,50px)] flex justify-center">
          {Array.from({ length: snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Акция ${index + 1}`}
              aria-current={index === selected ? "true" : undefined}
              onClick={() => api?.scrollTo(index)}
              className={cn(
                "mx-[7px] size-2.5 rounded-full transition-colors lg:size-[15px]",
                index === selected ? "bg-primary" : "bg-dot hover:bg-primary/40"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Карточка акции: обложка + заголовок, короткий текст и кнопка «Узнать условия». */
function PromotionCard({ item }: { item: PromotionSlide }) {
  return (
    <article className="flex h-full flex-col rounded-[12px] bg-white p-[13px_16px] lg:min-h-[350px] lg:flex-row lg:gap-[clamp(24px,3.4vw,65px)] lg:p-[25px]">
      <div className="bg-muted h-[225px] shrink-0 overflow-hidden rounded-[12px] lg:h-[clamp(200px,15.625vw,300px)] lg:flex-1">
        <Picture
          asset={item.cover}
          sizes="(min-width:1024px) 380px, 88vw"
          alt={item.cover?.alt || item.title}
          pictureClassName="block h-full"
          className="h-full w-full rounded-[12px] object-cover"
        />
      </div>
      <div className="flex flex-1 flex-col items-start justify-center pt-3 lg:pt-0">
        <h3 className="max-w-[90%] text-[clamp(16px,2.083vw,40px)] leading-[1.12] font-bold">
          {item.title}
        </h3>
        <p className="text-subtle py-[10px] text-xs leading-[1.5] lg:py-5 lg:text-[clamp(14px,0.9375vw,18px)]">
          {item.shortText}
        </p>
        <LeadDialogTrigger
          kind="promo"
          block={item.title}
          formTitle={`Акция: ${item.title}`}
          promotionId={item.id}
          asChild
        >
          <button
            type="button"
            className="text-accent-red hover:bg-accent-red inline-flex h-10 w-[120px] items-center justify-center rounded-[12px] border border-[#E5E4E4] text-xs font-semibold transition-colors hover:border-transparent hover:text-white lg:h-[clamp(40px,2.6vw,50px)] lg:w-[clamp(160px,12vw,230px)] lg:text-[clamp(14px,1.1vw,21px)]"
          >
            Узнать условия
          </button>
        </LeadDialogTrigger>
      </div>
    </article>
  );
}

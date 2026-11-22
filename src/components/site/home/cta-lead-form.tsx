"use client";

import { lazy, Suspense, useRef } from "react";
import { LazyBoundary } from "@/components/lazy-boundary";
import type { LeadFormProps } from "@/components/leads/lead-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLoadWhenNeeded } from "@/hooks/use-load-when-needed";
import { cn } from "@/lib/utils";

/*
 * Форма CTA (react-hook-form, zod, маска телефона) — отдельный чанк. Секция далеко под первым
 * экраном, а статический импорт добавлял эти библиотеки в начальный JS главной и ухудшал
 * симулированные LCP/TBT в Lighthouse. Когда грузить — решает `useLoadWhenNeeded`.
 */
const LeadForm = lazy(() =>
  import("@/components/leads/lead-form").then((m) => ({ default: m.LeadForm }))
);

/** Только сериализуемые пропсы: компонент рендерится из серверной секции */
type CtaLeadFormProps = Pick<
  LeadFormProps,
  "type" | "block" | "formTitle" | "submitLabel" | "className"
>;

/**
 * Высоты повторяют FORM_CLASS секции (cta-form-section.tsx), иначе при подмене заглушки
 * на форму карточка «прыгнет». Если меняете размеры полей/кнопки там — меняйте и здесь.
 */
const FIELD_HEIGHT = "h-[clamp(48px,5.2vw,100px)]";
const SUBMIT_HEIGHT = "h-[clamp(52px,4.7vw,90px)]";

/**
 * Заглушка той же высоты, что и форма: та же раскладка `flex-col gap-3`, блоки высотой полей
 * и кнопки, а строка согласия — с тем же текстом и классами, что у подписи чекбокса в LeadForm.
 * Текст невидим и нужен только для высоты: подпись занимает 2–3 строки в зависимости от ширины
 * карточки и шрифта (12px до md, 14px с md), и фиксированный min-height тут не угадать.
 */
function LeadFormPlaceholder() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      <Skeleton className={cn(FIELD_HEIGHT, "rounded-[12px]")} />
      <Skeleton className={cn(FIELD_HEIGHT, "rounded-[12px]")} />
      <div className="flex items-start gap-3">
        <Skeleton className="mt-0.5 size-5 shrink-0 rounded-[4px]" />
        <Skeleton className="rounded-[4px]">
          <p className="invisible text-xs leading-snug font-normal md:text-sm">
            Я даю согласие на обработку персональных данных и ознакомлен(а) с политикой
            конфиденциальности
          </p>
        </Skeleton>
      </div>
      <Skeleton className={cn(SUBMIT_HEIGHT, "rounded-[12px]")} />
    </div>
  );
}

/**
 * Чанк не загрузился (обрыв сети, новый деплой с другими хэшами). `React.lazy` запоминает
 * отклонённый промис, поэтому повторить загрузку без перезагрузки страницы нельзя —
 * предлагаем обновить страницу; кнопка «Заказать звонок» в шапке грузит свой чанк отдельно.
 */
function LeadFormLoadError() {
  return (
    <div role="alert" className="flex flex-col gap-3 text-sm">
      <p>
        Не удалось загрузить форму. Обновите страницу или закажите звонок кнопкой в шапке сайта.
      </p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>
        Обновить страницу
      </Button>
    </div>
  );
}

/** Форма заявки CTA, которая подгружается при приближении к ней, первом действии или в простое */
export function CtaLeadForm(props: CtaLeadFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldLoad = useLoadWhenNeeded(containerRef);

  return (
    <div ref={containerRef}>
      {shouldLoad ? (
        <LazyBoundary fallback={<LeadFormLoadError />}>
          <Suspense fallback={<LeadFormPlaceholder />}>
            <LeadForm {...props} />
          </Suspense>
        </LazyBoundary>
      ) : (
        <LeadFormPlaceholder />
      )}
    </div>
  );
}

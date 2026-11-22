import { Skeleton } from "@/components/ui/skeleton";
import { Container } from "../container";
import { SectionTitle } from "../section-title";

/** Отступы и заголовок блока «Калькулятор» — общие для блока и его заглушки */
export const CALCULATOR_SECTION_CLASS = "py-12";
export const CALCULATOR_TITLE = "Калькулятор стоимости";

/**
 * Заглушка блока «Калькулятор» на главной: тот же заголовок и карточка примерной высоты
 * формы (поля в столбик на мобильном, в ряд с `sm`), чтобы не было сдвига макета.
 */
export function CalculatorTeaserSkeleton() {
  return (
    <section aria-hidden="true" className={CALCULATOR_SECTION_CLASS}>
      <Container className="flex flex-col gap-8">
        <SectionTitle>{CALCULATOR_TITLE}</SectionTitle>
        <Skeleton className="h-[440px] w-full rounded-lg sm:h-[264px]" />
      </Container>
    </section>
  );
}

import { Suspense } from "react";
import { connection } from "next/server";
import { CalculatorClient } from "@/components/calculator/calculator-client";
import { CalculatorSkeleton } from "@/components/calculator/calculator-skeleton";
import { Container } from "@/components/site/container";
import { SectionTitle } from "@/components/site/section-title";
import { getOpDate } from "@/lib/dates";
import { getCalculatorCatalog } from "@/lib/queries/calculator";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Калькулятор стоимости",
  description:
    "Рассчитайте стоимость аренды бильярдного стола, VIP-комнаты, меню и банкетных сетов на любое число гостей.",
  alternates: { canonical: "/calculator" }, // metadataBase задаёт root layout
};

export default function CalculatorPage() {
  return (
    <Container className="py-8 md:py-12">
      <SectionTitle as="h1" className="mb-6 md:mb-8">
        Калькулятор стоимости
      </SectionTitle>
      <Suspense fallback={<CalculatorSkeleton />}>
        <CalculatorContent />
      </Suspense>
    </Container>
  );
}

/** Каталог из БД и операционная дата — только в запросе (после connection), не при сборке */
async function CalculatorContent() {
  await connection();
  const opDate = getOpDate();
  const catalog = await getCalculatorCatalog();
  return <CalculatorClient catalog={catalog} defaultDate={opDate} />;
}

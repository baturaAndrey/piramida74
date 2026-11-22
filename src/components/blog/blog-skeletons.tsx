import { Container } from "@/components/site/container";
import { Skeleton } from "@/components/ui/skeleton";

function CardSkeleton() {
  return (
    <div className="bg-card overflow-hidden rounded-lg border">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/** Сетка карточек при загрузке списка статей */
export function BlogListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Загрузка статей">
      <Skeleton className="h-9 w-32" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Статья при загрузке */
export function ArticleSkeleton() {
  return (
    <Container className="py-8 md:py-12" aria-busy="true" aria-label="Загрузка статьи">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="aspect-video w-full rounded-lg" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </Container>
  );
}

/** Блок «Из блога» на главной при загрузке */
export function BlogTeaserSkeleton() {
  return (
    <Container className="flex flex-col gap-8 py-12" aria-busy="true" aria-label="Загрузка статей">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </Container>
  );
}

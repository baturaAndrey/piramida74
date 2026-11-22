import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ArticleCard } from "@/components/blog/article-card";
import { Container } from "@/components/site/container";
import { SectionTitle } from "@/components/site/section-title";
import { getRecentArticles } from "@/lib/queries/blog";
import { cn } from "@/lib/utils";

type BlogTeaserProps = {
  /** `roundedNowIso()` — вычисляется вызывающей стороной после `await connection()` */
  now: string;
  className?: string;
};

/**
 * Блок «Из блога» для главной: 3 последние статьи или ничего.
 * Вызывающая сторона обязана рендерить его после `await connection()` внутри `<Suspense>`
 * (фолбэк — `BlogTeaserSkeleton`).
 */
export async function BlogTeaser({ now, className }: BlogTeaserProps) {
  const articles = await getRecentArticles(3, now);
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="blog-teaser-title" className={cn("py-12", className)}>
      <Container className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionTitle>
            <span id="blog-teaser-title">Из блога</span>
          </SectionTitle>
          <Link
            href="/blog"
            className="text-primary hover:text-primary-dark inline-flex items-center gap-1.5 text-base font-medium transition-colors"
          >
            Все статьи
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      </Container>
    </section>
  );
}

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";

export type PageHeaderCrumb = { label: string; href?: string };

export type PageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Кнопки справа (например «Добавить») */
  actions?: ReactNode;
  /** Стрелка «Назад» слева от заголовка */
  backHref?: string;
  /** Хлебные крошки над заголовком; последний элемент — текущая страница */
  breadcrumbs?: PageHeaderCrumb[];
};

/** Шапка страницы админки (серверный компонент, без хуков). */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  breadcrumbs,
}: PageHeaderProps) {
  return (
    <div className="mb-6 space-y-2">
      {breadcrumbs && breadcrumbs.length > 0 ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink asChild>
                        <Link href={crumb.href}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {isLast ? null : <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      {/* flex-wrap: кнопки уходят под заголовок, когда им не хватает места, а не сжимают его */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-[min(100%,16rem)] flex-1 items-start gap-2">
          {backHref ? (
            <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0">
              <Link href={backHref} aria-label="Назад">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h1 className="text-2xl font-bold break-words">{title}</h1>
            {description ? <p className="text-muted-foreground text-sm">{description}</p> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

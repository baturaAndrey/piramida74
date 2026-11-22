import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { z } from "zod";
import { AuthorForm } from "@/components/admin/blog/author-form";
import { PageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { countAuthorArticles, getAuthorForEdit } from "@/lib/blog-admin/queries";
import { requireAdmin } from "@/lib/session";
import type { AuthorFormInput } from "@/lib/validation/blog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Автор" };

export default async function EditAuthorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [found, articlesCount] = await Promise.all([getAuthorForEdit(id), countAuthorArticles(id)]);
  if (!found) notFound();
  const a = found.author;

  const defaultValues: AuthorFormInput = {
    id: a.id,
    slug: a.slug,
    name: a.name,
    photoMediaId: a.photoMediaId,
    roleInClub: a.roleInClub ?? "",
    rank: a.rank ?? "",
    bio: a.bio ?? "",
    sameAs: a.sameAs.map((value) => ({ value })),
    isActive: a.isActive,
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={a.name}
        backHref="/admin/blog/authors"
        breadcrumbs={[
          { label: "Авторы", href: "/admin/blog/authors" },
          { label: "Редактирование" },
        ]}
        {...(a.isActive
          ? {
              actions: (
                <Button asChild variant="outline" size="sm">
                  <a href={`/authors/${a.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" aria-hidden />
                    Открыть на сайте
                  </a>
                </Button>
              ),
            }
          : {})}
      />
      <AuthorForm
        key={a.updatedAt.toISOString()}
        defaultValues={defaultValues}
        initialPhoto={found.photo}
        articlesCount={articlesCount}
      />
    </div>
  );
}

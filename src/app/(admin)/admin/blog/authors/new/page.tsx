import { AuthorForm } from "@/components/admin/blog/author-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdmin } from "@/lib/session";
import type { AuthorFormInput } from "@/lib/validation/blog";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Новый автор" };

const EMPTY_AUTHOR: AuthorFormInput = {
  slug: "",
  name: "",
  photoMediaId: null,
  roleInClub: "",
  rank: "",
  bio: "",
  sameAs: [],
  isActive: true,
};

export default async function NewAuthorPage() {
  await requireAdmin();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Новый автор"
        backHref="/admin/blog/authors"
        breadcrumbs={[{ label: "Авторы", href: "/admin/blog/authors" }, { label: "Новый автор" }]}
      />
      <AuthorForm defaultValues={EMPTY_AUTHOR} initialPhoto={null} />
    </div>
  );
}

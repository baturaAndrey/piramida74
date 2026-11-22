import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/session";

/** У раздела «Блог» нет своей сводки — открываем список статей (после проверки прав). */
export default async function BlogIndexPage() {
  await requireAdmin();
  redirect("/admin/blog/articles");
}

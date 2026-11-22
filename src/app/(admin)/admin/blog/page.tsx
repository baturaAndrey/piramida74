import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/session";

/** У раздела «Блог» нет своей сводки — открываем список статей (после проверки прав). */
export default async function BlogIndexPage() {
  await requireStaff();
  redirect("/admin/blog/articles");
}

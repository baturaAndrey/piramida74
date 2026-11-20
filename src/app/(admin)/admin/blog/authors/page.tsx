import Link from "next/link";
import { Plus, UserRound } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { Picture } from "@/components/media/picture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuthorsWithCounts } from "@/lib/blog-admin/queries";
import { requireAdmin } from "@/lib/session";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Авторы блога" };

export default async function AdminAuthorsPage() {
  await requireAdmin();
  const authors = await listAuthorsWithCounts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Авторы"
        description="Тренеры клуба, которые пишут статьи."
        actions={
          <Button asChild>
            <Link href="/admin/blog/authors/new">
              <Plus className="h-4 w-4" aria-hidden />
              Новый автор
            </Link>
          </Button>
        }
      />
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">
                <span className="sr-only">Фото</span>
              </TableHead>
              <TableHead>Имя</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead className="text-right">Статей</TableHead>
              <TableHead>На сайте</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {authors.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  Авторов пока нет
                </TableCell>
              </TableRow>
            ) : (
              authors.map((author) => (
                <TableRow key={author.id}>
                  <TableCell>
                    <div className="bg-muted relative h-10 w-10 overflow-hidden rounded-full">
                      {author.photo ? (
                        <Picture
                          asset={author.photo}
                          sizes="40px"
                          alt=""
                          className="h-full w-full object-cover"
                          pictureClassName="block h-full w-full"
                        />
                      ) : (
                        <UserRound
                          className="text-muted-foreground absolute inset-0 m-auto h-4 w-4"
                          aria-hidden
                        />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/admin/blog/authors/${author.id}`}
                      className="font-medium hover:underline"
                    >
                      {author.name}
                    </Link>
                    <p className="text-muted-foreground font-mono text-xs">
                      /authors/{author.slug}
                    </p>
                  </TableCell>
                  <TableCell>
                    {[author.roleInClub, author.rank].filter(Boolean).join(", ") || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{author.articlesCount}</TableCell>
                  <TableCell>
                    {author.isActive ? (
                      <Badge>Показан</Badge>
                    ) : (
                      <Badge variant="outline">Скрыт</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

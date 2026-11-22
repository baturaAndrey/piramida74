import Link from "next/link";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 404 внутри админки: срабатывает на notFound() в страницах /admin/… (неизвестный id),
 * чтобы не уходить на публичную 404 с шапкой и подвалом сайта.
 */
export default function AdminNotFound() {
  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="items-center text-center">
        <FileQuestion className="text-muted-foreground h-10 w-10" aria-hidden />
        <CardTitle>Не найдено</CardTitle>
        <CardDescription>
          Запись не существует или была удалена. Проверьте ссылку или вернитесь к сводке.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild>
          <Link href="/admin">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Вернуться в админку
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

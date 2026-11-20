"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Граница ошибок админки: текст ошибки не показываем (может содержать детали сервера). */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin] page error", error);
  }, [error]);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="items-center text-center">
        <AlertCircle className="text-destructive h-10 w-10" aria-hidden />
        <CardTitle>Что-то пошло не так</CardTitle>
        <CardDescription>
          Не удалось загрузить страницу. Повторите попытку; если ошибка повторяется — обновите
          страницу позже.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button type="button" onClick={reset}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Повторить
        </Button>
      </CardContent>
    </Card>
  );
}

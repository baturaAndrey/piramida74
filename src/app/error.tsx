"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="container-site py-16">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <AlertCircle className="text-destructive size-16" aria-hidden="true" />
        </div>
        <h1 className="mb-4 text-2xl font-bold">Что-то пошло не так</h1>
        <p className="text-subtle mb-6">
          Произошла непредвиденная ошибка. Попробуйте ещё раз или позвоните нам, если проблема
          повторяется.
        </p>
        {error.digest && <p className="text-subtle mb-4 text-xs">Код ошибки: {error.digest}</p>}
        <div className="flex justify-center gap-4">
          <Button onClick={reset}>Попробовать снова</Button>
          <Button variant="outline" asChild>
            <Link href="/">На главную</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TZ } from "@/lib/dates";
import { LEGAL_TYPE_LABELS, type LegalDocTypeValue } from "../_schema";
import type { LegalVersionRow, LegalVersionStatus } from "../_queries";

const dateTimeFormat = new Intl.DateTimeFormat("ru-RU", {
  timeZone: TZ,
  dateStyle: "medium",
  timeStyle: "short",
});

const HASH_PREVIEW_LENGTH = 8;

const STATUS_LABELS: Record<LegalVersionStatus, string> = {
  draft: "Черновик",
  current: "Опубликован",
  archived: "Архив",
};

const STATUS_VARIANTS: Record<LegalVersionStatus, "outline" | "default" | "secondary"> = {
  draft: "outline",
  current: "default",
  archived: "secondary",
};

const PUBLIC_PATHS: Record<LegalDocTypeValue, string> = {
  policy: "/politika",
  consent: "/soglasie",
};

type LegalVersionsProps = {
  type: LegalDocTypeValue;
  versions: LegalVersionRow[];
};

/** Секция одного типа документа: текущая версия, таблица всех версий и создание новой. */
export function LegalVersions({ type, versions }: LegalVersionsProps) {
  const current = versions.find((v) => v.status === "current");

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 space-y-0 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <CardTitle className="text-xl">{LEGAL_TYPE_LABELS[type]}</CardTitle>
          <CardDescription>
            {current ? (
              <>
                Текущая версия {current.version} — показывается на{" "}
                <Link
                  href={PUBLIC_PATHS[type]}
                  target="_blank"
                  className="text-primary underline underline-offset-2"
                >
                  {PUBLIC_PATHS[type]}
                </Link>
              </>
            ) : (
              "Опубликованной версии нет — на сайте документ не показывается"
            )}
          </CardDescription>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href={`/admin/legal/new?type=${type}`}>
            <Plus className="h-4 w-4" aria-hidden />
            Создать новую версию
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center text-sm">
            <FileText className="h-8 w-8" aria-hidden />
            Версий ещё нет
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Версия</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Опубликован</TableHead>
                <TableHead>SHA-256</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Действие</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium whitespace-nowrap">{v.version}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge variant={STATUS_VARIANTS[v.status]}>{STATUS_LABELS[v.status]}</Badge>
                      {v.status === "current" ? (
                        <Badge variant="outline" className="text-success">
                          Текущая версия
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {v.publishedAt ? (
                      <time dateTime={v.publishedAt.toISOString()}>
                        {dateTimeFormat.format(v.publishedAt)}
                      </time>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <code className="font-mono text-xs" title={v.sha256}>
                      {v.sha256.slice(0, HASH_PREVIEW_LENGTH)}
                    </code>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/admin/legal/${v.id}`}>Открыть</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

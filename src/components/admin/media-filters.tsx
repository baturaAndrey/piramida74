"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { folderLabel, MEDIA_FOLDER_LABELS } from "@/lib/admin/media-dto";

/** Radix Select не допускает пустое значение у пункта */
const ALL_FOLDERS = "__all__";

type MediaFiltersProps = {
  query: string;
  onQueryChange: (value: string) => void;
  folder: string;
  onFolderChange: (value: string) => void;
  /** Папки из БД; объединяются с известными */
  folders?: string[];
};

/** Поиск по имени/alt и фильтр папки для медиатеки и пикера. */
export function MediaFilters({
  query,
  onQueryChange,
  folder,
  onFolderChange,
  folders = [],
}: MediaFiltersProps) {
  const options = Array.from(new Set([...Object.keys(MEDIA_FOLDER_LABELS), ...folders])).sort(
    (a, b) => folderLabel(a).localeCompare(folderLabel(b), "ru")
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по имени файла или описанию"
          aria-label="Поиск по медиатеке"
          className="pl-8"
        />
      </div>
      <Select
        value={folder || ALL_FOLDERS}
        onValueChange={(value) => onFolderChange(value === ALL_FOLDERS ? "" : value)}
      >
        <SelectTrigger className="w-full sm:w-56" aria-label="Папка">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_FOLDERS}>Все папки</SelectItem>
          {options.map((value) => (
            <SelectItem key={value} value={value}>
              {folderLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

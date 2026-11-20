"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATEGORY_PRESETS, MAX_CATEGORIES, MAX_CATEGORY_LENGTH } from "../_lib/labels";

type CategoriesFieldProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

const PRESET_SET = new Set<string>(CATEGORY_PRESETS);

function includesIgnoreCase(list: string[], item: string): boolean {
  const needle = item.toLocaleLowerCase("ru");
  return list.some((entry) => entry.toLocaleLowerCase("ru") === needle);
}

/** Категории участников: пресеты-чипы + произвольные значения (без дублей без учёта регистра). */
export function CategoriesField({ value, onChange, disabled = false }: CategoriesFieldProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isFull = value.length >= MAX_CATEGORIES;
  const custom = value.filter((item) => !PRESET_SET.has(item));

  function togglePreset(preset: string) {
    if (value.includes(preset)) {
      onChange(value.filter((item) => item !== preset));
      return;
    }
    if (isFull) return;
    onChange([...value, preset]);
  }

  function addCustom() {
    const next = draft.trim();
    if (!next) return;
    if (next.length > MAX_CATEGORY_LENGTH) {
      setError(`Не длиннее ${MAX_CATEGORY_LENGTH} символов`);
      return;
    }
    if (includesIgnoreCase(value, next)) {
      setError("Такая категория уже выбрана");
      return;
    }
    if (isFull) {
      setError(`Не больше ${MAX_CATEGORIES} категорий`);
      return;
    }
    // Ввод «мужчины» включает пресет «Мужчины», а не дублирует его
    const preset = CATEGORY_PRESETS.find(
      (item) => item.toLocaleLowerCase("ru") === next.toLocaleLowerCase("ru")
    );
    onChange([...value, preset ?? next]);
    setDraft("");
    setError(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Enter добавляет категорию, а не отправляет всю форму
    if (event.key === "Enter") {
      event.preventDefault();
      addCustom();
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Категории участников">
        {CATEGORY_PRESETS.map((preset) => {
          const selected = value.includes(preset);
          return (
            <Button
              key={preset}
              type="button"
              size="sm"
              variant={selected ? "default" : "outline"}
              className="rounded-full"
              aria-pressed={selected}
              disabled={disabled || (!selected && isFull)}
              onClick={() => togglePreset(preset)}
            >
              {preset}
            </Button>
          );
        })}
        {custom.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            className="rounded-full"
            disabled={disabled}
            aria-label={`Убрать категорию «${item}»`}
            onClick={() => onChange(value.filter((entry) => entry !== item))}
          >
            {item}
            <X className="h-3 w-3" aria-hidden />
          </Button>
        ))}
      </div>
      <div className="flex max-w-md gap-2">
        <Input
          id={inputId}
          value={draft}
          maxLength={MAX_CATEGORY_LENGTH}
          placeholder="Своя категория"
          aria-label="Своя категория"
          disabled={disabled || isFull}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isFull || !draft.trim()}
          onClick={addCustom}
        >
          <Plus className="h-4 w-4" aria-hidden />
          Добавить
        </Button>
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

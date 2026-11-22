import { Lightbulb } from "lucide-react";

type FunFactProps = { title: string | null; text: string };

/** Карточка «Интересный факт» в конце раздела меню */
export function FunFact({ title, text }: FunFactProps) {
  return (
    <aside className="border-primary/20 bg-primary/5 mt-4 flex gap-3 rounded-[12px] border p-4 md:p-5">
      <Lightbulb className="text-primary mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-semibold">{title?.trim() || "Интересный факт"}</p>
        <p className="text-sm leading-relaxed whitespace-pre-line md:text-base">{text}</p>
      </div>
    </aside>
  );
}

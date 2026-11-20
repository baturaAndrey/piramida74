import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * Custom font-size tokens declared as `--text-*` in the `@theme` block of
 * src/app/globals.css. Keep this list in sync with that file.
 *
 * tailwind-merge cannot read the CSS theme, so without registering these it
 * classifies e.g. `text-h2` as a text COLOR (the color scale accepts any
 * value) and `cn("text-h2", "text-white")` would drop `text-h2`.
 * Custom `--color-*` tokens need no registration for the same reason.
 */
const CUSTOM_FONT_SIZES = [
  "h1",
  "h2",
  "calendar-title",
  "card-title",
  "promo-title",
  "price",
  "hero-sub",
  "badge-size",
  "popup-title",
  "body-lg",
  "btn",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [...CUSTOM_FONT_SIZES],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

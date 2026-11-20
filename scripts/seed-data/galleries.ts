/**
 * Ровно 8 пустых галерей; изображения добавит задача 15 (import-legacy-images) по key.
 */
import type { SeedGallery } from "./types";

export const SEED_GALLERIES: SeedGallery[] = [
  { key: "hero", title: "Первый экран" },
  { key: "service_russian", title: "Русский бильярд" },
  { key: "service_pool", title: "Американский бильярд" },
  { key: "service_vip", title: "VIP-комнаты" },
  { key: "service_training", title: "Обучение бильярду" },
  { key: "bar", title: "Бар и кухня" },
  { key: "about", title: "О клубе" },
  { key: "cta", title: "Блок «Хотите забронировать стол?» (фон и фото)" },
];

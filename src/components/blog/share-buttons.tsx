"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { TelegramIcon, VkIcon } from "@/components/site/social-icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShareButtonsProps = {
  /** Абсолютный URL статьи */
  url: string;
  title: string;
  className?: string;
};

/** «Поделиться»: VK, Telegram и копирование ссылки. */
export function ShareButtons({ url, title, className }: ShareButtonsProps) {
  const vkHref = `https://vk.com/share.php?${new URLSearchParams({ url, title })}`;
  const telegramHref = `https://t.me/share/url?${new URLSearchParams({ url, text: title })}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-subtle mr-1 text-sm font-medium">Поделиться:</span>
      <Button asChild variant="outline" size="sm">
        <a
          href={vkHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Поделиться ВКонтакте"
        >
          <VkIcon className="size-4" />
          ВКонтакте
        </a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a
          href={telegramHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Поделиться в Telegram"
        >
          <TelegramIcon className="size-4" />
          Telegram
        </a>
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={copyLink}>
        <Link2 aria-hidden="true" />
        Копировать ссылку
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

type AdminUserMenuProps = {
  name: string;
  email: string;
};

/** Блок пользователя в футере сайдбара: имя, email, «Выйти». */
export function AdminUserMenu({ name, email }: AdminUserMenuProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      const { error } = await signOut();
      if (error) throw new Error(error.message);
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Не удалось выйти. Попробуйте ещё раз.");
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-md p-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name || email}</p>
        <p className="text-muted-foreground truncate text-xs">{email}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => void handleSignOut()}
        disabled={pending}
        aria-label="Выйти"
        title="Выйти"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}

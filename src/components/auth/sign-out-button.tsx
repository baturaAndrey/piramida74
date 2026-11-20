"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/auth-client"

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)

  return (
    <Button
      variant="outline"
      className={className}
      disabled={isPending}
      onClick={async () => {
        setIsPending(true)
        try {
          await signOut()
        } finally {
          router.replace("/login")
          router.refresh()
        }
      }}
    >
      <LogOut className="size-4" />
      Выйти
    </Button>
  )
}

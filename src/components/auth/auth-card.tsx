import type { ReactNode } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card"

interface AuthCardProps {
  title: string
  description?: string
  children: ReactNode
}

/** Статическая оболочка страниц входа/сброса пароля: бренд, заголовок, описание. */
export function AuthCard({ title, description, children }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-2 text-center">
        <p className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-xl font-bold text-transparent">
          Пирамида
        </p>
        <h1 className="text-2xl font-semibold leading-none tracking-tight">{title}</h1>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

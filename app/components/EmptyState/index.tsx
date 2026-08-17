import type { ReactNode } from 'react'

import { Card } from '#components/ui/card'

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <Card className="items-center px-6 py-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-primary">{icon}</div>
      <h3 className="font-display text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-xs text-[14px] leading-relaxed text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </Card>
  )
}

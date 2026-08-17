import { useState } from 'react'
import { Navigate, useParams } from 'react-router'
import {
  AlertTriangle,
  Banknote,
  Check,
  History,
  MoreHorizontal,
  Pencil,
  Receipt,
  Share2,
  Trash2,
} from 'lucide-react'

import { PAYMENT_METHOD_LABEL } from '#types'
import { ConfirmDialog } from '#components/ConfirmDialog'
import { Page } from '#components/Page'
import { StatusBadge } from '#components/StatusBadge'
import { TenantForm } from '#components/TenantForm'
import { Badge } from '#components/ui/badge'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu'
import { Progress } from '#components/ui/progress'
import { Skeleton } from '#components/ui/skeleton'
import { toast } from '#components/ui/sonner'
import { useHouse, useTenant } from '#hooks/useData'
import { deleteHistoryEntry, deleteTenant, settleArrears, settleMonth } from '#lib/actions'
import { cn } from '#lib/utils'
import useRouting, { routePath } from '#root/hooks/useRouting'
import { type QuickActionId, usePreferences } from '#store/preferences'
import { useUI } from '#store/ui'
import { billLines } from '#utils/billing'
import { formatDate, monthKey, monthLabel, monthLabelLong, ordinal } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { money } from '#utils/payments'
import { tenantStatus } from '#utils/status'

import type { HistoryEntry, Tenant as TenantRecord, TenantStatus } from '#types'

function Tenant() {
  const { houseId = '', tenantId = '' } = useParams()
  const routeTo = useRouting()
  const tenant = useTenant(tenantId)
  const house = useHouse(houseId)
  const openBilling = useUI((s) => s.openBilling)
  const openBackfill = useUI((s) => s.openBackfill)
  const openPayment = useUI((s) => s.openPayment)
  const showInvoice = useUI((s) => s.showInvoice)
  const quickActions = usePreferences((s) => s.quickActions)

  const [editing, setEditing] = useState(false)
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<HistoryEntry | null>(null)

  // Deleted from under us, or a stale link — fall back to the house.
  if (tenant === null) return <Navigate to={routePath('house', { houseId })} replace />

  if (tenant === undefined) {
    return (
      <Page title="…" backTo={routePath('house', { houseId })} backLabel="Back to house">
        <Skeleton className="h-40" />
      </Page>
    )
  }

  const status = tenantStatus(tenant)
  const thisMonth = monthKey()
  const outstanding = status.outstanding

  async function copyReminder() {
    if (!tenant) return
    const text = reminderText(tenant, status)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        toast.success('Reminder copied')
      }
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  }

  const actions: { id: QuickActionId; label: string; icon: typeof Receipt; run: () => void }[] = [
    {
      id: 'payment',
      label: 'Record payment',
      icon: Banknote,
      run: () => openPayment({ tenantId: tenant.id, month: outstanding[0]?.month ?? thisMonth }),
    },
    { id: 'bill', label: 'Generate bill', icon: Receipt, run: () => openBilling(tenant.id) },
    { id: 'reminder', label: 'Send reminder', icon: Share2, run: () => void copyReminder() },
    {
      id: 'backfill',
      label: 'Log past months',
      icon: History,
      run: () => openBackfill(tenant.id),
    },
    { id: 'edit', label: 'Edit details', icon: Pencil, run: () => setEditing(true) },
  ]

  const inline = actions.filter((a) => quickActions.includes(a.id))
  const overflow = actions.filter((a) => !quickActions.includes(a.id))

  return (
    <Page
      title={tenant.name}
      subtitle={[tenant.unit && `Unit ${tenant.unit}`, house?.name].filter(Boolean).join(' · ')}
      backTo={routePath('house', { houseId })}
      backLabel={house?.name ?? 'Back to house'}
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge state={status.state} label={status.label} />
          <div className="text-right">
            <div className="font-display text-[22px] leading-none font-semibold">
              {formatMoney(tenant.rent)}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">per month</div>
          </div>
        </div>

        {/* Actions the user chose to keep on the page; the rest sit in ⋯. */}
        <div className="flex gap-2">
          {inline.map((action) => (
            <Button
              key={action.id}
              variant={action.id === 'payment' ? 'default' : 'outline'}
              className="min-w-0 flex-1"
              onClick={action.run}
              disabled={action.id === 'reminder' && status.state === 'paid'}
            >
              <action.icon />
              {action.label}
            </Button>
          ))}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflow.map((action) => (
                <DropdownMenuItem
                  key={action.id}
                  onSelect={action.run}
                  disabled={action.id === 'reminder' && status.state === 'paid'}
                >
                  <action.icon />
                  {action.label}
                </DropdownMenuItem>
              ))}
              {overflow.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem variant="destructive" onSelect={() => setConfirmDeleteTenant(true)}>
                <Trash2 />
                Delete tenant
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {outstanding.length > 0 && (
          <section className="rounded-card border border-primary/40 bg-primary-soft/70 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-primary">
                <AlertTriangle className="size-4" />
                {outstanding.length} month{outstanding.length === 1 ? '' : 's'} outstanding
              </div>
              <div className="font-display text-[19px] leading-none font-semibold text-primary">
                {formatMoney(status.arrearsAmount)}
              </div>
            </div>

            <ul className="mt-2.5 space-y-1.5">
              {outstanding.map((m) => (
                <li
                  key={m.month}
                  className="flex items-center gap-2 rounded-lg bg-card/80 px-3 py-2 text-[13.5px]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-medium">{monthLabel(m.month)}</span>
                      {m.partial && <Badge variant="warning">Part paid</Badge>}
                    </div>
                    {m.month === thisMonth && (
                      <span className="text-[11.5px] text-muted-foreground">this month</span>
                    )}
                  </div>
                  <span className="shrink-0 font-semibold">{formatMoney(m.amount)}</span>
                  <Button
                    size="xs"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => openPayment({ tenantId: tenant.id, month: m.month })}
                  >
                    Pay
                  </Button>
                </li>
              ))}
            </ul>

            <Button
              className="mt-3 w-full"
              onClick={async () => {
                const n = await settleArrears(tenant.id)
                toast.success(`Settled ${n} month${n === 1 ? '' : 's'} for ${tenant.name}`)
              }}
            >
              <Check />
              Settle all {formatMoney(status.arrearsAmount)}
            </Button>
          </section>
        )}

        {status.state === 'paid' && (
          <div className="flex items-center justify-center gap-2 rounded-card bg-success-soft py-2.5 text-[14px] font-semibold text-success">
            <Check className="size-4" />
            Paid for {monthLabel(thisMonth)}
          </div>
        )}

        <Card className="divide-y divide-rule-soft text-[14px]">
          <Row label="Due date">
            {status.dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} ·{' '}
            {ordinal(tenant.dueDay)} each month
          </Row>
          {tenant.phone && (
            <Row label="Phone">
              <a href={`tel:${tenant.phone}`} className="font-medium text-primary underline">
                {tenant.phone}
              </a>
            </Row>
          )}
          <Row label="Last settled">
            {tenant.lastPaidMonth
              ? `${monthLabelLong(tenant.lastPaidMonth)} · logged ${formatDate(tenant.lastPaidDate)}`
              : 'No month settled in full yet'}
          </Row>
          {tenant.notes && <Row label="Notes">{tenant.notes}</Row>}
        </Card>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            Payment history
          </h3>
          {tenant.history.length === 0 ? (
            <Card className="px-4 py-5 text-center text-[13.5px] text-muted-foreground">
              Nothing logged yet. Use{' '}
              <span className="font-medium text-foreground">Log past months</span> to backfill rent
              that’s already been paid.
            </Card>
          ) : (
            <ul className="divide-y divide-rule-soft rounded-card border border-border bg-card">
              {tenant.history.map((entry) => (
                <HistoryRow
                  key={entry.month}
                  entry={entry}
                  onPay={() => openPayment({ tenantId: tenant.id, month: entry.month })}
                  onSettle={async () => {
                    await settleMonth(tenant.id, entry.month)
                    toast.success(`${monthLabel(entry.month)} settled`)
                  }}
                  onInvoice={
                    entry.breakdown && house
                      ? () =>
                          showInvoice({
                            tenant,
                            houseName: house.name,
                            houseAddress: house.address,
                            month: entry.month,
                            breakdown: entry.breakdown!,
                          })
                      : undefined
                  }
                  onDelete={() => setEntryToDelete(entry)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <TenantForm
        open={editing}
        houseId={tenant.houseId}
        tenant={tenant}
        onClose={() => setEditing(false)}
      />

      <ConfirmDialog
        open={confirmDeleteTenant}
        title={`Delete ${tenant.name}?`}
        body="Their details and full payment history will be removed. This cannot be undone."
        confirmLabel="Delete tenant"
        onCancel={() => setConfirmDeleteTenant(false)}
        onConfirm={async () => {
          setConfirmDeleteTenant(false)
          await deleteTenant(tenant.id)
          routeTo('house', { houseId })
          toast.success('Tenant deleted')
        }}
      />

      <ConfirmDialog
        open={Boolean(entryToDelete)}
        title={`Remove ${entryToDelete ? monthLabel(entryToDelete.month) : ''} record?`}
        body="The month goes back to unpaid, including every instalment logged against it. Status recalculates from what remains."
        confirmLabel="Remove record"
        onCancel={() => setEntryToDelete(null)}
        onConfirm={async () => {
          const month = entryToDelete!.month
          setEntryToDelete(null)
          await deleteHistoryEntry(tenant.id, month)
          toast.success('Payment record removed')
        }}
      />
    </Page>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  )
}

function HistoryRow({
  entry,
  onPay,
  onSettle,
  onInvoice,
  onDelete,
}: {
  entry: HistoryEntry
  onPay: () => void
  onSettle: () => void
  onInvoice?: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const strikeSettled = usePreferences((s) => s.strikeSettled)
  const lines = entry.breakdown ? billLines(entry.breakdown) : []
  const settled = entry.paymentStatus === 'paid'
  const partial = entry.paymentStatus === 'partially_paid'
  const progress = entry.totalAmount > 0 ? (entry.amountPaid / entry.totalAmount) * 100 : 100

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-[15px] font-semibold',
                settled && strikeSettled && 'text-muted-foreground line-through',
              )}
            >
              {monthLabel(entry.month)}
            </span>
            {partial && <Badge variant="warning">Part paid</Badge>}
            {entry.paymentStatus === 'unpaid' && <Badge variant="outline">Unpaid</Badge>}
            {entry.manual && <Tag>Manual</Tag>}
            {entry.viaBill && <Tag>On bill</Tag>}
            {entry.breakdown && <Tag>Itemised</Tag>}
          </div>
          <div className="mt-0.5 text-[12.5px] text-muted-foreground">
            {partial
              ? `${formatMoney(entry.amountPaid)} of ${formatMoney(entry.totalAmount)} · ${formatMoney(entry.amountDue)} left`
              : `logged ${formatDate(entry.date)}`}
          </div>
        </button>
        <span className="shrink-0 font-display text-[16px] font-semibold">
          {formatMoney(entry.amountPaid)}
        </span>
        <Button
          variant="quiet"
          size="icon-sm"
          onClick={onDelete}
          aria-label={`Remove ${monthLabel(entry.month)} record`}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {partial && <Progress className="mt-2" value={progress} indicatorClassName="bg-warning" />}

      {expanded && (
        <div className="mt-2.5 rounded-lg bg-muted px-3 py-2.5">
          {lines.length > 0 && (
            <ul className="space-y-1 text-[13px]">
              {lines.map((line) => (
                <li key={line.label} className="flex justify-between gap-3">
                  <span className="text-foreground/80">
                    {line.label}
                    {line.detail && (
                      <span className="ml-1 text-muted-foreground">({line.detail})</span>
                    )}
                  </span>
                  <span className="font-medium">{formatMoney(line.amount)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 border-t border-border pt-2">
            <div className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              Instalments
            </div>
            {entry.payments.length === 0 ? (
              <p className="text-[12.5px] text-muted-foreground">Nothing collected yet.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                {entry.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {formatDate(payment.date)} · {PAYMENT_METHOD_LABEL[payment.method]}
                      {payment.reference ? ` · ${payment.reference}` : ''}
                    </span>
                    <span className="shrink-0 font-medium">{formatMoney(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {!settled && (
              <>
                <Button size="xs" onClick={onPay}>
                  Record payment
                </Button>
                <Button size="xs" variant="outline" onClick={onSettle}>
                  Settle {formatMoney(money(entry.amountDue))}
                </Button>
              </>
            )}
            {onInvoice && (
              <Button size="xs" variant="link" onClick={onInvoice}>
                Open invoice
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function reminderText(tenant: TenantRecord, status: TenantStatus): string {
  const unit = tenant.unit ? ` (unit ${tenant.unit})` : ''
  if (status.outstanding.length > 1) {
    const months = status.outstanding.map((m) => monthLabel(m.month)).join(', ')
    return `Namaste ${tenant.name}${unit}, rent for ${months} is still outstanding — ${formatMoney(
      status.arrearsAmount,
    )} in total. Please clear it at your earliest. Thank you.`
  }
  if (status.state === 'partial') {
    return `Namaste ${tenant.name}${unit}, thank you for the part payment. ${formatMoney(
      status.arrearsAmount,
    )} is still outstanding for ${monthLabelLong(status.outstanding[0]?.month ?? monthKey())}. Thank you.`
  }
  return `Namaste ${tenant.name}${unit}, this is a reminder that rent of ${formatMoney(
    tenant.rent,
  )} for ${monthLabelLong(monthKey())} is ${status.label.toLowerCase()}. Thank you.`
}

export default Tenant

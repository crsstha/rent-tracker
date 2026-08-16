import { useState } from 'react'
import { AlertTriangle, Check, History, Pencil, Receipt, Share2, Trash2 } from 'lucide-react'
import { useHouse, useTenant } from '../hooks/useData'
import { billLines, formatMoney } from '../lib/billing'
import { deleteHistoryEntry, deleteTenant, markPaid, settleArrears } from '../lib/actions'
import { formatDate, monthKey, monthLabel, monthLabelLong, ordinal } from '../lib/dates'
import { tenantStatus } from '../lib/status'
import { useUI } from '../store'
import { TenantForm } from './TenantForm'
import { Confirm, Sheet, StatusChip } from './ui'
import type { HistoryEntry, Tenant } from '../types'

export function TenantSheet() {
  const tenantId = useUI((s) => s.openTenantId)
  const close = () => useUI.getState().openTenant(null)
  const tenant = useTenant(tenantId)
  const house = useHouse(tenant?.houseId ?? null)
  const openBilling = useUI((s) => s.openBilling)
  const openBackfill = useUI((s) => s.openBackfill)
  const showInvoice = useUI((s) => s.showInvoice)
  const notify = useUI((s) => s.notify)

  const [editing, setEditing] = useState(false)
  const [confirmDeleteTenant, setConfirmDeleteTenant] = useState(false)
  const [entryToDelete, setEntryToDelete] = useState<HistoryEntry | null>(null)

  const open = Boolean(tenantId) && !editing
  if (!tenant) {
    return open ? (
      <Sheet open title="Loading…" onClose={close}>
        <div />
      </Sheet>
    ) : null
  }

  const status = tenantStatus(tenant)
  const thisMonth = monthKey()
  const owed = status.unpaidMonths
  const paidThisMonth = tenant.history.some((h) => h.month === thisMonth)

  async function copyReminder() {
    if (!tenant) return
    const text = reminderText(tenant, status)
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        notify('Reminder copied')
      }
    } catch {
      /* user dismissed the share sheet — nothing to report */
    }
  }

  return (
    <>
      <Sheet
        open={open}
        title={tenant.name}
        subtitle={[tenant.unit && `Unit ${tenant.unit}`, house?.name].filter(Boolean).join(' · ')}
        onClose={close}
        footer={
          <div className="flex gap-2">
            {status.state === 'paid' ? (
              <div className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-forest-soft py-2.5 text-[14px] font-semibold text-forest">
                <Check size={16} />
                Paid for {monthLabel(thisMonth)}
              </div>
            ) : owed.length > 0 ? (
              <button
                className="btn-ghost flex-1"
                onClick={async () => {
                  const n = await settleArrears(tenant.id)
                  notify(`Settled ${n} month${n === 1 ? '' : 's'}`)
                }}
              >
                <Check size={16} />
                Settle {owed.length} month{owed.length === 1 ? '' : 's'}
              </button>
            ) : (
              <button
                className="btn-ghost flex-1"
                onClick={async () => {
                  await markPaid(tenant.id)
                  notify(`${tenant.name} marked paid`)
                }}
              >
                <Check size={16} />
                Mark paid
              </button>
            )}
            <button className="btn-primary flex-1" onClick={() => openBilling(tenant.id)}>
              <Receipt size={16} />
              {paidThisMonth ? 'New bill' : 'Generate bill'}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-3">
            <StatusChip state={status.state} label={status.label} />
            <div className="text-right">
              <div className="font-display text-[22px] leading-none font-semibold">
                {formatMoney(tenant.rent)}
              </div>
              <div className="mt-1 text-[12px] text-ink-3">per month</div>
            </div>
          </div>

          {owed.length > 0 && (
            <section className="rounded-[var(--radius-card)] border border-maroon/40 bg-maroon-soft/70 px-4 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-[14px] font-semibold text-maroon">
                  <AlertTriangle size={15} />
                  {owed.length} unpaid month{owed.length === 1 ? '' : 's'}
                </div>
                <div className="font-display text-[19px] leading-none font-semibold text-maroon">
                  {formatMoney(status.arrearsAmount)}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {owed.map((m) => (
                  <span
                    key={m}
                    className="rounded border border-maroon/25 bg-card px-2 py-0.5 text-[11.5px] font-medium text-maroon"
                  >
                    {monthLabel(m)}
                    {m === thisMonth ? ' · this month' : ''}
                  </span>
                ))}
              </div>
              <button
                className="btn-primary mt-3 w-full py-2 text-[14px]"
                onClick={async () => {
                  const n = await settleArrears(tenant.id)
                  notify(`Settled ${n} month${n === 1 ? '' : 's'} for ${tenant.name}`)
                }}
              >
                <Check size={15} />
                Settle all {formatMoney(status.arrearsAmount)}
              </button>
            </section>
          )}

          <dl className="card divide-y divide-rule-soft text-[14px]">
            <Row label="Due date">
              {status.dueDate.toLocaleDateString(undefined, { day: 'numeric', month: 'long' })} ·{' '}
              {ordinal(tenant.dueDay)} each month
            </Row>
            {tenant.phone && (
              <Row label="Phone">
                <a href={`tel:${tenant.phone}`} className="font-medium text-maroon underline">
                  {tenant.phone}
                </a>
              </Row>
            )}
            <Row label="Last paid">
              {tenant.lastPaidMonth
                ? `${monthLabelLong(tenant.lastPaidMonth)} · logged ${formatDate(tenant.lastPaidDate)}`
                : 'No payments logged yet'}
            </Row>
            {tenant.notes && <Row label="Notes">{tenant.notes}</Row>}
          </dl>

          <div className="grid grid-cols-2 gap-2">
            <button className="btn-ghost" onClick={() => openBackfill(tenant.id)}>
              <History size={16} />
              Log past months
            </button>
            <button className="btn-ghost" onClick={copyReminder} disabled={status.state === 'paid'}>
              <Share2 size={16} />
              Send reminder
            </button>
            <button className="btn-ghost" onClick={() => setEditing(true)}>
              <Pencil size={16} />
              Edit details
            </button>
            <button
              className="btn border border-rule bg-card text-maroon hover:bg-maroon-soft"
              onClick={() => setConfirmDeleteTenant(true)}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>

          <section>
            <h3 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
              Payment history
            </h3>
            {tenant.history.length === 0 ? (
              <p className="card px-4 py-5 text-center text-[13.5px] text-ink-3">
                Nothing logged yet. Use{' '}
                <span className="font-medium text-ink-2">Log past months</span> to backfill rent
                that’s already been paid.
              </p>
            ) : (
              <ul className="card divide-y divide-rule-soft">
                {tenant.history.map((entry) => (
                  <HistoryRow
                    key={entry.month}
                    entry={entry}
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
      </Sheet>

      <TenantForm
        open={editing}
        houseId={tenant.houseId}
        tenant={tenant}
        onClose={() => setEditing(false)}
      />

      <Confirm
        open={confirmDeleteTenant}
        title={`Delete ${tenant.name}?`}
        body="Their details and full payment history will be removed. This cannot be undone."
        confirmLabel="Delete tenant"
        onCancel={() => setConfirmDeleteTenant(false)}
        onConfirm={async () => {
          setConfirmDeleteTenant(false)
          close()
          await deleteTenant(tenant.id)
          notify('Tenant deleted')
        }}
      />

      <Confirm
        open={Boolean(entryToDelete)}
        title={`Remove ${entryToDelete ? monthLabel(entryToDelete.month) : ''} payment?`}
        body="That month goes back to unpaid, and paid status recalculates from what remains."
        confirmLabel="Remove entry"
        onCancel={() => setEntryToDelete(null)}
        onConfirm={async () => {
          const month = entryToDelete!.month
          setEntryToDelete(null)
          await deleteHistoryEntry(tenant.id, month)
          notify('Payment entry removed')
        }}
      />
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <dt className="w-24 shrink-0 text-[13px] text-ink-3">{label}</dt>
      <dd className="min-w-0 flex-1 text-ink">{children}</dd>
    </div>
  )
}

function HistoryRow({
  entry,
  onInvoice,
  onDelete,
}: {
  entry: HistoryEntry
  onInvoice?: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const lines = entry.breakdown ? billLines(entry.breakdown) : []

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <button
          className="min-w-0 flex-1 text-left"
          onClick={() => entry.breakdown && setExpanded((v) => !v)}
          aria-expanded={entry.breakdown ? expanded : undefined}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[15px] font-semibold">{monthLabel(entry.month)}</span>
            {entry.manual && <Tag>Manual</Tag>}
            {entry.viaBill && <Tag>On bill</Tag>}
            {entry.breakdown && (
              <span className="rounded bg-slate-soft px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-slate uppercase">
                Itemised
              </span>
            )}
          </div>
          <div className="mt-0.5 text-[12.5px] text-ink-3">logged {formatDate(entry.date)}</div>
        </button>
        <span className="font-display shrink-0 text-[16px] font-semibold">
          {formatMoney(entry.amount)}
        </span>
        <button
          onClick={onDelete}
          aria-label={`Remove ${monthLabel(entry.month)} payment`}
          className="-mr-1.5 shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-maroon-soft hover:text-maroon"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {expanded && entry.breakdown && (
        <div className="mt-2.5 rounded-lg bg-paper px-3 py-2.5">
          <ul className="space-y-1 text-[13px]">
            {lines.map((line) => (
              <li key={line.label} className="flex justify-between gap-3">
                <span className="text-ink-2">
                  {line.label}
                  {line.detail && <span className="ml-1 text-ink-3">({line.detail})</span>}
                </span>
                <span className="font-medium">{formatMoney(line.amount)}</span>
              </li>
            ))}
          </ul>
          {onInvoice && (
            <button
              className="mt-2.5 text-[13px] font-semibold text-maroon underline"
              onClick={onInvoice}
            >
              Open invoice
            </button>
          )}
        </div>
      )}
    </li>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-paper px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide text-ink-3 uppercase">
      {children}
    </span>
  )
}

function reminderText(tenant: Tenant, status: ReturnType<typeof tenantStatus>): string {
  const unit = tenant.unit ? ` (unit ${tenant.unit})` : ''
  if (status.unpaidMonths.length > 1) {
    const months = status.unpaidMonths.map(monthLabel).join(', ')
    return `Namaste ${tenant.name}${unit}, rent for ${months} is still outstanding — ${formatMoney(
      status.arrearsAmount,
    )} in total. Please clear it at your earliest. Thank you.`
  }
  return `Namaste ${tenant.name}${unit}, this is a reminder that rent of ${formatMoney(
    tenant.rent,
  )} for ${monthLabelLong(monthKey())} is ${status.label.toLowerCase()}. Thank you.`
}

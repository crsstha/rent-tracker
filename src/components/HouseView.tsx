import { useMemo, useState } from 'react'
import { Bell, Home, Pencil, Plus, Trash2 } from 'lucide-react'
import { needsAttention, summarise, useHouse, useRanked, useTenants } from '../hooks/useData'
import { formatMoney } from '../lib/billing'
import { deleteHouse } from '../lib/actions'
import { ordinal } from '../lib/dates'
import { useUI } from '../store'
import { HouseForm } from './HouseForm'
import { TenantForm } from './TenantForm'
import { Confirm, EmptyState, StatusChip } from './ui'
import type { RankedTenant } from '../hooks/useData'

export function HouseView({ houseId }: { houseId: string }) {
  const house = useHouse(houseId)
  const tenants = useTenants(houseId)
  const ranked = useRanked(tenants)
  const go = useUI((s) => s.go)
  const openTenant = useUI((s) => s.openTenant)
  const notify = useUI((s) => s.notify)

  const [addingTenant, setAddingTenant] = useState(false)
  const [editingHouse, setEditingHouse] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const summary = useMemo(() => summarise(tenants ?? []), [tenants])
  const attention = useMemo(() => needsAttention(ranked), [ranked])

  // The house was deleted from under us (or the id is stale) — go home.
  if (house === null) {
    go({ name: 'houses' })
    return null
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
      {/* Labelled, and on their own row: as bare icons beside "Tenants" they
          read as acting on the tenant list rather than the house. */}
      <div className="mb-3 flex justify-end gap-1">
        <button
          onClick={() => setEditingHouse(true)}
          className="btn-quiet px-2.5 py-1.5 text-[13px] font-medium"
        >
          <Pencil size={14} />
          Edit house
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          className="btn px-2.5 py-1.5 text-[13px] font-medium text-ink-3 hover:bg-maroon-soft hover:text-maroon"
        >
          <Trash2 size={14} />
          Delete
        </button>
      </div>

      <section className="card mb-4 grid grid-cols-3 divide-x divide-rule-soft">
        <Cell label="Collected" sub="this month" value={formatMoney(summary.collected)} tone="text-forest" />
        <Cell label="Pending" sub="this month" value={formatMoney(summary.pending)} tone="text-ink" />
        <Cell
          label="Arrears"
          sub={summary.arrears > 0 ? 'earlier months' : 'nothing older'}
          value={formatMoney(summary.arrears)}
          tone={summary.arrears > 0 ? 'text-maroon' : 'text-ink-3'}
        />
      </section>

      {attention.length > 0 && (
        <section className="mb-5 rounded-[var(--radius-card)] border border-maroon/25 bg-maroon-soft/60 p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <Bell size={15} className="text-maroon" />
            <h2 className="text-[11px] font-semibold tracking-[0.1em] text-maroon uppercase">
              Reminders
            </h2>
          </div>
          <ul className="space-y-1.5">
            {attention.map(({ tenant, status }) => (
              <li key={tenant.id}>
                <button
                  onClick={() => openTenant(tenant.id)}
                  className="flex w-full items-center gap-2 rounded-lg bg-card/80 px-3 py-2 text-left text-[14px] hover:bg-card"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{tenant.name}</span>
                  <span className="shrink-0 text-[12.5px] text-ink-3">
                    {formatMoney(
                      status.state === 'arrears' ? status.arrearsAmount : tenant.rent,
                    )}
                  </span>
                  <span
                    className={`shrink-0 text-[12.5px] font-semibold ${
                      status.state === 'due-soon' ? 'text-amber' : 'text-maroon'
                    }`}
                  >
                    {status.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Tenants</h2>
        {ranked.length > 0 && <span className="text-[12px] text-ink-3">{ranked.length} total</span>}
      </div>

      {tenants === undefined ? (
        <div className="card h-24 animate-pulse opacity-60" />
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={<Home size={22} />}
          title="No tenants here yet"
          body="Add the people renting in this house to start tracking their rent."
        />
      ) : (
        <ul className="space-y-2.5">
          {ranked.map((r) => (
            <TenantRow key={r.tenant.id} row={r} onOpen={() => openTenant(r.tenant.id)} />
          ))}
        </ul>
      )}

      <button className="btn-add mt-4" onClick={() => setAddingTenant(true)}>
        <Plus size={16} /> New tenant entry
      </button>

      <TenantForm open={addingTenant} houseId={houseId} onClose={() => setAddingTenant(false)} />
      {house && (
        <HouseForm open={editingHouse} house={house} onClose={() => setEditingHouse(false)} />
      )}
      <Confirm
        open={confirmDelete}
        title={`Delete ${house?.name ?? 'this house'}?`}
        body={`This also deletes ${ranked.length} tenant${ranked.length === 1 ? '' : 's'} and all their payment history. This cannot be undone.`}
        confirmLabel="Delete house"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await deleteHouse(houseId)
          go({ name: 'houses' })
          notify('House deleted')
        }}
      />
    </div>
  )
}

function Cell({
  label,
  sub,
  value,
  tone,
}: {
  label: string
  sub: string
  value: string
  tone: string
}) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        {label}
      </div>
      <div className={`font-display mt-0.5 text-[17px] font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-ink-3">{sub}</div>
    </div>
  )
}

function TenantRow({ row, onOpen }: { row: RankedTenant; onOpen: () => void }) {
  const { tenant, status } = row
  const owesMore = status.unpaidMonths.length > 1

  return (
    <li>
      <button
        onClick={onOpen}
        className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-maroon/40 active:scale-[0.995]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold">{tenant.name}</h3>
            {tenant.unit && (
              <span className="shrink-0 rounded bg-paper px-1.5 py-0.5 text-[11px] font-medium text-ink-3">
                {tenant.unit}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <StatusChip state={status.state} label={status.label} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[17px] font-semibold">
            {formatMoney(owesMore ? status.arrearsAmount : tenant.rent)}
          </div>
          <div className="text-[12px] text-ink-3">
            {owesMore ? 'total owed' : `due ${ordinal(tenant.dueDay)}`}
          </div>
        </div>
      </button>
    </li>
  )
}

import { useMemo, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Bell, Home, Pencil, Plus, Trash2 } from 'lucide-react'

import { CollectionChart } from '#components/CollectionChart'
import { ConfirmDialog } from '#components/ConfirmDialog'
import { EmptyState } from '#components/EmptyState'
import { HouseForm } from '#components/HouseForm'
import { Page, SectionHeading } from '#components/Page'
import { StatusBadge } from '#components/StatusBadge'
import { TenantForm } from '#components/TenantForm'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { Skeleton } from '#components/ui/skeleton'
import { toast } from '#components/ui/sonner'
import type { MonthPoint, RankedTenant } from '#hooks/useData'
import {
  monthlyCollection,
  needsAttention,
  summarise,
  totalsFor,
  useHouse,
  useRanked,
  useTenants,
} from '#hooks/useData'
import { deleteHouse } from '#lib/actions'
import { cn } from '#lib/utils'
import useRouting, { routePath } from '#root/hooks/useRouting'
import { useDateSystem } from '#store/preferences'
import { monthLabelIn } from '#utils/calendar'
import { addMonths, endOfMonth, monthKey, ordinal } from '#utils/dates'
import { formatMoney } from '#utils/format'

import type { Tenant } from '#types'

/** How far the collection chart looks back, in months. */
const MONTHS_CHARTED = 12

type Period = 'this-month' | 'last-month' | 'year'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'year', label: 'Last 12 months' },
]

interface StatCell {
  label: string
  sub: string
  value: string
  tone: string
}

/**
 * The three headline figures for whichever period is showing, and the months
 * the chart should draw at full strength.
 *
 * A past month is summarised as of its own last day rather than today, so
 * "last month" reads as it did when the month closed — arrears counted from
 * there, not from now.
 */
function usePeriodStats(
  tenants: Tenant[],
  series: MonthPoint[],
  period: Period,
): { cells: StatCell[]; emphasis: string[] } {
  const system = useDateSystem()

  return useMemo(() => {
    if (period === 'year') {
      const totals = totalsFor(series)
      return {
        cells: [
          {
            label: 'Collected',
            sub: `${totals.months} months`,
            value: formatMoney(totals.collected),
            tone: 'text-success',
          },
          {
            label: 'Billed',
            sub: 'rent + utilities',
            value: formatMoney(totals.billed),
            tone: 'text-foreground',
          },
          {
            label: 'Still due',
            sub: totals.due > 0 ? 'across the year' : 'all settled',
            value: formatMoney(totals.due),
            tone: totals.due > 0 ? 'text-destructive' : 'text-muted-foreground',
          },
        ],
        emphasis: series.map((point) => point.month),
      }
    }

    const month = period === 'this-month' ? monthKey() : addMonths(monthKey(), -1)
    const asOf = period === 'this-month' ? new Date() : endOfMonth(month)
    const summary = summarise(tenants, asOf)
    const when = monthLabelIn(month, system)

    return {
      cells: [
        {
          label: 'Collected',
          sub: when,
          value: formatMoney(summary.collected),
          tone: 'text-success',
        },
        {
          label: 'Pending',
          sub: when,
          value: formatMoney(summary.pending),
          tone: 'text-foreground',
        },
        {
          label: 'Arrears',
          sub: summary.arrears > 0 ? 'earlier months' : 'nothing older',
          value: formatMoney(summary.arrears),
          tone: summary.arrears > 0 ? 'text-destructive' : 'text-muted-foreground',
        },
      ],
      emphasis: [month],
    }
  }, [tenants, series, period, system])
}

function PeriodTabs({ value, onChange }: { value: Period; onChange: (next: Period) => void }) {
  return (
    <div
      role="group"
      aria-label="Period"
      className="mb-3 flex rounded-lg border border-border bg-muted p-0.5"
    >
      {PERIODS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex-1 rounded-[6px] px-2 py-1.5 text-[12.5px] font-medium transition',
            value === option.value
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function House() {
  const { houseId = '' } = useParams()
  const routeTo = useRouting()
  const system = useDateSystem()
  const house = useHouse(houseId)
  const tenants = useTenants(houseId)
  const ranked = useRanked(tenants)

  const [addingTenant, setAddingTenant] = useState(false)
  const [editingHouse, setEditingHouse] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [period, setPeriod] = useState<Period>('this-month')

  const attention = useMemo(() => needsAttention(ranked), [ranked])
  const series = useMemo(() => monthlyCollection(tenants ?? [], MONTHS_CHARTED), [tenants])
  const { cells, emphasis } = usePeriodStats(tenants ?? [], series, period)

  // The house was deleted from under us (or the id is stale) — go home.
  // `replace`, so Back doesn't bounce straight into the missing record again.
  if (house === null) return <Navigate to={routePath('houses')} replace />

  return (
    <Page
      title={house?.name ?? '…'}
      subtitle={house?.address}
      backTo={routePath('houses')}
      backLabel="All houses"
    >
      {/* Labelled, and on their own row: as bare icons beside "Tenants" they
          read as acting on the tenant list rather than the house. */}
      <div className="mb-3 flex justify-end gap-1">
        <Button variant="quiet" size="sm" onClick={() => setEditingHouse(true)}>
          <Pencil />
          Edit house
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:bg-primary-soft hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 />
          Delete
        </Button>
      </div>

      <PeriodTabs value={period} onChange={setPeriod} />

      <Card className="mb-4 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-rule-soft">
          {cells.map((cell) => (
            <Cell key={cell.label} {...cell} />
          ))}
        </div>
        <div className="border-t border-rule-soft px-3.5 pt-3.5 pb-3">
          <CollectionChart points={series} system={system} emphasis={emphasis} />
        </div>
      </Card>

      {attention.length > 0 && (
        <section className="mb-5 rounded-card border border-primary/25 bg-primary-soft/60 p-3.5">
          <div className="mb-2.5 flex items-center gap-2">
            <Bell size={15} className="text-primary" />
            <h2 className="text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">
              Reminders
            </h2>
          </div>
          <ul className="space-y-1.5">
            {attention.map(({ tenant, status }) => (
              <li key={tenant.id}>
                <Link
                  to={routePath('tenant', { houseId, tenantId: tenant.id })}
                  className="flex w-full items-center gap-2 rounded-lg bg-card/80 px-3 py-2 text-left text-[14px] hover:bg-card"
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{tenant.name}</span>
                  <span className="shrink-0 text-[12.5px] text-muted-foreground">
                    {formatMoney(status.arrearsAmount > 0 ? status.arrearsAmount : tenant.rent)}
                  </span>
                  <span
                    className={`shrink-0 text-[12.5px] font-semibold ${
                      status.state === 'due-soon' || status.state === 'partial'
                        ? 'text-warning'
                        : 'text-destructive'
                    }`}
                  >
                    {status.label}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <SectionHeading aside={ranked.length > 0 ? `${ranked.length} total` : undefined}>
        Tenants
      </SectionHeading>

      {tenants === undefined ? (
        <Skeleton className="h-24" />
      ) : ranked.length === 0 ? (
        <EmptyState
          icon={<Home size={22} />}
          title="No tenants here yet"
          body="Add the people renting in this house to start tracking their rent."
        />
      ) : (
        <ul className="space-y-2.5">
          {ranked.map((r) => (
            <TenantRow key={r.tenant.id} row={r} houseId={houseId} />
          ))}
        </ul>
      )}

      <button type="button" className="mt-4 btn-add" onClick={() => setAddingTenant(true)}>
        <Plus size={16} /> New tenant entry
      </button>

      <TenantForm open={addingTenant} houseId={houseId} onClose={() => setAddingTenant(false)} />
      {house && (
        <HouseForm open={editingHouse} house={house} onClose={() => setEditingHouse(false)} />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${house?.name ?? 'this house'}?`}
        body={`This also deletes ${ranked.length} tenant${ranked.length === 1 ? '' : 's'} and all their payment history. This cannot be undone.`}
        confirmLabel="Delete house"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false)
          await deleteHouse(houseId)
          routeTo('houses')
          toast.success('House deleted')
        }}
      />
    </Page>
  )
}

function Cell({ label, sub, value, tone }: StatCell) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`mt-0.5 font-display text-[17px] font-semibold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10.5px] text-muted-foreground">{sub}</div>
    </div>
  )
}

function TenantRow({ row, houseId }: { row: RankedTenant; houseId: string }) {
  const { tenant, status } = row
  const owesMore = status.outstanding.length > 1

  return (
    <li>
      <Link
        to={routePath('tenant', { houseId, tenantId: tenant.id })}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40 active:scale-[0.995]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[16px] font-semibold">{tenant.name}</h3>
            {tenant.unit && (
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                {tenant.unit}
              </span>
            )}
          </div>
          <div className="mt-1.5">
            <StatusBadge state={status.state} label={status.label} />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[17px] font-semibold">
            {formatMoney(owesMore ? status.arrearsAmount : tenant.rent)}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {owesMore ? 'total owed' : `due ${ordinal(tenant.dueDay)}`}
          </div>
        </div>
      </Link>
    </li>
  )
}

export default House

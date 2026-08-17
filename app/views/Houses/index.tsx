import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Bell, Building2, Check, ChevronRight, Plus, Settings } from 'lucide-react'

import { EmptyState } from '#components/EmptyState'
import { HouseForm } from '#components/HouseForm'
import { InstallHint } from '#components/InstallHint'
import { Page, SectionHeading } from '#components/Page'
import { Badge } from '#components/ui/badge'
import { Card } from '#components/ui/card'
import { Skeleton } from '#components/ui/skeleton'
import { summarise, useAllTenants, useHouses } from '#hooks/useData'
import { routePath } from '#root/hooks/useRouting'
import { monthKey, monthLabelLong } from '#utils/dates'
import { formatMoney } from '#utils/format'
import { tenantStatus } from '#utils/status'

import type { House, Tenant } from '#types'

function Houses() {
  const houses = useHouses()
  const tenants = useAllTenants()
  const [adding, setAdding] = useState(false)

  const byHouse = useMemo(() => {
    const map = new Map<string, Tenant[]>()
    for (const t of tenants ?? []) {
      const list = map.get(t.houseId)
      if (list) list.push(t)
      else map.set(t.houseId, [t])
    }
    return map
  }, [tenants])

  const overall = useMemo(() => summarise(tenants ?? []), [tenants])
  const attention = useMemo(
    () =>
      (tenants ?? []).filter((t) => {
        const s = tenantStatus(t).state
        return s === 'overdue' || s === 'due-soon' || s === 'arrears' || s === 'partial'
      }).length,
    [tenants],
  )

  const loading = houses === undefined || tenants === undefined

  return (
    <Page
      title="Rent Register"
      subtitle={monthLabelLong(monthKey())}
      actions={
        <Link to={routePath('settings')} className="cover-btn">
          <Settings size={13} /> Settings
        </Link>
      }
      className="pt-0"
    >
      <InstallHint />

      <div className="pt-5">
        {!loading && houses.length > 0 && (
          <Card className="mb-5 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-rule-soft border-b border-rule-soft">
              <Stat label="Collected" value={formatMoney(overall.collected)} tone="text-success" />
              <Stat label="Pending" value={formatMoney(overall.pending)} tone="text-foreground" />
              <Stat
                label="Arrears"
                value={formatMoney(overall.arrears)}
                tone={overall.arrears > 0 ? 'text-destructive' : 'text-muted-foreground'}
              />
            </div>
            <div className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
              {attention > 0 ? (
                <Bell size={15} className="text-destructive" />
              ) : (
                <Check size={15} className="text-success" />
              )}
              <span
                className={attention > 0 ? 'font-medium text-destructive' : 'text-muted-foreground'}
              >
                {attention > 0
                  ? `${attention} tenant${attention === 1 ? '' : 's'} need attention`
                  : 'Nothing due in the next 3 days'}
              </span>
              {overall.partialCount > 0 && (
                <Badge variant="warning" className="ml-auto">
                  {overall.partialCount} part paid
                </Badge>
              )}
            </div>
          </Card>
        )}

        <SectionHeading
          aside={!loading && houses.length > 0 ? `${houses.length} total` : undefined}
        >
          Houses
        </SectionHeading>

        {loading ? (
          <div className="space-y-2.5">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[86px]" />
            ))}
          </div>
        ) : houses.length === 0 ? (
          <EmptyState
            icon={<Building2 size={22} />}
            title="No houses yet"
            body="Add your first house, then start adding the tenants who live there."
          />
        ) : (
          <ul className="space-y-2.5">
            {houses.map((house) => (
              <HouseCard key={house.id} house={house} tenants={byHouse.get(house.id) ?? []} />
            ))}
          </ul>
        )}

        <button type="button" className="mt-4 btn-add" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add house
        </button>
      </div>

      <HouseForm open={adding} onClose={() => setAdding(false)} />
    </Page>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        {label}
      </div>
      <div className={`mt-0.5 font-display text-[17px] font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function HouseCard({ house, tenants }: { house: House; tenants: Tenant[] }) {
  const s = summarise(tenants)

  return (
    <li>
      <Link
        to={routePath('house', { houseId: house.id })}
        className="flex w-full items-center gap-3 rounded-card border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40 active:scale-[0.995]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-display text-[16px] font-semibold">{house.name}</h3>
            {s.arrears > 0 && <Badge variant="alert">{formatMoney(s.arrears)} arrears</Badge>}
            {s.partialCount > 0 && <Badge variant="warning">{s.partialCount} part paid</Badge>}
          </div>
          {house.address && (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{house.address}</p>
          )}
          {/* No dot separators: they dangle at the end of a wrapped line. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px]">
            <span>
              {s.tenantCount} tenant{s.tenantCount === 1 ? '' : 's'}
            </span>
            <span className="font-medium text-success">{formatMoney(s.collected)} in</span>
            {s.pending > 0 && (
              <span className="text-muted-foreground">{formatMoney(s.pending)} pending</span>
            )}
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
      </Link>
    </li>
  )
}

export default Houses

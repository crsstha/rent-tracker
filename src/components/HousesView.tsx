import { useMemo, useState } from 'react'
import { Bell, Building2, Check, ChevronRight, Plus } from 'lucide-react'
import { summarise, useAllTenants, useHouses } from '../hooks/useData'
import { formatMoney } from '../lib/billing'
import { tenantStatus } from '../lib/status'
import { useUI } from '../store'
import { HouseForm } from './HouseForm'
import { EmptyState } from './ui'
import type { House, Tenant } from '../types'

export function HousesView() {
  const houses = useHouses()
  const tenants = useAllTenants()
  const go = useUI((s) => s.go)
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
        return s === 'overdue' || s === 'due-soon' || s === 'arrears'
      }).length,
    [tenants],
  )

  const loading = houses === undefined || tenants === undefined

  return (
    <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
      {!loading && houses.length > 0 && (
        <section className="card mb-5 overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-rule-soft border-b border-rule-soft">
            <Stat label="Collected" value={formatMoney(overall.collected)} tone="text-forest" />
            <Stat label="Pending" value={formatMoney(overall.pending)} tone="text-ink" />
            <Stat
              label="Arrears"
              value={formatMoney(overall.arrears)}
              tone={overall.arrears > 0 ? 'text-maroon' : 'text-ink-3'}
            />
          </div>
          <div className="flex items-center gap-2 px-4 py-2.5 text-[13px]">
            {attention > 0 ? (
              <Bell size={15} className="text-maroon" />
            ) : (
              <Check size={15} className="text-forest" />
            )}
            <span className={attention > 0 ? 'font-medium text-maroon' : 'text-ink-3'}>
              {attention > 0
                ? `${attention} tenant${attention === 1 ? '' : 's'} need attention`
                : 'Nothing due in the next 3 days'}
            </span>
          </div>
        </section>
      )}

      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">Houses</h2>
        {!loading && houses.length > 0 && (
          <span className="text-[12px] text-ink-3">{houses.length} total</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1].map((i) => (
            <div key={i} className="card h-[86px] animate-pulse opacity-60" />
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
            <HouseCard
              key={house.id}
              house={house}
              tenants={byHouse.get(house.id) ?? []}
              onOpen={() => go({ name: 'house', houseId: house.id })}
            />
          ))}
        </ul>
      )}

      <button className="btn-add mt-4" onClick={() => setAdding(true)}>
        <Plus size={16} /> Add house
      </button>

      <HouseForm open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
        {label}
      </div>
      <div className={`font-display mt-0.5 text-[17px] font-semibold ${tone}`}>{value}</div>
    </div>
  )
}

function HouseCard({
  house,
  tenants,
  onOpen,
}: {
  house: House
  tenants: Tenant[]
  onOpen: () => void
}) {
  const s = summarise(tenants)
  return (
    <li>
      <button
        onClick={onOpen}
        className="card flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:border-maroon/40 active:scale-[0.995]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display truncate text-[16px] font-semibold">{house.name}</h3>
            {s.arrears > 0 && (
              <span className="chip bg-maroon text-paper-2">{formatMoney(s.arrears)} arrears</span>
            )}
          </div>
          {house.address && <p className="mt-0.5 truncate text-[13px] text-ink-3">{house.address}</p>}
          {/* No dot separators: they dangle at the end of a wrapped line. */}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[13px] text-ink-2">
            <span>
              {s.tenantCount} tenant{s.tenantCount === 1 ? '' : 's'}
            </span>
            <span className="font-medium text-forest">{formatMoney(s.collected)} in</span>
            {s.pending > 0 && <span className="text-ink-3">{formatMoney(s.pending)} pending</span>}
          </div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-3" />
      </button>
    </li>
  )
}

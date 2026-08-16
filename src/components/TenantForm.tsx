import { useEffect, useState } from 'react'
import { Field, Sheet } from './ui'
import { createTenant, updateTenant, type TenantDraft } from '../lib/actions'
import { monthKey } from '../lib/dates'
import { tenancyStart } from '../lib/status'
import type { Tenant } from '../types'

export function TenantForm({
  open,
  houseId,
  tenant,
  onClose,
}: {
  open: boolean
  houseId: string
  tenant?: Tenant | null
  onClose: () => void
}) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setForm({
      name: tenant?.name ?? '',
      unit: tenant?.unit ?? '',
      phone: tenant?.phone ?? '',
      rent: tenant ? String(tenant.rent) : '',
      dueDay: tenant ? String(tenant.dueDay) : '5',
      startMonth: tenant ? tenancyStart(tenant) : monthKey(),
      notes: tenant?.notes ?? '',
    })
    setError('')
  }, [open, tenant])

  const set = (key: string) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setError('')
  }

  async function save() {
    if (!form.name?.trim()) return setError('Enter the tenant’s name.')
    const rent = Number(form.rent)
    if (!Number.isFinite(rent) || rent <= 0) return setError('Enter a monthly rent amount.')
    const dueDay = Number(form.dueDay)
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 28) {
      return setError('Due day must be between 1 and 28.')
    }
    if (form.startMonth && form.startMonth > monthKey()) {
      return setError('Tenancy can’t start in the future.')
    }

    const draft: TenantDraft = {
      name: form.name,
      unit: form.unit,
      phone: form.phone,
      rent,
      dueDay,
      startMonth: form.startMonth,
      notes: form.notes,
    }

    if (tenant) await updateTenant(tenant.id, draft)
    else await createTenant(houseId, draft)
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={tenant ? 'Edit tenant' : 'Add a tenant'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save}>
            {tenant ? 'Save changes' : 'Add tenant'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Full name">
          <input
            className="field"
            autoFocus={!tenant}
            value={form.name ?? ''}
            placeholder="Rajesh Thapa"
            onChange={set('name')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit / room">
            <input className="field" value={form.unit ?? ''} placeholder="2B" onChange={set('unit')} />
          </Field>
          <Field label="Phone">
            <input
              className="field"
              type="tel"
              inputMode="tel"
              value={form.phone ?? ''}
              placeholder="98XXXXXXXX"
              onChange={set('phone')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monthly rent">
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-ink-3">
                Rs
              </span>
              <input
                className="field pl-9"
                type="number"
                inputMode="numeric"
                value={form.rent ?? ''}
                placeholder="12000"
                onChange={set('rent')}
              />
            </div>
          </Field>
          <Field label="Due day" hint="1–28, so it exists every month.">
            <input
              className="field"
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              value={form.dueDay ?? ''}
              onChange={set('dueDay')}
            />
          </Field>
        </div>

        <Field label="Tenant since" hint="Unpaid months are counted from here.">
          <input
            className="field"
            type="month"
            max={monthKey()}
            value={form.startMonth ?? ''}
            onChange={set('startMonth')}
          />
        </Field>

        <Field label="Notes">
          <textarea
            className="field min-h-[76px] resize-y"
            value={form.notes ?? ''}
            placeholder="Deposit Rs 20,000 held. Moved in Baisakh 2082."
            onChange={set('notes')}
          />
        </Field>

        {error && <p className="text-[13px] font-medium text-maroon">{error}</p>}
      </div>
    </Sheet>
  )
}

import { useEffect, useState } from 'react'

import { AmountInput, Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { Textarea } from '#components/ui/textarea'
import { createTenant, type TenantDraft, updateTenant } from '#lib/actions'
import { usePreferences } from '#store/preferences'
import { monthKey } from '#utils/dates'
import { tenancyStart } from '#utils/status'

import type { Tenant } from '#types'

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
  const expandNotesOnFocus = usePreferences((s) => s.expandNotesOnFocus)
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notesFocused, setNotesFocused] = useState(false)

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
    <FormSheet
      open={open}
      onClose={onClose}
      title={tenant ? 'Edit tenant' : 'Add a tenant'}
      closeAction={false}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save}>
            {tenant ? 'Save changes' : 'Add tenant'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Full name">
          <Input
            autoFocus={!tenant}
            value={form.name ?? ''}
            placeholder="Rajesh Thapa"
            onChange={set('name')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Unit / room">
            <Input value={form.unit ?? ''} placeholder="2B" onChange={set('unit')} />
          </Field>
          <Field label="Phone">
            <Input
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
            <AmountInput
              value={Number(form.rent) || 0}
              onChange={(v) => setForm((f) => ({ ...f, rent: String(v) }))}
              placeholder="12000"
            />
          </Field>
          <Field label="Due day" hint="1–28, so it exists every month.">
            <Input
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
          <Input
            type="month"
            max={monthKey()}
            value={form.startMonth ?? ''}
            onChange={set('startMonth')}
          />
        </Field>

        <Field label="Notes">
          <Textarea
            value={form.notes ?? ''}
            placeholder="Deposit Rs 20,000 held. Moved in Baisakh 2082."
            className={
              expandNotesOnFocus && !notesFocused && !form.notes
                ? 'min-h-11 resize-none'
                : undefined
            }
            onFocus={() => setNotesFocused(true)}
            onBlur={() => setNotesFocused(false)}
            onChange={set('notes')}
          />
        </Field>

        {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
      </div>
    </FormSheet>
  )
}

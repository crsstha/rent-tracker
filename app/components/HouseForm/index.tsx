import { useEffect, useState } from 'react'

import { Field } from '#components/Field'
import { FormSheet } from '#components/FormSheet'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { createHouse, updateHouse } from '#lib/actions'

import type { House } from '#types'

export function HouseForm({
  open,
  house,
  onClose,
  onSaved,
}: {
  open: boolean
  house?: House | null
  onClose: () => void
  onSaved?: (id: string) => void
}) {
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(house?.name ?? '')
    setAddress(house?.address ?? '')
    setError('')
  }, [open, house])

  async function save() {
    if (!name.trim()) {
      setError('Give the house a name.')
      return
    }
    if (house) {
      await updateHouse(house.id, { name: name.trim(), address: address.trim() || undefined })
      onSaved?.(house.id)
    } else {
      // Must not be inlined as `onSaved?.(await createHouse(...))`: an optional
      // call short-circuits its arguments, so with no onSaved passed (the
      // common case) the house was never created at all.
      const id = await createHouse({ name, address })
      onSaved?.(id)
    }
    onClose()
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={house ? 'Edit house' : 'Add a house'}
      closeAction={false}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-1" onClick={save}>
            {house ? 'Save changes' : 'Add house'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="House name">
          <Input
            value={name}
            autoFocus
            placeholder="Baneshwor House"
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
          />
        </Field>
        <Field label="Address" hint="Optional — shown on invoices.">
          <Input
            value={address}
            placeholder="Ward 10, Lalitpur"
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        {error && <p className="text-[13px] font-medium text-destructive">{error}</p>}
      </div>
    </FormSheet>
  )
}

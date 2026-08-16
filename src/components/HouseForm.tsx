import { useEffect, useState } from 'react'
import { Field, Sheet } from './ui'
import { createHouse, updateHouse } from '../lib/actions'
import type { House } from '../types'

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
      onSaved?.(await createHouse({ name, address }))
    }
    onClose()
  }

  return (
    <Sheet
      open={open}
      title={house ? 'Edit house' : 'Add a house'}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button className="btn-ghost flex-1" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary flex-1" onClick={save}>
            {house ? 'Save changes' : 'Add house'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="House name">
          <input
            className="field"
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
          <input
            className="field"
            value={address}
            placeholder="Ward 10, Lalitpur"
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        {error && <p className="text-[13px] font-medium text-maroon">{error}</p>}
      </div>
    </Sheet>
  )
}

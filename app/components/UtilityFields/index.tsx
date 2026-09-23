import type { ReactNode } from 'react'
import { Zap } from 'lucide-react'

import { AmountInput, Field } from '#components/Field'
import { Card } from '#components/ui/card'
import { Input } from '#components/ui/input'
import { Switch } from '#components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '#components/ui/tabs'
import { type BillInput, DEFAULT_ELEC_RATE } from '#utils/billing'
import { formatMoney } from '#utils/format'

import type { BillBreakdown } from '#types'

type Setter = <K extends keyof BillInput>(key: K, value: BillInput[K]) => void

/**
 * Water, electricity and garbage — the opt-in charges on top of rent. Shared
 * by the bill sheet and the payment sheet so a month can pick up its utilities
 * whichever way it gets charged.
 */
export function UtilityFields({
  input,
  set,
  breakdown,
}: {
  input: BillInput
  set: Setter
  breakdown: BillBreakdown
}) {
  return (
    <>
      <Toggle
        label="Water"
        hint="Flat amount, no meter"
        on={input.waterEnabled}
        onToggle={(v) => set('waterEnabled', v)}
      >
        <AmountInput value={input.water} onChange={(v) => set('water', v)} placeholder="500" />
      </Toggle>

      <Toggle
        label="Electricity"
        hint={input.elecMode === 'units' ? 'By meter reading' : 'Flat amount'}
        on={input.elecEnabled}
        onToggle={(v) => set('elecEnabled', v)}
      >
        <div className="space-y-3">
          <Tabs
            value={input.elecMode}
            onValueChange={(v) => set('elecMode', v as BillInput['elecMode'])}
          >
            <TabsList>
              <TabsTrigger value="units">By units</TabsTrigger>
              <TabsTrigger value="amount">Direct amount</TabsTrigger>
            </TabsList>
          </Tabs>

          {input.elecMode === 'units' ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Previous">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={input.elecPrev ?? ''}
                    placeholder="0"
                    onChange={(e) =>
                      set('elecPrev', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Current">
                  <Input
                    type="number"
                    inputMode="numeric"
                    value={input.elecCurr ?? ''}
                    placeholder="0"
                    onChange={(e) =>
                      set('elecCurr', e.target.value === '' ? null : Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Rs / unit">
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={input.elecRate}
                    onChange={(e) => set('elecRate', Number(e.target.value) || DEFAULT_ELEC_RATE)}
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
                <Zap className="size-3.5 shrink-0" />
                <span>
                  {breakdown.electricity.units} units × Rs {breakdown.electricity.rate} ={' '}
                  <strong className="font-semibold">
                    {formatMoney(breakdown.electricity.cost)}
                  </strong>
                </span>
              </div>
            </>
          ) : (
            <AmountInput
              value={input.elecAmount}
              onChange={(v) => set('elecAmount', v)}
              placeholder="1200"
            />
          )}
        </div>
      </Toggle>

      <Toggle
        label="Garbage"
        hint="Flat amount"
        on={input.garbageEnabled}
        onToggle={(v) => set('garbageEnabled', v)}
      >
        <AmountInput value={input.garbage} onChange={(v) => set('garbage', v)} placeholder="200" />
      </Toggle>
    </>
  )
}

export function Toggle({
  label,
  hint,
  on,
  onToggle,
  children,
}: {
  label: string
  hint: string
  on: boolean
  onToggle: (value: boolean) => void
  children: ReactNode
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <div className="flex-1">
          <div className="text-[15px] font-semibold">{label}</div>
          <div className="text-[12.5px] text-muted-foreground">{hint}</div>
        </div>
        <Switch checked={on} onCheckedChange={onToggle} aria-label={label} />
      </div>
      {on && <div className="border-t border-rule-soft px-4 py-3">{children}</div>}
    </Card>
  )
}

import { Check, Monitor, Moon, RotateCcw, Sun } from 'lucide-react'

import { Page } from '#components/Page'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { Checkbox } from '#components/ui/checkbox'
import { Label } from '#components/ui/label'
import { RadioGroup, RadioGroupItem } from '#components/ui/radio-group'
import { toast } from '#components/ui/sonner'
import { Switch } from '#components/ui/switch'
import { useResolvedMode } from '#hooks/useAppearanceEffect'
import { type PaletteId, PALETTES, type ResolvedMode, type ThemeMode } from '#lib/theme'
import { cn } from '#lib/utils'
import { routePath } from '#root/hooks/useRouting'
import { useAppearance } from '#store/appearance'
import {
  type Preferences,
  QUICK_ACTIONS,
  type QuickActionId,
  usePreferences,
} from '#store/preferences'

const MODES: { value: ThemeMode; label: string; hint: string; icon: typeof Sun }[] = [
  { value: 'auto', label: 'Auto', hint: 'Follow the device setting', icon: Monitor },
  { value: 'light', label: 'Light', hint: 'Always light', icon: Sun },
  { value: 'dark', label: 'Dark', hint: 'Always dark', icon: Moon },
]

const TOGGLES: { key: keyof Preferences; label: string; hint: string }[] = [
  {
    key: 'expandNotesOnFocus',
    label: 'Expand note fields only on focus',
    hint: 'Notes and payment remarks stay one line until you tap into them.',
  },
  {
    key: 'compactStatus',
    label: 'Make status compact',
    hint: 'Payment status shows as a dot and short label instead of a full badge.',
  },
  {
    key: 'strikeSettled',
    label: 'Strike through settled months',
    hint: 'Months paid in full are struck out in payment history.',
  },
  {
    key: 'autoDetectMethod',
    label: 'Auto-detect payment method on note blur',
    hint: 'Typing “eSewa” or “cheque 4412” in a note picks the method for you.',
  },
]

function Appearance() {
  const mode = useAppearance((s) => s.mode)
  const setMode = useAppearance((s) => s.setMode)
  const lightPalette = useAppearance((s) => s.lightPalette)
  const darkPalette = useAppearance((s) => s.darkPalette)
  const setPalette = useAppearance((s) => s.setPalette)
  const resolved = useResolvedMode()

  const prefs = usePreferences()

  return (
    <Page
      title="Appearance"
      subtitle="Theme, palette and entry preferences"
      backTo={routePath('settings')}
      backLabel="Settings"
    >
      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Mode
        </h2>
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as ThemeMode)}
          className="grid-cols-3 gap-2"
        >
          {MODES.map((option) => (
            <label
              key={option.value}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-1.5 rounded-card border px-2 py-3 text-center transition',
                mode === option.value
                  ? 'border-primary bg-primary-soft'
                  : 'border-border bg-card hover:bg-accent',
              )}
            >
              <RadioGroupItem value={option.value} className="sr-only" />
              <option.icon
                className={cn(
                  'size-5',
                  mode === option.value ? 'text-primary' : 'text-muted-foreground',
                )}
              />
              <span className="text-[14px] font-semibold">{option.label}</span>
              <span className="text-[11.5px] leading-tight text-muted-foreground">
                {option.hint}
              </span>
            </label>
          ))}
        </RadioGroup>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {mode === 'auto'
            ? `Following your device — currently ${resolved}.`
            : `Locked to ${mode}.`}
        </p>
      </section>

      {/* Two independent pickers: the light palette never affects dark, and
          vice versa, so each mode can have its own look. */}
      <PalettePicker
        mode="light"
        title="Light palette"
        active={lightPalette}
        inUse={resolved === 'light'}
        onSelect={(id) => setPalette('light', id)}
      />

      <PalettePicker
        mode="dark"
        title="Dark palette"
        active={darkPalette}
        inUse={resolved === 'dark'}
        onSelect={(id) => setPalette('dark', id)}
      />

      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Entry preferences
        </h2>
        <Card className="divide-y divide-rule-soft">
          {TOGGLES.map((toggle) => (
            <div key={toggle.key} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="text-[14.5px] font-medium">{toggle.label}</div>
                <div className="text-[12.5px] leading-relaxed text-muted-foreground">
                  {toggle.hint}
                </div>
              </div>
              <Switch
                checked={prefs[toggle.key] as boolean}
                aria-label={toggle.label}
                onCheckedChange={(next) => prefs.set(toggle.key, next as never)}
              />
            </div>
          ))}
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          Actions shown on the tenant page
        </h2>
        <Card className="divide-y divide-rule-soft">
          {QUICK_ACTIONS.map((action) => {
            const checked = prefs.quickActions.includes(action.id)
            return (
              <label
                key={action.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[14.5px]"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => prefs.toggleQuickAction(action.id as QuickActionId)}
                />
                <span className="flex-1">{action.label}</span>
                <span className="text-[12px] text-muted-foreground">
                  {checked ? 'on the page' : 'in the ⋯ menu'}
                </span>
              </label>
            )
          })}
        </Card>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          Anything switched off still works — it moves into the overflow menu.
        </p>
      </section>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          prefs.reset()
          toast.success('Entry preferences reset')
        }}
      >
        <RotateCcw />
        Reset entry preferences
      </Button>
    </Page>
  )
}

function PalettePicker({
  mode,
  title,
  active,
  inUse,
  onSelect,
}: {
  mode: ResolvedMode
  title: string
  active: PaletteId
  inUse: boolean
  onSelect: (id: PaletteId) => void
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
          {title}
        </h2>
        {inUse && <span className="text-[11px] text-muted-foreground">showing now</span>}
      </div>

      <RadioGroup
        value={active}
        onValueChange={(v) => onSelect(v as PaletteId)}
        className="gap-0 overflow-hidden rounded-card border border-border bg-card"
      >
        {PALETTES.map((palette) => {
          const swatch = palette.swatch[mode]
          const selected = active === palette.id
          return (
            <label
              key={palette.id}
              className={cn(
                'flex cursor-pointer items-center gap-3 border-b border-rule-soft px-4 py-3 transition last:border-b-0',
                selected ? 'bg-primary-soft/60' : 'hover:bg-accent',
              )}
            >
              <RadioGroupItem value={palette.id} id={`${mode}-${palette.id}`} />
              <span
                aria-hidden
                className="size-9 shrink-0 rounded-lg border border-border"
                style={{
                  background: `linear-gradient(135deg, ${swatch.background} 0%, ${swatch.background} 40%, ${swatch.primary} 40%, ${swatch.primary} 72%, ${swatch.accent} 72%)`,
                }}
              />
              <span className="min-w-0 flex-1">
                <Label htmlFor={`${mode}-${palette.id}`} className="text-[15px] font-semibold">
                  {palette.name}
                </Label>
                <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
                  {palette.description}
                </span>
              </span>
              {selected && <Check className="size-4 shrink-0 text-primary" />}
            </label>
          )
        })}
      </RadioGroup>
    </section>
  )
}

export default Appearance

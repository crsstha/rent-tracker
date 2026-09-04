import { cn } from '#lib/utils'
import { usePreferences } from '#store/preferences'
import type { DateSystem } from '#utils/calendar'

/**
 * Bikram Sambat or Gregorian, everywhere at once.
 *
 * It is one preference rather than a per-screen setting: a landlord reading
 * "Bhadra" on the home page and "August" on a bill would have to convert in
 * their head, which is the whole thing this is meant to save.
 */

const OPTIONS: { value: DateSystem; label: string; title: string }[] = [
  { value: 'BS', label: 'BS', title: 'Bikram Sambat' },
  { value: 'AD', label: 'AD', title: 'Gregorian' },
]

export function DateSystemToggle({
  variant = 'default',
  className,
}: {
  /** `cover` sits on the header gradient and borrows its ink. */
  variant?: 'default' | 'cover'
  className?: string
}) {
  const system = usePreferences((s) => s.dateSystem)
  const setPreference = usePreferences((s) => s.set)

  return (
    <div
      role="group"
      aria-label="Date system"
      className={cn(
        'inline-flex overflow-hidden rounded-md p-0.5',
        variant === 'cover'
          ? 'bg-[color-mix(in_srgb,var(--cover-foreground)_14%,transparent)]'
          : 'border border-border bg-muted',
        className,
      )}
    >
      {OPTIONS.map((option) => {
        const active = system === option.value

        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            aria-pressed={active}
            onClick={() => setPreference('dateSystem', option.value)}
            className={cn(
              'rounded-[4px] px-2.5 py-[3px] text-[11.5px] font-semibold tracking-wide transition',
              variant === 'cover'
                ? active
                  ? 'bg-[color-mix(in_srgb,var(--cover-foreground)_88%,transparent)] text-[var(--cover-from)]'
                  : 'text-[var(--cover-foreground)] opacity-75'
                : active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

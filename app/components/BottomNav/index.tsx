import { NavLink, useLocation } from 'react-router'
import { Building2, CalendarDays, Settings, Wallet } from 'lucide-react'

import { cn } from '#lib/utils'
import type { RouteKeys } from '#root/config/routes'
import { routePath } from '#root/hooks/useRouting'

/**
 * The four places the register is used from, always within thumb reach.
 *
 * A tab stays lit for everything underneath it — a tenant's page still reads as
 * "Houses" — so `match` is a prefix, not the exact path. Home is the exception:
 * every path starts with "/", so it only matches itself.
 */
const TABS: { route: RouteKeys; label: string; icon: typeof Building2; match: string }[] = [
  { route: 'home', label: 'Home', icon: CalendarDays, match: '/' },
  { route: 'houses', label: 'Houses', icon: Building2, match: '/houses' },
  { route: 'spending', label: 'Spending', icon: Wallet, match: '/spending' },
  { route: 'settings', label: 'Settings', icon: Settings, match: '/settings' },
]

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-safe-bottom backdrop-blur-sm"
      aria-label="Main"
    >
      <ul className="mx-auto flex w-full max-w-2xl">
        {TABS.map(({ route, label, icon: Icon, match }) => {
          const active = match === '/' ? pathname === '/' : pathname.startsWith(match)

          return (
            <li key={route} className="flex-1">
              <NavLink
                to={routePath(route)}
                className={cn(
                  'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition',
                  active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 1.9} />
                {label}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

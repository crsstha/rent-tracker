/**
 * Every route in one place.
 *
 * Each entry is lazy — the module is only fetched when the route is first
 * visited, so a landlord opening the houses list doesn't pay for the settings
 * screen or the invoice renderer. `App.tsx` turns these into react-router
 * objects; `useRouting` turns the keys into type-checked navigation.
 *
 * `visibility` is carried from the reference client so an auth split can be
 * added without reshaping the config. Everything is `is-anything` today: the
 * register is device-local and has no accounts.
 */

type Visibility = 'is-authenticated' | 'is-not-authenticated' | 'is-anything'

export interface RouteConfig {
  index?: boolean
  path?: string
  load: () => Promise<{ default: () => React.JSX.Element | null }>
  visibility: Visibility
  children?: RouteConfig[]
}

const houses: RouteConfig = {
  index: true,
  path: '/',
  load: () => import('#views/Houses'),
  visibility: 'is-anything',
}

const house: RouteConfig = {
  path: '/houses/:houseId',
  load: () => import('#views/House'),
  visibility: 'is-anything',
}

const tenant: RouteConfig = {
  path: '/houses/:houseId/tenants/:tenantId',
  load: () => import('#views/Tenant'),
  visibility: 'is-anything',
}

const settings: RouteConfig = {
  path: '/settings',
  load: () => import('#views/Settings'),
  visibility: 'is-anything',
}

const appearance: RouteConfig = {
  path: '/settings/appearance',
  load: () => import('#views/Settings/Appearance'),
  visibility: 'is-anything',
}

const notFound: RouteConfig = {
  path: '*',
  load: () => import('#views/NotFound'),
  visibility: 'is-anything',
}

const routes = {
  houses,
  house,
  tenant,
  settings,
  appearance,
  notFound,
} satisfies Record<string, RouteConfig>

export type RouteKeys = keyof typeof routes

export default routes

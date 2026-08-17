import { generatePath, useNavigate } from 'react-router'

import routes from '#root/config/routes'

export type RoutesMap = typeof routes

type ExtractPath<T> = T extends { path: infer P } ? (P extends string ? P : '') : ''

type PathParams<P extends string> = P extends `${string}:${string}`
  ? [params: Record<string, string | number>]
  : [params?: Record<string, string> | undefined]

/**
 * Navigate by route key rather than by string.
 *
 * `routeTo('tenant', { houseId, tenantId })` is checked at compile time: a
 * route with params won't accept a call without them, and a renamed path
 * changes in exactly one place.
 */
function useRouting() {
  const navigate = useNavigate()

  return <K extends keyof RoutesMap>(route: K, ...args: PathParams<ExtractPath<RoutesMap[K]>>) => {
    const routeConfig = routes[route] as { path?: string }
    const pathTemplate = routeConfig.path ?? ''
    const normalizedTemplate = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`

    void navigate(generatePath(normalizedTemplate, args[0] ?? {}))
  }
}

/** The same path building, without navigating — for `<Link to={…}>`. */
export function routePath<K extends keyof RoutesMap>(
  route: K,
  ...args: PathParams<ExtractPath<RoutesMap[K]>>
): string {
  const routeConfig = routes[route] as { path?: string }
  const pathTemplate = routeConfig.path ?? ''
  const normalizedTemplate = pathTemplate.startsWith('/') ? pathTemplate : `/${pathTemplate}`
  return generatePath(normalizedTemplate, args[0] ?? {})
}

export default useRouting

import { createBrowserRouter, type RouteObject, RouterProvider } from 'react-router'

import type { RouteConfig } from '#root/config/routes'
import routes from '#root/config/routes'
import PageError from '#views/PageError'

/**
 * Route config → react-router objects.
 *
 * Every route is `lazy`, so each view is its own chunk. The layout nesting is
 * fixed — Root (providers) wraps RootLayout (chrome) wraps the routes — with
 * the visibility split left in place for whenever accounts arrive.
 */
function mapRoute(routeConfig: RouteConfig): RouteObject {
  const object: RouteObject = {
    path: routeConfig.path,
    lazy: async () => {
      const { default: Component } = await routeConfig.load()
      return { Component }
    },
    children: routeConfig.children?.map(mapRoute),
  }

  // A bare index route has no path of its own.
  if (routeConfig.index && !routeConfig.path) {
    return { index: true, lazy: object.lazy }
  }

  return object
}

const router = createBrowserRouter([
  {
    lazy: async () => {
      const { default: Component } = await import('#root/index')
      return { Component }
    },
    // Eager, not lazy: a chunk that failed to load is exactly when this shows.
    errorElement: <PageError />,
    children: [
      {
        lazy: async () => {
          const { default: Component } = await import('#views/RootLayout')
          return { Component }
        },
        children: Object.values(routes).map(mapRoute),
      },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App

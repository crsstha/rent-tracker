import { Page } from '#components/Page'
import { Panchang as PanchangCard } from '#components/Panchang'
import { routePath } from '#root/hooks/useRouting'

/**
 * The full year's panchang, on its own route rather than sitting inline on
 * Home — every festival and public holiday the app knows about is a long
 * scroll, and Home's job is a glance at today, not a scroll through the year.
 */
function Panchang() {
  return (
    <Page title="The year’s panchang" subtitle="Fixed and lunar dates" backTo={routePath('home')}>
      <PanchangCard />
    </Page>
  )
}

export default Panchang

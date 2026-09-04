import { Outlet } from 'react-router'

import { AdvanceSheet } from '#components/AdvanceSheet'
import { BackfillSheet } from '#components/BackfillSheet'
import { BillSheet } from '#components/BillSheet'
import { BottomNav } from '#components/BottomNav'
import { Invoice } from '#components/Invoice'
import { PaymentSheet } from '#components/PaymentSheet'
import { UpdatePrompt } from '#components/UpdatePrompt'

/**
 * Chrome shared by every route.
 *
 * The sheets live here rather than inside a view because they outlive
 * navigation: a bill raised from the tenant page still shows its invoice after
 * the route underneath has changed. The tab bar sits below them in the stacking
 * order, so an open sheet covers it rather than fighting it.
 */
function RootLayout() {
  return (
    <>
      <Outlet />

      <BillSheet />
      <PaymentSheet />
      <BackfillSheet />
      <AdvanceSheet />
      <Invoice />
      <UpdatePrompt />
      <BottomNav />
    </>
  )
}

export default RootLayout

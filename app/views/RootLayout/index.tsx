import { Outlet } from 'react-router'

import { BackfillSheet } from '#components/BackfillSheet'
import { BillSheet } from '#components/BillSheet'
import { Invoice } from '#components/Invoice'
import { PaymentSheet } from '#components/PaymentSheet'
import { UpdatePrompt } from '#components/UpdatePrompt'

/**
 * Chrome shared by every route.
 *
 * The sheets live here rather than inside a view because they outlive
 * navigation: a bill raised from the tenant page still shows its invoice after
 * the route underneath has changed.
 */
function RootLayout() {
  return (
    <>
      <Outlet />

      <BillSheet />
      <PaymentSheet />
      <BackfillSheet />
      <Invoice />
      <UpdatePrompt />
    </>
  )
}

export default RootLayout

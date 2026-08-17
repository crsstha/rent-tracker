import { Link } from 'react-router'
import { Compass } from 'lucide-react'

import { EmptyState } from '#components/EmptyState'
import { Page } from '#components/Page'
import { Button } from '#components/ui/button'

function NotFound() {
  return (
    <Page title="Not found" subtitle="That page isn’t part of the register">
      <EmptyState
        icon={<Compass size={22} />}
        title="Nothing here"
        body="The link may be out of date, or the record it pointed at has been deleted."
        action={
          <Button asChild>
            <Link to="/">Back to all houses</Link>
          </Button>
        }
      />
    </Page>
  )
}

export default NotFound

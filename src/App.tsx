import { ArrowLeft, Home, Settings } from 'lucide-react'
import { useHouse } from './hooks/useData'
import { BackfillSheet } from './components/BackfillSheet'
import { BillSheet } from './components/BillSheet'
import { HouseView } from './components/HouseView'
import { HousesView } from './components/HousesView'
import { InstallHint } from './components/InstallHint'
import { Invoice } from './components/Invoice'
import { SettingsView } from './components/SettingsView'
import { TenantSheet } from './components/TenantSheet'
import { UpdatePrompt } from './components/UpdatePrompt'
import { Toast } from './components/ui'
import { monthLabelLong, monthKey } from './lib/dates'
import { useUI } from './store'

export default function App() {
  const view = useUI((s) => s.view)
  const go = useUI((s) => s.go)
  const toast = useUI((s) => s.toast)
  const dismissToast = useUI((s) => s.dismissToast)

  const house = useHouse(view.name === 'house' ? view.houseId : null)

  const title =
    view.name === 'settings'
      ? 'Settings'
      : view.name === 'house'
        ? (house?.name ?? '…')
        : 'Rent Register'

  const subtitle =
    view.name === 'settings'
      ? 'Backup, storage & reminders'
      : view.name === 'house'
        ? (house?.address ?? monthLabelLong(monthKey()))
        : monthLabelLong(monthKey())

  return (
    <>
      <header className="cover no-print">
        <div className="cover-inner">
          {view.name !== 'houses' && (
            <button className="cover-btn mb-2.5" onClick={() => go({ name: 'houses' })}>
              <ArrowLeft size={13} /> All houses
            </button>
          )}
          <div className="flex items-center justify-between gap-3">
            <div className="cover-eyebrow">
              <Home size={13} /> Landlord’s Ledger
            </div>
            {view.name === 'houses' && (
              <button className="cover-btn" onClick={() => go({ name: 'settings' })}>
                <Settings size={13} /> Settings
              </button>
            )}
          </div>
          <h1 className="cover-title">{title}</h1>
          <p className="cover-sub">{subtitle}</p>
        </div>
      </header>

      {view.name === 'houses' && <InstallHint />}

      {view.name === 'houses' && <HousesView />}
      {view.name === 'house' && <HouseView houseId={view.houseId} />}
      {view.name === 'settings' && <SettingsView />}

      <TenantSheet />
      <BillSheet />
      <BackfillSheet />
      <Invoice />
      <UpdatePrompt />
      {toast && <Toast message={toast.message} tone={toast.tone} onDone={dismissToast} />}
    </>
  )
}

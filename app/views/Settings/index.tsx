import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Bell, ChevronRight, Download, Palette, Trash2, Upload } from 'lucide-react'

import { ConfirmDialog } from '#components/ConfirmDialog'
import { FormSheet } from '#components/FormSheet'
import { Page } from '#components/Page'
import { Button } from '#components/ui/button'
import { Card } from '#components/ui/card'
import { Progress } from '#components/ui/progress'
import { toast } from '#components/ui/sonner'
import { Switch } from '#components/ui/switch'
import { useAllTenants, useHouses } from '#hooks/useData'
import {
  BackupParseError,
  exportBackup,
  importBackup,
  type ImportMode,
  parseBackup,
  wipeAll,
} from '#lib/db/backup'
import { estimateStorage, requestPersistence } from '#lib/db/storage'
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
  remindersSupported,
} from '#lib/reminders'
import useRouting, { routePath } from '#root/hooks/useRouting'
import { formatDate } from '#utils/dates'
import { formatBytes } from '#utils/format'

import type { BackupFile } from '#types'

function Settings() {
  const routeTo = useRouting()
  const houses = useHouses()
  const tenants = useAllTenants()
  const fileInput = useRef<HTMLInputElement>(null)

  const [pending, setPending] = useState<BackupFile | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [storage, setStorage] = useState<{
    usage: number
    quota: number
    persisted: boolean
  } | null>(null)
  const [notifOn, setNotifOn] = useState(remindersEnabled())

  useEffect(() => {
    void (async () => {
      const est = await estimateStorage()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (est) setStorage({ ...est, persisted })
    })()
  }, [])

  const entryCount = (tenants ?? []).reduce((n, t) => n + t.history.length, 0)
  const paymentCount = (tenants ?? []).reduce(
    (n, t) => n + t.history.reduce((m, h) => m + h.payments.length, 0),
    0,
  )

  async function doExport() {
    const backup = await exportBackup()
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rent-register-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Revoke on the next tick so the download has picked the blob up.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('Backup file saved')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      toast.error(err instanceof BackupParseError ? err.message : 'Could not read that file.')
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pending) return
    const file = pending
    setPending(null)
    await importBackup(file, mode)
    toast.success(
      `${mode === 'replace' ? 'Restored' : 'Merged'} ${file.houses.length} houses and ${file.tenants.length} tenants`,
    )
  }

  return (
    <Page
      title="Settings"
      subtitle="Appearance, backup, storage & reminders"
      backTo={routePath('houses')}
      backLabel="All houses"
    >
      <Section title="Appearance">
        <Link
          to={routePath('appearance')}
          className="flex items-center gap-3 rounded-card border border-border bg-card px-4 py-3 transition hover:border-primary/40"
        >
          <Palette size={16} className="text-primary" />
          <div className="flex-1">
            <div className="text-[15px] font-medium">Theme & entry preferences</div>
            <div className="text-[12.5px] text-muted-foreground">
              Light / dark mode, palettes, and how entries behave
            </div>
          </div>
          <ChevronRight size={18} className="text-muted-foreground" />
        </Link>
      </Section>

      <Section title="Your data">
        <Card className="divide-y divide-rule-soft">
          <div className="grid grid-cols-4 divide-x divide-rule-soft">
            <Stat label="Houses" value={String(houses?.length ?? 0)} />
            <Stat label="Tenants" value={String(tenants?.length ?? 0)} />
            <Stat label="Months" value={String(entryCount)} />
            <Stat label="Payments" value={String(paymentCount)} />
          </div>
          <p className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Everything is stored in this device’s own browser storage. Nothing is uploaded, and no
            account is needed — which also means an uninstall or a “clear site data” wipes it.{' '}
            <strong className="font-semibold text-foreground">Export a backup regularly.</strong>
          </p>
        </Card>
      </Section>

      <Section title="Backup & restore">
        <div className="space-y-2">
          <Button variant="outline" className="w-full justify-start" onClick={doExport}>
            <Download className="text-primary" />
            <span className="flex-1 text-left">Export backup</span>
            <span className="text-[12.5px] font-normal text-muted-foreground">JSON file</span>
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() => fileInput.current?.click()}
          >
            <Upload className="text-primary" />
            <span className="flex-1 text-left">Import backup</span>
            <span className="text-[12.5px] font-normal text-muted-foreground">from file</span>
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </Section>

      <Section title="Storage">
        <Card className="divide-y divide-rule-soft text-[14px]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-medium">Persistent storage</div>
              <div className="text-[12.5px] text-muted-foreground">
                {storage?.persisted
                  ? 'Granted — the browser won’t evict your data'
                  : 'Not granted. Installing the app makes this more likely.'}
              </div>
            </div>
            {!storage?.persisted && (
              <Button
                variant="quiet"
                size="sm"
                onClick={async () => {
                  const ok = await requestPersistence()
                  setStorage((s) => (s ? { ...s, persisted: ok } : s))
                  if (ok) toast.success('Storage marked persistent')
                  else toast.error('The browser declined — data is still saved')
                }}
              >
                Request
              </Button>
            )}
          </div>
          {storage && (
            <div className="px-4 py-3">
              <div className="flex justify-between text-[12.5px] text-muted-foreground">
                <span>Used</span>
                <span>
                  {formatBytes(storage.usage)} of {formatBytes(storage.quota)}
                </span>
              </div>
              <Progress
                className="mt-1.5"
                value={Math.min(100, Math.max(1, (storage.usage / (storage.quota || 1)) * 100))}
              />
            </div>
          )}
        </Card>
      </Section>

      {remindersSupported() && (
        <Section title="Reminders">
          <Card>
            <div className="flex items-center gap-3 px-4 py-3">
              <Bell size={16} className="text-primary" />
              <div className="flex-1">
                <div className="text-[15px] font-medium">Due-date notifications</div>
                <div className="text-[12.5px] text-muted-foreground">
                  Checked once a day when you open the app — no background push.
                </div>
              </div>
              <Switch
                checked={notifOn}
                aria-label="Due-date notifications"
                onCheckedChange={async (next) => {
                  if (!next) {
                    disableReminders()
                    setNotifOn(false)
                    return
                  }
                  const ok = await enableReminders()
                  setNotifOn(ok)
                  if (ok) toast.success('Reminders on — checked when you open the app')
                  else toast.error('Permission was denied')
                }}
              />
            </div>
          </Card>
        </Section>
      )}

      <Section title="Danger zone">
        <Button
          variant="outline"
          className="w-full justify-start border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setConfirmWipe(true)}
        >
          <Trash2 />
          Erase all data on this device
        </Button>
      </Section>

      <p className="mt-8 text-center text-[12px] text-muted-foreground">
        Rent Register · works offline · v{__APP_VERSION__}
      </p>

      <FormSheet
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        title="Restore this backup?"
        subtitle={pending ? `Exported ${formatDate(pending.exportedAt)}` : undefined}
        closeAction={false}
        footer={
          <div className="space-y-2">
            <Button className="w-full" onClick={() => runImport('replace')}>
              Replace everything
            </Button>
            <Button variant="outline" className="w-full" onClick={() => runImport('merge')}>
              Merge with existing data
            </Button>
            <Button variant="quiet" className="w-full" onClick={() => setPending(null)}>
              Close
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-[14px] leading-relaxed">
          <p>
            This file contains{' '}
            <strong className="font-semibold">{pending?.houses.length ?? 0} houses</strong> and{' '}
            <strong className="font-semibold">{pending?.tenants.length ?? 0} tenants</strong>.
          </p>
          <div className="rounded-lg bg-primary-soft px-3 py-2.5 text-[13.5px] text-primary">
            <strong className="font-semibold">Replace</strong> deletes everything currently on this
            device first. <strong className="font-semibold">Merge</strong> keeps what you have and
            only adds records that aren’t already here.
          </div>
        </div>
      </FormSheet>

      <ConfirmDialog
        open={confirmWipe}
        title="Erase all data?"
        body="Every house, tenant and payment record on this device will be deleted. Export a backup first if you might want any of it back."
        confirmLabel="Erase everything"
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          setConfirmWipe(false)
          await wipeAll()
          routeTo('houses')
          toast.success('All data erased')
        }}
      />
    </Page>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3 text-center">
      <div className="font-display text-[19px] font-semibold">{value}</div>
      <div className="text-[10.5px] tracking-[0.06em] text-muted-foreground uppercase">{label}</div>
    </div>
  )
}

export default Settings

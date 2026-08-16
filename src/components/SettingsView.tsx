import { useEffect, useRef, useState } from 'react'
import { Bell, Download, Trash2, Upload } from 'lucide-react'
import { useAllTenants, useHouses } from '../hooks/useData'
import {
  BackupParseError,
  estimateStorage,
  exportBackup,
  importBackup,
  parseBackup,
  requestPersistence,
  wipeAll,
  type ImportMode,
} from '../lib/db'
import { formatDate } from '../lib/dates'
import {
  disableReminders,
  enableReminders,
  remindersEnabled,
  remindersSupported,
} from '../lib/reminders'
import { useUI } from '../store'
import type { BackupFile } from '../types'
import { Confirm, Sheet } from './ui'

export function SettingsView() {
  const go = useUI((s) => s.go)
  const notify = useUI((s) => s.notify)
  const houses = useHouses()
  const tenants = useAllTenants()
  const fileInput = useRef<HTMLInputElement>(null)

  const [pending, setPending] = useState<BackupFile | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(
    null,
  )
  const [notifOn, setNotifOn] = useState(remindersEnabled())

  useEffect(() => {
    void (async () => {
      const est = await estimateStorage()
      const persisted = (await navigator.storage?.persisted?.()) ?? false
      if (est) setStorage({ ...est, persisted })
    })()
  }, [])

  const entryCount = (tenants ?? []).reduce((n, t) => n + t.history.length, 0)

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
    notify('Backup file saved')
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (!file) return
    try {
      setPending(parseBackup(await file.text()))
    } catch (err) {
      notify(err instanceof BackupParseError ? err.message : 'Could not read that file.', 'error')
    }
  }

  async function runImport(mode: ImportMode) {
    if (!pending) return
    const file = pending
    setPending(null)
    await importBackup(file, mode)
    notify(
      `${mode === 'replace' ? 'Restored' : 'Merged'} ${file.houses.length} houses and ${file.tenants.length} tenants`,
    )
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-2xl px-4 pt-5 pb-16">
      <Section title="Your data">
        <div className="card divide-y divide-rule-soft">
          <div className="grid grid-cols-3 divide-x divide-rule-soft">
            <Stat label="Houses" value={String(houses?.length ?? 0)} />
            <Stat label="Tenants" value={String(tenants?.length ?? 0)} />
            <Stat label="Payments" value={String(entryCount)} />
          </div>
          <p className="px-4 py-3 text-[13px] leading-relaxed text-ink-3">
            Everything is stored in this device’s own browser storage. Nothing is uploaded, and no
            account is needed — which also means an uninstall or a “clear site data” wipes it.{' '}
            <strong className="font-semibold text-ink-2">Export a backup regularly.</strong>
          </p>
        </div>
      </Section>

      <Section title="Backup & restore">
        <div className="space-y-2">
          <button className="btn-ghost w-full justify-start" onClick={doExport}>
            <Download size={16} className="text-maroon" />
            <span className="flex-1 text-left">Export backup</span>
            <span className="text-[12.5px] font-normal text-ink-3">JSON file</span>
          </button>
          <button className="btn-ghost w-full justify-start" onClick={() => fileInput.current?.click()}>
            <Upload size={16} className="text-maroon" />
            <span className="flex-1 text-left">Import backup</span>
            <span className="text-[12.5px] font-normal text-ink-3">from file</span>
          </button>
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
        <div className="card divide-y divide-rule-soft text-[14px]">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="font-medium">Persistent storage</div>
              <div className="text-[12.5px] text-ink-3">
                {storage?.persisted
                  ? 'Granted — the browser won’t evict your data'
                  : 'Not granted. Installing the app makes this more likely.'}
              </div>
            </div>
            {!storage?.persisted && (
              <button
                className="btn-quiet px-3 py-1.5 text-[13px]"
                onClick={async () => {
                  const ok = await requestPersistence()
                  setStorage((s) => (s ? { ...s, persisted: ok } : s))
                  notify(
                    ok ? 'Storage marked persistent' : 'The browser declined — data is still saved',
                    ok ? 'ok' : 'error',
                  )
                }}
              >
                Request
              </button>
            )}
          </div>
          {storage && (
            <div className="px-4 py-3">
              <div className="flex justify-between text-[12.5px] text-ink-3">
                <span>Used</span>
                <span>
                  {formatBytes(storage.usage)} of {formatBytes(storage.quota)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rule-soft">
                <div
                  className="h-full rounded-full bg-maroon"
                  style={{
                    width: `${Math.min(100, Math.max(1, (storage.usage / (storage.quota || 1)) * 100))}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </Section>

      {remindersSupported() && (
        <Section title="Reminders">
          <button
            className="card flex w-full items-center gap-3 px-4 py-3 text-left"
            aria-pressed={notifOn}
            onClick={async () => {
              if (notifOn) {
                disableReminders()
                setNotifOn(false)
                return
              }
              const ok = await enableReminders()
              setNotifOn(ok)
              notify(
                ok ? 'Reminders on — checked when you open the app' : 'Permission was denied',
                ok ? 'ok' : 'error',
              )
            }}
          >
            <Bell size={16} className="text-maroon" />
            <div className="flex-1">
              <div className="text-[15px] font-medium">Due-date notifications</div>
              <div className="text-[12.5px] text-ink-3">
                Checked once a day when you open the app — no background push.
              </div>
            </div>
            <span
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${notifOn ? 'bg-maroon' : 'bg-rule'}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-card shadow transition-all ${
                  notifOn ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        </Section>
      )}

      <Section title="Danger zone">
        <button
          className="btn w-full justify-start border border-maroon/30 bg-maroon-soft/50 text-maroon"
          onClick={() => setConfirmWipe(true)}
        >
          <Trash2 size={16} />
          Erase all data on this device
        </button>
      </Section>

      <p className="mt-8 text-center text-[12px] text-ink-3">
        Rent Register · works offline · v{__APP_VERSION__}
      </p>

      <Sheet
        open={Boolean(pending)}
        title="Restore this backup?"
        subtitle={pending ? `Exported ${formatDate(pending.exportedAt)}` : undefined}
        onClose={() => setPending(null)}
        footer={
          <div className="space-y-2">
            <button className="btn-primary w-full" onClick={() => runImport('replace')}>
              Replace everything
            </button>
            <button className="btn-ghost w-full" onClick={() => runImport('merge')}>
              Merge with existing data
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-[14px] leading-relaxed">
          <p className="text-ink-2">
            This file contains{' '}
            <strong className="font-semibold">{pending?.houses.length ?? 0} houses</strong> and{' '}
            <strong className="font-semibold">{pending?.tenants.length ?? 0} tenants</strong>.
          </p>
          <div className="rounded-lg bg-maroon-soft px-3 py-2.5 text-[13.5px] text-maroon">
            <strong className="font-semibold">Replace</strong> deletes everything currently on this
            device first. <strong className="font-semibold">Merge</strong> keeps what you have and
            only adds records that aren’t already here.
          </div>
        </div>
      </Sheet>

      <Confirm
        open={confirmWipe}
        title="Erase all data?"
        body="Every house, tenant and payment record on this device will be deleted. Export a backup first if you might want any of it back."
        confirmLabel="Erase everything"
        onCancel={() => setConfirmWipe(false)}
        onConfirm={async () => {
          setConfirmWipe(false)
          await wipeAll()
          go({ name: 'houses' })
          notify('All data erased')
        }}
      />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-3 py-3 text-center">
      <div className="font-display text-[20px] font-semibold">{value}</div>
      <div className="text-[11px] tracking-[0.06em] text-ink-3 uppercase">{label}</div>
    </div>
  )
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, X } from 'lucide-react'
import { billLines, billNumber, formatMoney } from '../lib/billing'
import { formatDate, monthLabelLong } from '../lib/dates'
import { useUI } from '../store'

/**
 * The invoice renders into #print-root, which sits outside the app tree — the
 * print stylesheet hides #root entirely so nothing in the app can clip or
 * re-style the page. On screen the same node is shown as a full overlay.
 */
export function Invoice() {
  const doc = useUI((s) => s.invoice)
  const close = () => useUI.getState().showInvoice(null)

  useEffect(() => {
    const root = document.getElementById('print-root')
    if (!root || !doc) return
    root.style.display = 'block'
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('keydown', onKey)
    return () => {
      root.style.display = ''
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [doc])

  const target = document.getElementById('print-root')
  if (!doc || !target) return null

  const { tenant, houseName, houseAddress, month, breakdown } = doc
  const lines = billLines(breakdown)
  const issued = tenant.history.find((h) => h.month === month)?.date ?? new Date().toISOString()

  return createPortal(
    <div className="fixed inset-0 z-80 overflow-y-auto bg-ink/45 print:static print:overflow-visible print:bg-white">
      <div className="no-print sticky top-0 z-10 flex items-center gap-2 bg-ink px-3 py-2.5 text-paper-2">
        <button onClick={close} className="rounded-lg p-1.5 hover:bg-white/10" aria-label="Close invoice">
          <X size={18} />
        </button>
        <span className="flex-1 text-[14px] font-semibold">Invoice preview</span>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 rounded-lg bg-paper-2 px-3 py-1.5 text-[13.5px] font-semibold text-ink"
        >
          <Download size={15} />
          Save as PDF
        </button>
      </div>

      <div className="mx-auto my-4 w-full max-w-[190mm] bg-white px-6 py-8 text-[#1a1a1a] shadow-xl sm:px-10 sm:py-10 print:my-0 print:max-w-none print:px-0 print:py-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-[#7A1F2E] pb-4">
          <div>
            <h1 className="font-display text-[24px] leading-tight font-bold text-[#7A1F2E]">
              {houseName}
            </h1>
            {houseAddress && <p className="mt-1 text-[13px] text-[#5d5245]">{houseAddress}</p>}
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold tracking-[0.16em] text-[#8b7f6e] uppercase">
              Rent Invoice
            </div>
            <div className="mt-1 text-[13px] font-semibold">{billNumber(tenant, month)}</div>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-6 text-[13px]">
          <div>
            <div className="mb-1.5 text-[10.5px] font-semibold tracking-[0.14em] text-[#8b7f6e] uppercase">
              Billed to
            </div>
            <div className="font-display text-[15px] font-bold">{tenant.name}</div>
            {tenant.unit && <div className="text-[#5d5245]">Unit {tenant.unit}</div>}
            {tenant.phone && <div className="text-[#5d5245]">{tenant.phone}</div>}
          </div>
          <div className="text-right">
            <Meta label="Billing period" value={monthLabelLong(month)} />
            <Meta label="Issued" value={formatDate(issued)} />
            <Meta label="Rent due day" value={`Day ${tenant.dueDay} of the month`} />
          </div>
        </section>

        <table className="mt-7 w-full border-collapse text-[13.5px]">
          <thead>
            <tr className="border-y border-[#ded2b8] text-[10.5px] tracking-[0.12em] text-[#8b7f6e] uppercase">
              <th className="py-2 text-left font-semibold">Description</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.label} className="border-b border-[#e8dfc9]">
                <td className="py-2.5 pr-4">
                  <div className="font-medium">{line.label}</div>
                  {line.detail && <div className="mt-0.5 text-[12px] text-[#8b7f6e]">{line.detail}</div>}
                </td>
                <td className="py-2.5 text-right font-medium whitespace-nowrap">
                  {formatMoney(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-3 text-right text-[12px] font-semibold tracking-[0.1em] text-[#8b7f6e] uppercase">
                Total payable
              </td>
              <td className="font-display pt-3 text-right text-[20px] font-bold whitespace-nowrap text-[#7A1F2E]">
                {formatMoney(breakdown.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {breakdown.arrears && breakdown.arrears.amount > 0 && (
          <div className="mt-4 rounded border border-[#e3b7ac] bg-[#f7ebe4] px-4 py-3 text-[12.5px] text-[#7A1F2E]">
            Includes {breakdown.arrears.months.length} previously unpaid month
            {breakdown.arrears.months.length === 1 ? '' : 's'} totalling{' '}
            {formatMoney(breakdown.arrears.amount)}. Paying this bill clears them.
          </div>
        )}

        {tenant.notes && (
          <div className="mt-4 text-[12.5px] text-[#5d5245] italic">Note: {tenant.notes}</div>
        )}

        <div className="mt-6 rounded border border-[#e8dfc9] bg-[#faf7ef] px-4 py-3 text-[12.5px] text-[#5d5245]">
          Received with thanks. Thank you for your prompt payment.
        </div>

        <div className="mt-14 flex items-end justify-between gap-8 text-[12px] text-[#5d5245]">
          <div className="w-1/2">
            <div className="border-t border-[#8b7f6e] pt-1.5">Tenant signature</div>
          </div>
          <div className="w-1/2 text-right">
            <div className="border-t border-[#8b7f6e] pt-1.5">Landlord signature</div>
          </div>
        </div>
      </div>
    </div>,
    target,
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5">
      <span className="text-[10.5px] font-semibold tracking-[0.14em] text-[#8b7f6e] uppercase">
        {label}{' '}
      </span>
      <div className="font-medium">{value}</div>
    </div>
  )
}

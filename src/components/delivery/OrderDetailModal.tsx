import { useState } from 'react'
import {
  ORIGIN_LABELS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  formatMoney,
  formatTime,
  getNextAction,
  type DeliveryOrder,
  type DeliveryStatus,
} from '../../lib/delivery'
import { CloseIcon, PrinterIcon, WhatsappIcon } from '../icons'

interface OrderDetailModalProps {
  order: DeliveryOrder
  busy: boolean
  error: string | null
  onClose: () => void
  onAdvance: (status: DeliveryStatus) => void
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <div className="mt-0.5 text-[13px] break-words text-[var(--ink)]">{children}</div>
    </div>
  )
}

export function OrderDetailModal({ order, busy, error, onClose, onAdvance }: OrderDetailModalProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const next = getNextAction(order)
  const finished = order.status === 'completed' || order.status === 'canceled'
  const a = order.address
  const phoneDigits = order.customer.phone.replace(/\D/g, '')
  const whatsappUrl = phoneDigits ? `https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}` : null
  const canCancel = !finished && order.origin !== 'ifood'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92svh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="print-area">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-bold text-[var(--ink)]">
                Pedido #{order.external_display_id || order.code}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
                {ORIGIN_LABELS[order.origin] ?? order.origin} · {formatTime(order.created_at)} · {STATUS_LABELS[order.status]}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="no-print inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
              aria-label="Fechar"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 grid gap-3 rounded-xl bg-[var(--page)] p-4 sm:grid-cols-2">
            <Row label="Cliente">{order.customer.name || '—'}</Row>
            <Row label="Telefone">
              {order.customer.phone || '—'}
              {whatsappUrl && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="no-print ml-2 inline-flex items-center gap-1 font-semibold text-[var(--green-600)] hover:underline"
                >
                  <WhatsappIcon className="h-3.5 w-3.5" /> Chamar
                </a>
              )}
            </Row>
            <div className="sm:col-span-2">
              <Row label={order.fulfillment_type === 'pickup' ? 'Retirada' : 'Entrega'}>
                {order.fulfillment_type === 'pickup' ? (
                  'Retirada no balcão'
                ) : a ? (
                  <>
                    {[a.street, a.number].filter(Boolean).join(', ')}
                    {a.district ? ` - ${a.district}` : ''}
                    {a.city ? ` · ${a.city}${a.state ? `/${a.state}` : ''}` : ''}
                    {a.complement && <span className="block text-[var(--ink-soft)]">Compl.: {a.complement}</span>}
                    {a.reference && <span className="block text-[var(--ink-soft)]">Referência: {a.reference}</span>}
                  </>
                ) : (
                  'Endereço não informado'
                )}
              </Row>
            </div>
            {order.notes && (
              <div className="sm:col-span-2">
                <Row label="Observações do cliente">{order.notes}</Row>
              </div>
            )}
          </div>

          <table className="mt-4 w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">
                <th className="pb-1.5">Item</th>
                <th className="pb-1.5 text-right">Qtd</th>
                <th className="pb-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-t border-[var(--border)] align-top">
                  <td className="py-1.5 pr-2 text-[var(--ink)]">
                    {item.name}
                    {item.observation && <span className="block text-[11.5px] text-[var(--ink-soft)]">{item.observation}</span>}
                  </td>
                  <td className="py-1.5 text-right text-[var(--ink-soft)]">{item.quantity}</td>
                  <td className="py-1.5 text-right font-semibold text-[var(--ink)]">{formatMoney(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <dl className="mt-3 grid gap-1 border-t border-[var(--border)] pt-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-[var(--ink-soft)]">Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--ink-soft)]">Taxa de entrega</dt>
              <dd>{formatMoney(order.delivery_fee)}</dd>
            </div>
            <div className="flex justify-between text-[15px] font-bold text-[var(--ink)]">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-[var(--ink-soft)]">Pagamento</dt>
              <dd>{PAYMENT_LABELS[order.payment_method] ?? order.payment_method}</dd>
            </div>
            {order.include_disposables && (
              <div className="flex justify-between">
                <dt className="text-[var(--ink-soft)]">Descartáveis</dt>
                <dd>Sim</dd>
              </div>
            )}
          </dl>
        </div>

        {error && <p className="no-print mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="no-print mt-5 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <PrinterIcon className="h-4 w-4" />
            Imprimir
          </button>

          {canCancel &&
            (confirmingCancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onAdvance('canceled')}
                className="rounded-xl bg-[var(--red-500)] px-3.5 py-2.5 text-[13px] font-bold text-white disabled:opacity-60"
              >
                Confirmar cancelamento
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="rounded-xl px-3.5 py-2.5 text-[13px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
              >
                Cancelar pedido
              </button>
            ))}
          {order.origin === 'ifood' && !finished && (
            <span className="text-[11.5px] text-[var(--muted)]">Cancelamento do iFood é feito pelo portal do iFood.</span>
          )}

          {next && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAdvance(next.status)}
              className="ml-auto rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {busy ? 'Atualizando…' : next.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

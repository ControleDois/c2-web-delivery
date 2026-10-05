import {
  ORIGIN_LABELS,
  PAYMENT_LABELS,
  elapsedMinutes,
  formatAddress,
  formatElapsed,
  formatMoney,
  formatTime,
  getNextAction,
  type DeliveryOrder,
  type DeliveryStatus,
} from '../../lib/delivery'
import { ClockIcon, TruckIcon, BagIcon, UserIcon } from '../icons'

interface OrderCardProps {
  order: DeliveryOrder
  now: number
  isNew: boolean
  busy: boolean
  onOpen: () => void
  onAdvance: (status: DeliveryStatus) => void
}

function elapsedTone(minutes: number, finished: boolean) {
  if (finished) return 'bg-[var(--page)] text-[var(--muted)]'
  if (minutes >= 40) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (minutes >= 20) return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
  return 'bg-[var(--green-100)] text-[var(--green-600)]'
}

export function OrderCard({ order, now, isNew, busy, onOpen, onAdvance }: OrderCardProps) {
  const finished = order.status === 'completed' || order.status === 'canceled'
  const minutes = elapsedMinutes(order.created_at, now)
  const next = getNextAction(order)
  const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const isPickup = order.fulfillment_type === 'pickup'

  return (
    <div
      className={`rounded-xl border bg-[var(--surface)] p-3 shadow-[var(--card-shadow)] transition ${
        isNew ? 'border-[var(--blue-500)] ring-2 ring-[var(--blue-300)]' : 'border-[var(--border)]'
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
            {order.customer.name || 'Cliente'}
          </p>
          <span
            className={`flex flex-none items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${elapsedTone(minutes, finished)}`}
          >
            <ClockIcon className="h-3 w-3" />
            {formatElapsed(minutes)}
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--ink-soft)]">
          <span className="rounded-md bg-[var(--blue-100)] px-1.5 py-0.5 font-semibold text-[var(--blue-500)]">
            {ORIGIN_LABELS[order.origin] ?? order.origin}
          </span>
          <span className="font-semibold">#{order.external_display_id || order.code}</span>
          <span>{formatTime(order.created_at)}</span>
        </div>

        <p className="mt-2 flex items-start gap-1.5 text-[12px] text-[var(--ink-soft)]">
          {isPickup ? (
            <BagIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          ) : (
            <TruckIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          )}
          <span className="min-w-0">{formatAddress(order)}</span>
        </p>

        {order.courier && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-500)]">
            <UserIcon className="h-3.5 w-3.5 flex-none" />
            {order.courier.name}
            {order.courier.vehicle && (
              <span className="font-normal text-[var(--ink-soft)]">· {order.courier.vehicle}</span>
            )}
          </p>
        )}

        <div className="mt-2 flex items-center justify-between text-[12px]">
          <span className="text-[var(--muted)]">
            {itemCount} {itemCount === 1 ? 'item' : 'itens'} ·{' '}
            {PAYMENT_LABELS[order.payment_method] ?? order.payment_method}
          </span>
          <span className="text-[13px] font-bold text-[var(--ink)]">{formatMoney(order.total)}</span>
        </div>
      </button>

      {next && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdvance(next.status)}
          className="mt-3 w-full rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[12.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
        >
          {busy ? 'Atualizando…' : next.label}
        </button>
      )}
    </div>
  )
}

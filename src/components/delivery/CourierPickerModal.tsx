import { TruckIcon, UserIcon, CloseIcon } from '../icons'
import { courierVehicleLabel, type Courier } from '../../lib/delivery'

interface CourierPickerModalProps {
  couriers: Courier[]
  busy: boolean
  onPick: (courierId: string | null) => void
  onClose: () => void
}

export function CourierPickerModal({ couriers, busy, onPick, onClose }: CourierPickerModalProps) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={busy ? undefined : onClose}
    >
      <div
        className="max-h-[85svh] w-full max-w-[420px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Quem vai entregar?</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              Escolha o entregador para marcar o pedido como saiu.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {couriers.map((courier) => (
            <button
              key={courier.id}
              type="button"
              disabled={busy}
              onClick={() => onPick(courier.id)}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-left transition hover:border-[var(--blue-500)] hover:bg-[var(--blue-100)] disabled:opacity-60"
            >
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-500)]">
                <UserIcon className="h-4.5 w-4.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-bold text-[var(--ink)]">{courier.name}</span>
                {courierVehicleLabel(courier) && (
                  <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-[var(--ink-soft)]">
                    <TruckIcon className="h-3 w-3" />
                    {courierVehicleLabel(courier)}
                  </span>
                )}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(null)}
            className="rounded-xl px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Sair sem escolher entregador
          </button>
        </div>
      </div>
    </div>
  )
}

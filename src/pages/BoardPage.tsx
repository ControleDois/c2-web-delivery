import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useDeliveryBoard } from '../hooks/useDeliveryBoard'
import { BOARD_COLUMNS, type DeliveryOrder, type DeliveryStatus } from '../lib/delivery'
import { ApiError } from '../lib/api'
import { OrderCard } from '../components/delivery/OrderCard'
import { OrderDetailModal } from '../components/delivery/OrderDetailModal'
import { CourierPickerModal } from '../components/delivery/CourierPickerModal'
import { BellIcon, RefreshIcon, SearchIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'
import { audioUnlocked, playAlert, subscribeAudioState, unlockAudio } from '../lib/alertSound'

interface BoardPageProps {
  session: AuthSession
  company: AuthCompany
}

const SOUND_KEY = 'c2_delivery_sound'

const COLUMN_TONE: Record<string, string> = {
  red: 'bg-[var(--red-100)] text-[var(--red-500)]',
  amber: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  blue: 'bg-[var(--blue-100)] text-[var(--blue-500)]',
  green: 'bg-[var(--green-100)] text-[var(--green-600)]',
  muted: 'bg-[var(--page)] text-[var(--muted)]',
}

function readSoundPreference() {
  try {
    return localStorage.getItem(SOUND_KEY) === '1'
  } catch {
    return false
  }
}

export function BoardPage({ session, company }: BoardPageProps) {
  const [soundEnabled, setSoundEnabled] = useState(readSoundPreference)
  const [search, setSearch] = useState('')
  const [now, setNow] = useState(() => Date.now())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [pickingFor, setPickingFor] = useState<{ order: DeliveryOrder; status: DeliveryStatus } | null>(null)

  const { orders, loading, error, connected, newIds, couriers, reload, changeStatus, setCourier, acknowledge } =
    useDeliveryBoard(session, company, soundEnabled)

  const unlocked = useSyncExternalStore(subscribeAudioState, audioUnlocked)

  // O navegador só libera áudio depois de uma interação: destrava no primeiro clique/toque/tecla.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

  async function toggleSound() {
    const next = !soundEnabled
    setSoundEnabled(next)
    if (next && (await unlockAudio())) playAlert()
    try {
      localStorage.setItem(SOUND_KEY, next ? '1' : '0')
    } catch {
      // preferência só vale nesta sessão
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return orders
    return orders.filter(
      (order) =>
        order.customer.name.toLowerCase().includes(term) ||
        order.customer.phone.replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§') ||
        String(order.external_display_id || order.code)
          .toLowerCase()
          .includes(term)
    )
  }, [orders, search])

  const selected = selectedId ? (orders.find((order) => order.id === selectedId) ?? null) : null

  async function handleAdvance(order: DeliveryOrder, status: DeliveryStatus, courierId?: string) {
    // Na saída para entrega pergunta quem vai levar, se já há entregadores
    // cadastrados e o pedido ainda não tem um definido.
    if (
      status === 'out_for_delivery' &&
      !courierId &&
      !order.courier &&
      order.fulfillment_type !== 'pickup' &&
      couriers.length
    ) {
      setActionError(null)
      setPickingFor({ order, status })
      return
    }

    setBusyId(order.id)
    setActionError(null)
    try {
      await changeStatus(order.id, status, courierId)
      if (status === 'completed' || status === 'canceled') setSelectedId(null)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o pedido.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleAssignCourier(order: DeliveryOrder, courierId: string | null) {
    setBusyId(order.id)
    setActionError(null)
    try {
      await setCourier(order.id, courierId)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atribuir o entregador.')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePickCourier(courierId: string | null) {
    if (!pickingFor) return
    const { order, status } = pickingFor
    if (courierId) {
      setPickingFor(null)
      await handleAdvance(order, status, courierId)
      return
    }
    setPickingFor(null)
    setBusyId(order.id)
    try {
      await changeStatus(order.id, status)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o pedido.')
    } finally {
      setBusyId(null)
    }
  }

  function openOrder(order: DeliveryOrder) {
    acknowledge(order.id)
    setActionError(null)
    setSelectedId(order.id)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-none flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2.5">
        <div className="relative w-full max-w-[280px]">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar cliente, telefone ou nº"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--page)] py-2 pr-3 pl-9 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--blue-500)] focus:outline-none"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
              connected
                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[var(--green-600)]' : 'bg-[var(--amber-500)]'}`}
            />
            {connected ? 'Ao vivo' : 'Reconectando…'}
          </span>
          <button
            type="button"
            onClick={toggleSound}
            title={soundEnabled ? 'Desligar som de novo pedido' : 'Ligar som de novo pedido'}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold ${
              soundEnabled
                ? 'bg-[var(--blue-100)] text-[var(--blue-500)]'
                : 'text-[var(--muted)] hover:bg-[var(--page)]'
            }`}
          >
            <BellIcon className="h-3.5 w-3.5" />
            {soundEnabled ? 'Som ligado' : 'Som desligado'}
          </button>
          {soundEnabled && !unlocked && (
            <button
              type="button"
              onClick={async () => {
                if (await unlockAudio()) playAlert()
              }}
              className="rounded-lg bg-[var(--amber-100)] px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--amber-500)]"
            >
              Som bloqueado pelo navegador — clique para ativar
            </button>
          )}
          <button
            type="button"
            onClick={reload}
            title="Atualizar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <RefreshIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="flex-none bg-[var(--red-100)] px-4 py-2 text-center text-[12.5px] font-medium text-[var(--red-500)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto p-3">
          {BOARD_COLUMNS.map((column) => {
            const finished = column.key === 'completed' || column.key === 'canceled'
            const columnOrders = filtered
              .filter((order) => column.statuses.includes(order.status))
              .sort((a, b) =>
                finished
                  ? (b.updated_at || '').localeCompare(a.updated_at || '')
                  : (a.created_at || '').localeCompare(b.created_at || '')
              )

            return (
              <section
                key={column.key}
                className="flex w-[280px] min-w-[260px] flex-1 flex-col rounded-xl bg-[var(--page)]"
              >
                <header className="flex flex-none items-center justify-between px-3 py-2.5">
                  <h2 className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${COLUMN_TONE[column.tone]}`}>
                    {column.title}
                  </h2>
                  <span className="text-[12px] font-bold text-[var(--muted)]">{columnOrders.length}</span>
                </header>
                <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-3">
                  {columnOrders.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[12px] text-[var(--muted)]">{column.empty}</p>
                  ) : (
                    columnOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        now={now}
                        isNew={newIds.includes(order.id)}
                        busy={busyId === order.id}
                        onOpen={() => openOrder(order)}
                        onAdvance={(status) => handleAdvance(order, status)}
                      />
                    ))
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}

      {selected && (
        <OrderDetailModal
          order={selected}
          busy={busyId === selected.id}
          error={actionError}
          couriers={couriers}
          onClose={() => setSelectedId(null)}
          onAdvance={(status) => handleAdvance(selected, status)}
          onAssignCourier={(courierId) => handleAssignCourier(selected, courierId)}
        />
      )}

      {pickingFor && (
        <CourierPickerModal
          couriers={couriers}
          busy={busyId === pickingFor.order.id}
          onPick={handlePickCourier}
          onClose={() => setPickingFor(null)}
        />
      )}
    </div>
  )
}

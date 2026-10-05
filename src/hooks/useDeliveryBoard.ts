import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSocket } from '../lib/socket'
import { fetchDeliveryBoard, updateDeliveryOrderStatus, type DeliveryOrder, type DeliveryStatus } from '../lib/delivery'
import { ApiError } from '../lib/api'
import type { AuthSession, AuthCompany } from '../lib/auth'

const REFRESH_MS = 45000

// Bipe curto via Web Audio (sem arquivo de som). O navegador só libera áudio
// depois de uma interação do usuário - por isso o alerta é ligado/desligado
// por um botão no cabeçalho.
function beep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioCtx()
    ;[0, 0.22].forEach((delay) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.15
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + delay)
      osc.stop(ctx.currentTime + delay + 0.16)
    })
    setTimeout(() => ctx.close(), 800)
  } catch {
    // sem áudio disponível: o destaque visual do card novo continua
  }
}

export function useDeliveryBoard(session: AuthSession, company: AuthCompany, soundEnabled: boolean) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [newIds, setNewIds] = useState<string[]>([])
  const knownIds = useRef<Set<string> | null>(null)
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled

  const registerArrivals = useCallback((incoming: DeliveryOrder[]) => {
    if (knownIds.current === null) {
      knownIds.current = new Set(incoming.map((order) => order.id))
      return
    }
    const fresh = incoming.filter((order) => !knownIds.current!.has(order.id) && order.status !== 'completed' && order.status !== 'canceled')
    incoming.forEach((order) => knownIds.current!.add(order.id))
    if (fresh.length) {
      setNewIds((current) => [...current, ...fresh.map((order) => order.id)])
      if (soundRef.current) beep()
    }
  }, [])

  const reload = useCallback(async () => {
    try {
      const res = await fetchDeliveryBoard(session.token.token, company.id)
      registerArrivals(res.orders)
      setOrders(res.orders)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os pedidos.')
    } finally {
      setLoading(false)
    }
  }, [session.token.token, company.id, registerArrivals])

  useEffect(() => {
    knownIds.current = null
    setLoading(true)
    reload()
    const timer = setInterval(reload, REFRESH_MS)
    return () => clearInterval(timer)
  }, [reload])

  useEffect(() => {
    const socket = connectSocket(company.id)
    const onUpdated = (payload: { order?: DeliveryOrder }) => {
      const order = payload?.order
      if (!order) return
      registerArrivals([order])
      setOrders((current) => {
        const exists = current.some((item) => item.id === order.id)
        return exists ? current.map((item) => (item.id === order.id ? order : item)) : [...current, order]
      })
    }
    const onConnect = () => {
      setConnected(true)
      reload()
    }
    const onDisconnect = () => setConnected(false)

    socket.on('delivery:order:updated', onUpdated)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    setConnected(socket.connected)

    return () => {
      socket.off('delivery:order:updated', onUpdated)
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [company.id, registerArrivals, reload])

  const changeStatus = useCallback(
    async (id: string, status: DeliveryStatus) => {
      const updated = await updateDeliveryOrderStatus(session.token.token, id, status)
      setOrders((current) => current.map((item) => (item.id === id ? updated : item)))
      setNewIds((current) => current.filter((item) => item !== id))
      return updated
    },
    [session.token.token]
  )

  const acknowledge = useCallback((id: string) => setNewIds((current) => current.filter((item) => item !== id)), [])

  return { orders, loading, error, connected, newIds, reload, changeStatus, acknowledge }
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { connectSocket } from '../lib/socket'
import { playAlert } from '../lib/alertSound'
import {
  assignDeliveryCourier,
  fetchActiveCouriers,
  fetchDeliveryBoard,
  updateDeliveryOrderStatus,
  type Courier,
  type DeliveryOrder,
  type DeliveryStatus,
} from '../lib/delivery'
import { ApiError } from '../lib/api'
import type { AuthSession, AuthCompany } from '../lib/auth'

const REFRESH_MS = 45000

export function useDeliveryBoard(session: AuthSession, company: AuthCompany, soundEnabled: boolean) {
  const [orders, setOrders] = useState<DeliveryOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [newIds, setNewIds] = useState<string[]>([])
  const knownIds = useRef<Set<string> | null>(null)
  const soundRef = useRef(soundEnabled)
  soundRef.current = soundEnabled

  const registerArrivals = useCallback((incoming: DeliveryOrder[]) => {
    if (knownIds.current === null) {
      knownIds.current = new Set(incoming.map((order) => order.id))
      return
    }
    const fresh = incoming.filter(
      (order) => !knownIds.current!.has(order.id) && order.status !== 'completed' && order.status !== 'canceled'
    )
    incoming.forEach((order) => knownIds.current!.add(order.id))
    if (fresh.length) {
      setNewIds((current) => [...current, ...fresh.map((order) => order.id)])
      if (soundRef.current) playAlert()
    }
  }, [])

  // Enquanto houver pedido novo sem atendimento, repete o alerta a cada 10 s.
  useEffect(() => {
    if (!soundEnabled || newIds.length === 0) return
    const timer = setInterval(playAlert, 10000)
    return () => clearInterval(timer)
  }, [soundEnabled, newIds.length])

  const reload = useCallback(async () => {
    fetchActiveCouriers(session.token.token, company.id)
      .then((res) => setCouriers(res.data || []))
      .catch(() => {})

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
    async (id: string, status: DeliveryStatus, courierId?: string) => {
      const updated = await updateDeliveryOrderStatus(session.token.token, id, status, courierId)
      setOrders((current) => current.map((item) => (item.id === id ? updated : item)))
      setNewIds((current) => current.filter((item) => item !== id))
      return updated
    },
    [session.token.token]
  )

  const setCourier = useCallback(
    async (id: string, courierId: string | null) => {
      const updated = await assignDeliveryCourier(session.token.token, id, courierId)
      setOrders((current) => current.map((item) => (item.id === id ? updated : item)))
      return updated
    },
    [session.token.token]
  )

  const acknowledge = useCallback((id: string) => setNewIds((current) => current.filter((item) => item !== id)), [])

  return { orders, loading, error, connected, newIds, couriers, reload, changeStatus, setCourier, acknowledge }
}

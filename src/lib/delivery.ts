import { apiGet, apiPost } from './api'

export type DeliveryStatus =
  'pending' | 'confirmed' | 'preparing' | 'ready_for_pickup' | 'out_for_delivery' | 'completed' | 'canceled'

export interface DeliveryOrderItem {
  id: string
  name: string
  quantity: number
  unit_price: number
  total: number
  observation: string | null
}

export interface DeliveryOrder {
  id: string
  code: number
  status: DeliveryStatus
  origin: string
  external_display_id: string | null
  fulfillment_type: 'delivery' | 'pickup' | string
  payment_method: string
  subtotal: number
  delivery_fee: number
  total: number
  notes: string | null
  include_disposables: boolean
  table_number: number | null
  created_at: string | null
  updated_at: string | null
  courier: { id: string; name: string; phone: string | null } | null
  courier_assigned_at: string | null
  customer: { name: string; phone: string }
  address: {
    street: string | null
    number: string | null
    district: string | null
    city: string | null
    state: string | null
    complement: string | null
    reference: string | null
    zip_code: string | null
  } | null
  items: DeliveryOrderItem[]
}

export function fetchDeliveryBoard(token: string, companyId: string) {
  return apiGet<{ orders: DeliveryOrder[]; server_time: string }>('/delivery-board', { companyId }, token)
}

export function updateDeliveryOrderStatus(token: string, id: string, status: DeliveryStatus, courierId?: string) {
  return apiPost<DeliveryOrder>(`/delivery-board/${id}/status`, { status, courier_id: courierId }, token)
}

export interface Courier {
  id: string
  name: string
  phone: string | null
  vehicle: string | null
}

export function fetchActiveCouriers(token: string, companyId: string) {
  return apiGet<{ data: Courier[] }>('/delivery-courier', { companyId, active: '1', limit: '200' }, token)
}

export function assignDeliveryCourier(token: string, id: string, courierId: string | null) {
  return apiPost<DeliveryOrder>(`/delivery-board/${id}/courier`, { courier_id: courierId }, token)
}

export interface BoardColumn {
  key: string
  title: string
  statuses: DeliveryStatus[]
  tone: 'red' | 'amber' | 'blue' | 'green' | 'muted'
  empty: string
}

export const BOARD_COLUMNS: BoardColumn[] = [
  { key: 'pending', title: 'Pendentes', statuses: ['pending'], tone: 'red', empty: 'Nenhum pedido novo.' },
  {
    key: 'production',
    title: 'Em produção',
    statuses: ['confirmed', 'preparing'],
    tone: 'amber',
    empty: 'Nenhum pedido em produção.',
  },
  {
    key: 'ready',
    title: 'Pronto / Saiu para entrega',
    statuses: ['ready_for_pickup', 'out_for_delivery'],
    tone: 'blue',
    empty: 'Nenhum pedido pronto.',
  },
  {
    key: 'completed',
    title: 'Concluídos',
    statuses: ['completed'],
    tone: 'green',
    empty: 'Nenhum pedido concluído hoje.',
  },
  {
    key: 'canceled',
    title: 'Cancelados',
    statuses: ['canceled'],
    tone: 'muted',
    empty: 'Nenhum pedido cancelado hoje.',
  },
]

export const STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: 'Pendente',
  confirmed: 'Aceito',
  preparing: 'Em preparo',
  ready_for_pickup: 'Pronto',
  out_for_delivery: 'Saiu para entrega',
  completed: 'Concluído',
  canceled: 'Cancelado',
}

export const ORIGIN_LABELS: Record<string, string> = {
  own: 'Cardápio próprio',
  ifood: 'iFood',
  ze: 'Zé Delivery',
}

export const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  card: 'Cartão',
  pix: 'Pix',
  ifood: 'Pago no iFood',
}

export interface NextAction {
  label: string
  status: DeliveryStatus
}

// Próximo passo do pedido na ordem natural do delivery. Retirada no balcão
// não "sai para entrega": vai de pronto direto para concluído.
export function getNextAction(order: DeliveryOrder): NextAction | null {
  const isPickup = order.fulfillment_type === 'pickup'

  switch (order.status) {
    case 'pending':
      return { label: 'Aceitar pedido', status: 'confirmed' }
    case 'confirmed':
      return { label: 'Iniciar preparo', status: 'preparing' }
    case 'preparing':
      return { label: isPickup ? 'Pronto para retirada' : 'Pronto para entrega', status: 'ready_for_pickup' }
    case 'ready_for_pickup':
      return isPickup
        ? { label: 'Retirado - concluir', status: 'completed' }
        : { label: 'Saiu para entrega', status: 'out_for_delivery' }
    case 'out_for_delivery':
      return { label: 'Entregue - concluir', status: 'completed' }
    default:
      return null
  }
}

export function elapsedMinutes(from: string | null, now: number): number {
  if (!from) return 0
  return Math.max(0, Math.floor((now - new Date(from).getTime()) / 60000))
}

export function formatElapsed(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${String(minutes % 60).padStart(2, '0')}`
}

export function formatMoney(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function formatTime(value: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Cuiaba' }).format(
    new Date(value)
  )
}

export function formatAddress(order: DeliveryOrder): string {
  const a = order.address
  if (!a) return order.fulfillment_type === 'pickup' ? 'Retirada no balcão' : 'Endereço não informado'
  const street = [a.street, a.number].filter(Boolean).join(', ')
  return [street, a.district].filter(Boolean).join(' - ')
}

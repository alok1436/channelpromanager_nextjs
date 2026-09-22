'use client'

import { useCallback, useEffect, useState } from 'react'
import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useSession } from 'next-auth/react'

type OrderItem = { id: number; sku: string; title: string; quantity_ordered: number; item_price: string; currency: string }
type Order = {
  id: number; order_number: string; external_order_id: string; channel: number | null
  status: string; external_status: string; total: string; currency: string
  buyer_name: string; buyer_email: string; purchase_date: string | null
  shipping_address: Record<string, unknown>; items: OrderItem[]; created_at: string
}
type Channel = { id: number; name: string; platform: { code: string } }
type Page<T> = { count: number; results: T[] }
type SyncResult = { orders_created: number; orders_updated: number; items_created: number; items_updated: number }
type Form = { order_number: string; status: string; total: string; currency: string }

const emptyForm: Form = { order_number: '', status: 'pending', total: '0.00', currency: 'EUR' }
const statuses = ['pending', 'processing', 'completed', 'cancelled']

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null)
  if (body?.detail) return String(body.detail)
  if (body?.message) return String(body.message)
  if (body && typeof body === 'object') return Object.entries(body).map(([key, value]) => key + ': ' + String(value)).join(' · ')
  return 'Request failed (' + response.status + ')'
}

const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch('/api/portal/' + path, { cache: 'no-store', ...init })
  if (!response.ok) throw new Error(await readError(response))
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const OrderManager = () => {
  const { data: session } = useSession()
  const [orders, setOrders] = useState<Order[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [channelId, setChannelId] = useState('')
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState<Order | 'new' | null>(null)
  const [form, setForm] = useState<Form>(emptyForm)
  const [viewing, setViewing] = useState<Order | null>(null)
  const [deleting, setDeleting] = useState<Order | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [syncChannel, setSyncChannel] = useState('')

  const can = (code: string) => session?.user?.accountType === 'superuser' || session?.user?.accountType === 'customer' || Boolean(session?.user?.permissions?.includes(code))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), page_size: '20', ordering: '-created_at' })
      if (query) params.set('search', query)
      if (status) params.set('status', status)
      if (channelId) params.set('channel', channelId)
      const data = await request<Page<Order>>('orders?' + params.toString())
      setOrders(data.results)
      setCount(data.count)
      setError('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load orders')
    } finally {
      setLoading(false)
    }
  }, [page, query, status, channelId])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    request<Page<Channel> | Channel[]>('channels?page_size=100').then(data => {
      setChannels(Array.isArray(data) ? data : data.results)
    }).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load channels'))
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { setQuery(search); setPage(1) }, 350)
    return () => window.clearTimeout(timer)
  }, [search])

  const openEdit = (order: Order | 'new') => {
    setEditing(order)
    setForm(order === 'new' ? emptyForm : {
      order_number: order.order_number, status: order.status, total: order.total, currency: order.currency
    })
    setError('')
  }

  const save = async () => {
    if (!form.order_number.trim() || !form.currency.trim() || !Number.isFinite(Number(form.total)) || Number(form.total) < 0) {
      setError('Enter an order number, currency, and a valid non-negative total.')
      return
    }
    setWorking(true)
    try {
      const isNew = editing === 'new'
      await request<Order>('orders' + (isNew ? '' : '/' + (editing as Order).id), {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, order_number: form.order_number.trim(), currency: form.currency.trim().toUpperCase() })
      })
      setEditing(null)
      setNotice(isNew ? 'Order created.' : 'Order updated.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save order')
    } finally {
      setWorking(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setWorking(true)
    try {
      await request<void>('orders/' + deleting.id, { method: 'DELETE' })
      setDeleting(null)
      setNotice('Order deleted.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete order')
    } finally {
      setWorking(false)
    }
  }

  const syncKaufland = async () => {
    if (!syncChannel) return
    setWorking(true)
    try {
      const result = await request<SyncResult>('channels/' + syncChannel + '/sync-orders', { method: 'POST' })
      setSyncOpen(false)
      setNotice('Kaufland: ' + result.orders_created + ' orders created, ' + result.orders_updated + ' updated.')
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to download Kaufland orders')
    } finally {
      setWorking(false)
    }
  }

  const kauflandChannels = channels.filter(channel => channel.platform.code === 'kaufland')
  const channelName = (id: number | null) => channels.find(channel => channel.id === id)?.name ?? (id ? 'Channel #' + id : 'Manual')
  const money = (order: Order) => order.currency + ' ' + order.total

  return <div className='flex flex-col gap-5'>
    {error && <Alert severity='error' onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity='success' onClose={() => setNotice('')}>{notice}</Alert>}
    <Card>
      <CardHeader title='Orders' subheader='Search, manage, and download marketplace orders' action={<div className='flex flex-wrap gap-2'>
        {can('orders.create') && <Button variant='tonal' onClick={() => { setSyncChannel(kauflandChannels[0] ? String(kauflandChannels[0].id) : ''); setSyncOpen(true) }}>Download Kaufland orders</Button>}
        {can('orders.create') && <Button variant='contained' onClick={() => openEdit('new')}>Add order</Button>}
      </div>} />
      <CardContent className='flex flex-wrap gap-3'>
        <TextField size='small' label='Search order, buyer, or SKU' value={search} onChange={event => setSearch(event.target.value)} className='min-is-[250px] flex-1' />
        <TextField select size='small' label='Status' value={status} onChange={event => { setStatus(event.target.value); setPage(1) }} className='min-is-[150px]'><MenuItem value=''>All statuses</MenuItem>{statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
        <TextField select size='small' label='Channel' value={channelId} onChange={event => { setChannelId(event.target.value); setPage(1) }} className='min-is-[180px]'><MenuItem value=''>All channels</MenuItem>{channels.map(channel => <MenuItem key={channel.id} value={String(channel.id)}>{channel.name}</MenuItem>)}</TextField>
        <Button onClick={() => void load()} disabled={loading}>Refresh</Button>
      </CardContent>
      <TableContainer><Table><TableHead><TableRow><TableCell>Order / date</TableCell><TableCell>Channel</TableCell><TableCell>Product info</TableCell><TableCell>Buyer</TableCell><TableCell>Total</TableCell><TableCell>Status</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead><TableBody>
        {orders.map(order => <TableRow key={order.id} hover><TableCell><Typography fontWeight={600}>{order.order_number}</Typography><Typography variant='body2' color='text.secondary'>{order.purchase_date ? new Date(order.purchase_date).toLocaleString() : new Date(order.created_at).toLocaleString()}</Typography></TableCell><TableCell>{channelName(order.channel)}</TableCell><TableCell>{order.items.length ? <><Typography>{order.items[0].title || order.items[0].sku}</Typography><Typography variant='body2' color='text.secondary'>{order.items.length} item{order.items.length === 1 ? '' : 's'}</Typography></> : '—'}</TableCell><TableCell>{order.buyer_name || order.buyer_email || '—'}</TableCell><TableCell>{money(order)}</TableCell><TableCell><Chip size='small' label={order.status} color={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'error' : 'warning'} /></TableCell><TableCell align='right'><Button size='small' onClick={() => setViewing(order)}>View</Button>{can('orders.update') && <Button size='small' onClick={() => openEdit(order)}>Edit</Button>}{can('orders.delete') && <Button size='small' color='error' onClick={() => setDeleting(order)}>Delete</Button>}</TableCell></TableRow>)}
        {!loading && orders.length === 0 && <TableRow><TableCell colSpan={7} align='center'>No orders found.</TableCell></TableRow>}
        {loading && <TableRow><TableCell colSpan={7} align='center'>Loading orders…</TableCell></TableRow>}
      </TableBody></Table></TableContainer>
      {count > 20 && <CardContent className='flex justify-end'><Pagination page={page} count={Math.ceil(count / 20)} onChange={(_, value) => setPage(value)} /></CardContent>}
    </Card>
    <Dialog open={Boolean(editing)} onClose={() => !working && setEditing(null)} fullWidth maxWidth='sm'><DialogTitle>{editing === 'new' ? 'Add manual order' : 'Edit order'}</DialogTitle><DialogContent className='flex flex-col gap-4 !pt-3'><TextField required label='Order number' value={form.order_number} onChange={event => setForm(current => ({ ...current, order_number: event.target.value }))} /><TextField select label='Status' value={form.status} onChange={event => setForm(current => ({ ...current, status: event.target.value }))}>{statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField><TextField required type='number' label='Total' value={form.total} onChange={event => setForm(current => ({ ...current, total: event.target.value }))} /><TextField required label='Currency' value={form.currency} onChange={event => setForm(current => ({ ...current, currency: event.target.value }))} inputProps={{ maxLength: 3 }} /></DialogContent><DialogActions><Button onClick={() => setEditing(null)} disabled={working}>Cancel</Button><Button variant='contained' onClick={() => void save()} disabled={working}>{working ? 'Saving…' : 'Save'}</Button></DialogActions></Dialog>
    <Dialog open={Boolean(viewing)} onClose={() => setViewing(null)} fullWidth maxWidth='md'><DialogTitle>Order {viewing?.order_number}</DialogTitle><DialogContent className='flex flex-col gap-3'><Typography>Channel: {viewing ? channelName(viewing.channel) : ''} · Status: {viewing?.status} · Total: {viewing ? money(viewing) : ''}</Typography><Typography>Buyer: {viewing?.buyer_name || '—'} {viewing?.buyer_email ? '(' + viewing.buyer_email + ')' : ''}</Typography><Typography variant='h6'>Items</Typography>{viewing?.items.length ? viewing.items.map(item => <Typography key={item.id}>{item.quantity_ordered} × {item.title || item.sku} — {item.currency || viewing.currency} {item.item_price}</Typography>) : <Typography color='text.secondary'>No items attached.</Typography>}<Typography variant='h6'>Shipping address</Typography><Typography>{viewing?.shipping_address ? Object.values(viewing.shipping_address).filter(value => typeof value === 'string' && value).join(', ') || '—' : '—'}</Typography></DialogContent><DialogActions><Button onClick={() => setViewing(null)}>Close</Button></DialogActions></Dialog>
    <Dialog open={Boolean(deleting)} onClose={() => !working && setDeleting(null)}><DialogTitle>Delete order?</DialogTitle><DialogContent>Delete order {deleting?.order_number} and its items? This cannot be undone.</DialogContent><DialogActions><Button onClick={() => setDeleting(null)} disabled={working}>Cancel</Button><Button color='error' variant='contained' onClick={() => void remove()} disabled={working}>Delete</Button></DialogActions></Dialog>
    <Dialog open={syncOpen} onClose={() => !working && setSyncOpen(false)} fullWidth maxWidth='xs'><DialogTitle>Download Kaufland orders</DialogTitle><DialogContent className='!pt-3'>{kauflandChannels.length ? <TextField select fullWidth label='Kaufland channel' value={syncChannel} onChange={event => setSyncChannel(event.target.value)}>{kauflandChannels.map(channel => <MenuItem key={channel.id} value={String(channel.id)}>{channel.name}</MenuItem>)}</TextField> : <Alert severity='warning'>No Kaufland channel found. Add one and configure its credentials and marketplaces first.</Alert>}</DialogContent><DialogActions><Button onClick={() => setSyncOpen(false)} disabled={working}>Cancel</Button><Button variant='contained' disabled={working || !syncChannel} onClick={() => void syncKaufland()}>{working ? 'Downloading…' : 'Download orders'}</Button></DialogActions></Dialog>
  </div>
}

export default OrderManager

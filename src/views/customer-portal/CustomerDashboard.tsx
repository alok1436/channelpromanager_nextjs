'use client'

import { useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

type Order = {
  id: number
  order_number: string
  status: 'pending' | 'processing' | 'completed' | 'cancelled'
  total: string
  currency: string
  created_at: string
}

type DashboardData = {
  companyCount: number
  orderCount: number
  orders: Order[]
}

const normalizeList = <Item,>(payload: unknown): { count: number; results: Item[] } => {
  if (Array.isArray(payload)) return { count: payload.length, results: payload as Item[] }
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>

    if (Array.isArray(value.results)) return { count: Number(value.count ?? value.results.length), results: value.results as Item[] }
    if (value.data && typeof value.data === 'object') return normalizeList<Item>(value.data)
  }

  return { count: 0, results: [] }
}

const statusColor = (status: Order['status']) => {
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'error'
  if (status === 'processing') return 'info'
  return 'warning'
}

const CustomerDashboard = () => {
  const { data: session } = useSession()
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      fetch('/api/portal/companies?page=1&page_size=1'),
      fetch('/api/portal/orders?page=1&page_size=5&ordering=-created_at')
    ])
      .then(async ([companiesResponse, ordersResponse]) => {
        if (!companiesResponse.ok || !ordersResponse.ok) throw new Error('Unable to load dashboard data')

        const companies = normalizeList<never>(await companiesResponse.json())
        const orders = normalizeList<Order>(await ordersResponse.json())

        if (active) setData({ companyCount: companies.count, orderCount: orders.count, orders: orders.results })
      })
      .catch(caught => active && setError(caught instanceof Error ? caught.message : 'Unable to load dashboard'))

    return () => {
      active = false
    }
  }, [])

  const completedOrders = useMemo(() => data?.orders.filter(order => order.status === 'completed').length ?? 0, [data])
  const activeOrders = useMemo(() => data?.orders.filter(order => ['pending', 'processing'].includes(order.status)).length ?? 0, [data])

  return (
    <div className='flex flex-col gap-6'>
      <Card>
        <CardContent className='flex flex-wrap items-center justify-between gap-6 p-8'>
          <div>
            <Typography variant='h3'>Welcome, {session?.user?.name || 'Customer'}</Typography>
            <Typography color='text.secondary' className='mt-1'>Here is your Channel Pro Manager overview.</Typography>
          </div>
          <Button variant='contained' startIcon={<i className='tabler-building-plus' />} onClick={() => router.push(`/${lang}/companies`)}>
            Manage Companies
          </Button>
        </CardContent>
      </Card>

      {error && <Alert severity='error'>{error}</Alert>}

      <Grid container spacing={6}>
        {[
          { label: 'Companies', value: data?.companyCount, icon: 'tabler-building', color: 'primary' },
          { label: 'Total Orders', value: data?.orderCount, icon: 'tabler-shopping-cart', color: 'info' },
          { label: 'Active Orders', value: data ? activeOrders : undefined, icon: 'tabler-clock', color: 'warning' },
          { label: 'Recent Completed', value: data ? completedOrders : undefined, icon: 'tabler-circle-check', color: 'success' }
        ].map(item => (
          <Grid key={item.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card className='bs-full'>
              <CardContent className='flex items-center justify-between gap-4'>
                <div>
                  <Typography color='text.secondary'>{item.label}</Typography>
                  {item.value === undefined ? <Skeleton width={54} height={46} /> : <Typography variant='h3'>{item.value}</Typography>}
                </div>
                <div className='flex items-center justify-center rounded-lg bg-primaryLighter is-14 bs-14'>
                  <i className={`${item.icon} text-primary text-3xl`} />
                </div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card>
        <CardHeader title='Recent Orders' subheader='Your five most recent orders' />
        <Table>
          <TableHead><TableRow><TableCell>Order</TableCell><TableCell>Status</TableCell><TableCell>Total</TableCell><TableCell>Date</TableCell></TableRow></TableHead>
          <TableBody>
            {data?.orders.map(order => (
              <TableRow key={order.id} hover>
                <TableCell>{order.order_number}</TableCell>
                <TableCell><Chip size='small' label={order.status} color={statusColor(order.status)} variant='tonal' /></TableCell>
                <TableCell>{order.currency} {order.total}</TableCell>
                <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
              </TableRow>
            ))}
            {data && data.orders.length === 0 && <TableRow><TableCell colSpan={4} align='center'>No orders yet.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

export default CustomerDashboard

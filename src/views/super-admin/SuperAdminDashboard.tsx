'use client'

import { useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import Grid from '@mui/material/Grid'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import { useParams, useRouter } from 'next/navigation'

import type { AdminResource } from './resourceConfig'

type Summary = {
  resource: AdminResource
  title: string
  description: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'info'
  count: number | null
}

const readCount = (payload: unknown): number => {
  if (Array.isArray(payload)) return payload.length
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>

    if (typeof value.count === 'number') return value.count
    if (value.data) return readCount(value.data)
  }

  return 0
}

const initialSummaries: Summary[] = [
  { resource: 'platforms', title: 'Platforms', description: 'Integration provider master data', icon: 'tabler-world-cog', color: 'primary', count: null },
  { resource: 'marketplaces', title: 'Marketplaces', description: 'Regional sales destinations', icon: 'tabler-building-store', color: 'info', count: null },
  { resource: 'modules', title: 'Modules', description: 'Application feature groups', icon: 'tabler-box', color: 'primary', count: null },
  { resource: 'permissions', title: 'Permissions', description: 'Available access rules', icon: 'tabler-key', color: 'warning', count: null },
  { resource: 'roles', title: 'Roles', description: 'Permission assignments', icon: 'tabler-user-shield', color: 'info', count: null },
  { resource: 'customers', title: 'Customers', description: 'Managed customer accounts', icon: 'tabler-users', color: 'success', count: null }
]

const SuperAdminDashboard = () => {
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()
  const [summaries, setSummaries] = useState(initialSummaries)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all(
      initialSummaries.map(async summary => {
        const response = await fetch(`/api/super-admin/${summary.resource}?page=1&page_size=1`)

        if (!response.ok) throw new Error(`Unable to load ${summary.title.toLowerCase()}`)

        return { ...summary, count: readCount(await response.json()) }
      })
    )
      .then(results => active && setSummaries(results))
      .catch(caught => active && setError(caught instanceof Error ? caught.message : 'Unable to load dashboard'))

    return () => {
      active = false
    }
  }, [])

  return (
    <div className='flex flex-col gap-6'>
      <Card className='overflow-hidden'>
        <CardContent className='flex flex-wrap items-center justify-between gap-6 p-8'>
          <div className='flex flex-col gap-2'>
            <Chip label='SUPER ADMIN' color='primary' size='small' className='self-start' />
            <Typography variant='h3'>Administration Dashboard</Typography>
            <Typography color='text.secondary'>Manage platforms, marketplaces, system access, roles, permissions, and customers.</Typography>
          </div>
          <div className='flex items-center justify-center rounded-xl bg-primaryLighter is-24 bs-24'>
            <i className='tabler-shield-lock text-primary text-5xl' />
          </div>
        </CardContent>
      </Card>

      {error && <Alert severity='error'>{error}</Alert>}

      <Grid container spacing={6}>
        {summaries.map(summary => (
          <Grid key={summary.resource} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card className='bs-full'>
              <CardContent className='flex flex-col gap-5'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-center justify-center rounded-lg bg-primaryLighter is-12 bs-12'>
                    <i className={`${summary.icon} text-primary text-2xl`} />
                  </div>
                  {summary.count === null ? <Skeleton width={48} height={42} /> : <Typography variant='h3'>{summary.count}</Typography>}
                </div>
                <div>
                  <Typography variant='h5'>{summary.title}</Typography>
                  <Typography variant='body2' color='text.secondary'>{summary.description}</Typography>
                </div>
                <Button
                  variant='tonal'
                  color={summary.color}
                  endIcon={<i className='tabler-arrow-right' />}
                  onClick={() => router.push(`/${lang}/super-admin/${summary.resource}`)}
                >
                  Manage {summary.title}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default SuperAdminDashboard

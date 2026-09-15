'use client'

import { useCallback, useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'

import CustomTextField from '@core/components/mui/TextField'

type Warehouse = {
  id: number
  customer: number
  company: number | null
  company_name: string | null
  name: string
  street1: string
  street2: string
  plz: string
  city: string
  province: string
  country: string
  phone: string
  fax: string
  email: string
  notes: string
}

type CompanyOption = { id: number; name: string }
type WarehouseForm = Omit<Warehouse, 'id' | 'customer' | 'company_name'> & { company: number }

const emptyForm: WarehouseForm = {
  company: 0,
  name: '',
  street1: '',
  street2: '',
  plz: '',
  city: '',
  province: '',
  country: '',
  phone: '',
  fax: '',
  email: '',
  notes: ''
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

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null)

  if (body?.detail) return String(body.detail)
  const errors = body?.errors ?? body

  if (errors && typeof errors === 'object') {
    return Object.entries(errors).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' · ')
  }

  return `Request failed (${response.status})`
}

const WarehouseManager = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [companies, setCompanies] = useState<CompanyOption[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Warehouse | null>(null)
  const [deleting, setDeleting] = useState<Warehouse | null>(null)
  const [form, setForm] = useState<WarehouseForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadWarehouses = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), page_size: '10' })

    if (appliedSearch) query.set('search', appliedSearch)

    try {
      const response = await fetch(`/api/portal/warehouses?${query}`)

      if (!response.ok) throw new Error(await readError(response))
      const data = normalizeList<Warehouse>(await response.json())

      setWarehouses(data.results)
      setCount(data.count)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load warehouses')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, page])

  const loadCompanies = useCallback(async () => {
    try {
      const response = await fetch('/api/portal/companies?page_size=200&is_active=true')

      if (!response.ok) throw new Error(await readError(response))
      setCompanies(normalizeList<CompanyOption>(await response.json()).results)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load companies')
    }
  }, [])

  useEffect(() => { void loadWarehouses() }, [loadWarehouses])
  useEffect(() => { void loadCompanies() }, [loadCompanies])

  const update = <Key extends keyof WarehouseForm>(key: Key, value: WarehouseForm[Key]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, company: companies[0]?.id ?? 0 })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (warehouse: Warehouse) => {
    setEditing(warehouse)
    setForm({
      company: warehouse.company ?? companies[0]?.id ?? 0,
      name: warehouse.name,
      street1: warehouse.street1,
      street2: warehouse.street2,
      plz: warehouse.plz,
      city: warehouse.city,
      province: warehouse.province,
      country: warehouse.country,
      phone: warehouse.phone,
      fax: warehouse.fax,
      email: warehouse.email,
      notes: warehouse.notes
    })
    setError('')
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.company) return setError('Company is required.')
    if (!form.name.trim()) return setError('Warehouse name is required.')

    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/portal/warehouses${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })

      if (!response.ok) throw new Error(await readError(response))
      setDialogOpen(false)
      setNotice(`Warehouse ${editing ? 'updated' : 'created'} successfully.`)
      await loadWarehouses()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save warehouse')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)

    try {
      const response = await fetch(`/api/portal/warehouses/${deleting.id}`, { method: 'DELETE' })

      if (!response.ok) throw new Error(await readError(response))
      setDeleting(null)
      setNotice('Warehouse deleted successfully.')
      await loadWarehouses()
    } catch (caught) {
      setDeleting(null)
      setError(caught instanceof Error ? caught.message : 'Unable to delete warehouse')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader
        avatar={<i className='tabler-building-warehouse text-2xl' />}
        title='Warehouses'
        subheader='Manage company warehouse locations'
        action={<Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate} disabled={!companies.length}>Add Warehouse</Button>}
      />
      <CardContent className='flex gap-3'>
        <TextField size='small' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search warehouses' onKeyDown={event => event.key === 'Enter' && (setPage(1), setAppliedSearch(search))} />
        <Button variant='tonal' onClick={() => { setPage(1); setAppliedSearch(search) }}>Search</Button>
      </CardContent>
      {error && !dialogOpen && <Alert severity='error' className='mx-6 mb-4'>{error}</Alert>}
      {!companies.length && !loading && <Alert severity='info' className='mx-6 mb-4'>Create an active company before adding a warehouse.</Alert>}
      <TableContainer>
        <Table>
          <TableHead><TableRow><TableCell>Warehouse</TableCell><TableCell>Company</TableCell><TableCell>Location</TableCell><TableCell>Contact</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {warehouses.map(warehouse => (
              <TableRow key={warehouse.id} hover>
                <TableCell><Typography fontWeight={500}>{warehouse.name}</Typography></TableCell>
                <TableCell>{warehouse.company_name || '—'}</TableCell>
                <TableCell>{[warehouse.street1, warehouse.plz, warehouse.city, warehouse.country].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell><Typography variant='body2'>{warehouse.email || '—'}</Typography><Typography variant='caption' color='text.secondary'>{warehouse.phone}</Typography></TableCell>
                <TableCell align='right'><IconButton aria-label='Edit warehouse' onClick={() => openEdit(warehouse)}><i className='tabler-edit' /></IconButton><IconButton aria-label='Delete warehouse' color='error' onClick={() => setDeleting(warehouse)}><i className='tabler-trash' /></IconButton></TableCell>
              </TableRow>
            ))}
            {!loading && warehouses.length === 0 && <TableRow><TableCell colSpan={5} align='center'>No warehouses found.</TableCell></TableRow>}
            {loading && <TableRow><TableCell colSpan={5} align='center'>Loading…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {count > 10 && <CardContent className='flex justify-end'><Pagination page={page} count={Math.ceil(count / 10)} color='primary' onChange={(_, value) => setPage(value)} /></CardContent>}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth='md' scroll='body'>
        <DialogTitle className='relative flex flex-col items-center gap-2 p-6 text-center sm:p-8'>
          <div className='flex items-center justify-center rounded-xl bg-primaryLighter text-primary is-14 bs-14'>
            <i className='tabler-building-warehouse text-3xl' />
          </div>
          <Typography variant='h4'>{editing ? 'Edit warehouse' : 'Create a warehouse'}</Typography>
          <Typography color='text.secondary'>Set the company, location and contact details for this warehouse.</Typography>
          <IconButton className='absolute !end-4 !top-4' onClick={() => setDialogOpen(false)} disabled={saving}><i className='tabler-x' /></IconButton>
        </DialogTitle>
        <DialogContent className='!pt-0 sm:!px-8'>
          {error && <Alert severity='error' className='mb-4'>{error}</Alert>}
          <div className='flex flex-col gap-5'>
            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-info-circle text-primary text-2xl' /><div><Typography variant='h6'>Warehouse details</Typography><Typography variant='body2' color='text.secondary'>Choose the owning company and warehouse name</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth required label='Company' value={form.company || ''} onChange={event => update('company', Number(event.target.value))} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-building' /></InputAdornment> } }}>{companies.map(company => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</CustomTextField></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth required label='Warehouse name' placeholder='e.g. Berlin Central Warehouse' value={form.name} onChange={event => update('name', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-building-warehouse' /></InputAdornment> } }} /></Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-map-pin text-primary text-2xl' /><div><Typography variant='h6'>Location</Typography><Typography variant='body2' color='text.secondary'>Physical address used for operations and shipping</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Street 1' placeholder='Street and house number' value={form.street1} onChange={event => update('street1', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Street 2' placeholder='Building, unit or floor' value={form.street2} onChange={event => update('street2', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Postal code (PLZ)' placeholder='Postal code' value={form.plz} onChange={event => update('plz', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='City' placeholder='City' value={form.city} onChange={event => update('city', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Province' placeholder='State or province' value={form.province} onChange={event => update('province', event.target.value)} /></Grid>
                <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Country' placeholder='Country' value={form.country} onChange={event => update('country', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-world' /></InputAdornment> } }} /></Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-headset text-primary text-2xl' /><div><Typography variant='h6'>Warehouse contact</Typography><Typography variant='body2' color='text.secondary'>Direct contact details for this location</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth type='email' label='Email address' placeholder='warehouse@example.com' value={form.email} onChange={event => update('email', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-mail' /></InputAdornment> } }} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Phone' placeholder='+49 123 456789' value={form.phone} onChange={event => update('phone', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-phone' /></InputAdornment> } }} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Fax' placeholder='+49 123 456780' value={form.fax} onChange={event => update('fax', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-printer' /></InputAdornment> } }} /></Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-4 flex items-center gap-3'><i className='tabler-notes text-primary text-2xl' /><div><Typography variant='h6'>Internal notes</Typography><Typography variant='body2' color='text.secondary'>Optional operational information for your team</Typography></div></div>
              <CustomTextField fullWidth multiline minRows={3} label='Notes' placeholder='Add receiving hours, access instructions, or other useful details…' value={form.notes} onChange={event => update('notes', event.target.value)} />
            </div>
          </div>
        </DialogContent>
        <DialogActions className='gap-3 px-6 pb-6 pt-5 sm:px-8'><Button variant='tonal' color='secondary' onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant='contained' startIcon={<i className='tabler-device-floppy' />} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Warehouse'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => !saving && setDeleting(null)} fullWidth maxWidth='xs'>
        <DialogTitle>Delete Warehouse?</DialogTitle>
        <DialogContent><Typography>Delete {deleting?.name}? This action cannot be undone.</Typography></DialogContent>
        <DialogActions><Button color='secondary' onClick={() => setDeleting(null)} disabled={saving}>Cancel</Button><Button color='error' variant='contained' onClick={remove} disabled={saving}>Delete</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
    </Card>
  )
}

export default WarehouseManager

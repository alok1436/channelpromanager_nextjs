'use client'

import { useCallback, useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Pagination from '@mui/material/Pagination'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useSearchParams } from 'next/navigation'

import CustomTextField from '@core/components/mui/TextField'

type Company = {
  id: number
  name: string
  street_1: string
  street_2: string
  postal_code: string
  city: string
  province: string
  country: string
  phone: string
  fax: string
  email: string
  logo: string | null
  note: string
  is_active: boolean
}

type CompanyForm = Omit<Company, 'id' | 'logo'> & { logo: File | null; existingLogo: string | null }

const normalizeCompanies = (payload: unknown): { count: number; results: Company[] } => {
  if (Array.isArray(payload)) return { count: payload.length, results: payload as Company[] }
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>

    if (Array.isArray(value.results)) return { count: Number(value.count ?? value.results.length), results: value.results as Company[] }
    if (value.data && typeof value.data === 'object') return normalizeCompanies(value.data)
  }

  return { count: 0, results: [] }
}

const emptyForm: CompanyForm = {
  name: '', street_1: '', street_2: '', postal_code: '', city: '', province: '', country: '',
  phone: '', fax: '', email: '', logo: null, existingLogo: null, note: '', is_active: true
}

const readError = async (response: Response) => {
  const text = await response.text()
  let body: unknown = null

  try {
    body = text ? JSON.parse(text) : null
  } catch {
    return text.trim() || `Request failed (${response.status})`
  }

  const flatten = (value: unknown, path = ''): string[] => {
    if (Array.isArray(value)) return value.flatMap(item => flatten(item, path))
    if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, item]) => flatten(item, path ? `${path}.${key}` : key))

    return [`${path ? `${path}: ` : ''}${String(value)}`]
  }

  if (body && typeof body === 'object' && 'detail' in body) return String((body as { detail: unknown }).detail)
  if (body && typeof body === 'object') return flatten(body).join(' · ')

  return `Request failed (${response.status})`
}

const CompanyManager = () => {
  const searchParams = useSearchParams()
  const [companies, setCompanies] = useState<Company[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [deleting, setDeleting] = useState<Company | null>(null)
  const [form, setForm] = useState<CompanyForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), page_size: '10' })

    if (appliedSearch) query.set('search', appliedSearch)

    try {
      const response = await fetch(`/api/portal/companies?${query}`)

      if (!response.ok) throw new Error(await readError(response))

      const data = normalizeCompanies(await response.json())

      setCompanies(data.results)
      setCount(data.count)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load companies')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, page])

  useEffect(() => {
    void loadCompanies()
  }, [loadCompanies])

  useEffect(() => {
    if (searchParams.get('create') === 'true') openCreate()
    // Open only when the route explicitly requests the create form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const update = <Key extends keyof CompanyForm>(key: Key, value: CompanyForm[Key]) => {
    setForm(current => ({ ...current, [key]: value }))
  }

  const chooseLogo = (file: File | null) => {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Logo: choose a PNG, JPG, or WebP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(`Logo: ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB. The maximum size is 5 MB.`)
      return
    }
    setError('')
    update('logo', file)
  }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setError('')
    setDialogOpen(true)
  }

  const openEdit = (company: Company) => {
    setEditing(company)
    setForm({ ...company, logo: null, existingLogo: company.logo })
    setError('')
    setDialogOpen(true)
  }

  const save = async () => {
    if (!form.name.trim()) {
      setError('Company name is required.')
      return
    }

    setSaving(true)
    setError('')
    const payload = new FormData()

    ;(['name', 'street_1', 'street_2', 'postal_code', 'city', 'province', 'country', 'phone', 'fax', 'email', 'note'] as const)
      .forEach(key => payload.append(key, form[key]))
    payload.append('is_active', String(form.is_active))
    if (form.logo) payload.append('logo', form.logo)

    try {
      const response = await fetch(`/api/portal/companies${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST',
        body: payload
      })

      if (!response.ok) throw new Error(await readError(response))

      setDialogOpen(false)
      setNotice(`Company ${editing ? 'updated' : 'created'} successfully.`)
      await loadCompanies()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save company')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleting) return
    setSaving(true)

    try {
      const response = await fetch(`/api/portal/companies/${deleting.id}`, { method: 'DELETE' })

      if (!response.ok) throw new Error(await readError(response))

      setDeleting(null)
      setNotice('Company deleted successfully.')
      await loadCompanies()
    } catch (caught) {
      setDeleting(null)
      setError(caught instanceof Error ? caught.message : 'Unable to delete company')
    } finally {
      setSaving(false)
    }
  }

  const logoPreview = form.logo ? URL.createObjectURL(form.logo) : form.existingLogo

  return (
    <Card>
      <CardHeader
        avatar={<i className='tabler-building text-2xl' />}
        title='Companies'
        subheader='Manage your company profiles'
        action={<Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>Add Company</Button>}
      />
      <CardContent className='flex gap-3'>
        <TextField size='small' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search companies' onKeyDown={event => event.key === 'Enter' && (setPage(1), setAppliedSearch(search))} />
        <Button variant='tonal' onClick={() => { setPage(1); setAppliedSearch(search) }}>Search</Button>
      </CardContent>
      {error && !dialogOpen && <Alert severity='error' className='mx-6 mb-4'>{error}</Alert>}
      <TableContainer>
        <Table>
          <TableHead><TableRow><TableCell>Company</TableCell><TableCell>Location</TableCell><TableCell>Contact</TableCell><TableCell>Status</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {companies.map(company => (
              <TableRow key={company.id} hover>
                <TableCell><div className='flex items-center gap-3'><Avatar src={company.logo ?? undefined}><i className='tabler-building' /></Avatar><Typography fontWeight={500}>{company.name}</Typography></div></TableCell>
                <TableCell>{[company.city, company.country].filter(Boolean).join(', ') || '—'}</TableCell>
                <TableCell><Typography variant='body2'>{company.email || '—'}</Typography><Typography variant='caption' color='text.secondary'>{company.phone}</Typography></TableCell>
                <TableCell><Chip size='small' label={company.is_active ? 'Active' : 'Inactive'} color={company.is_active ? 'success' : 'secondary'} /></TableCell>
                <TableCell align='right'><IconButton onClick={() => openEdit(company)}><i className='tabler-edit' /></IconButton><IconButton color='error' onClick={() => setDeleting(company)}><i className='tabler-trash' /></IconButton></TableCell>
              </TableRow>
            ))}
            {!loading && companies.length === 0 && <TableRow><TableCell colSpan={5} align='center'>No companies found.</TableCell></TableRow>}
            {loading && <TableRow><TableCell colSpan={5} align='center'>Loading…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {count > 10 && <CardContent className='flex justify-end'><Pagination page={page} count={Math.ceil(count / 10)} onChange={(_, value) => setPage(value)} color='primary' /></CardContent>}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth='md' scroll='body'>
        <DialogTitle className='relative flex flex-col items-center gap-2 p-6 text-center sm:p-8'>
          <div className='flex items-center justify-center rounded-xl bg-primaryLighter text-primary is-14 bs-14'>
            <i className='tabler-building text-3xl' />
          </div>
          <Typography variant='h4'>{editing ? 'Edit company' : 'Create a company'}</Typography>
          <Typography color='text.secondary'>Keep your business identity, address and contact information up to date.</Typography>
          <IconButton className='absolute !end-4 !top-4' onClick={() => setDialogOpen(false)} disabled={saving}><i className='tabler-x' /></IconButton>
        </DialogTitle>
        <DialogContent className='!pt-0 sm:!px-8'>
          {error && <Alert severity='error' className='mb-4'>{error}</Alert>}
          <div className='flex flex-col gap-5'>
            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-id text-primary text-2xl' /><div><Typography variant='h6'>Basic details</Typography><Typography variant='body2' color='text.secondary'>Company identity and visibility</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 7 }}><CustomTextField fullWidth required label='Company name' placeholder='e.g. Acme Trading Ltd.' value={form.name} onChange={event => update('name', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-building' /></InputAdornment> } }} /></Grid>
                <Grid size={{ xs: 12, sm: 5 }}><div className='flex min-bs-16 items-center justify-between rounded-lg bg-actionHover px-4 py-3'><div><Typography fontWeight={500}>Company status</Typography><Typography variant='caption' color='text.secondary'>{form.is_active ? 'Visible and available' : 'Currently disabled'}</Typography></div><Switch checked={form.is_active} onChange={event => update('is_active', event.target.checked)} /></div></Grid>
                <Grid size={{ xs: 12 }}>
                  <div className='flex flex-col items-center gap-4 rounded-xl border border-dashed border-primary bg-primaryLighter p-5 sm:flex-row'>
                    <Avatar src={logoPreview ?? undefined} variant='rounded' className='is-20 bs-20'>{!logoPreview && <i className='tabler-photo text-3xl' />}</Avatar>
                    <div className='flex flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-start'><Typography fontWeight={600}>Company logo</Typography><Typography variant='body2' color='text.secondary'>Upload PNG, JPG or WebP up to 5 MB. Invalid files are explained before upload.</Typography><Button component='label' size='small' variant='tonal' startIcon={<i className='tabler-upload' />}>Choose image<input hidden type='file' accept='image/png,image/jpeg,image/webp' onChange={event => chooseLogo(event.target.files?.[0] ?? null)} /></Button>{form.logo && <Typography variant='caption' color='success.main'>{form.logo.name} ({(form.logo.size / 1024 / 1024).toFixed(2)} MB)</Typography>}</div>
                  </div>
                </Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-map-pin text-primary text-2xl' /><div><Typography variant='h6'>Address</Typography><Typography variant='body2' color='text.secondary'>Registered business location</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Street 1' placeholder='Street and house number' value={form.street_1} onChange={event => update('street_1', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='Street 2' placeholder='Suite, floor or building' value={form.street_2} onChange={event => update('street_2', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Postal code' placeholder='Postal code' value={form.postal_code} onChange={event => update('postal_code', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='City' placeholder='City' value={form.city} onChange={event => update('city', event.target.value)} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Province' placeholder='State or province' value={form.province} onChange={event => update('province', event.target.value)} /></Grid>
                <Grid size={{ xs: 12 }}><CustomTextField fullWidth label='Country' placeholder='Country' value={form.country} onChange={event => update('country', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-world' /></InputAdornment> } }} /></Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-5 flex items-center gap-3'><i className='tabler-address-book text-primary text-2xl' /><div><Typography variant='h6'>Contact information</Typography><Typography variant='body2' color='text.secondary'>How partners can reach this company</Typography></div></div>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Email address' type='email' placeholder='office@example.com' value={form.email} onChange={event => update('email', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-mail' /></InputAdornment> } }} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Phone' placeholder='+49 123 456789' value={form.phone} onChange={event => update('phone', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-phone' /></InputAdornment> } }} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth label='Fax' placeholder='+49 123 456780' value={form.fax} onChange={event => update('fax', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-printer' /></InputAdornment> } }} /></Grid>
              </Grid>
            </div>

            <div className='rounded-xl border border-solid border-divider p-5'>
              <div className='mb-4 flex items-center gap-3'><i className='tabler-notes text-primary text-2xl' /><div><Typography variant='h6'>Internal notes</Typography><Typography variant='body2' color='text.secondary'>Optional information for your team</Typography></div></div>
              <CustomTextField fullWidth multiline minRows={3} label='Note' placeholder='Add helpful context about this company…' value={form.note} onChange={event => update('note', event.target.value)} />
            </div>
          </div>
        </DialogContent>
        <DialogActions className='gap-3 px-6 pb-6 pt-5 sm:px-8'><Button variant='tonal' color='secondary' onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button><Button variant='contained' startIcon={<i className='tabler-device-floppy' />} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Company'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleting)} onClose={() => !saving && setDeleting(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete company?</DialogTitle><DialogContent><Typography>Delete {deleting?.name}? This cannot be undone.</Typography></DialogContent>
        <DialogActions><Button color='secondary' onClick={() => setDeleting(null)}>Cancel</Button><Button color='error' variant='contained' onClick={remove} disabled={saving}>Delete</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
    </Card>
  )
}

export default CompanyManager

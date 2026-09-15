'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
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

type Company = { id: number; name: string }
type Platform = { id: number; name: string; code: string; is_active: boolean }
type Marketplace = { id: number; name: string; code: string; country_code: string; currency_code: string }
type Channel = {
  id: number
  name: string
  company: Company
  platform: Platform
  country_code: string
  vat: string
  standard_shipping_cost: string
  note: string
  status: string
  is_active: boolean
  credential_configured: boolean
  marketplaces: Marketplace[]
}
type ChannelForm = {
  company_id: number
  platform: string
  name: string
  country_code: string
  vat: string
  standard_shipping_cost: string
  note: string
  marketplace_ids: number[]
  is_active: boolean
}

const emptyForm: ChannelForm = {
  company_id: 0, platform: '', name: '', country_code: '', vat: '',
  standard_shipping_cost: '0.00', note: '', marketplace_ids: [], is_active: true
}

const credentialFields: Record<string, Array<{ key: string; label: string; type?: string; hint?: string }>> = {
  cdiscount: [
    { key: 'seller_id', label: 'Seller ID' }, { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client secret', type: 'password' }
  ],
  woocommerce: [
    { key: 'store_url', label: 'Store URL', hint: 'https://store.example.com' },
    { key: 'consumer_key', label: 'Consumer key', type: 'password' },
    { key: 'consumer_secret', label: 'Consumer secret', type: 'password' }
  ],
  otto: [{ key: 'client_id', label: 'Client ID' }, { key: 'client_secret', label: 'Client secret', type: 'password' }]
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
  const errors = body?.errors ?? body

  if (body?.detail) return String(body.detail)
  if (errors && typeof errors === 'object') return Object.entries(errors)
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ')

  return `Request failed (${response.status})`
}

const statusColor = (status: string): 'success' | 'warning' | 'error' | 'secondary' => {
  if (status === 'active') return 'success'
  if (status === 'error') return 'error'
  if (['pending', 'authorizing'].includes(status)) return 'warning'

  return 'secondary'
}

const ChannelManager = () => {
  const [channels, setChannels] = useState<Channel[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [marketplaces, setMarketplaces] = useState<Marketplace[]>([])
  const [form, setForm] = useState<ChannelForm>(emptyForm)
  const [editing, setEditing] = useState<Channel | null>(null)
  const [deleting, setDeleting] = useState<Channel | null>(null)
  const [credentialChannel, setCredentialChannel] = useState<Channel | null>(null)
  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [dialogOpen, setDialogOpen] = useState(false)
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadChannels = useCallback(async () => {
    setLoading(true)
    setError('')
    const query = new URLSearchParams({ page: String(page), page_size: '10' })

    if (appliedSearch) query.set('search', appliedSearch)
    try {
      const response = await fetch(`/api/portal/channels?${query}`)

      if (!response.ok) throw new Error(await readError(response))
      const data = normalizeList<Channel>(await response.json())

      setChannels(data.results)
      setCount(data.count)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load channels')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, page])

  useEffect(() => { void loadChannels() }, [loadChannels])
  useEffect(() => {
    Promise.all([
      fetch('/api/portal/companies?page_size=200&is_active=true'),
      fetch('/api/portal/platforms?page_size=200&is_active=true')
    ]).then(async ([companyResponse, platformResponse]) => {
      if (!companyResponse.ok) throw new Error(await readError(companyResponse))
      if (!platformResponse.ok) throw new Error(await readError(platformResponse))
      setCompanies(normalizeList<Company>(await companyResponse.json()).results)
      setPlatforms(normalizeList<Platform>(await platformResponse.json()).results)
    }).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load channel options'))
  }, [])

  const loadMarketplaces = useCallback(async (platformCode: string, selected: number[] = []) => {
    if (!platformCode) {
      setMarketplaces([])
      return
    }
    const response = await fetch(`/api/portal/platforms/${encodeURIComponent(platformCode)}/marketplaces`)

    if (!response.ok) throw new Error(await readError(response))
    setMarketplaces(normalizeList<Marketplace>(await response.json()).results)
    setForm(current => ({ ...current, marketplace_ids: selected }))
  }, [])

  const update = <Key extends keyof ChannelForm>(key: Key, value: ChannelForm[Key]) => setForm(current => ({ ...current, [key]: value }))

  const openCreate = () => {
    const platform = platforms[0]?.code ?? ''

    setEditing(null)
    setForm({ ...emptyForm, company_id: companies[0]?.id ?? 0, platform })
    setError('')
    setDialogOpen(true)
    void loadMarketplaces(platform)
  }

  const openEdit = (channel: Channel) => {
    const selected = channel.marketplaces.map(marketplace => marketplace.id)

    setEditing(channel)
    setForm({
      company_id: channel.company.id, platform: channel.platform.code, name: channel.name,
      country_code: channel.country_code, vat: channel.vat, standard_shipping_cost: channel.standard_shipping_cost,
      note: channel.note, marketplace_ids: selected, is_active: channel.is_active
    })
    setError('')
    setDialogOpen(true)
    void loadMarketplaces(channel.platform.code, selected)
  }

  const save = async () => {
    if (!form.company_id || !form.platform || !form.name.trim() || form.country_code.trim().length !== 2) {
      setError('Company, platform, channel name and two-letter country code are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const payload = editing
        ? { company_id: form.company_id, name: form.name, country_code: form.country_code, vat: form.vat, standard_shipping_cost: form.standard_shipping_cost, note: form.note, is_active: form.is_active }
        : form
      const response = await fetch(`/api/portal/channels${editing ? `/${editing.id}` : ''}`, {
        method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      })

      if (!response.ok) throw new Error(await readError(response))
      if (editing) {
        const marketplaceResponse = await fetch(`/api/portal/channels/${editing.id}/marketplaces`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ marketplace_ids: form.marketplace_ids })
        })

        if (!marketplaceResponse.ok) throw new Error(await readError(marketplaceResponse))
      }
      setDialogOpen(false)
      setNotice(`Channel ${editing ? 'updated' : 'created'} successfully.`)
      await loadChannels()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save channel')
    } finally {
      setSaving(false)
    }
  }

  const disconnect = async () => {
    if (!deleting) return
    setSaving(true)
    try {
      const response = await fetch(`/api/portal/channels/${deleting.id}/disconnect`, { method: 'POST' })

      if (!response.ok) throw new Error(await readError(response))
      setDeleting(null)
      setNotice('Channel disconnected successfully.')
      await loadChannels()
    } catch (caught) {
      setDeleting(null)
      setError(caught instanceof Error ? caught.message : 'Unable to disconnect channel')
    } finally {
      setSaving(false)
    }
  }

  const authorize = async (channel: Channel) => {
    setError('')
    const response = await fetch(`/api/portal/channels/${channel.id}/authorize`, { method: 'POST' })

    if (!response.ok) return setError(await readError(response))
    const data = await response.json() as { authorization_url: string }

    window.location.assign(data.authorization_url)
  }

  const saveCredentials = async () => {
    if (!credentialChannel) return
    const fields = credentialFields[credentialChannel.platform.code] ?? []
    const missing = fields.find(field => !credentials[field.key]?.trim())

    if (missing) return setError(`${missing.label} is required.`)
    setSaving(true)
    setError('')
    try {
      const response = await fetch(`/api/portal/channels/${credentialChannel.id}/credentials`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials)
      })

      if (!response.ok) throw new Error(await readError(response))
      setCredentialChannel(null)
      setCredentials({})
      setNotice('Credentials saved securely.')
      await loadChannels()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save credentials')
    } finally {
      setSaving(false)
    }
  }

  const selectedPlatform = useMemo(() => platforms.find(platform => platform.code === form.platform), [form.platform, platforms])

  return (
    <Card>
      <CardHeader avatar={<i className='tabler-plug-connected text-2xl' />} title='Sales Channels' subheader='Connect and manage marketplace integrations' action={<Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate} disabled={!companies.length || !platforms.length}>Add Channel</Button>} />
      <CardContent className='flex gap-3'><TextField size='small' value={search} onChange={event => setSearch(event.target.value)} placeholder='Search channels' onKeyDown={event => event.key === 'Enter' && (setPage(1), setAppliedSearch(search))} /><Button variant='tonal' onClick={() => { setPage(1); setAppliedSearch(search) }}>Search</Button></CardContent>
      {error && !dialogOpen && !credentialChannel && <Alert severity='error' className='mx-6 mb-4'>{error}</Alert>}
      {!companies.length && !loading && <Alert severity='info' className='mx-6 mb-4'>Create an active company before adding a sales channel.</Alert>}
      <TableContainer><Table><TableHead><TableRow><TableCell>Channel</TableCell><TableCell>Company</TableCell><TableCell>Platform</TableCell><TableCell>Marketplaces</TableCell><TableCell>Status</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead>
        <TableBody>{channels.map(channel => <TableRow key={channel.id} hover>
          <TableCell><Typography fontWeight={600}>{channel.name}</Typography><Typography variant='caption' color='text.secondary'>{channel.country_code} · {channel.vat || 'No VAT'}</Typography></TableCell>
          <TableCell>{channel.company.name}</TableCell><TableCell><Chip size='small' variant='tonal' color='primary' label={channel.platform.name} /></TableCell>
          <TableCell>{channel.marketplaces.length ? channel.marketplaces.map(item => item.country_code).join(', ') : '—'}</TableCell>
          <TableCell><Chip size='small' color={statusColor(channel.status)} label={channel.status.replaceAll('_', ' ')} /></TableCell>
          <TableCell align='right'><IconButton title='Edit channel' onClick={() => openEdit(channel)}><i className='tabler-edit' /></IconButton>{['amazon', 'ebay'].includes(channel.platform.code) ? <IconButton color='primary' title='Authorize channel' onClick={() => void authorize(channel)}><i className='tabler-link' /></IconButton> : <IconButton color={channel.credential_configured ? 'success' : 'primary'} title='Configure credentials' onClick={() => { setError(''); setCredentials({}); setCredentialChannel(channel) }}><i className='tabler-key' /></IconButton>}<IconButton color='error' title='Disconnect channel' disabled={channel.status === 'disconnected'} onClick={() => setDeleting(channel)}><i className='tabler-plug-connected-x' /></IconButton></TableCell>
        </TableRow>)}{!loading && channels.length === 0 && <TableRow><TableCell colSpan={6} align='center'>No channels found.</TableCell></TableRow>}{loading && <TableRow><TableCell colSpan={6} align='center'>Loading…</TableCell></TableRow>}</TableBody>
      </Table></TableContainer>
      {count > 10 && <CardContent className='flex justify-end'><Pagination page={page} count={Math.ceil(count / 10)} color='primary' onChange={(_, value) => setPage(value)} /></CardContent>}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth='md' scroll='body'>
        <DialogTitle component='div' className='relative flex flex-col items-center gap-2 p-6 text-center'><div className='flex items-center justify-center rounded-xl bg-primaryLighter text-primary is-14 bs-14'><i className='tabler-plug-connected text-3xl' /></div><Typography variant='h4'>{editing ? 'Edit sales channel' : 'Connect a sales channel'}</Typography><Typography color='text.secondary'>Select the provider, company and regional marketplaces.</Typography><IconButton className='absolute !end-4 !top-4' onClick={() => setDialogOpen(false)}><i className='tabler-x' /></IconButton></DialogTitle>
        <DialogContent className='!pt-0 sm:!px-8'>{error && <Alert severity='error' className='mb-4'>{error}</Alert>}<div className='flex flex-col gap-5'>
          <div className='rounded-xl border border-solid border-divider p-5'><Typography variant='h6' className='mb-4'>Channel identity</Typography><Grid container spacing={4}>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth required label='Company' value={form.company_id || ''} onChange={event => update('company_id', Number(event.target.value))}>{companies.map(company => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth required disabled={Boolean(editing)} label='Platform' value={form.platform} onChange={event => { const code = event.target.value; update('platform', code); void loadMarketplaces(code) }}>{platforms.map(platform => <MenuItem key={platform.id} value={platform.code}>{platform.name}</MenuItem>)}</CustomTextField></Grid>
            <Grid size={{ xs: 12, sm: 8 }}><CustomTextField fullWidth required label='Channel name' placeholder='e.g. Amazon Germany' value={form.name} onChange={event => update('name', event.target.value)} slotProps={{ input: { startAdornment: <InputAdornment position='start'><i className='tabler-tag' /></InputAdornment> } }} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><CustomTextField fullWidth required label='Country code' placeholder='DE' value={form.country_code} onChange={event => update('country_code', event.target.value.toUpperCase().slice(0, 2))} /></Grid>
          </Grid></div>
          <div className='rounded-xl border border-solid border-divider p-5'><Typography variant='h6'>Marketplaces</Typography><Typography variant='body2' color='text.secondary' className='mb-3'>Choose active {selectedPlatform?.name ?? ''} destinations for this channel.</Typography><Grid container>{marketplaces.map(marketplace => <Grid key={marketplace.id} size={{ xs: 12, sm: 6 }}><FormControlLabel control={<Checkbox checked={form.marketplace_ids.includes(marketplace.id)} onChange={event => update('marketplace_ids', event.target.checked ? [...form.marketplace_ids, marketplace.id] : form.marketplace_ids.filter(id => id !== marketplace.id))} />} label={`${marketplace.name} (${marketplace.currency_code})`} /></Grid>)}{!marketplaces.length && <Typography color='text.secondary'>No active marketplaces configured for this platform.</Typography>}</Grid></div>
          <div className='rounded-xl border border-solid border-divider p-5'><Typography variant='h6' className='mb-4'>Commercial settings</Typography><Grid container spacing={4}><Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth label='VAT number' value={form.vat} onChange={event => update('vat', event.target.value)} /></Grid><Grid size={{ xs: 12, sm: 6 }}><CustomTextField fullWidth type='number' label='Standard shipping cost' value={form.standard_shipping_cost} onChange={event => update('standard_shipping_cost', event.target.value)} /></Grid><Grid size={{ xs: 12 }}><CustomTextField fullWidth multiline minRows={3} label='Internal notes' value={form.note} onChange={event => update('note', event.target.value)} /></Grid></Grid></div>
        </div></DialogContent><DialogActions className='gap-3 px-8 pb-6 pt-5'><Button variant='tonal' color='secondary' onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant='contained' onClick={() => void save()} disabled={saving}>{saving ? 'Saving…' : 'Save Channel'}</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(credentialChannel)} onClose={() => !saving && setCredentialChannel(null)} fullWidth maxWidth='sm'><DialogTitle>Configure {credentialChannel?.platform.name}</DialogTitle><DialogContent className='flex flex-col gap-4 !pt-3'>{error && <Alert severity='error'>{error}</Alert>}<Alert severity='info'>Credentials are encrypted by the server and are never returned to the browser.</Alert>{(credentialFields[credentialChannel?.platform.code ?? ''] ?? []).map(field => <CustomTextField key={field.key} fullWidth required type={field.type ?? 'text'} label={field.label} placeholder={field.hint} value={credentials[field.key] ?? ''} onChange={event => setCredentials(current => ({ ...current, [field.key]: event.target.value }))} />)}</DialogContent><DialogActions><Button color='secondary' onClick={() => setCredentialChannel(null)}>Cancel</Button><Button variant='contained' onClick={() => void saveCredentials()} disabled={saving}>{saving ? 'Saving…' : 'Save credentials'}</Button></DialogActions></Dialog>
      <Dialog open={Boolean(deleting)} onClose={() => !saving && setDeleting(null)} fullWidth maxWidth='xs'><DialogTitle>Disconnect channel?</DialogTitle><DialogContent><Typography>Disconnect {deleting?.name}? Its history will be retained.</Typography></DialogContent><DialogActions><Button color='secondary' onClick={() => setDeleting(null)}>Cancel</Button><Button color='error' variant='contained' onClick={() => void disconnect()} disabled={saving}>Disconnect</Button></DialogActions></Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
    </Card>
  )
}

export default ChannelManager

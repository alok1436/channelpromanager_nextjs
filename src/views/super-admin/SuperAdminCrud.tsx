'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'

import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
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
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Select from '@mui/material/Select'
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

import type { AdminResource, FieldConfig } from './resourceConfig'
import { resourceConfigs } from './resourceConfig'

type Row = Record<string, unknown> & { id: number; is_system_role?: boolean }
type PaginatedResponse = { count: number; results: Row[] }
type OptionMap = Partial<Record<AdminResource, Row[]>>
type PermissionGroup = {
  module: string
  name: string
  permissions: Array<{ id: number; code: string; name: string }>
}

const platformDescriptions: Record<string, string> = {
  amazon: 'Everything from A to Z.',
  ebay: 'Buy it, sell it, love it.',
  otto: 'A trusted home for modern retail.',
  cdiscount: 'French ecommerce made accessible.',
  woocommerce: 'Commerce built on WordPress.'
}

const pageSize = 10

const normalizeList = (payload: unknown): PaginatedResponse => {
  if (Array.isArray(payload)) return { count: payload.length, results: payload as Row[] }

  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>

    if (Array.isArray(value.results)) {
      return { count: typeof value.count === 'number' ? value.count : value.results.length, results: value.results as Row[] }
    }

    if (value.data && typeof value.data === 'object') return normalizeList(value.data)
  }

  return { count: 0, results: [] }
}

const normalizePermissionList = (payload: unknown): PaginatedResponse => {
  const raw = payload && typeof payload === 'object' && !Array.isArray(payload) && 'data' in payload
    ? (payload as Record<string, unknown>).data
    : payload

  if (!Array.isArray(raw)) return normalizeList(raw)

  const groups = raw as PermissionGroup[]

  if (!groups.every(group => Array.isArray(group.permissions))) return normalizeList(raw)

  const results = groups.flatMap(group => group.permissions.map(permission => ({
    id: permission.id,
    name: permission.name,
    codename: permission.code,
    module_name: group.name,
    module_slug: group.module,
    is_active: true
  })))

  return { count: results.length, results }
}

const normalizeResourceList = (payload: unknown, resource: AdminResource) =>
  resource === 'permissions' ? normalizePermissionList(payload) : normalizeList(payload)

const getErrorMessage = async (response: Response) => {
  const data = await response.json().catch(() => null)

  if (data?.detail) return String(data.detail)
  if (data && typeof data === 'object') {
    return Object.entries(data)
      .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : String(messages)}`)
      .join(' · ')
  }

  return `Request failed (${response.status})`
}

const displayValue = (value: unknown, key: string, row: Row) => {
  if (key === 'is_active') return <Chip size='small' color={value ? 'success' : 'secondary'} label={value ? 'Active' : 'Inactive'} />
  if (key === 'has_login') return <Chip size='small' color={value ? 'info' : 'secondary'} label={value ? 'Enabled' : 'Not set'} />
  if (key === 'logo_url') return value
    ? <Avatar src={String(value)} alt={`${String(row.name ?? 'Platform')} logo`} variant='rounded' sx={{ width: 52, height: 52, '& img': { objectFit: 'contain' } }} />
    : <Avatar variant='rounded' sx={{ width: 52, height: 52 }}><i className='tabler-photo-off' /></Avatar>
  if (key === 'description' && !value) return platformDescriptions[String(row.code ?? '').toLowerCase()] ?? '—'
  if (Array.isArray(value)) return value.length ? value.map(item => typeof item === 'object' ? String((item as Row).name) : String(item)).join(', ') : '—'

  return value === null || value === undefined || value === '' ? '—' : String(value)
}

const SuperAdminCrud = ({ resource }: { resource: AdminResource }) => {
  const config = resourceConfigs[resource]
  const [rows, setRows] = useState<Row[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [appliedSearch, setAppliedSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteRow, setDeleteRow] = useState<Row | null>(null)
  const [editingRow, setEditingRow] = useState<Row | null>(null)
  const [form, setForm] = useState<Record<string, unknown>>(config.defaults)
  const [options, setOptions] = useState<OptionMap>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const query = new URLSearchParams({ page: String(page), page_size: String(pageSize) })

      if (appliedSearch) query.set('search', appliedSearch)

      const response = await fetch(`/api/super-admin/${resource}?${query}`)

      if (!response.ok) throw new Error(await getErrorMessage(response))

      let data = normalizeResourceList(await response.json(), resource)

      // The grouped permissions endpoint returns the complete matrix instead of
      // a paginated result, so search its flattened rows on the client.
      if (resource === 'permissions' && appliedSearch) {
        const term = appliedSearch.toLowerCase()
        const results = data.results.filter(row => ['name', 'codename', 'module_name'].some(
          key => String(row[key] ?? '').toLowerCase().includes(term)
        ))

        data = { count: results.length, results }
      }

      setRows(data.results)
      setCount(data.count)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load records')
    } finally {
      setLoading(false)
    }
  }, [appliedSearch, page, resource])

  useEffect(() => {
    setPage(1)
    setAppliedSearch('')
    setSearch('')
    setForm(config.defaults)
  }, [config.defaults, resource])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const optionResources = useMemo(
    () => [...new Set(config.fields.flatMap(field => field.optionsResource ? [field.optionsResource] : []))],
    [config.fields]
  )

  useEffect(() => {
    if (!formOpen) return

    optionResources.forEach(async optionResource => {
      const response = await fetch(`/api/super-admin/${optionResource}?page_size=200`)

      if (response.ok) {
        const data = normalizeResourceList(await response.json(), optionResource)

        setOptions(current => ({ ...current, [optionResource]: data.results }))
      }
    })
  }, [formOpen, optionResources])

  const openCreate = () => {
    setEditingRow(null)
    setForm({ ...config.defaults })
    setError('')
    setFormOpen(true)
  }

  const openEdit = async (row: Row) => {
    setError('')

    try {
      // The module-grouped permission list is intentionally a summary. Load the
      // individual record so its module, description and status can be edited.
      let editableRow = row

      if (resource === 'permissions') {
        const response = await fetch(`/api/super-admin/${resource}/${row.id}`)

        if (!response.ok) throw new Error(await getErrorMessage(response))
        editableRow = await response.json() as Row
      }

      setEditingRow(editableRow)
      setForm({
        ...Object.fromEntries(config.fields.map(field => [field.key, field.type === 'image' ? null : editableRow[field.key] ?? config.defaults[field.key]])),
        _logoPreview: editableRow.logo_url ?? null
      })
      setFormOpen(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to load ${config.singular.toLowerCase()}`)
    }
  }

  const save = async () => {
    const missing = config.fields.find(field => field.required && (form[field.key] === '' || form[field.key] === undefined))

    if (missing) {
      setError(`${missing.label} is required.`)
      return
    }

    setSaving(true)
    setError('')

    try {
      const hasImage = config.fields.some(field => field.type === 'image')
      let body: BodyInit
      let headers: HeadersInit | undefined

      if (hasImage) {
        const payload = new FormData()

        config.fields.forEach(field => {
          const value = form[field.key]

          if (field.type === 'image') {
            if (value instanceof File) payload.append(field.key, value)
          } else if (value !== undefined && value !== null) payload.append(field.key, String(value))
        })
        body = payload
      } else {
        headers = { 'Content-Type': 'application/json' }
        body = JSON.stringify(form)
      }

      const response = await fetch(`/api/super-admin/${resource}${editingRow ? `/${editingRow.id}` : ''}`, {
        method: editingRow ? 'PATCH' : 'POST', headers, body
      })

      if (!response.ok) throw new Error(await getErrorMessage(response))

      setFormOpen(false)
      setNotice(`${config.singular} ${editingRow ? 'updated' : 'created'} successfully.`)
      await loadRows()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save record')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!deleteRow) return

    setSaving(true)

    try {
      const response = await fetch(`/api/super-admin/${resource}/${deleteRow.id}`, { method: 'DELETE' })

      if (!response.ok) throw new Error(await getErrorMessage(response))

      setDeleteRow(null)
      setNotice(`${config.singular} deleted successfully.`)
      await loadRows()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to delete record')
      setDeleteRow(null)
    } finally {
      setSaving(false)
    }
  }

  const renderField = (field: FieldConfig) => {
    const value = form[field.key]
    const update = (newValue: unknown) => setForm(current => ({ ...current, [field.key]: newValue }))

    if (field.type === 'boolean') {
      return <FormControlLabel key={field.key} control={<Switch checked={Boolean(value)} onChange={event => update(event.target.checked)} />} label={field.label} />
    }

    if (field.type === 'image') {
      const preview = value instanceof File ? URL.createObjectURL(value) : String(form._logoPreview ?? '')

      const chooseImage = (file: File | null) => {
        if (!file) return
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
          setError('Logo must be a PNG, JPG, or WebP image.')
          return
        }
        if (file.size > 2 * 1024 * 1024) {
          setError('Logo must be 2 MB or smaller.')
          return
        }

        const image = new Image()
        const objectUrl = URL.createObjectURL(file)

        image.onload = () => {
          URL.revokeObjectURL(objectUrl)
          if (image.width !== 200 || image.height !== 200) {
            setError(`Logo must be exactly 200 × 200 pixels. Selected image is ${image.width} × ${image.height}.`)
            return
          }
          setError('')
          update(file)
        }
        image.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          setError('The selected logo could not be read. Please choose another image.')
        }
        image.src = objectUrl
      }

      return (
        <div key={field.key} className='flex items-center gap-4 rounded-xl border border-dashed border-primary bg-primaryLighter p-4'>
          <Avatar src={preview || undefined} variant='rounded' sx={{ width: 96, height: 96, '& img': { objectFit: 'contain' } }}><i className='tabler-photo text-3xl' /></Avatar>
          <div className='flex flex-col items-start gap-2'>
            <Typography fontWeight={600}>Platform logo</Typography>
            <Typography variant='body2' color='text.secondary'>PNG, JPG or WebP. Exactly 200 × 200 pixels, maximum 2 MB.</Typography>
            <Button component='label' variant='tonal' size='small' startIcon={<i className='tabler-upload' />}>
              Choose logo
              <input hidden type='file' accept='image/png,image/jpeg,image/webp' onChange={event => chooseImage(event.target.files?.[0] ?? null)} />
            </Button>
          </div>
        </div>
      )
    }

    if (resource === 'roles' && field.key === 'permissions') {
      const selected = Array.isArray(value) ? value.map(String) : []
      const items = options.permissions ?? []
      const groups = Object.entries(Object.groupBy(items, item => String(item.module_name ?? 'Other')))
      const toggle = (codename: string) => update(
        selected.includes(codename) ? selected.filter(item => item !== codename) : [...selected, codename]
      )

      return (
        <div key={field.key} className='flex flex-col gap-3'>
          <Typography variant='subtitle1'>{field.label}</Typography>
          {groups.length === 0 && <Typography color='text.secondary'>No active permissions available.</Typography>}
          {groups.map(([moduleName, permissions]) => {
            const modulePermissions = permissions ?? []
            const moduleCodes = modulePermissions.map(permission => String(permission.codename))
            const selectedCount = moduleCodes.filter(code => selected.includes(code)).length

            return (
              <div key={moduleName} className='rounded border border-solid border-divider p-3'>
                <FormControlLabel
                  className='m-0'
                  control={
                    <Checkbox
                      checked={moduleCodes.length > 0 && selectedCount === moduleCodes.length}
                      indeterminate={selectedCount > 0 && selectedCount < moduleCodes.length}
                      onChange={event => update(event.target.checked
                        ? [...new Set([...selected, ...moduleCodes])]
                        : selected.filter(code => !moduleCodes.includes(code)))}
                    />
                  }
                  label={<Typography fontWeight={600}>{moduleName}</Typography>}
                />
                <Divider className='my-2' />
                <div className='grid grid-cols-1 sm:grid-cols-2'>
                  {modulePermissions.map(permission => {
                    const codename = String(permission.codename)

                    return (
                      <FormControlLabel
                        key={permission.id}
                        control={<Checkbox checked={selected.includes(codename)} onChange={() => toggle(codename)} />}
                        label={String(permission.name)}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )
    }

    if (field.type === 'select' || field.type === 'multiselect') {
      const items = field.optionsResource ? options[field.optionsResource] ?? [] : []
      const optionValue = field.optionValue ?? 'id'
      const optionLabel = field.optionLabel ?? 'name'

      return (
        <Select
          key={field.key}
          fullWidth
          displayEmpty
          multiple={field.type === 'multiselect'}
          value={field.type === 'multiselect' ? (value as Array<string | number> ?? []) : (value ?? '')}
          onChange={event => update(event.target.value)}
          renderValue={selected => {
            if (Array.isArray(selected)) {
              return selected.map(selectedValue => items.find(item => item[optionValue] === selectedValue)?.[optionLabel] ?? selectedValue).join(', ') || field.label
            }

            return items.find(item => item[optionValue] === selected)?.[optionLabel]?.toString() ?? field.label
          }}
        >
          {field.type === 'select' && <MenuItem value=''><em>Select {field.label}</em></MenuItem>}
          {items.map(item => <MenuItem key={String(item.id)} value={item[optionValue] as string | number}>{String(item[optionLabel])}</MenuItem>)}
        </Select>
      )
    }

    return (
      <TextField
        key={field.key}
        fullWidth
        required={field.required}
        label={field.label}
        type={field.type ?? 'text'}
        value={value ?? ''}
        onChange={event => update(field.type === 'number' ? Number(event.target.value) : event.target.value)}
        multiline={field.key === 'description' || field.key === 'address'}
        minRows={field.key === 'description' || field.key === 'address' ? 2 : undefined}
        slotProps={field.type === 'date' ? { inputLabel: { shrink: true } } : undefined}
      />
    )
  }

  return (
    <Card>
      <CardHeader
        avatar={<i className={`${config.icon} text-2xl`} />}
        title={config.title}
        subheader={`Manage ${config.title.toLowerCase()}`}
        action={<Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={openCreate}>Add {config.singular}</Button>}
      />
      <CardContent className='flex gap-3 items-center'>
        <TextField
          size='small'
          value={search}
          onChange={event => setSearch(event.target.value)}
          onKeyDown={event => event.key === 'Enter' && (setPage(1), setAppliedSearch(search))}
          placeholder={`Search ${config.title.toLowerCase()}`}
        />
        <Button variant='tonal' onClick={() => { setPage(1); setAppliedSearch(search) }}>Search</Button>
        {appliedSearch && <Button color='secondary' onClick={() => { setSearch(''); setAppliedSearch(''); setPage(1) }}>Clear</Button>}
      </CardContent>
      {error && !formOpen && <Alert severity='error' className='mx-6 mb-4'>{error}</Alert>}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {config.columns.map(column => <TableCell key={column.key}>{column.label}</TableCell>)}
              <TableCell align='right'>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.map((row, index) => (
              <Fragment key={row.id}>
                {resource === 'permissions' && (index === 0 || rows[index - 1]?.module_name !== row.module_name) && (
                  <TableRow>
                    <TableCell colSpan={config.columns.length + 1} className='bg-actionHover'>
                      <Typography fontWeight={600}>{String(row.module_name ?? 'Other')}</Typography>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow hover>
                  {config.columns.map(column => <TableCell key={column.key}>{displayValue(row[column.key], column.key, row)}</TableCell>)}
                  <TableCell align='right'>
                    <IconButton aria-label={`Edit ${config.singular}`} onClick={() => void openEdit(row)}><i className='tabler-edit' /></IconButton>
                    <IconButton aria-label={`Delete ${config.singular}`} color='error' disabled={row.is_system_role} onClick={() => setDeleteRow(row)}><i className='tabler-trash' /></IconButton>
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
            {!loading && rows.length === 0 && <TableRow><TableCell colSpan={config.columns.length + 1} align='center'>No records found.</TableCell></TableRow>}
            {loading && <TableRow><TableCell colSpan={config.columns.length + 1} align='center'>Loading…</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
      {resource !== 'permissions' && count > pageSize && <CardContent className='flex justify-end'><Pagination count={Math.ceil(count / pageSize)} page={page} onChange={(_, value) => setPage(value)} color='primary' /></CardContent>}

      <Dialog open={formOpen} onClose={() => !saving && setFormOpen(false)} fullWidth maxWidth={resource === 'roles' ? 'md' : 'sm'}>
        <DialogTitle>{editingRow ? 'Edit' : 'Add'} {config.singular}</DialogTitle>
        <DialogContent className='flex flex-col gap-4 !pt-3'>
          {error && <Alert severity='error'>{error}</Alert>}
          {config.fields.map(renderField)}
        </DialogContent>
        <DialogActions>
          <Button color='secondary' onClick={() => setFormOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant='contained' onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteRow)} onClose={() => !saving && setDeleteRow(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete {config.singular}?</DialogTitle>
        <DialogContent><Typography>This action cannot be undone.</Typography></DialogContent>
        <DialogActions>
          <Button color='secondary' onClick={() => setDeleteRow(null)} disabled={saving}>Cancel</Button>
          <Button color='error' variant='contained' onClick={remove} disabled={saving}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
    </Card>
  )
}

export default SuperAdminCrud

'use client'

import { useCallback, useEffect, useState } from 'react'

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
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Pagination from '@mui/material/Pagination'
import Skeleton from '@mui/material/Skeleton'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useParams, usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { archiveProduct, bulkArchiveProducts, bulkProductStatus, duplicateProduct, getProducts, restoreProduct } from './api'
import type { ProductCondition, ProductFilters, ProductListItem, ProductStatus } from './types'
import { buildProductQuery, canProductAction } from './utils'

type Company = { id: number; name: string }
type CompanyPayload = { results?: Company[] }

const statuses: ProductStatus[] = ['draft', 'active', 'inactive', 'discontinued', 'archived']
const conditions: ProductCondition[] = ['new', 'used', 'refurbished']
const statusColor = (status: ProductStatus): 'success' | 'warning' | 'secondary' | 'error' | 'info' => ({
  active: 'success', draft: 'warning', inactive: 'secondary', discontinued: 'error', archived: 'info'
} as const)[status]

const ProductList = () => {
  const router = useRouter()
  const pathname = usePathname()
  const { lang } = useParams<{ lang: string }>()
  const { data: session } = useSession()
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [count, setCount] = useState(0)
  const [filters, setFilters] = useState<ProductFilters>({ page: 1, page_size: 10, ordering: '-updated_at', language: 'en' })
  const [searchInput, setSearchInput] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [confirmArchive, setConfirmArchive] = useState<ProductListItem | 'bulk' | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const can = (code: string) => canProductAction(session?.user?.accountType, session?.user?.permissions, code)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getProducts(filters)

      setProducts(data.results)
      setCount(data.count)
      setSelected(current => current.filter(id => data.results.some(product => product.id === id)))
      const query = buildProductQuery(filters)
      router.replace(`${pathname}?${query}`, { scroll: false })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load products')
    } finally {
      setLoading(false)
    }
  }, [filters, pathname, router])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    fetch('/api/portal/companies?page_size=100&is_active=true').then(async response => {
      if (!response.ok) return
      const data = await response.json() as CompanyPayload | Company[]

      setCompanies(Array.isArray(data) ? data : data.results ?? [])
    })
  }, [])
  useEffect(() => {
    const timeout = window.setTimeout(() => setFilters(current => ({ ...current, search: searchInput, page: 1 })), 400)

    return () => window.clearTimeout(timeout)
  }, [searchInput])

  const mutate = async (operation: () => Promise<unknown>, success: string) => {
    setWorking(true)
    setError('')
    try {
      await operation()
      setNotice(success)
      setSelected([])
      await load()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update product')
    } finally {
      setWorking(false)
    }
  }

  const clearFilters = () => {
    setSearchInput('')
    setFilters({ page: 1, page_size: 10, ordering: '-updated_at', language: 'en' })
  }

  return <div className='flex flex-col gap-6'>
    <Card><CardHeader avatar={<i className='tabler-package text-2xl' />} title='Products' subheader='Manage multilingual catalog products and variants' action={can('products.create') && <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push(`/${lang}/products/create`)}>Add Product</Button>} />
      <CardContent className='flex flex-wrap items-center gap-3'><TextField className='min-is-[260px] flex-1' size='small' value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder='Search by SKU, EAN, name, brand…' /><Button variant={showFilters ? 'contained' : 'tonal'} startIcon={<i className='tabler-filter' />} onClick={() => setShowFilters(value => !value)}>Filters</Button><TextField select size='small' label='Sort' value={filters.ordering} onChange={event => setFilters(current => ({ ...current, ordering: event.target.value, page: 1 }))}><MenuItem value='-updated_at'>Recently updated</MenuItem><MenuItem value='sku'>SKU A–Z</MenuItem><MenuItem value='-created_at'>Newest</MenuItem><MenuItem value='standard_sale_price'>Price low–high</MenuItem><MenuItem value='-standard_sale_price'>Price high–low</MenuItem></TextField></CardContent>
      {showFilters && <CardContent className='border-bs border-solid border-divider'><Grid container spacing={4}><Grid size={{ xs: 12, sm: 6, md: 3 }}><TextField select fullWidth size='small' label='Company' value={filters.company_id ?? ''} onChange={event => setFilters(current => ({ ...current, company_id: Number(event.target.value) || '', page: 1 }))}><MenuItem value=''>All companies</MenuItem>{companies.map(company => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select fullWidth size='small' label='Status' value={filters.status ?? ''} onChange={event => setFilters(current => ({ ...current, status: event.target.value as ProductStatus | '', page: 1 }))}><MenuItem value=''>All statuses</MenuItem>{statuses.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField select fullWidth size='small' label='Condition' value={filters.condition ?? ''} onChange={event => setFilters(current => ({ ...current, condition: event.target.value as ProductCondition | '', page: 1 }))}><MenuItem value=''>All conditions</MenuItem>{conditions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid><Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField fullWidth size='small' label='Brand' value={filters.brand ?? ''} onChange={event => setFilters(current => ({ ...current, brand: event.target.value, page: 1 }))} /></Grid><Grid size={{ xs: 12, sm: 6, md: 2 }}><TextField fullWidth size='small' label='Product type' value={filters.product_type ?? ''} onChange={event => setFilters(current => ({ ...current, product_type: event.target.value, page: 1 }))} /></Grid><Grid size={{ xs: 12, md: 1 }}><Button fullWidth color='secondary' onClick={clearFilters}>Clear</Button></Grid></Grid></CardContent>}
      {selected.length > 0 && <CardContent className='flex flex-wrap items-center gap-3 bg-actionHover'><Typography fontWeight={600}>{selected.length} selected</Typography>{can('products.update') && <TextField select size='small' label='Change status' value='' onChange={event => void mutate(() => bulkProductStatus(selected, event.target.value), 'Product statuses updated.')}><MenuItem value='' disabled>Select</MenuItem>{statuses.filter(item => item !== 'archived').map(item => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>}{can('products.delete') && <Button color='error' variant='tonal' startIcon={<i className='tabler-archive' />} onClick={() => setConfirmArchive('bulk')}>Archive selected</Button>}</CardContent>}
      {error && <Alert severity='error' className='mx-6 mb-4'>{error}</Alert>}
      <TableContainer><Table><TableHead><TableRow><TableCell padding='checkbox'><Checkbox checked={products.length > 0 && selected.length === products.length} indeterminate={selected.length > 0 && selected.length < products.length} onChange={event => setSelected(event.target.checked ? products.map(item => item.id) : [])} /></TableCell><TableCell>Image</TableCell><TableCell>SKU / Product</TableCell><TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Brand</TableCell><TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Company</TableCell><TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>Identifier</TableCell><TableCell>Price</TableCell><TableCell>Status</TableCell><TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>Updated</TableCell><TableCell align='right'>Actions</TableCell></TableRow></TableHead><TableBody>
        {loading ? Array.from({ length: 5 }).map((_, index) => <TableRow key={index}>{Array.from({ length: 10 }).map((__, cell) => <TableCell key={cell}><Skeleton /></TableCell>)}</TableRow>) : products.map(product => <TableRow key={product.id} hover><TableCell padding='checkbox'><Checkbox checked={selected.includes(product.id)} onChange={event => setSelected(current => event.target.checked ? [...current, product.id] : current.filter(id => id !== product.id))} /></TableCell><TableCell><Avatar variant='rounded' src={product.primary_image ?? undefined}><i className='tabler-photo' /></Avatar></TableCell><TableCell><Typography fontWeight={600}>{product.sku}</Typography><Typography variant='body2' color='text.secondary'>{product.name || 'Unnamed product'}</Typography></TableCell><TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>{product.brand || '—'}</TableCell><TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{product.company?.name ?? '—'}</TableCell><TableCell sx={{ display: { xs: 'none', xl: 'table-cell' } }}>{product.ean || '—'}</TableCell><TableCell>{product.standard_sale_price ? `${product.currency_code} ${product.standard_sale_price}` : '—'}</TableCell><TableCell><Chip size='small' variant='tonal' color={statusColor(product.status)} label={product.status} /></TableCell><TableCell sx={{ display: { xs: 'none', lg: 'table-cell' } }}>{new Date(product.updated_at).toLocaleDateString()}</TableCell><TableCell align='right'><IconButton title='View' onClick={() => router.push(`/${lang}/products/${product.id}`)}><i className='tabler-eye' /></IconButton>{can('products.update') && <IconButton title='Edit' onClick={() => router.push(`/${lang}/products/${product.id}/edit`)}><i className='tabler-edit' /></IconButton>}{can('products.create') && <IconButton title='Duplicate' disabled={working} onClick={() => void mutate(() => duplicateProduct(product.id), 'Product duplicated successfully.')}><i className='tabler-copy' /></IconButton>}{can('products.delete') && product.status !== 'archived' && <IconButton color='error' title='Archive' onClick={() => setConfirmArchive(product)}><i className='tabler-archive' /></IconButton>}{can('products.update') && product.status === 'archived' && <IconButton color='success' title='Restore' onClick={() => void mutate(() => restoreProduct(product.id), 'Product restored.')}><i className='tabler-restore' /></IconButton>}</TableCell></TableRow>)}
        {!loading && products.length === 0 && <TableRow><TableCell colSpan={10}><div className='flex flex-col items-center gap-3 py-12 text-center'><i className='tabler-package-off text-5xl text-textSecondary' /><Typography variant='h5'>No products yet</Typography><Typography color='text.secondary'>Create your first product to start building your catalog.</Typography>{can('products.create') && <Button variant='contained' onClick={() => router.push(`/${lang}/products/create`)}>Add Product</Button>}</div></TableCell></TableRow>}
      </TableBody></Table></TableContainer>{count > 10 && <CardContent className='flex justify-end'><Pagination count={Math.ceil(count / 10)} page={Number(filters.page ?? 1)} onChange={(_, page) => setFilters(current => ({ ...current, page }))} color='primary' /></CardContent>}
    </Card>
    <Dialog open={Boolean(confirmArchive)} onClose={() => !working && setConfirmArchive(null)} fullWidth maxWidth='xs'><DialogTitle>Archive product?</DialogTitle><DialogContent><Typography>{confirmArchive === 'bulk' ? `Archive ${selected.length} selected products?` : `Archive ${confirmArchive?.sku}?`} Products remain available for history and can be restored.</Typography></DialogContent><DialogActions><Button color='secondary' onClick={() => setConfirmArchive(null)}>Cancel</Button><Button variant='contained' color='error' disabled={working} onClick={() => { const operation = confirmArchive === 'bulk' ? () => bulkArchiveProducts(selected) : () => archiveProduct((confirmArchive as ProductListItem).id); setConfirmArchive(null); void mutate(operation, 'Product archived.') }}>Archive</Button></DialogActions></Dialog>
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </div>
}

export default ProductList

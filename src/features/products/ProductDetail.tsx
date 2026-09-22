'use client'

import { useEffect, useState } from 'react'

import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { getProduct } from './api'
import type { Product } from './types'

const ProductDetail = ({ productId }: { productId: number }) => {
  const router = useRouter()
  const { lang } = useParams<{ lang: string }>()
  const { data: session } = useSession()
  const [product, setProduct] = useState<Product | null>(null)
  const [preferredLanguage, setPreferredLanguage] = useState('en')
  const [error, setError] = useState('')
  const canEdit = session?.user?.accountType === 'customer' || session?.user?.permissions.includes('products.update')

  useEffect(() => {
    getProduct(productId).then(setProduct).catch(caught => setError(caught instanceof Error ? caught.message : 'Product not found.'))
  }, [productId])
  useEffect(() => {
    fetch('/api/portal/product-language-settings').then(async response => {
      if (!response.ok) return
      const data = await response.json() as { language_codes: string[] }

      if (data.language_codes[0]) setPreferredLanguage(data.language_codes[0])
    })
  }, [])

  if (error) return <Alert severity='error'>{error}</Alert>
  if (!product) return <Card><CardContent className='flex items-center justify-center gap-3 p-12'><CircularProgress size={24} /><Typography>Loading product…</Typography></CardContent></Card>
  const primary = product.images.find(image => image.is_primary) ?? product.images[0]
  const mainName = product.translations.find(item => item.language_code === preferredLanguage)?.name ?? product.translations[0]?.name ?? 'Unnamed product'
  const facts = [
    ['Brand', product.brand], ['Manufacturer', product.manufacturer], ['Company', product.company?.name],
    ['Condition', product.condition], ['Product type', product.product_type], ['MPN', product.mpn],
    ['EAN', product.ean], ['UPC', product.upc], ['ISBN', product.isbn], ['GTIN', product.gtin],
    ['Purchase price', product.purchase_price ? `${product.currency_code} ${product.purchase_price}` : ''],
    ['Sale price', product.standard_sale_price ? `${product.currency_code} ${product.standard_sale_price}` : ''],
    ['Tax rate', product.tax_rate ? `${product.tax_rate}%` : ''],
    ['Weight', product.weight ? `${product.weight} ${product.weight_unit}` : ''],
    ['Dimensions', [product.length, product.width, product.height].every(Boolean) ? `${product.length} × ${product.width} × ${product.height} ${product.dimension_unit}` : '']
  ]

  return <div className='flex flex-col gap-6'>
    <Card><CardContent className='flex flex-wrap items-center justify-between gap-5 p-7'><div className='flex items-center gap-5'><Avatar src={primary?.image_url} variant='rounded' className='is-24 bs-24'><i className='tabler-package text-4xl' /></Avatar><div><div className='mb-2 flex flex-wrap items-center gap-2'><Typography variant='h3'>{mainName}</Typography><Chip size='small' color={product.status === 'active' ? 'success' : 'secondary'} label={product.status} /></div><Typography color='text.secondary'>SKU {product.sku}</Typography></div></div><div className='flex gap-2'><Button color='secondary' variant='tonal' onClick={() => router.push(`/${lang}/products`)}>Back</Button>{canEdit && <Button variant='contained' startIcon={<i className='tabler-edit' />} onClick={() => router.push(`/${lang}/products/${product.id}/edit`)}>Edit Product</Button>}</div></CardContent></Card>
    <Grid container spacing={6}><Grid size={{ xs: 12, lg: 7 }}><Card className='bs-full'><CardContent><Typography variant='h5' className='mb-5'>Product information</Typography><Grid container spacing={4}>{facts.map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6 }}><Typography variant='caption' color='text.secondary'>{label}</Typography><Typography fontWeight={500}>{value || '—'}</Typography></Grid>)}</Grid><Divider className='my-6' /><Typography variant='caption' color='text.secondary'>Created {new Date(product.created_at).toLocaleString()} · Updated {new Date(product.updated_at).toLocaleString()}</Typography></CardContent></Card></Grid><Grid size={{ xs: 12, lg: 5 }}><Card className='bs-full'><CardContent><Typography variant='h5' className='mb-5'>Images</Typography><Grid container spacing={3}>{product.images.map(image => <Grid key={image.id} size={{ xs: 6, sm: 4, lg: 6 }}><div className='relative'><Avatar src={image.image_url} alt={image.alt_text} variant='rounded' className='is-full bs-36' />{image.is_primary && <Chip className='absolute start-2 top-2' size='small' color='primary' label='Primary' />}</div></Grid>)}{!product.images.length && <Typography color='text.secondary'>No product images uploaded.</Typography>}</Grid></CardContent></Card></Grid></Grid>
    <Card><CardContent><Typography variant='h5' className='mb-5'>Translations</Typography><Grid container spacing={5}>{product.translations.map(item => <Grid key={item.id} size={{ xs: 12, md: 6 }}><Card variant='outlined'><CardContent><div className='mb-3 flex items-center justify-between'><Typography variant='h6'>{item.name}</Typography><Chip size='small' label={item.language_code} /></div><Typography color='text.secondary' className='whitespace-pre-wrap'>{item.description || item.short_description || 'No description.'}</Typography>{item.bullet_points.length > 0 && <ul className='mb-0'>{item.bullet_points.map((bullet, index) => <li key={index}>{bullet}</li>)}</ul>}</CardContent></Card></Grid>)}</Grid></CardContent></Card>
    <Card><CardContent><Typography variant='h5' className='mb-5'>Variants</Typography><Table><TableHead><TableRow><TableCell>SKU</TableCell><TableCell>Attributes</TableCell><TableCell>EAN</TableCell><TableCell>Price</TableCell><TableCell>Status</TableCell></TableRow></TableHead><TableBody>{product.variants.map(variant => <TableRow key={variant.id}><TableCell>{variant.sku}</TableCell><TableCell>{variant.attributes.map(item => item.value).join(' / ') || '—'}</TableCell><TableCell>{variant.ean || '—'}</TableCell><TableCell>{variant.standard_sale_price ? `${product.currency_code} ${variant.standard_sale_price}` : '—'}</TableCell><TableCell><Chip size='small' color={variant.is_active ? 'success' : 'secondary'} label={variant.is_active ? 'Active' : 'Inactive'} /></TableCell></TableRow>)}{!product.variants.length && <TableRow><TableCell colSpan={5} align='center'>This product currently has no variants.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>
}

export default ProductDetail

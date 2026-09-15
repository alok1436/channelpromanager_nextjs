'use client'

import { useEffect, useMemo, useState } from 'react'

import TabContext from '@mui/lab/TabContext'
import TabPanel from '@mui/lab/TabPanel'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import FormControlLabel from '@mui/material/FormControlLabel'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

import CustomTabList from '@core/components/mui/TabList'
import CustomTextField from '@core/components/mui/TextField'

import {
  createProduct, createTranslation, createVariant, deleteProductImage, deleteTranslation, deleteVariant,
  getProduct, reorderProductImages, updateProduct, updateProductImage, updateTranslation, updateVariant,
  uploadProductImage
} from './api'
import type { Product, ProductCondition, ProductImage, ProductPayload, ProductStatus, ProductTranslation, ProductVariant } from './types'
import { canProductAction, validateProductForm } from './utils'

type Company = { id: number; name: string }
type PendingImage = { file: File; preview: string; alt_text: string; is_primary: boolean }

const blankTranslation = (language_code = 'en'): ProductTranslation => ({
  language_code, name: '', short_description: '', description: '', bullet_points: [], meta_title: '', meta_description: ''
})
const blankVariant = (): ProductVariant => ({
  sku: '', ean: '', upc: '', gtin: '', mpn: '', purchase_price: null,
  standard_sale_price: null, weight: null, is_active: true, attributes: []
})
const emptyPayload: ProductPayload = {
  company_id: null, sku: '', brand: '', manufacturer: '', mpn: '', ean: '', upc: '', isbn: '', gtin: '',
  product_type: '', condition: 'new', purchase_price: null, standard_sale_price: null, currency_code: 'EUR',
  tax_rate: null, weight: null, weight_unit: 'kg', length: null, width: null, height: null,
  dimension_unit: 'cm', status: 'draft', is_active: true, translations: [blankTranslation()], variants: []
}

const ProductForm = ({ productId }: { productId?: number }) => {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const { lang } = useParams<{ lang: string }>()
  const [tab, setTab] = useState('general')
  const [form, setForm] = useState<ProductPayload>(emptyPayload)
  const [original, setOriginal] = useState<Product | null>(null)
  const [images, setImages] = useState<ProductImage[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<number[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [activeLanguage, setActiveLanguage] = useState('en')
  const [newLanguage, setNewLanguage] = useState('')
  const [loading, setLoading] = useState(Boolean(productId))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/portal/companies?page_size=100&is_active=true').then(async response => {
      if (!response.ok) return
      const body = await response.json() as { results?: Company[] } | Company[]

      setCompanies(Array.isArray(body) ? body : body.results ?? [])
    })
  }, [])

  useEffect(() => {
    if (!productId) return
    getProduct(productId).then(product => {
      setOriginal(product)
      setImages(product.images)
      setForm({
        company_id: product.company?.id ?? null, sku: product.sku, brand: product.brand,
        manufacturer: product.manufacturer, mpn: product.mpn, ean: product.ean, upc: product.upc,
        isbn: product.isbn, gtin: product.gtin, product_type: product.product_type, condition: product.condition,
        purchase_price: product.purchase_price, standard_sale_price: product.standard_sale_price,
        currency_code: product.currency_code, tax_rate: product.tax_rate, weight: product.weight,
        weight_unit: product.weight_unit, length: product.length, width: product.width, height: product.height,
        dimension_unit: product.dimension_unit, status: product.status, is_active: product.is_active,
        translations: product.translations.length ? product.translations : [blankTranslation()], variants: product.variants
      })
      setActiveLanguage(product.translations[0]?.language_code ?? 'en')
    }).catch(caught => setError(caught instanceof Error ? caught.message : 'Unable to load product'))
      .finally(() => setLoading(false))
  }, [productId])

  const update = <Key extends keyof ProductPayload>(key: Key, value: ProductPayload[Key]) => setForm(current => ({ ...current, [key]: value }))
  const translationIndex = Math.max(0, form.translations.findIndex(item => item.language_code === activeLanguage))
  const translation = form.translations[translationIndex] ?? blankTranslation(activeLanguage)

  const updateTranslationField = <Key extends keyof ProductTranslation>(key: Key, value: ProductTranslation[Key]) => update('translations', form.translations.map((item, index) => index === translationIndex ? { ...item, [key]: value } : item))
  const updateVariantAt = (index: number, value: ProductVariant) => update('variants', form.variants.map((item, position) => position === index ? value : item))

  const addLanguage = () => {
    const normalized = newLanguage.trim().replace('_', '-')

    if (!normalized || form.translations.some(item => item.language_code.toLowerCase() === normalized.toLowerCase())) {
      setError(normalized ? 'This language already exists.' : 'Enter a language code.')
      return
    }
    update('translations', [...form.translations, blankTranslation(normalized)])
    setActiveLanguage(normalized)
    setNewLanguage('')
    setError('')
  }

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const additions = Array.from(files).map((file, index) => ({
      file, preview: URL.createObjectURL(file), alt_text: '', is_primary: images.length === 0 && pendingImages.length === 0 && index === 0
    }))

    setPendingImages(current => [...current, ...additions])
  }

  const synchronizeNested = async (id: number) => {
    if (original) {
      const remainingTranslations = new Set(form.translations.flatMap(item => item.id ? [item.id] : []))
      const remainingVariants = new Set(form.variants.flatMap(item => item.id ? [item.id] : []))

      await Promise.all(original.translations.filter(item => item.id && !remainingTranslations.has(item.id)).map(item => deleteTranslation(id, item.id!)))
      await Promise.all(original.variants.filter(item => item.id && !remainingVariants.has(item.id)).map(item => deleteVariant(id, item.id!)))
      await Promise.all(form.translations.map(item => item.id ? updateTranslation(id, item.id, item) : createTranslation(id, item)))
      await Promise.all(form.variants.map(item => item.id ? updateVariant(id, item.id, item) : createVariant(id, item)))
    }
    await Promise.all(removedImageIds.map(imageId => deleteProductImage(id, imageId)))
    const keptImages = images.filter(image => !removedImageIds.includes(image.id))

    for (const image of keptImages) await updateProductImage(id, image.id, { alt_text: image.alt_text, is_primary: image.is_primary })
    if (keptImages.length) await reorderProductImages(id, keptImages.map(image => image.id))
    for (const image of pendingImages) await uploadProductImage(id, image.file, image.alt_text, image.is_primary)
  }

  const save = async () => {
    const validationError = validateProductForm(form)

    if (validationError) {
      setError(validationError)
      return
    }
    setSaving(true)
    setError('')
    try {
      let product: Product

      if (productId) {
        const { translations, variants, ...general } = form

        product = await updateProduct(productId, general)
        await synchronizeNested(productId)
      } else {
        product = await createProduct(form)
        await synchronizeNested(product.id)
      }
      router.push(`/${lang}/products/${product.id}`)
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save product')
    } finally {
      setSaving(false)
    }
  }

  const setPrimary = (kind: 'existing' | 'pending', index: number) => {
    setImages(current => current.map((image, position) => ({ ...image, is_primary: kind === 'existing' && position === index })))
    setPendingImages(current => current.map((image, position) => ({ ...image, is_primary: kind === 'pending' && position === index })))
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    const destination = index + direction

    if (destination < 0 || destination >= images.length) return
    setImages(current => {
      const next = [...current]
      ;[next[index], next[destination]] = [next[destination], next[index]]
      return next
    })
  }

  const title = productId ? 'Edit Product' : 'Add Product'
  const subtitle = productId ? 'Update product catalog information and related content.' : 'Create a complete, multilingual catalog product.'

  if (loading) return <Card><CardContent className='flex items-center justify-center gap-3 p-12'><CircularProgress size={24} /><Typography>Loading product…</Typography></CardContent></Card>
  if (sessionStatus !== 'loading' && !canProductAction(session?.user?.accountType, session?.user?.permissions, productId ? 'products.update' : 'products.create')) return <Alert severity='error'>You do not have permission to {productId ? 'edit' : 'create'} products.</Alert>

  return <div className='flex flex-col gap-6'>
    <Card><CardContent className='flex flex-wrap items-center justify-between gap-5 p-7'><div><Typography variant='h3'>{title}</Typography><Typography color='text.secondary'>{subtitle}</Typography></div><div className='flex gap-3'><Button color='secondary' variant='tonal' onClick={() => router.back()}>Cancel</Button><Button variant='contained' startIcon={<i className='tabler-device-floppy' />} disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Product'}</Button></div></CardContent></Card>
    {error && <Alert severity='error'>{error}</Alert>}
    <TabContext value={tab}><Card><CardContent className='pb-0'><CustomTabList onChange={(_, value: string) => setTab(value)} variant='scrollable' pill='true'><Tab value='general' label='General' icon={<i className='tabler-info-circle' />} iconPosition='start' /><Tab value='descriptions' label='Descriptions' icon={<i className='tabler-language' />} iconPosition='start' /><Tab value='images' label={`Images (${images.length + pendingImages.length - removedImageIds.length})`} icon={<i className='tabler-photo' />} iconPosition='start' /><Tab value='variants' label={`Variants (${form.variants.length})`} icon={<i className='tabler-box-multiple' />} iconPosition='start' /></CustomTabList></CardContent></Card>
      <TabPanel value='general' className='p-0'><div className='flex flex-col gap-6'>
        <Card><CardContent><Typography variant='h5' className='mb-5'>Core information</Typography><Grid container spacing={5}><Grid size={{ xs: 12, md: 6 }}><CustomTextField select fullWidth label='Company' value={form.company_id ?? ''} onChange={event => update('company_id', Number(event.target.value) || null)}><MenuItem value=''>No company</MenuItem>{companies.map(company => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}</CustomTextField></Grid><Grid size={{ xs: 12, md: 6 }}><CustomTextField required fullWidth label='SKU' value={form.sku} onChange={event => update('sku', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth label='Brand' value={form.brand} onChange={event => update('brand', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth label='Manufacturer' value={form.manufacturer} onChange={event => update('manufacturer', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth label='Product type' value={form.product_type} onChange={event => update('product_type', event.target.value)} /></Grid><Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth label='Condition' value={form.condition} onChange={event => update('condition', event.target.value as ProductCondition)}>{(['new', 'used', 'refurbished'] as ProductCondition[]).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</CustomTextField></Grid><Grid size={{ xs: 12, sm: 6 }}><CustomTextField select fullWidth label='Status' value={form.status} onChange={event => update('status', event.target.value as ProductStatus)}>{(['draft', 'active', 'inactive', 'discontinued', 'archived'] as ProductStatus[]).map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</CustomTextField></Grid><Grid size={{ xs: 12 }}><FormControlLabel control={<Checkbox checked={form.is_active} onChange={event => update('is_active', event.target.checked)} />} label='Product is active' /></Grid></Grid></CardContent></Card>
        <Card><CardContent><Typography variant='h5' className='mb-5'>Identifiers</Typography><Grid container spacing={5}>{(['mpn', 'ean', 'upc', 'isbn', 'gtin'] as const).map(key => <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}><CustomTextField fullWidth label={key.toUpperCase()} value={form[key]} onChange={event => update(key, event.target.value)} /></Grid>)}</Grid></CardContent></Card>
        <Card><CardContent><Typography variant='h5' className='mb-5'>Pricing and tax</Typography><Grid container spacing={5}><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField type='number' fullWidth label='Purchase price' value={form.purchase_price ?? ''} onChange={event => update('purchase_price', event.target.value || null)} /></Grid><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField type='number' fullWidth label='Sale price' value={form.standard_sale_price ?? ''} onChange={event => update('standard_sale_price', event.target.value || null)} /></Grid><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField fullWidth label='Currency' value={form.currency_code} onChange={event => update('currency_code', event.target.value.toUpperCase().slice(0, 3))} /></Grid><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField type='number' fullWidth label='Tax rate %' value={form.tax_rate ?? ''} onChange={event => update('tax_rate', event.target.value || null)} /></Grid></Grid></CardContent></Card>
        <Card><CardContent><Typography variant='h5' className='mb-5'>Weight and dimensions</Typography><Grid container spacing={5}><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField type='number' fullWidth label='Weight' value={form.weight ?? ''} onChange={event => update('weight', event.target.value || null)} /></Grid><Grid size={{ xs: 12, sm: 6, md: 3 }}><CustomTextField fullWidth label='Weight unit' value={form.weight_unit} onChange={event => update('weight_unit', event.target.value)} /></Grid>{(['length', 'width', 'height'] as const).map(key => <Grid key={key} size={{ xs: 12, sm: 6, md: 2 }}><CustomTextField type='number' fullWidth label={key} value={form[key] ?? ''} onChange={event => update(key, event.target.value || null)} /></Grid>)}<Grid size={{ xs: 12, sm: 6, md: 2 }}><CustomTextField fullWidth label='Dimension unit' value={form.dimension_unit} onChange={event => update('dimension_unit', event.target.value)} /></Grid></Grid></CardContent></Card>
      </div></TabPanel>
      <TabPanel value='descriptions' className='p-0'><Card><CardContent className='flex flex-col gap-5'><div className='flex flex-wrap items-center justify-between gap-3'><div><Typography variant='h5'>Multilingual content</Typography><Typography color='text.secondary'>Add independent catalog content for every language.</Typography></div><div className='flex gap-2'><CustomTextField size='small' label='Language code' placeholder='fr-FR' value={newLanguage} onChange={event => setNewLanguage(event.target.value)} /><Button variant='tonal' startIcon={<i className='tabler-plus' />} onClick={addLanguage}>Add language</Button></div></div><div className='flex flex-wrap gap-2'>{form.translations.map(item => <Chip key={item.language_code} clickable color={activeLanguage === item.language_code ? 'primary' : 'default'} label={item.language_code} onClick={() => setActiveLanguage(item.language_code)} onDelete={form.translations.length > 1 ? () => { const next = form.translations.filter(value => value !== item); update('translations', next); setActiveLanguage(next[0].language_code) } : undefined} />)}</div><Divider /><Grid container spacing={5}><Grid size={{ xs: 12, md: 8 }}><CustomTextField required fullWidth label='Product name' value={translation.name} onChange={event => updateTranslationField('name', event.target.value)} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth label='Meta title' value={translation.meta_title} onChange={event => updateTranslationField('meta_title', event.target.value)} /></Grid><Grid size={{ xs: 12 }}><CustomTextField fullWidth multiline minRows={2} label='Short description' value={translation.short_description} onChange={event => updateTranslationField('short_description', event.target.value)} /></Grid><Grid size={{ xs: 12 }}><CustomTextField fullWidth multiline minRows={6} label='Description' value={translation.description} onChange={event => updateTranslationField('description', event.target.value)} /></Grid><Grid size={{ xs: 12 }}><CustomTextField fullWidth multiline minRows={2} label='Meta description' value={translation.meta_description} onChange={event => updateTranslationField('meta_description', event.target.value)} /></Grid></Grid><div><div className='mb-3 flex items-center justify-between'><Typography variant='h6'>Bullet points</Typography><Button size='small' startIcon={<i className='tabler-plus' />} onClick={() => updateTranslationField('bullet_points', [...translation.bullet_points, ''])}>Add bullet</Button></div><div className='flex flex-col gap-3'>{translation.bullet_points.map((bullet, index) => <div key={index} className='flex items-center gap-2'><Typography color='text.secondary'>{index + 1}.</Typography><CustomTextField fullWidth value={bullet} placeholder='Product benefit' onChange={event => updateTranslationField('bullet_points', translation.bullet_points.map((item, position) => position === index ? event.target.value : item))} /><IconButton disabled={index === 0} onClick={() => { const next = [...translation.bullet_points]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; updateTranslationField('bullet_points', next) }}><i className='tabler-arrow-up' /></IconButton><IconButton disabled={index === translation.bullet_points.length - 1} onClick={() => { const next = [...translation.bullet_points]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; updateTranslationField('bullet_points', next) }}><i className='tabler-arrow-down' /></IconButton><IconButton color='error' onClick={() => updateTranslationField('bullet_points', translation.bullet_points.filter((_, position) => position !== index))}><i className='tabler-trash' /></IconButton></div>)}</div></div></CardContent></Card></TabPanel>
      <TabPanel value='images' className='p-0'><Card><CardContent className='flex flex-col gap-5'><div className='flex flex-wrap items-center justify-between gap-3'><div><Typography variant='h5'>Product images</Typography><Typography color='text.secondary'>Upload, reorder, describe, and select one primary image.</Typography></div><Button component='label' variant='contained' startIcon={<i className='tabler-upload' />}>Upload images<input hidden multiple accept='image/jpeg,image/png,image/webp,image/gif' type='file' onChange={event => addFiles(event.target.files)} /></Button></div><Grid container spacing={5}>{images.map((image, index) => !removedImageIds.includes(image.id) && <Grid key={image.id} size={{ xs: 12, sm: 6, md: 4 }}><Card variant='outlined'><CardContent className='flex flex-col gap-3'><div className='relative'><Avatar src={image.image_url} variant='rounded' className='is-full bs-48' />{image.is_primary && <Chip className='absolute start-2 top-2' size='small' color='primary' label='Primary' />}</div><CustomTextField fullWidth label='Alt text' value={image.alt_text} onChange={event => setImages(current => current.map(item => item.id === image.id ? { ...item, alt_text: event.target.value } : item))} /><div className='flex justify-between'><div><IconButton disabled={index === 0} onClick={() => moveImage(index, -1)}><i className='tabler-arrow-left' /></IconButton><IconButton disabled={index === images.length - 1} onClick={() => moveImage(index, 1)}><i className='tabler-arrow-right' /></IconButton></div><div><Button size='small' onClick={() => setPrimary('existing', index)}>Set primary</Button><IconButton color='error' onClick={() => setRemovedImageIds(current => [...current, image.id])}><i className='tabler-trash' /></IconButton></div></div></CardContent></Card></Grid>)}{pendingImages.map((image, index) => <Grid key={image.preview} size={{ xs: 12, sm: 6, md: 4 }}><Card variant='outlined'><CardContent className='flex flex-col gap-3'><div className='relative'><Avatar src={image.preview} variant='rounded' className='is-full bs-48' />{image.is_primary && <Chip className='absolute start-2 top-2' size='small' color='primary' label='Primary' />}</div><CustomTextField fullWidth label='Alt text' value={image.alt_text} onChange={event => setPendingImages(current => current.map((item, position) => position === index ? { ...item, alt_text: event.target.value } : item))} /><div className='flex justify-end'><Button size='small' onClick={() => setPrimary('pending', index)}>Set primary</Button><IconButton color='error' onClick={() => setPendingImages(current => current.filter((_, position) => position !== index))}><i className='tabler-trash' /></IconButton></div></CardContent></Card></Grid>)}{images.length + pendingImages.length - removedImageIds.length === 0 && <Grid size={{ xs: 12 }}><div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-divider py-12'><i className='tabler-photo-off text-5xl text-textSecondary' /><Typography variant='h6'>No product images uploaded</Typography></div></Grid>}</Grid></CardContent></Card></TabPanel>
      <TabPanel value='variants' className='p-0'><Card><CardContent className='flex flex-col gap-5'><div className='flex items-center justify-between'><div><Typography variant='h5'>Product variants</Typography><Typography color='text.secondary'>Create flexible SKU combinations and their attributes.</Typography></div><Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => update('variants', [...form.variants, blankVariant()])}>Add variant</Button></div>{form.variants.length === 0 && <div className='flex flex-col items-center gap-3 rounded-xl border border-dashed border-divider py-12'><i className='tabler-box-off text-5xl text-textSecondary' /><Typography variant='h6'>This product currently has no variants.</Typography></div>}{form.variants.map((variant, index) => <Card key={variant.id ?? `new-${index}`} variant='outlined'><CardContent className='flex flex-col gap-4'><div className='flex items-center justify-between'><Typography variant='h6'>Variant {index + 1}</Typography><IconButton color='error' onClick={() => update('variants', form.variants.filter((_, position) => position !== index))}><i className='tabler-trash' /></IconButton></div><Grid container spacing={4}><Grid size={{ xs: 12, md: 4 }}><CustomTextField required fullWidth label='Variant SKU' value={variant.sku} onChange={event => updateVariantAt(index, { ...variant, sku: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth label='EAN' value={variant.ean} onChange={event => updateVariantAt(index, { ...variant, ean: event.target.value })} /></Grid><Grid size={{ xs: 12, md: 4 }}><CustomTextField fullWidth type='number' label='Sale price' value={variant.standard_sale_price ?? ''} onChange={event => updateVariantAt(index, { ...variant, standard_sale_price: event.target.value || null })} /></Grid></Grid><FormControlLabel control={<Checkbox checked={variant.is_active} onChange={event => updateVariantAt(index, { ...variant, is_active: event.target.checked })} />} label='Variant is active' /><Divider /><div className='flex items-center justify-between'><Typography fontWeight={600}>Attributes</Typography><Button size='small' onClick={() => updateVariantAt(index, { ...variant, attributes: [...variant.attributes, { name: '', value: '' }] })}>Add attribute</Button></div>{variant.attributes.map((attribute, attributeIndex) => <Grid container spacing={3} key={attribute.id ?? attributeIndex} alignItems='center'><Grid size={{ xs: 5 }}><CustomTextField fullWidth label='Name' placeholder='Color' value={attribute.name} onChange={event => updateVariantAt(index, { ...variant, attributes: variant.attributes.map((item, position) => position === attributeIndex ? { ...item, name: event.target.value } : item) })} /></Grid><Grid size={{ xs: 5 }}><CustomTextField fullWidth label='Value' placeholder='Black' value={attribute.value} onChange={event => updateVariantAt(index, { ...variant, attributes: variant.attributes.map((item, position) => position === attributeIndex ? { ...item, value: event.target.value } : item) })} /></Grid><Grid size={{ xs: 2 }}><IconButton color='error' onClick={() => updateVariantAt(index, { ...variant, attributes: variant.attributes.filter((_, position) => position !== attributeIndex) })}><i className='tabler-trash' /></IconButton></Grid></Grid>)}</CardContent></Card>)}</CardContent></Card></TabPanel>
    </TabContext>
    <Card className='sticky bottom-4 z-10'><CardContent className='flex justify-end gap-3 py-4'><Button color='secondary' variant='tonal' onClick={() => router.back()}>Cancel</Button><Button variant='contained' disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save Product'}</Button></CardContent></Card>
  </div>
}

export default ProductForm

import type { ProductFilters, ProductPayload } from './types'

export const buildProductQuery = (filters: ProductFilters) => {
  const query = new URLSearchParams()

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== '' && value !== undefined) query.set(key, String(value))
  })

  return query
}

export const canProductAction = (accountType: string | undefined, permissions: string[] | undefined, code: string) =>
  accountType === 'customer' || Boolean(permissions?.includes(code))

export const validateProductForm = (form: ProductPayload) => {
  if (!form.sku.trim()) return 'SKU is required.'
  if (!form.translations.length || form.translations.some(item => !item.language_code.trim() || !item.name.trim())) return 'Every translation requires a language code and product name.'
  if (form.variants.some(item => !item.sku.trim())) return 'Every variant requires a SKU.'
  if ([form.purchase_price, form.standard_sale_price, form.tax_rate, form.weight, form.length, form.width, form.height].some(value => value !== null && Number(value) < 0)) return 'Prices, tax, weight, and dimensions cannot be negative.'

  return ''
}

export const parseProductCsv = (source: string) => {
  const firstLine = source.split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]

    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else quoted = !quoted
    } else if (character === delimiter && !quoted) {
      row.push(field.trim())
      field = ''
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && source[index + 1] === '\n') index += 1
      row.push(field.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else field += character
  }
  row.push(field.trim())
  if (row.some(Boolean)) rows.push(row)

  const headers = (rows.shift() ?? []).map(value => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())

  return rows.map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

const csvValue = (row: Record<string, string>, ...keys: string[]) => keys.map(key => row[key]).find(Boolean) ?? ''
const nullableNumber = (value: string) => value.trim() === '' ? null : value.trim()

export const wooCommerceRowToProduct = (row: Record<string, string>, companyId: number | null): ProductPayload => ({
  company_id: companyId,
  sku: csvValue(row, 'sku').trim(),
  brand: csvValue(row, 'brands', 'brand'),
  manufacturer: '',
  mpn: csvValue(row, 'mpn'),
  ean: csvValue(row, 'gtin ean upc isbn', 'ean'),
  upc: csvValue(row, 'upc'),
  isbn: csvValue(row, 'isbn'),
  gtin: csvValue(row, 'gtin'),
  product_type: csvValue(row, 'type', 'categories'),
  condition: 'new',
  purchase_price: null,
  standard_sale_price: nullableNumber(csvValue(row, 'sale price', 'regular price')),
  currency_code: 'EUR',
  tax_rate: null,
  weight: nullableNumber(csvValue(row, 'weight kg', 'weight')),
  weight_unit: 'kg',
  length: nullableNumber(csvValue(row, 'length cm', 'length')),
  width: nullableNumber(csvValue(row, 'width cm', 'width')),
  height: nullableNumber(csvValue(row, 'height cm', 'height')),
  dimension_unit: 'cm',
  status: csvValue(row, 'published').toLowerCase() === '1' ? 'active' : 'draft',
  is_active: true,
  translations: [{
    language_code: 'en',
    name: csvValue(row, 'name').trim(),
    short_description: csvValue(row, 'short description'),
    description: csvValue(row, 'description'),
    bullet_points: [],
    meta_title: '',
    meta_description: ''
  }],
  variants: []
})

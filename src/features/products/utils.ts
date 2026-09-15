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

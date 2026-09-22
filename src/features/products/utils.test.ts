import assert from 'node:assert/strict'
import test from 'node:test'

import type { ProductPayload } from './types'
import { buildProductQuery, canProductAction, parseProductCsv, validateProductForm, wooCommerceRowToProduct } from './utils'

const validProduct = (): ProductPayload => ({
  company_id: null, sku: 'SKU-1', brand: '', manufacturer: '', mpn: '', ean: '', upc: '', isbn: '', gtin: '',
  product_type: '', condition: 'new', purchase_price: null, standard_sale_price: '10.00', currency_code: 'EUR',
  tax_rate: null, weight: null, weight_unit: 'kg', length: null, width: null, height: null, dimension_unit: 'cm',
  status: 'draft', is_active: true, translations: [{ language_code: 'en', name: 'Product', short_description: '', description: '', bullet_points: [], meta_title: '', meta_description: '' }], variants: []
})

test('product query includes server filters and omits empty values', () => {
  assert.equal(buildProductQuery({ search: 'shoe', page: 2, status: 'active', brand: '' }).toString(), 'search=shoe&page=2&status=active')
})

test('owner has product actions and staff requires explicit permission', () => {
  assert.equal(canProductAction('customer', [], 'products.create'), true)
  assert.equal(canProductAction('staff', ['products.view'], 'products.update'), false)
  assert.equal(canProductAction('staff', ['products.update'], 'products.update'), true)
})

test('product form validation covers SKU, translation, variants, and negative values', () => {
  assert.equal(validateProductForm(validProduct()), '')
  assert.equal(validateProductForm({ ...validProduct(), sku: '' }), 'SKU is required.')
  assert.match(validateProductForm({ ...validProduct(), translations: [] }), /translation/)
  assert.match(validateProductForm({ ...validProduct(), standard_sale_price: '-1' }), /cannot be negative/)
})

test('WooCommerce CSV supports quoted values and maps required product fields', () => {
  const rows = parseProductCsv('SKU,Name,Description,Regular price,Published\nABC-1,"Blue, Large","A useful product",19.90,1')
  const product = wooCommerceRowToProduct(rows[0], 7)

  assert.equal(rows.length, 1)
  assert.equal(product.sku, 'ABC-1')
  assert.equal(product.translations[0].name, 'Blue, Large')
  assert.equal(product.standard_sale_price, '19.90')
  assert.equal(product.company_id, 7)
  assert.equal(product.status, 'active')
})

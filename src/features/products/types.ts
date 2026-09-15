export type ProductStatus = 'draft' | 'active' | 'inactive' | 'discontinued' | 'archived'
export type ProductCondition = 'new' | 'used' | 'refurbished'
export type CompanySummary = { id: number; name: string }

export type ProductTranslation = {
  id?: number
  language_code: string
  name: string
  short_description: string
  description: string
  bullet_points: string[]
  meta_title: string
  meta_description: string
  created_at?: string
  updated_at?: string
}

export type ProductImage = {
  id: number
  image_url: string
  alt_text: string
  position: number
  is_primary: boolean
  created_at: string
  updated_at: string
}

export type ProductVariantAttribute = { id?: number; name: string; value: string; position?: number }
export type ProductVariant = {
  id?: number
  sku: string
  ean: string
  upc: string
  gtin: string
  mpn: string
  purchase_price: string | null
  standard_sale_price: string | null
  weight: string | null
  is_active: boolean
  attributes: ProductVariantAttribute[]
  created_at?: string
  updated_at?: string
}

export type ProductListItem = {
  id: number
  sku: string
  name: string
  brand: string
  company: CompanySummary | null
  ean: string
  standard_sale_price: string | null
  currency_code: string
  status: ProductStatus
  is_active: boolean
  primary_image: string | null
  variant_count: number
  created_at: string
  updated_at: string
}

export type Product = {
  id: number
  company: CompanySummary | null
  sku: string
  brand: string
  manufacturer: string
  mpn: string
  ean: string
  upc: string
  isbn: string
  gtin: string
  product_type: string
  condition: ProductCondition
  purchase_price: string | null
  standard_sale_price: string | null
  currency_code: string
  tax_rate: string | null
  weight: string | null
  weight_unit: string
  length: string | null
  width: string | null
  height: string | null
  dimension_unit: string
  status: ProductStatus
  is_active: boolean
  translations: ProductTranslation[]
  images: ProductImage[]
  variants: ProductVariant[]
  created_at: string
  updated_at: string
}

export type ProductPayload = Omit<Product, 'id' | 'company' | 'images' | 'created_at' | 'updated_at'> & {
  company_id: number | null
}

export type ProductFilters = {
  page?: number
  page_size?: number
  search?: string
  company_id?: number | ''
  status?: ProductStatus | ''
  condition?: ProductCondition | ''
  brand?: string
  product_type?: string
  is_active?: boolean | ''
  language?: string
  ordering?: string
}

export type PaginatedProductResponse = { count: number; next: string | null; previous: string | null; results: ProductListItem[] }

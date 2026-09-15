import type { PaginatedProductResponse, Product, ProductFilters, ProductImage, ProductPayload, ProductTranslation, ProductVariant } from './types'
import { buildProductQuery } from './utils'

export class ProductApiError extends Error {
  status: number
  errors: Record<string, unknown>

  constructor(message: string, status: number, errors: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.errors = errors
  }
}

const parseError = async (response: Response) => {
  const body = await response.json().catch(() => null)
  const errors = (body?.errors ?? body ?? {}) as Record<string, unknown>
  const message = body?.message || body?.detail || Object.entries(errors)
    .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ') || `Request failed (${response.status})`

  return new ProductApiError(String(message), response.status, errors)
}

const request = async <Result>(path: string, init?: RequestInit): Promise<Result> => {
  const response = await fetch(`/api/portal/products${path}`, { cache: 'no-store', ...init })

  if (!response.ok) throw await parseError(response)
  if (response.status === 204) return undefined as Result

  return response.json() as Promise<Result>
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
})

export const getProducts = (filters: ProductFilters = {}) => {
  const query = buildProductQuery(filters)

  return request<PaginatedProductResponse>(`?${query}`)
}
export const getProduct = (id: number) => request<Product>(`/${id}`)
export const createProduct = (payload: ProductPayload) => request<Product>('', json('POST', payload))
export const updateProduct = (id: number, payload: Partial<ProductPayload>) => request<Product>(`/${id}`, json('PATCH', payload))
export const archiveProduct = (id: number) => request<Product>(`/${id}/archive`, json('POST'))
export const restoreProduct = (id: number) => request<Product>(`/${id}/restore`, json('POST'))
export const duplicateProduct = (id: number) => request<Product>(`/${id}/duplicate`, json('POST'))
export const createTranslation = (id: number, payload: ProductTranslation) => request<ProductTranslation>(`/${id}/translations`, json('POST', payload))
export const updateTranslation = (id: number, translationId: number, payload: ProductTranslation) => request<ProductTranslation>(`/${id}/translations/${translationId}`, json('PATCH', payload))
export const deleteTranslation = (id: number, translationId: number) => request<void>(`/${id}/translations/${translationId}`, json('DELETE'))
export const createVariant = (id: number, payload: ProductVariant) => request<ProductVariant>(`/${id}/variants`, json('POST', payload))
export const updateVariant = (id: number, variantId: number, payload: ProductVariant) => request<ProductVariant>(`/${id}/variants/${variantId}`, json('PATCH', payload))
export const deleteVariant = (id: number, variantId: number) => request<void>(`/${id}/variants/${variantId}`, json('DELETE'))
export const uploadProductImage = (id: number, file: File, altText = '', isPrimary = false) => {
  const body = new FormData()

  body.set('image', file)
  body.set('alt_text', altText)
  body.set('is_primary', String(isPrimary))
  return request<ProductImage>(`/${id}/images`, { method: 'POST', body })
}
export const updateProductImage = (id: number, imageId: number, payload: Pick<ProductImage, 'alt_text' | 'is_primary'>) => request<ProductImage>(`/${id}/images/${imageId}`, json('PATCH', payload))
export const deleteProductImage = (id: number, imageId: number) => request<void>(`/${id}/images/${imageId}`, json('DELETE'))
export const reorderProductImages = (id: number, imageIds: number[]) => request<ProductImage[]>(`/${id}/images/reorder`, json('PUT', { image_ids: imageIds }))
export const bulkProductStatus = (productIds: number[], status: string) => request<{ updated: number }>('/bulk/status', json('POST', { product_ids: productIds, status }))
export const bulkArchiveProducts = (productIds: number[]) => request<{ updated: number }>('/bulk/archive', json('POST', { product_ids: productIds }))

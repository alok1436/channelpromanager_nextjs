import ProductDetail from '@/features/products/ProductDetail'

const ProductPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  return <ProductDetail productId={Number(id)} />
}

export default ProductPage

import ProductForm from '@/features/products/ProductForm'

const EditProductPage = async ({ params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params

  return <ProductForm productId={Number(id)} />
}

export default EditProductPage

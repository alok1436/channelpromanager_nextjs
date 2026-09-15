import { redirect } from 'next/navigation'

const SuperAdminPage = async ({ params }: { params: Promise<{ lang: string }> }) => {
  const { lang } = await params

  redirect(`/${lang}/super-admin/dashboard`)
}

export default SuperAdminPage

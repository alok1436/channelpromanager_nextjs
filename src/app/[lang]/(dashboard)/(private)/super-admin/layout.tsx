import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'

import type { ChildrenType } from '@core/types'
import { authOptions } from '@/libs/auth'

const SuperAdminLayout = async ({ children, params }: ChildrenType & { params: Promise<{ lang: string }> }) => {
  const session = await getServerSession(authOptions)
  const { lang } = await params

  if (session?.user?.accountType !== 'superuser') redirect(`/${lang}/pages/misc/401-not-authorized`)

  return children
}

export default SuperAdminLayout

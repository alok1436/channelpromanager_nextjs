import { notFound } from 'next/navigation'

import SuperAdminCrud from '@/views/super-admin/SuperAdminCrud'
import type { AdminResource } from '@/views/super-admin/resourceConfig'
import { resourceConfigs } from '@/views/super-admin/resourceConfig'

const ResourcePage = async ({ params }: { params: Promise<{ resource: string }> }) => {
  const { resource } = await params

  if (!(resource in resourceConfigs)) notFound()

  return <SuperAdminCrud resource={resource as AdminResource} />
}

export default ResourcePage

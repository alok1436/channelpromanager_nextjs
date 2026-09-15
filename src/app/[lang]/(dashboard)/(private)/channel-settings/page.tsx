import { redirect } from 'next/navigation'

const ChannelSettingsPage = async ({ params }: { params: Promise<{ lang: string }> }) => {
  const { lang } = await params

  redirect(`/${lang}/settings`)
}

export default ChannelSettingsPage

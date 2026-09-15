// Next Imports
import { redirect } from 'next/navigation'

// Third-party Imports
import { getServerSession } from 'next-auth'

// Type Imports
import type { ChildrenType } from '@core/types'
import type { Locale } from '@configs/i18n'

// Config Imports
import themeConfig from '@configs/themeConfig'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'
import { authOptions } from '@/libs/auth'

const GuestOnlyRoute = async ({ children, lang }: ChildrenType & { lang: Locale }) => {
  const session = await getServerSession(authOptions)

  if (session) {
    const destination = session.user?.accountType === 'superuser' ? '/super-admin/dashboard' : themeConfig.homePageUrl

    redirect(getLocalizedUrl(destination, lang))
  }

  return <>{children}</>
}

export default GuestOnlyRoute

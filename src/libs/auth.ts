import CredentialsProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'

type TokenPair = { access: string; refresh: string }
type DjangoUser = {
  id: number
  email: string
  first_name: string
  last_name: string
  is_superuser: boolean
  customer: { id: number; company_name: string; email: string } | null
  membership: {
    id: number
    is_owner: boolean
    has_full_access: boolean
    role: { id: number; name: string } | null
  } | null
  roles: Array<{ id: number; name: string }>
  permissions: string[]
}

const apiUrl = () => process.env.DJANGO_API_URL ?? 'http://localhost:8000/api/v1'

const parseAccessExpiry = (accessToken: string) => {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString()) as { exp?: number }

    return payload.exp ? payload.exp * 1000 : Date.now() + 5 * 60 * 1000
  } catch {
    return Date.now() + 5 * 60 * 1000
  }
}

const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    const response = await fetch(`${apiUrl()}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: token.refreshToken }),
      cache: 'no-store'
    })

    if (!response.ok) throw new Error('Unable to refresh the Django access token')

    const tokens = (await response.json()) as Partial<TokenPair>
    const accessToken = tokens.access as string

    return {
      ...token,
      accessToken,
      refreshToken: tokens.refresh ?? token.refreshToken,
      accessTokenExpires: parseAccessExpiry(accessToken),
      authError: undefined
    }
  } catch {
    return { ...token, authError: 'RefreshAccessTokenError' }
  }
}

const hydrateIdentity = async (token: JWT): Promise<JWT> => {
  try {
    const response = await fetch(`${apiUrl()}/auth/me/`, {
      headers: { Authorization: `Bearer ${token.accessToken}` },
      cache: 'no-store'
    })

    if (!response.ok) return token

    const profile = await response.json() as DjangoUser

    return {
      ...token,
      userId: profile.id,
      name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
      email: profile.email,
      isSuperuser: profile.is_superuser,
      accountType: profile.is_superuser ? 'superuser' : profile.membership?.is_owner ? 'customer' : 'staff',
      customer: profile.customer,
      membership: profile.membership,
      roles: profile.roles,
      permissions: profile.permissions
    }
  } catch {
    return token
  }
}

const readError = async (response: Response) => {
  const body = await response.json().catch(() => null)

  if (body?.detail) return body.detail as string
  if (body && typeof body === 'object') return Object.values(body).flat().join(' ')

  return 'Unable to sign in with those credentials.'
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {},
      async authorize(credentials) {
        const { email, password } = credentials as { email?: string; password?: string }
        const loginResponse = await fetch(`${apiUrl()}/auth/login/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          cache: 'no-store'
        })

        if (!loginResponse.ok) throw new Error(JSON.stringify({ message: [await readError(loginResponse)] }))

        const tokens = (await loginResponse.json()) as TokenPair
        const meResponse = await fetch(`${apiUrl()}/auth/me/`, {
          headers: { Authorization: `Bearer ${tokens.access}` },
          cache: 'no-store'
        })

        if (!meResponse.ok) throw new Error(JSON.stringify({ message: [await readError(meResponse)] }))

        const profile = (await meResponse.json()) as DjangoUser
        const accountType = profile.is_superuser ? 'superuser' : profile.membership?.is_owner ? 'customer' : 'staff'

        return {
          id: String(profile.id),
          email: profile.email,
          name: `${profile.first_name} ${profile.last_name}`.trim() || profile.email,
          accessToken: tokens.access,
          refreshToken: tokens.refresh,
          accessTokenExpires: parseAccessExpiry(tokens.access),
          isSuperuser: profile.is_superuser,
          accountType,
          customer: profile.customer,
          membership: profile.membership,
          roles: profile.roles,
          permissions: profile.permissions
        } satisfies User
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = Number(user.id)
        token.accessToken = user.accessToken
        token.refreshToken = user.refreshToken
        token.accessTokenExpires = user.accessTokenExpires
        token.isSuperuser = user.isSuperuser
        token.accountType = user.accountType
        token.customer = user.customer
        token.membership = user.membership
        token.roles = user.roles
        token.permissions = user.permissions

        return token
      }

      if (!token.accountType && token.accessToken) token = await hydrateIdentity(token)

      if (Date.now() < token.accessTokenExpires - 30_000) return token

      return refreshAccessToken(token)
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId
        session.user.isSuperuser = token.isSuperuser
        session.user.accountType = token.accountType
        session.user.customer = token.customer
        session.user.membership = token.membership
        session.user.roles = token.roles
        session.user.permissions = token.permissions
      }

      session.authError = token.authError

      return session
    }
  }
}

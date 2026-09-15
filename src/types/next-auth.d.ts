import type { DefaultSession } from 'next-auth'

type AccountType = 'superuser' | 'customer' | 'staff'
type CustomerIdentity = { id: number; company_name: string; email: string } | null
type MembershipIdentity = {
  id: number
  is_owner: boolean
  has_full_access: boolean
  role: { id: number; name: string } | null
} | null

declare module 'next-auth' {
  interface User {
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    isSuperuser: boolean
    accountType: AccountType
    customer: CustomerIdentity
    membership: MembershipIdentity
    roles: Array<{ id: number; name: string }>
    permissions: string[]
  }

  interface Session {
    user: DefaultSession['user'] & {
      id: number
      isSuperuser: boolean
      accountType: AccountType
      customer: CustomerIdentity
      membership: MembershipIdentity
      roles: Array<{ id: number; name: string }>
      permissions: string[]
    }
    authError?: 'RefreshAccessTokenError'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: number
    accessToken: string
    refreshToken: string
    accessTokenExpires: number
    isSuperuser: boolean
    accountType: AccountType
    customer: CustomerIdentity
    membership: MembershipIdentity
    roles: Array<{ id: number; name: string }>
    permissions: string[]
    authError?: 'RefreshAccessTokenError'
  }
}

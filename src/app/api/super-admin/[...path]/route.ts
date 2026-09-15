import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

import { authOptions } from '@/libs/auth'

const allowedResources = new Set(['customers', 'modules', 'permissions', 'roles', 'platforms', 'marketplaces'])

const proxy = async (request: Request, context: { params: Promise<{ path: string[] }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.user?.isSuperuser) return NextResponse.json({ detail: 'Forbidden' }, { status: 403 })

  const { path } = await context.params
  const [resource, id] = path

  if (!resource || !allowedResources.has(resource) || path.length > 2 || (id && !/^\d+$/.test(id))) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  const token = await getToken({ req: request as never, secret: process.env.NEXTAUTH_SECRET })

  if (!token?.accessToken) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const sourceUrl = new URL(request.url)
  const endpoint = `${process.env.DJANGO_API_URL ?? 'http://localhost:8000/api/v1'}/${resource}/${id ? `${id}/` : ''}${sourceUrl.search}`
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text()
  const fetchBackend = (accessToken: string) => fetch(endpoint, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' } : {})
    },
    body,
    cache: 'no-store'
  })
  let response = await fetchBackend(String(token.accessToken))

  if (response.status === 401 && token.refreshToken) {
    const refreshResponse = await fetch(
      `${process.env.DJANGO_API_URL ?? 'http://localhost:8000/api/v1'}/auth/token/refresh/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: token.refreshToken }),
        cache: 'no-store'
      }
    )

    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json() as { access: string }

      response = await fetchBackend(refreshed.access)
    }
  }

  if (response.status === 204) return new NextResponse(null, { status: 204 })

  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' }
  })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const DELETE = proxy

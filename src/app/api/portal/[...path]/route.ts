import { getServerSession } from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { NextResponse } from 'next/server'

import { authOptions } from '@/libs/auth'

const simpleResources = new Set(['companies', 'warehouses', 'orders'])

const isAllowedPath = (path: string[]) => {
  const [resource, id, action, child] = path

  if (simpleResources.has(resource)) return path.length <= 2 && (!id || /^\d+$/.test(id))
  if (resource === 'channel-settings') return path.length === 1
  if (resource === 'platforms') return path.length === 1 || (path.length === 3 && Boolean(id) && action === 'marketplaces')
  if (resource === 'products') {
    if (path.length === 1) return true
    if (id === 'bulk') return path.length === 3 && ['status', 'archive'].includes(action)
    if (!id || !/^\d+$/.test(id)) return false
    if (path.length === 2) return true
    if (path.length === 3) return ['archive', 'restore', 'duplicate', 'translations', 'images', 'variants'].includes(action)
    if (path.length === 4 && ['translations', 'images', 'variants'].includes(action)) {
      return /^\d+$/.test(child) || (action === 'images' && child === 'reorder')
    }
    return false
  }
  if (resource !== 'channels') return false
  if (path.length === 1) return true
  if (!id || !/^\d+$/.test(id)) return false
  if (path.length === 2) return true

  return (path.length === 3 && ['disconnect', 'credentials', 'marketplaces', 'authorize'].includes(action)) ||
    (path.length === 4 && action === 'credentials' && child === 'status')
}

const proxy = async (request: Request, context: { params: Promise<{ path: string[] }> }) => {
  const session = await getServerSession(authOptions)

  if (!session?.user) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const { path } = await context.params
  if (!path[0] || !isAllowedPath(path)) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }

  const token = await getToken({ req: request as never, secret: process.env.NEXTAUTH_SECRET })

  if (!token?.accessToken) return NextResponse.json({ detail: 'Unauthorized' }, { status: 401 })

  const sourceUrl = new URL(request.url)
  const apiBase = process.env.DJANGO_API_URL ?? 'http://localhost:8000/api/v1'
  const endpoint = `${apiBase}/${path.join('/')}/${sourceUrl.search}`
  const hasBody = !['GET', 'HEAD'].includes(request.method)
  const body = hasBody ? await request.arrayBuffer() : undefined
  const fetchBackend = (accessToken: string) => fetch(endpoint, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(hasBody ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' } : {})
    },
    body,
    cache: 'no-store'
  })
  let response = await fetchBackend(String(token.accessToken))

  if (response.status === 401 && token.refreshToken) {
    const refreshResponse = await fetch(`${apiBase}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: token.refreshToken }),
      cache: 'no-store'
    })

    if (refreshResponse.ok) {
      const refreshed = await refreshResponse.json() as { access: string }

      response = await fetchBackend(refreshed.access)
    }
  }

  if (response.status === 204) return new NextResponse(null, { status: 204 })

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    headers: { 'Content-Type': response.headers.get('content-type') ?? 'application/json' }
  })
}

export const GET = proxy
export const POST = proxy
export const PATCH = proxy
export const PUT = proxy
export const DELETE = proxy

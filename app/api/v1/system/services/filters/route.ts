import { NextResponse } from 'next/server'
import { getInternalApiHeaders } from '@/lib/api-auth'
import { SCOPE_KEYS } from '@/src/lib/system/services'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-cache, no-store, must-revalidate' }
  if (!process.env.API_BASE_URL) return NextResponse.json({ error: 'API configuration unavailable' }, { status: 500, headers })
  const incoming = new URL(request.url).searchParams
  const params = new URLSearchParams()
  for (const key of [...SCOPE_KEYS, 'platform', 'includeArchived']) {
    const value = incoming.get(key)
    if (value) params.set(key, value)
  }
  try {
    const response = await fetch(`${process.env.API_BASE_URL}/api/v1/system/services/filters?${params}`, {
      headers: getInternalApiHeaders(), cache: 'no-store', signal: AbortSignal.timeout(60000),
    })
    return NextResponse.json(await response.json(), { status: response.status, headers })
  } catch {
    return NextResponse.json({ error: 'Service selections unavailable. Try again.' }, { status: 503, headers })
  }
}

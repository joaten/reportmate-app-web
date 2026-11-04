import { NextResponse } from 'next/server'
import { getInternalApiHeaders } from '@/lib/api-auth'
import { SERVICE_PARAMS } from '@/src/lib/system/services'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const headers = { 'Cache-Control': 'no-cache, no-store, must-revalidate' }

export async function GET(request: Request) {
  const base = process.env.API_BASE_URL
  if (!base) return NextResponse.json({ error: 'API configuration unavailable' }, { status: 500, headers })
  const incoming = new URL(request.url).searchParams
  const params = new URLSearchParams()
  for (const key of [...SERVICE_PARAMS, 'platform', 'limit']) {
    const value = incoming.get(key)
    if (value) params.set(key, value)
  }
  try {
    const response = await fetch(`${base}/api/v1/system/services?${params}`, {
      headers: getInternalApiHeaders(), cache: 'no-store', signal: AbortSignal.timeout(60000),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status, headers })
  } catch {
    return NextResponse.json({ error: 'Services report unavailable. Try again.' }, { status: 503, headers })
  }
}

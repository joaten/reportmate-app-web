import { trackedFetch } from '../data-cache'
import { arcticWolfRows, type WolfApplication, type WolfDevice, type WolfRow } from './arcticWolf'

async function read(url: string, signal: AbortSignal): Promise<unknown> {
  const response = await trackedFetch(url, { cache: 'no-store', signal })
  if (!response.ok) throw new Error('The Arctic Wolf report could not be loaded. Please retry.')
  return response.json()
}

/** Read every page; never present a capped application scan as a complete fleet report. */
export async function fetchArcticWolfReport(signal: AbortSignal): Promise<WolfRow[]> {
  const devices: WolfDevice[] = []
  const serials = new Set<string>()
  let expected: number | null = null
  for (;;) {
    const body = await read(`/api/v1/devices?limit=1000&offset=${devices.length}`, signal) as {
      devices?: WolfDevice[]; total?: number; hasMore?: boolean
    }
    if (!Array.isArray(body.devices) || !Number.isInteger(body.total) || body.total! < 0 ||
        (expected !== null && body.total !== expected)) throw new Error('Device inventory changed while loading. Please refresh.')
    expected = body.total!
    if (expected > 5000) throw new Error('This fleet exceeds the application inventory scan limit. A complete Arctic Wolf report cannot be generated.')
    for (const device of body.devices) {
      if (!device.serialNumber || serials.has(device.serialNumber)) throw new Error('Device inventory returned an incomplete page. Please refresh.')
      devices.push(device)
      serials.add(device.serialNumber)
    }
    if (devices.length === expected) break
    if (devices.length > expected || !body.devices.length || body.hasMore === false) throw new Error('Device inventory returned an incomplete page. Please refresh.')
  }
  const apps: WolfApplication[] = []
  for (;;) {
    const params = new URLSearchParams({ search: 'arctic', deviceLimit: '5000', limit: '5000', offset: String(apps.length) })
    const body = await read(`/api/v1/applications?${params}`, signal)
    if (!Array.isArray(body)) throw new Error('Application inventory could not be read. Please refresh.')
    if (!body.every(app => app && typeof app.name === 'string')) throw new Error('Application inventory returned invalid entries. Please refresh.')
    apps.push(...body)
    if (body.length < 5000) break
    if (apps.length > 100_000) throw new Error('Application inventory returned too many entries. The report is incomplete.')
  }
  signal.throwIfAborted()
  return arcticWolfRows(apps, devices, new Date().toISOString())
}

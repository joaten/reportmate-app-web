import { csvRow } from '../csv'

export interface WolfApplication {
  serialNumber: string
  deviceName?: string | null
  platform?: string | null
  name: string
  version?: string | null
  path?: string | null
  lastSeen?: string | null
  collectedAt?: string | null
  usage?: string | null
  department?: string | null
  area?: string | null
  location?: string | null
}

export interface WolfDevice {
  serialNumber: string
  deviceName?: string | null
  name?: string | null
  platform?: string | null
  lastSeen?: string | null
  usage?: string | null
  department?: string | null
  location?: string | null
  inventoryState?: { state?: string | null } | null
}

export interface WolfRow {
  device: string
  serial: string
  platform: string
  detection: string
  components: string
  lastSeen: string | null
  collectedAt: string | null
  usage: string
  department: string
  location: string
  reporting: string
  ageDays: number | null
  active: 'Yes' | 'No' | 'Unknown'
  inventoryState: string
  asOf: string
}

function validTime(value?: string | null): string | null {
  return value && Number.isFinite(Date.parse(value)) ? value : null
}

function latest(values: (string | null | undefined)[]): string | null {
  return values.map(validTime).filter((v): v is string => v !== null)
    .sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null
}

/** Inventory evidence only: companion apps and package entries do not establish service health. */
export function arcticWolfRows(apps: WolfApplication[], devices: WolfDevice[], asOf: string): WolfRow[] {
  const now = Date.parse(asOf)
  if (!Number.isFinite(now)) throw new Error('The report timestamp is invalid.')
  const inventory = new Map(devices.map(device => [device.serialNumber, device]))
  const groups = new Map<string, WolfApplication[]>()
  for (const app of apps) {
    if (!/arctic[\s_-]*wolf\b/i.test(app.name || '')) continue
    if (!app.serialNumber) throw new Error('An Arctic Wolf inventory entry has no device serial number.')
    groups.set(app.serialNumber, [...(groups.get(app.serialNumber) || []), app])
  }
  return [...groups].map(([serial, entries]): WolfRow => {
    const sorted = [...entries].sort((a, b) => (Date.parse(b.collectedAt || '') || 0) - (Date.parse(a.collectedAt || '') || 0))
    const app = sorted[0]
    const device = inventory.get(serial)
    const state = device?.inventoryState?.state || 'unknown'
    const lastSeen = device ? validTime(device.lastSeen) : latest(entries.map(entry => entry.lastSeen))
    const ageDays = lastSeen ? (now - Date.parse(lastSeen)) / 86_400_000 : null
    const components = [...new Set(entries.map(entry => `${entry.name}: ${entry.version || 'Unknown version'}`))].sort().join('; ')
    return {
      device: device?.deviceName || device?.name || app.deviceName || serial,
      serial, platform: device?.platform || app.platform || 'Unknown',
      detection: entries.some(entry => /^arctic[\s_-]*wolf[\s_-]+agent\b/i.test(entry.name))
        ? 'Agent component(s) reported' : 'Package entry only; agent not confirmed',
      components, lastSeen, collectedAt: latest(entries.map(entry => entry.collectedAt)),
      usage: device?.usage || app.usage || '',
      department: device?.department || app.department || app.area || '',
      location: device?.location || app.location || '',
      reporting: ageDays === null ? 'No check-in recorded' : ageDays < 0 ? 'Check-in timestamp is in the future'
        : ageDays <= 7 ? 'Reporting (within 7 days)' : 'Stale (over 7 days)',
      ageDays,
      active: state === 'checked_out' ? 'Yes' : state === 'storage' ? 'No' : 'Unknown',
      inventoryState: state, asOf,
    }
  }).sort((a, b) => a.device.localeCompare(b.device))
}

export function wolfTime(value: string | null): string {
  if (!validTime(value)) return 'Unknown'
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
  }).format(new Date(value!))
}

export const WOLF_COLUMNS = [
  'Device', 'Serial', 'Platform', 'Detection', 'Reported Components and Versions',
  'Last ReportMate Check-in (Vancouver)', 'Latest Application Inventory (Vancouver)',
  'Usage', 'Department', 'Location', 'Reporting Status', 'Days Since Last Check-in',
  'Active Device', 'Inventory State', 'Status As Of (Vancouver)',
] as const

export function wolfValues(row: WolfRow): (string | number)[] {
  return [row.device, row.serial, row.platform, row.detection, row.components,
    wolfTime(row.lastSeen), wolfTime(row.collectedAt), row.usage, row.department, row.location,
    row.reporting, row.ageDays === null ? '' : row.ageDays.toFixed(1), row.active,
    row.inventoryState, wolfTime(row.asOf)]
}

export function wolfCsv(rows: WolfRow[]): string {
  return [csvRow([...WOLF_COLUMNS]), ...rows.map(row => csvRow(wolfValues(row)))].join('\r\n')
}

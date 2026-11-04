export const SERVICES_API = "/api/v1/system/services"

export const SERVICE_STATES = ["running", "stopped", "mixed", "missing", "unknown"] as const
export const STARTUP_TYPES = ["automatic", "manual", "disabled", "boot", "system", "unknown"] as const
export const SCOPE_KEYS = ["usages", "catalogs", "areas", "fleets", "locations", "rooms", "inventoryStates"] as const
export const SERVICE_PARAMS = ["service", "application", "versions", "states", "startups", "freshness", "maxAgeHours", "search", ...SCOPE_KEYS, "includeArchived", "offset"] as const

export type ServiceState = typeof SERVICE_STATES[number]
export type Freshness = "fresh" | "stale" | "unknown"

export interface ServiceEntry {
  name: string | null
  displayName: string | null
  status: string | null
  state: ServiceState
  startType: string | null
  startup: string
  path: string | null
  type: string | null
  onDemand: boolean | number | null
  disabled: boolean | number | null
}

export interface ServiceDevice {
  serialNumber: string
  deviceName: string
  hostname: string | null
  assetTag: string | null
  platform: string
  usage: string | null
  catalog: string | null
  area: string | null
  fleet: string | null
  location: string | null
  room: string | null
  archived: boolean
  inventoryState: string | null
  lastSeen: string | null
  collectedAt: string | null
  applicationsCollectedAt: string | null
  services: ServiceEntry[]
  applications: { name: string; version: string | null; path: string | null }[]
  state: ServiceState
  reportedState: ServiceState
  freshness: Freshness
  applicationsFreshness: Freshness
}

export interface ServicesReport {
  generatedAt: string
  queryRequired: boolean
  total: number
  offset: number
  limit: number
  summary: Partial<Record<ServiceState, number>>
  options: Record<typeof SCOPE_KEYS[number], string[]>
  devices: ServiceDevice[]
}

export function listParam(params: URLSearchParams, key: string): string[] {
  return (params.get(key) || "").split(",").map(value => value.trim()).filter(Boolean)
}

export function servicesApiQuery(params: URLSearchParams, platform: string): string {
  const query = new URLSearchParams()
  for (const key of SERVICE_PARAMS) {
    const value = params.get(key)?.trim()
    if (value) query.set(key, value)
  }
  query.set("platform", platform)
  query.set("limit", "50")
  return query.toString()
}

/** Keep unrelated URL state; a changed filter always starts at the first page. */
export function servicesUrlQuery(current: string, patch: Record<string, string | null>): string {
  const params = new URLSearchParams(current)
  params.set("tab", "services")
  if (!("offset" in patch)) params.delete("offset")
  for (const [key, value] of Object.entries(patch)) {
    if (value?.trim()) params.set(key, value.trim())
    else params.delete(key)
  }
  return params.toString()
}

export function stateLabel(value: string): string {
  return value === "missing" ? "Not found" : value === "unknown" ? "Unknown" : value.charAt(0).toUpperCase() + value.slice(1)
}

export function inventoryLabel(value: string | null): string {
  return value === "checked_out" ? "Checked out" : value === "storage" ? "Storage"
    : value === "decommissioning" ? "Decommissioning" : "Unknown"
}

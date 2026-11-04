export const SERVICES_API = "/api/v1/system/services"
export const SERVICE_OPTIONS_API = `${SERVICES_API}/filters`

export const SERVICE_STATES = ["running", "stopped", "mixed", "missing", "unknown"] as const
export const STARTUP_TYPES = ["automatic", "manual", "disabled", "boot", "system", "unknown"] as const
export const SCOPE_KEYS = ["usages", "catalogs", "areas", "fleets", "locations", "rooms", "inventoryStates"] as const
export const SERVICE_PARAMS = ["service", "application", "serviceNames", "applicationNames", "versions", "states", "startups", "freshness", "maxAgeHours", "search", ...SCOPE_KEYS, "includeArchived", "offset"] as const

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

export interface ServiceCatalog {
  services: { name: string; displayName: string | null; devices: number; startups: string[] }[]
  applications: { name: string; devices: number; versions: string[] }[]
  options: ServicesReport["options"]
}

export function serviceOptionsQuery(params: URLSearchParams, platform: string): string {
  const query = new URLSearchParams({ platform })
  for (const key of [...SCOPE_KEYS, "includeArchived"]) {
    const value = params.get(key)
    if (value) query.set(key, value)
  }
  return query.toString()
}

/** Older shared links use substring filters; resolve their visible selections from real inventory. */
export function selectedServiceNames(params: URLSearchParams, catalog: ServiceCatalog | null): string[] {
  if (params.has("serviceNames")) return listParam(params, "serviceNames")
  const query = params.get("service")?.toLowerCase()
  return query ? (catalog?.services || []).filter(s => `${s.name} ${s.displayName || ""}`.toLowerCase().includes(query)).map(s => s.name) : []
}

export function selectedApplicationNames(params: URLSearchParams, catalog: ServiceCatalog | null): string[] {
  if (params.has("applicationNames")) return listParam(params, "applicationNames")
  const query = params.get("application")?.toLowerCase()
  return query ? (catalog?.applications || []).filter(a => a.name.toLowerCase().includes(query)).map(a => a.name) : []
}

export function listParam(params: URLSearchParams, key: string): string[] {
  const value = params.get(key) || ""
  if ((key === "serviceNames" || key === "applicationNames") && value.startsWith("[")) {
    try {
      const names: unknown = JSON.parse(value)
      return Array.isArray(names) ? names.filter((name): name is string => typeof name === "string" && !!name.trim()) : []
    } catch { return [] }
  }
  return value.split(",").map(part => part.trim()).filter(Boolean)
}

export function servicesApiQuery(params: URLSearchParams, platform: string): string {
  const query = new URLSearchParams()
  for (const key of SERVICE_PARAMS) {
    const value = params.get(key)?.trim()
    if (value) query.set(key, value)
  }
  query.set("platform", platform)
  query.delete("offset")
  query.set("limit", "500")
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

export function servicesPageQuery(query: string, offset = 0): string {
  const params = new URLSearchParams(query)
  params.set("offset", String(offset))
  params.set("limit", "500")
  return params.toString()
}

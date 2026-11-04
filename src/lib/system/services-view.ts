import { inventoryLabel, stateLabel, type ServiceDevice } from "./services"

export const EVIDENCE_CHOICES = [
  ["all", "All devices"], ["any", "Any matching evidence"], ["services", "Matching services"],
  ["applications", "Matching applications"], ["none", "No matching evidence"],
] as const
export const CHECKIN_CHOICES = [["all", "All"], ["recent", "Within maximum age"], ["stale", "Older"], ["unknown", "Unknown"]] as const
export const SERVICE_VIEW_PARAMS = ["evidence", "checkin", "checkinAgeHours", "sort", "direction", "columns"] as const
export const SERVICE_COLUMNS = [
  ["deviceName", "Device"], ["serialNumber", "Serial number"], ["assetTag", "Asset tag"], ["platform", "Platform"],
  ["state", "Service state"], ["services", "Matching services"], ["applications", "Application versions"],
  ["inventoryState", "Inventory"], ["usage", "Usage"], ["catalog", "Catalog"], ["area", "Area"],
  ["fleet", "Fleet"], ["location", "Location"], ["room", "Room"], ["collectedAt", "Service collection"],
  ["applicationsCollectedAt", "Application collection"], ["lastSeen", "Last seen"], ["checkinAge", "Check-in age"],
] as const
export type ServiceColumn = typeof SERVICE_COLUMNS[number][0]
export type Evidence = typeof EVIDENCE_CHOICES[number][0]
export type Checkin = typeof CHECKIN_CHOICES[number][0]
export interface ServicesView {
  evidence: Evidence
  checkin: Checkin
  checkinAgeHours: number
  sort: ServiceColumn
  direction: "asc" | "desc"
  columns: ServiceColumn[]
}

const defaultColumns: ServiceColumn[] = ["deviceName", "state", "services", "applications", "inventoryState", "collectedAt", "lastSeen"]
export function readServicesView(params: URLSearchParams, hasApplication: boolean): ServicesView {
  const available = SERVICE_COLUMNS.filter(([key]) => hasApplication || (key !== "applications" && key !== "applicationsCollectedAt"))
  const requested = params.has("columns") ? (params.get("columns") || "").split(",") : defaultColumns
  const columns = available.filter(([key]) => key === "deviceName" || requested.includes(key)).map(([key]) => key)
  const sort = columns.find(key => key === params.get("sort")) || "deviceName"
  const evidence = EVIDENCE_CHOICES.find(([key]) => key === params.get("evidence"))?.[0] || "all"
  const hours = Number(params.get("checkinAgeHours") || 168)
  return {
    evidence: evidence === "applications" && !hasApplication ? "all" : evidence,
    checkin: CHECKIN_CHOICES.find(([key]) => key === params.get("checkin"))?.[0] || "all",
    checkinAgeHours: Number.isFinite(hours) && hours > 0 ? Math.min(hours, 87600) : 168,
    sort, direction: params.get("direction") === "desc" ? "desc" : "asc", columns,
  }
}

/** Missing, invalid and future observations have unknown age at the report snapshot. */
export function checkinAgeHours(lastSeen: string | null, generatedAt: string): number | null {
  const seen = lastSeen ? Date.parse(lastSeen) : NaN
  const snapshot = Date.parse(generatedAt)
  return Number.isFinite(seen) && Number.isFinite(snapshot) && seen <= snapshot ? (snapshot - seen) / 3600000 : null
}
export function checkinState(age: number | null, maximumHours: number): Exclude<Checkin, "all"> {
  return age === null ? "unknown" : age <= maximumHours ? "recent" : "stale"
}
export function matchesEvidence(serviceCount: number, applicationCount: number, evidence: Evidence): boolean {
  switch (evidence) {
    case "any": return serviceCount > 0 || applicationCount > 0
    case "services": return serviceCount > 0
    case "applications": return applicationCount > 0
    case "none": return serviceCount === 0 && applicationCount === 0
    default: return true
  }
}

export function serviceSortValue(device: ServiceDevice, column: ServiceColumn, generatedAt: string): string | number | null {
  switch (column) {
    case "state": return stateLabel(device.state)
    case "inventoryState": return device.inventoryState ? `${inventoryLabel(device.inventoryState)} ${device.archived ? "Archived" : ""}` : null
    case "services": return device.services.map(s => s.name || s.displayName || "").sort().join("; ") || null
    case "applications": return device.applications.map(a => `${a.name} ${a.version || ""}`).sort().join("; ") || null
    case "checkinAge": return checkinAgeHours(device.lastSeen, generatedAt)
    case "lastSeen": return checkinAgeHours(device.lastSeen, generatedAt) === null ? null : Date.parse(device.lastSeen!)
    case "collectedAt":
    case "applicationsCollectedAt": return checkinAgeHours(device[column], generatedAt) === null ? null : Date.parse(device[column]!)
    default: return device[column] || null
  }
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })
export function compareReportValues(a: string | number | null, b: string | number | null, direction: "asc" | "desc"): number {
  if (a === null) return b === null ? 0 : 1
  if (b === null) return -1
  const comparison = typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b))
  return direction === "asc" ? comparison : -comparison
}

/** Derive the visible/exported rows without refetching or changing collected observations. */
export function servicesViewRows(devices: ServiceDevice[], generatedAt: string, view: ServicesView): ServiceDevice[] {
  return devices.filter(device => matchesEvidence(device.services.length, device.applications.length, view.evidence) &&
    (view.checkin === "all" || checkinState(checkinAgeHours(device.lastSeen, generatedAt), view.checkinAgeHours) === view.checkin))
    .sort((a, b) => compareReportValues(serviceSortValue(a, view.sort, generatedAt), serviceSortValue(b, view.sort, generatedAt), view.direction) ||
      collator.compare(a.serialNumber, b.serialNumber))
}

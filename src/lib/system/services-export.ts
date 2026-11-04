import { csvRow } from "../csv"
import { SERVICES_API, inventoryLabel, stateLabel, type ServiceDevice, type ServicesReport } from "./services"

export function servicesExportQuery(query: string, offset = 0): string {
  const params = new URLSearchParams(query)
  params.set("offset", String(offset))
  params.set("limit", "500")
  return params.toString()
}

export async function collectServicesExport(
  query: string,
  signal: AbortSignal,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ devices: ServiceDevice[]; generatedAt: string }> {
  const devices: ServiceDevice[] = []
  const serials = new Set<string>()
  let total: number | null = null
  let generatedAt = ""
  do {
    const response = await fetch(`${SERVICES_API}?${servicesExportQuery(query, devices.length)}`, { cache: "no-store", signal })
    if (!response.ok) throw new Error("The report could not be exported. Please retry.")
    const page: ServicesReport = await response.json()
    if (!Array.isArray(page.devices) || !Number.isInteger(page.total) || page.total < 0 || page.queryRequired ||
        page.offset !== devices.length || (total !== null && page.total !== total)) {
      throw new Error("The report changed during export. Please retry.")
    }
    total = page.total
    if (!generatedAt) generatedAt = page.generatedAt
    if (page.devices.length === 0 && devices.length < total) throw new Error("The export returned an incomplete page. Please retry.")
    for (const device of page.devices) {
      if (!device.serialNumber || serials.has(device.serialNumber)) throw new Error("The report changed during export. Please retry.")
      serials.add(device.serialNumber)
      devices.push(device)
    }
    if (devices.length > total) throw new Error("The report changed during export. Please retry.")
    onProgress(devices.length, total)
  } while (devices.length < total)
  signal.throwIfAborted()
  return { devices, generatedAt }
}

export function servicesCsv(devices: ServiceDevice[], generatedAt: string, reportUrl: string): string {
  const headers = [
    "Device Name", "Hostname", "Serial Number", "Asset Tag", "Platform", "Inventory State", "Archived in ReportMate",
    "Usage", "Catalog", "Area", "Fleet", "Location", "Room", "Service State", "Last Reported Service State",
    "Matching Services", "Reported Service States", "Startup Types", "Executable Paths", "Application Versions",
    "Service Collection Time", "Service Collection Freshness", "Application Collection Time", "Application Collection Freshness",
    "Last Seen", "Report Generated At", "Report URL",
  ]
  return [csvRow(headers), ...devices.map(device => csvRow([
    device.deviceName, device.hostname, device.serialNumber, device.assetTag, device.platform,
    inventoryLabel(device.inventoryState), device.archived ? "Yes" : "No",
    device.usage, device.catalog, device.area, device.fleet, device.location, device.room,
    stateLabel(device.state), stateLabel(device.reportedState),
    device.services.map(s => s.name || s.displayName || "").join("\n"),
    device.services.map(s => `${s.name || s.displayName || ""}: ${s.status || "Unknown"}`).join("\n"),
    device.services.map(s => `${s.name || s.displayName || ""}: ${s.startType || "Unknown"}`).join("\n"),
    device.services.map(s => `${s.name || s.displayName || ""}: ${s.path || "Not reported"}`).join("\n"),
    device.applications.map(a => `${a.name}: ${a.version || "Version not reported"}`).join("\n"),
    device.collectedAt, device.freshness, device.applicationsCollectedAt, device.applicationsFreshness,
    device.lastSeen, generatedAt, reportUrl,
  ]))].join("\r\n")
}

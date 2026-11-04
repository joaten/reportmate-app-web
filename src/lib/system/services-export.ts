import { csvRow } from "../csv"
import { inventoryLabel, stateLabel, type ServiceDevice } from "./services"

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

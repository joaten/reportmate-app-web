import { csvRow } from "../csv"
import { inventoryLabel, stateLabel, type ServiceDevice } from "./services"
import { checkinAgeHours, checkinState } from "./services-view"

export function servicesCsv(devices: ServiceDevice[], generatedAt: string, reportUrl: string, maximumCheckinHours = 168): string {
  const headers = [
    "Device Name", "Hostname", "Serial Number", "Asset Tag", "Platform", "Inventory State", "Archived in ReportMate",
    "Usage", "Catalog", "Area", "Fleet", "Location", "Room", "Service State", "Last Reported Service State",
    "Matching Services", "Reported Service States", "Startup Types", "Executable Paths", "Application Versions",
    "Service Collection Time", "Service Collection Freshness", "Application Collection Time", "Application Collection Freshness",
    "Last Seen", "Report Generated At", "Report URL",
    "Matching Service Reported", "Matching Application Reported", "Application Paths",
    "ReportMate Check-in Age (Hours)", "ReportMate Check-in Freshness", "Maximum Check-in Age (Hours)",
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
    device.services.length > 0 ? "Yes" : "No", device.applications.length > 0 ? "Yes" : "No",
    device.applications.map(a => `${a.name}: ${a.path || "Not reported"}`).join("\n"),
    checkinAgeHours(device.lastSeen, generatedAt)?.toFixed(2) ?? null,
    checkinState(checkinAgeHours(device.lastSeen, generatedAt), maximumCheckinHours), maximumCheckinHours,
  ]))].join("\r\n")
}

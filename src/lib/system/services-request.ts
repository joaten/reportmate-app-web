import { trackedFetch } from "../data-cache"
import { SERVICES_API, servicesPageQuery, type ServiceDevice, type ServicesReport } from "./services"

export async function fetchServicesReport(
  query: string,
  signal: AbortSignal,
  onProgress?: (loaded: number, total: number) => void,
): Promise<ServicesReport> {
  const devices: ServiceDevice[] = []
  const serials = new Set<string>()
  let total: number | null = null
  let report: ServicesReport | null = null
  do {
    const response = await trackedFetch(`${SERVICES_API}?${servicesPageQuery(query, devices.length)}`, { cache: "no-store", signal })
    if (!response.ok) throw new Error("The services report could not be loaded. Please retry.")
    const page: ServicesReport = await response.json()
    if (!Array.isArray(page.devices) || !Number.isInteger(page.total) || page.total < 0 || page.queryRequired ||
        page.offset !== devices.length || (total !== null && page.total !== total)) {
      throw new Error("The report changed while loading. Please retry.")
    }
    total = page.total
    if (!report) report = page
    if (page.devices.length === 0 && devices.length < total) throw new Error("The report returned an incomplete page. Please retry.")
    for (const device of page.devices) {
      if (!device.serialNumber || serials.has(device.serialNumber)) throw new Error("The report changed while loading. Please retry.")
      serials.add(device.serialNumber)
      devices.push(device)
    }
    if (devices.length > total) throw new Error("The report changed while loading. Please retry.")
    onProgress?.(devices.length, total)
  } while (devices.length < total)
  signal.throwIfAborted()
  if (!report) throw new Error("The services report could not be loaded.")
  return { ...report, devices }
}

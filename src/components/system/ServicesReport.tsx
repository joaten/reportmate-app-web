"use client"

import { cloneElement, useEffect, useId, useState, type FormEvent, type ReactElement } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { usePlatformFilterSafe } from "../../providers/PlatformFilterProvider"
import DeviceFilters from "../shared/DeviceFilters"
import { SystemViewSwitch } from "./SystemViewSwitch"
import { trackedFetch } from "../../lib/data-cache"
import { formatExactTime, formatRelativeTime } from "../../lib/time"
import {
  SERVICES_API, SERVICE_STATES, STARTUP_TYPES, inventoryLabel, listParam,
  servicesApiQuery, servicesUrlQuery, stateLabel,
  type ServiceState, type ServicesReport as Report,
} from "../../lib/system/services"

const input = "mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-white"
const button = "rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
const emptyOptions = { usages: [], catalogs: [], areas: [], fleets: [], locations: [], rooms: [], inventoryStates: [] }

function When({ value }: { value: string | null }) {
  return value ? <time dateTime={value} title={formatExactTime(value)}>{formatRelativeTime(value)}</time> : <span className="text-gray-400">Unknown</span>
}

function Badge({ state }: { state: ServiceState }) {
  const color = state === "running" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    : state === "stopped" || state === "missing" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{stateLabel(state)}</span>
}

function Field({ label, children }: { label: string; children: ReactElement<{ id?: string }> }) {
  const id = useId()
  return <div><label htmlFor={id} className="block text-xs font-medium text-gray-600 dark:text-gray-400">{label}</label>{cloneElement(children, { id })}</div>
}

export function ServicesReport() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { platformFilter } = usePlatformFilterSafe()
  const current = searchParams.toString()
  const params = new URLSearchParams(current)
  const query = servicesApiQuery(params, platformFilter)
  const [data, setData] = useState<Report | null>(null)
  const [options, setOptions] = useState<Report["options"]>(emptyOptions)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    setData(null)
    const run = async () => {
      try {
        const response = await trackedFetch(`${SERVICES_API}?${query}`, {
          cache: "no-store", signal: controller.signal,
        })
        const body = await response.json()
        if (!response.ok) {
          const detail = body.detail || body.error || `Services API failed: ${response.status}`
          throw new Error(typeof detail === "string" ? detail : "Invalid report filters. Check the service and application selections.")
        }
        if (!Array.isArray(body.devices) || typeof body.total !== "number" || !body.options) {
          throw new Error("The server returned an incomplete services report.")
        }
        if (!controller.signal.aborted) {
          setData(body)
          setOptions(body.options)
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Services report unavailable")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [query, reload])

  const update = (patch: Record<string, string | null>) => {
    router.push(`/system?${servicesUrlQuery(current, patch)}`, { scroll: false })
  }
  const toggle = (key: string, value: string) => {
    const selected = listParam(params, key)
    update({ [key]: (selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]).join(",") })
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const patch: Record<string, string | null> = {}
    for (const key of ["service", "application", "versions", "search", "states", "startups", "freshness", "maxAgeHours", "inventoryStates"]) {
      const value = String(form.get(key) || "").trim()
      patch[key] = value === "all" || (key === "maxAgeHours" && value === "24") ? null : value
    }
    patch.includeArchived = form.get("includeArchived") ? "true" : null
    if (patch.versions && !patch.application) {
      setError("Select an application before filtering its versions.")
      return
    }
    update(patch)
  }
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href)
      // Explicit all prevents another browser's saved platform changing the report.
      url.searchParams.set("platform", platformFilter === "Windows" ? "win" : platformFilter === "macOS" ? "mac" : "all")
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Could not copy the link. Copy this page's address instead.")
    }
  }
  const clearScope = () => update({ usages: null, catalogs: null, areas: null, fleets: null, locations: null, rooms: null })
  const hasQuery = !!params.get("service")?.trim()

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
      <div className="flex-1 page-container px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
            <div>
              <SystemViewSwitch current="services" />
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Service coverage, installed application versions, and collection age across devices.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copyLink} className={button}>{copied ? "Copied" : "Copy link"}</button>
              <button type="button" onClick={() => setReload(n => n + 1)} disabled={loading} className={button}>Refresh</button>
            </div>
          </div>

          <DeviceFilters
            filterOptions={{ ...options, statuses: [] }}
            selectedStatuses={[]} onStatusToggle={() => {}}
            selectedUsages={listParam(params, "usages")} onUsageToggle={v => toggle("usages", v)}
            selectedCatalogs={listParam(params, "catalogs")} onCatalogToggle={v => toggle("catalogs", v)}
            selectedAreas={listParam(params, "areas")} onAreaToggle={v => toggle("areas", v)}
            selectedFleets={listParam(params, "fleets")} onFleetToggle={v => toggle("fleets", v)}
            selectedLocations={listParam(params, "locations")} onLocationToggle={v => toggle("locations", v)}
            searchQuery="" onSearchChange={() => {}} onClearAll={clearScope}
            expanded={expanded} onToggle={() => setExpanded(v => !v)}
          />

          <div className="overflow-y-auto min-h-0 flex-1" aria-busy={loading}>
            <form key={current} onSubmit={submit} className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Field label="Service name or path">
                  <input className={input} name="service" required maxLength={200} defaultValue={params.get("service") || ""} placeholder="Search names, display names, or paths" />
                </Field>
                <Field label="Application name (optional)">
                  <input className={input} name="application" maxLength={200} defaultValue={params.get("application") || ""} placeholder="Match installed application names" />
                </Field>
                <Field label="Application versions (exact, comma separated)">
                  <input className={input} name="versions" maxLength={500} defaultValue={params.get("versions") || ""} placeholder="All reported versions" />
                </Field>
                <Field label="Device name, hostname, serial, or asset tag">
                  <input className={input} name="search" maxLength={200} defaultValue={params.get("search") || ""} placeholder="All devices in scope" />
                </Field>
                <Field label="Service state">
                  <select className={input} name="states" defaultValue={params.get("states") || ""}>
                    <option value="">All states</option>
                    {params.get("states")?.includes(",") && <option value={params.get("states")!}>{listParam(params, "states").map(stateLabel).join(", ")}</option>}
                    {SERVICE_STATES.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
                  </select>
                </Field>
                <Field label="Startup type">
                  <select className={input} name="startups" defaultValue={params.get("startups") || ""}>
                    <option value="">All startup types</option>
                    {params.get("startups")?.includes(",") && <option value={params.get("startups")!}>{listParam(params, "startups").map(stateLabel).join(", ")}</option>}
                    {STARTUP_TYPES.map(s => <option key={s} value={s}>{stateLabel(s)}</option>)}
                  </select>
                </Field>
                <Field label="Service collection age">
                  <select className={input} name="freshness" defaultValue={params.get("freshness") || "all"}>
                    <option value="all">All collections</option><option value="fresh">Within maximum age</option>
                    <option value="stale">Older than maximum age</option><option value="unknown">Unknown age</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Maximum age (hours)">
                    <input className={input} name="maxAgeHours" type="number" min={1} max={8760} required defaultValue={params.get("maxAgeHours") || "24"} />
                  </Field>
                  <Field label="Inventory state">
                    <select className={input} name="inventoryStates" defaultValue={params.get("inventoryStates") || ""}>
                      <option value="">All states</option>
                      {params.get("inventoryStates")?.includes(",") && <option value={params.get("inventoryStates")!}>{listParam(params, "inventoryStates").map(inventoryLabel).join(", ")}</option>}
                      {options.inventoryStates.map(s => <option key={s} value={s}>{inventoryLabel(s)}</option>)}
                    </select>
                  </Field>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <input type="checkbox" name="includeArchived" defaultChecked={params.get("includeArchived") === "true"} className="rounded border-gray-300" /> Include archived devices
                </label>
                <button type="submit" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Run report</button>
              </div>
            </form>

            {error && <div role="alert" className="mx-6 my-4 p-3 text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg">{error} <button type="button" className="underline ml-2" onClick={() => setReload(n => n + 1)}>Retry</button></div>}

            {hasQuery && data && !loading && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-gray-600 dark:text-gray-400">{data.total.toLocaleString()} devices <span className="text-gray-400">·</span> {data.devices.length ? data.offset + 1 : 0}–{data.devices.length ? data.offset + data.devices.length : 0}</div>
              <div className="flex flex-wrap gap-2" aria-label="Service state totals">
                {SERVICE_STATES.map(state => <button type="button" key={state} onClick={() => update({ states: params.get("states") === state ? null : state })} aria-pressed={params.get("states") === state}
                  className={`rounded-full px-2 py-1 text-xs border ${params.get("states") === state ? "border-blue-500 text-blue-700 dark:text-blue-300" : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300"}`}>
                  {stateLabel(state)} {data.summary[state] || 0}
                </button>)}
              </div>
            </div>}

            {!hasQuery ? <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"><p className="font-medium">Search for a service to build a fleet report.</p><p className="text-sm mt-2">Add an application name to compare its installed versions alongside service coverage.</p></div>
              : loading ? <div role="status" className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading services report…</div>
              : data && <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50"><tr>
                    {["Device", "Service state", "Matching services", "Application versions", "Inventory", "Service collection", "Last seen"].map(label => <th scope="col" key={label} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-900 dark:text-gray-100">
                    {data.devices.length === 0 && <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No devices match these filters.</td></tr>}
                    {data.devices.map(device => <tr key={device.serialNumber} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 min-w-[190px]">
                        <Link href={`/device/${encodeURIComponent(device.serialNumber)}?tab=system`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{device.deviceName}</Link>
                        {device.hostname && device.hostname !== device.deviceName && <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">{device.hostname}</div>}
                        <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">{device.serialNumber}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{device.assetTag} {device.platform}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[120px]"><Badge state={device.state} />
                        {device.state === "unknown" && device.services.length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last reported: {stateLabel(device.reportedState)}</div>}
                      </td>
                      <td className="px-4 py-3 min-w-[230px] max-w-md">
                        {device.services.length ? <div className="space-y-2">{device.services.map((service, index) => <div key={`${service.name}-${index}`}>
                          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs break-all">{service.name || service.displayName || "Unnamed service"}</span><span className="text-xs text-gray-500 dark:text-gray-400">{service.status || "Unknown state"}</span></div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{service.startType || (service.type ? `${service.type}${service.onDemand ? " · on demand" : ""}` : "Startup type unknown")}</div>
                        </div>)}
                          <details className="text-xs text-gray-500 dark:text-gray-400"><summary className="cursor-pointer">Executable paths</summary>{device.services.map((service, index) => <p key={index} className="font-mono break-all mt-1">{service.path || "Not reported"}</p>)}</details>
                        </div> : <span className="text-gray-500 dark:text-gray-400">{device.state === "missing" ? "Not found in service inventory" : "No matching service reported; coverage unknown"}</span>}
                      </td>
                      <td className="px-4 py-3 min-w-[180px] max-w-xs">
                        {!params.get("application") ? <span className="text-gray-400">Select an application</span> : <>
                          {device.applications.length ? device.applications.map((app, index) => <div key={index} className="mb-2"><div className="text-xs text-gray-500 dark:text-gray-400">{app.name}</div><div className="font-mono">{app.version || "Version not reported"}</div></div>) : <span className="text-gray-500 dark:text-gray-400">No matching application reported</span>}
                          <div className="text-xs text-gray-500 dark:text-gray-400"><When value={device.applicationsCollectedAt} />{device.applicationsFreshness !== "fresh" && ` · ${device.applicationsFreshness}`}</div>
                        </>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap"><div>{inventoryLabel(device.inventoryState)}</div>{device.archived && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Archived in ReportMate</div>}<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{[device.catalog, device.usage, device.room].filter(Boolean).join(" · ")}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><When value={device.collectedAt} /><div className={`text-xs mt-1 ${device.freshness === "fresh" ? "text-gray-500 dark:text-gray-400" : "text-amber-700 dark:text-amber-300"}`}>{device.freshness === "fresh" ? "Within maximum age" : device.freshness === "stale" ? "Older than maximum age" : "Collection age unknown"}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><When value={device.lastSeen} /></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
          </div>

          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-3xl">States describe the last collection within the selected age. A running service does not prove vendor connectivity. Application versions describe installed packages. macOS entries are launchd jobs; stopped jobs may run on demand.</p>
            {hasQuery && data && <div className="flex items-center gap-2">
              <button type="button" disabled={loading || data.offset === 0} className={button} onClick={() => update({ offset: String(Math.max(0, data.offset - data.limit)) })}>Previous</button>
              <button type="button" disabled={loading || data.offset + data.limit >= data.total} className={button} onClick={() => update({ offset: String(data.offset + data.limit) })}>Next</button>
            </div>}
          </div>
        </div>
      </div>
    </div>
  )
}

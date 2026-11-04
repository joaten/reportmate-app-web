"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { usePlatformFilterSafe } from "../../providers/PlatformFilterProvider"
import DeviceFilters from "../shared/DeviceFilters"
import { SystemViewSwitch } from "./SystemViewSwitch"
import { ServiceSelectionCloud } from "./ServiceSelectionCloud"
import { peekCached, rememberCached, trackedFetch } from "../../lib/data-cache"
import { formatExactTime, formatRelativeTime } from "../../lib/time"
import {
  SERVICES_API, SERVICE_OPTIONS_API, SERVICE_PARAMS, SERVICE_STATES, inventoryLabel, listParam,
  selectedApplicationNames, selectedServiceNames, serviceOptionsQuery, servicesApiQuery,
  servicesUrlQuery, stateLabel, type ServiceState, type ServiceCatalog, type ServicesReport as Report,
} from "../../lib/system/services"

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

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick}
    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${active
      ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700"
      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"}`}>{children}</button>
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return <div><h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{label}</h3><div className="flex flex-wrap gap-2">{children}</div></div>
}

export function ServicesReport() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { platformFilter } = usePlatformFilterSafe()
  const current = searchParams.toString()
  const params = new URLSearchParams(current)
  const query = servicesApiQuery(params, platformFilter)
  const optionsKey = `${SERVICE_OPTIONS_API}?${serviceOptionsQuery(params, platformFilter)}`
  const hasQuery = !!(params.get("serviceNames") || params.get("service"))?.trim()
  const hasApplication = !!(params.get("applicationNames") || params.get("application"))?.trim()
  const [data, setData] = useState<Report | null>(null)
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null)
  const [loading, setLoading] = useState(hasQuery)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [expanded, setExpanded] = useState(!hasQuery)
  const [appPickerOpen, setAppPickerOpen] = useState(hasApplication)
  const [copied, setCopied] = useState(false)
  const searchValue = params.get("search") || ""
  const [deviceSearch, setDeviceSearch] = useState(searchValue)
  const serviceNames = selectedServiceNames(params, catalog)
  const applicationNames = selectedApplicationNames(params, catalog)
  const selectedVersions = listParam(params, "versions")
  const availableVersions = [...new Set((catalog?.applications || []).filter(a => applicationNames.includes(a.name)).flatMap(a => a.versions))]
    .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  const startupOptions = [...new Set((catalog?.services || []).filter(s => serviceNames.includes(s.name)).flatMap(s => s.startups))].sort()
  const options = catalog?.options || emptyOptions

  useEffect(() => {
    const controller = new AbortController()
    const cached = peekCached<ServiceCatalog>(optionsKey)
    setCatalog(cached || null)
    setOptionsLoading(!cached)
    setOptionsError(null)
    const run = async () => {
      try {
        const response = await trackedFetch(optionsKey, { cache: "no-store", signal: controller.signal })
        const body = await response.json()
        if (!response.ok || !Array.isArray(body.services) || !Array.isArray(body.applications)) throw new Error("Available report selections could not be loaded.")
        if (!controller.signal.aborted) setCatalog(rememberCached(optionsKey, body))
      } catch (err) {
        if (!controller.signal.aborted) setOptionsError(err instanceof Error ? err.message : "Service selections unavailable")
      } finally {
        if (!controller.signal.aborted) setOptionsLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [optionsKey, reload])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(hasQuery)
    setError(null)
    setData(null)
    if (!hasQuery) return () => controller.abort()
    const run = async () => {
      try {
        const response = await trackedFetch(`${SERVICES_API}?${query}`, { cache: "no-store", signal: controller.signal })
        const body = await response.json()
        if (!response.ok) throw new Error(typeof body.detail === "string" ? body.detail : "The services report could not be loaded.")
        if (!Array.isArray(body.devices) || typeof body.total !== "number") throw new Error("The server returned an incomplete services report.")
        if (!controller.signal.aborted) setData(body)
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Services report unavailable")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    run()
    return () => controller.abort()
  }, [query, reload, hasQuery])

  useEffect(() => { setDeviceSearch(searchValue) }, [searchValue])
  useEffect(() => {
    if (deviceSearch === searchValue) return
    const timer = setTimeout(() => router.replace(`/system?${servicesUrlQuery(current, { search: deviceSearch })}`, { scroll: false }), 250)
    return () => clearTimeout(timer)
  }, [deviceSearch, searchValue, current, router])

  const update = (patch: Record<string, string | null>) => {
    const next = servicesUrlQuery(current, patch)
    const nextParams = new URLSearchParams(next)
    if (!nextParams.get("serviceNames") && !nextParams.get("service")) setExpanded(true)
    router.push(`/system?${next}`, { scroll: false })
  }
  const toggle = (key: string, value: string) => {
    const selected = listParam(params, key)
    update({ [key]: (selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]).join(",") })
  }
  const chooseServices = (values: string[]) => update({ service: null, serviceNames: values.length ? JSON.stringify(values) : null })
  const chooseApplications = (values: string[]) => update({ application: null, applicationNames: values.length ? JSON.stringify(values) : null, versions: null })
  const toggleService = (value: string) => chooseServices(serviceNames.includes(value) ? serviceNames.filter(v => v !== value) : [...serviceNames, value])
  const toggleApplication = (value: string) => chooseApplications(applicationNames.includes(value) ? applicationNames.filter(v => v !== value) : [...applicationNames, value])
  const clearAll = () => {
    setDeviceSearch("")
    update(Object.fromEntries(SERVICE_PARAMS.map(key => [key, null])))
  }
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("platform", platformFilter === "Windows" ? "win" : platformFilter === "macOS" ? "mac" : "all")
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError("Could not copy the link. Copy this page's address instead.") }
  }
  const activeCount = serviceNames.length + applicationNames.length + selectedVersions.length +
    listParam(params, "states").length + listParam(params, "startups").length + listParam(params, "inventoryStates").length +
    (params.has("freshness") ? 1 : 0) + (params.has("maxAgeHours") ? 1 : 0) + (params.has("includeArchived") ? 1 : 0)
  const age = params.get("maxAgeHours") || "24"
  const freshness = params.get("freshness") || "all"
  const chips = [
    ...(params.get("service") ? [{ key: "legacyService", label: params.get("service")!, clear: () => update({ service: null }) }] :
      serviceNames.map(name => ({ key: `service-${name}`, label: catalog?.services.find(s => s.name === name)?.displayName || name, clear: () => toggleService(name) }))),
    ...(params.get("application") ? [{ key: "legacyApplication", label: params.get("application")!, clear: () => update({ application: null, versions: null }) }] :
      applicationNames.map(name => ({ key: `app-${name}`, label: name, clear: () => toggleApplication(name) }))),
    ...selectedVersions.map(version => ({ key: `version-${version}`, label: version, clear: () => toggle("versions", version) })),
  ]

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
      <div className="flex-1 page-container px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-3">
            <div><SystemViewSwitch current="services" /><p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Service coverage and installed versions across devices.</p></div>
            <div className="flex items-center gap-2"><button type="button" onClick={copyLink} className={button}>{copied ? "Copied" : "Copy link"}</button><button type="button" onClick={() => setReload(n => n + 1)} disabled={loading} className={button}>Refresh</button></div>
          </div>
          <div className="flex-1 overflow-auto min-h-0" aria-busy={loading}>
            <DeviceFilters filterOptions={{ ...options, statuses: [] }}
              selectedStatuses={[]} onStatusToggle={() => {}}
              selectedUsages={listParam(params, "usages")} onUsageToggle={v => toggle("usages", v)}
              selectedCatalogs={listParam(params, "catalogs")} onCatalogToggle={v => toggle("catalogs", v)}
              selectedAreas={listParam(params, "areas")} onAreaToggle={v => toggle("areas", v)}
              selectedFleets={listParam(params, "fleets")} onFleetToggle={v => toggle("fleets", v)}
              selectedLocations={listParam(params, "locations")} onLocationToggle={v => toggle("locations", v)}
              searchQuery="" onSearchChange={() => {}} onClearAll={clearAll}
              additionalActiveCount={activeCount} expanded={expanded} onToggle={() => setExpanded(v => !v)}>
              <div className="space-y-4 py-3 mb-4 border-b border-gray-200 dark:border-gray-700">
                <div className={`grid gap-6 ${appPickerOpen || hasApplication ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                  <ServiceSelectionCloud label="Services" options={(catalog?.services || []).map(s => ({ value: s.name, label: s.displayName || s.name, devices: s.devices }))} selected={serviceNames} onToggle={toggleService} onSelect={chooseServices} loading={optionsLoading} />
                  {(appPickerOpen || hasApplication) && <ServiceSelectionCloud label="Applications" options={(catalog?.applications || []).map(a => ({ value: a.name, label: a.name, devices: a.devices }))} selected={applicationNames} onToggle={toggleApplication} onSelect={chooseApplications} loading={optionsLoading} />}
                </div>
                {!appPickerOpen && !hasApplication && <button type="button" onClick={() => setAppPickerOpen(true)} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">Add application versions</button>}
                {hasApplication && <Choices label="Versions"><Choice active={selectedVersions.length === 0} onClick={() => update({ versions: null })}>All versions</Choice>{availableVersions.map(version => <Choice key={version} active={selectedVersions.includes(version)} onClick={() => toggle("versions", version)}>{version}</Choice>)}</Choices>}
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {startupOptions.length > 0 && <Choices label="Startup type"><Choice active={!params.get("startups")} onClick={() => update({ startups: null })}>All</Choice>{startupOptions.map(value => <Choice key={value} active={listParam(params, "startups").includes(value)} onClick={() => toggle("startups", value)}>{stateLabel(value)}</Choice>)}</Choices>}
                  <Choices label="Collection age">{([['all', 'All'], ['fresh', 'Within maximum age'], ['stale', 'Older'], ['unknown', 'Unknown']] as const).map(([value, label]) => <Choice key={value} active={freshness === value} onClick={() => update({ freshness: value === "all" ? null : value })}>{label}</Choice>)}</Choices>
                  <Choices label="Maximum collection age">{[...new Set(["24", "168", "720", age])].map(value => <Choice key={value} active={age === value} onClick={() => update({ maxAgeHours: value === "24" ? null : value })}>{value === "24" ? "24 hours" : value === "168" ? "7 days" : value === "720" ? "30 days" : `${value} hours`}</Choice>)}</Choices>
                  <Choices label="Inventory state"><Choice active={!params.get("inventoryStates")} onClick={() => update({ inventoryStates: null })}>All</Choice>{options.inventoryStates.map(value => <Choice key={value} active={listParam(params, "inventoryStates").includes(value)} onClick={() => toggle("inventoryStates", value)}>{inventoryLabel(value)}</Choice>)}</Choices>
                  <Choices label="Archive"><Choice active={params.get("includeArchived") === "true"} onClick={() => update({ includeArchived: params.get("includeArchived") === "true" ? null : "true" })}>Include archived</Choice></Choices>
                </div>
              </div>
            </DeviceFilters>
            {chips.length > 0 && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
              {chips.map(chip => <button type="button" key={chip.key} onClick={chip.clear} title={`Remove ${chip.label}`} className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800">{chip.label}<span aria-hidden="true">×</span></button>)}
              <button type="button" onClick={clearAll} className="text-xs text-red-600 dark:text-red-400 hover:underline ml-2">Clear selections</button>
            </div>}
            {(error || optionsError) && <div role="alert" className="mx-6 my-4 p-3 text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg">{error || optionsError}<button type="button" className="underline ml-2" onClick={() => setReload(n => n + 1)}>Retry</button></div>}
            {hasQuery && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-gray-600 dark:text-gray-400">{loading ? "Updating report…" : data ? `${data.total.toLocaleString()} devices` : ""}</span><input type="search" aria-label="Search devices" placeholder="Search devices…" value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-white" /></div>
              <div className="flex flex-wrap gap-2" aria-label="Service state filters"><Choice active={!params.get("states")} onClick={() => update({ states: null })}>All states</Choice>{SERVICE_STATES.map(state => <Choice key={state} active={listParam(params, "states").includes(state)} onClick={() => toggle("states", state)}>{stateLabel(state)}{data ? ` ${data.summary[state] || 0}` : ""}</Choice>)}</div>
            </div>}
            {!hasQuery ? <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"><p className="font-medium">Choose services from Selections to build your report.</p><p className="text-sm mt-2">Pick the collected services you want to compare. Results update as you select.</p></div>
              : loading ? <div role="status" className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading services report…</div>
              : data && <div className="overflow-x-auto">
<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-900/50"><tr>
                    {["Device", "Service state", "Matching services", ...(hasApplication ? ["Application versions"] : []), "Inventory", "Service collection", "Last seen"].map(label => <th scope="col" key={label} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{label}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-900 dark:text-gray-100">
                    {data.devices.length === 0 && <tr><td colSpan={hasApplication ? 7 : 6} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No devices match these filters.</td></tr>}
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
                      {hasApplication && <td className="px-4 py-3 min-w-[180px] max-w-xs">
                        <>
                          {device.applications.length ? device.applications.map((app, index) => <div key={index} className="mb-2"><div className="text-xs text-gray-500 dark:text-gray-400">{app.name}</div><div className="font-mono">{app.version || "Version not reported"}</div></div>) : <span className="text-gray-500 dark:text-gray-400">No matching application reported</span>}
                          <div className="text-xs text-gray-500 dark:text-gray-400"><When value={device.applicationsCollectedAt} />{device.applicationsFreshness !== "fresh" && ` · ${device.applicationsFreshness}`}</div>
                        </>
                      </td>}
                      <td className="px-4 py-3 whitespace-nowrap"><div>{inventoryLabel(device.inventoryState)}</div>{device.archived && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Archived in ReportMate</div>}<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{[device.catalog, device.usage, device.room].filter(Boolean).join(" · ")}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><When value={device.collectedAt} /><div className={`text-xs mt-1 ${device.freshness === "fresh" ? "text-gray-500 dark:text-gray-400" : "text-amber-700 dark:text-amber-300"}`}>{device.freshness === "fresh" ? "Within maximum age" : device.freshness === "stale" ? "Older than maximum age" : "Collection age unknown"}</div></td>
                      <td className="px-4 py-3 whitespace-nowrap"><When value={device.lastSeen} /></td>
                    </tr>)}
                  </tbody>
                </table>
              </div>}
          </div>
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Last collected local state; a running service does not prove vendor connectivity.</p>
            {hasQuery && data && <div className="flex items-center gap-3"><span className="text-xs text-gray-500 dark:text-gray-400">{data.devices.length ? data.offset + 1 : 0}–{data.devices.length ? data.offset + data.devices.length : 0} of {data.total}</span><button type="button" disabled={loading || data.offset === 0} className={button} onClick={() => update({ offset: String(Math.max(0, data.offset - data.limit)) })}>Previous</button><button type="button" disabled={loading || data.offset + data.limit >= data.total} className={button} onClick={() => update({ offset: String(data.offset + data.limit) })}>Next</button></div>}
          </div>
        </div>
      </div>
    </div>
  )
}

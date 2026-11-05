"use client"

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { usePlatformFilterSafe } from "../../providers/PlatformFilterProvider"
import DeviceFilters from "../shared/DeviceFilters"
import { SystemViewSwitch } from "./SystemViewSwitch"
import { ServiceSelectionCloud } from "./ServiceSelectionCloud"
import { peekCached, rememberCached, trackedFetch } from "../../lib/data-cache"
import { servicesCsv } from "../../lib/system/services-export"
import { fetchServicesReport } from "../../lib/system/services-request"
import {
  SERVICE_OPTIONS_API, SERVICE_PARAMS, SERVICE_STATES, inventoryLabel, listParam,
  selectedApplicationNames, selectedServiceNames, serviceOptionsQuery, servicesApiQuery,
  servicesUrlQuery, stateLabel, type ServiceCatalog, type ServicesReport as Report,
} from "../../lib/system/services"

import { ServicesTable } from "./ServicesTable"
import {
  CHECKIN_CHOICES, EVIDENCE_CHOICES, SERVICE_COLUMNS, SERVICE_VIEW_PARAMS, readServicesView, servicesViewRows,
  type ServiceColumn,
} from "../../lib/system/services-view"

const actionButton = "px-4 py-2 text-sm rounded-lg transition-colors whitespace-nowrap font-medium flex items-center gap-2 disabled:opacity-50"
const secondaryAction = `${actionButton} bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white`
const emptyOptions = { usages: [], catalogs: [], areas: [], fleets: [], locations: [], rooms: [], inventoryStates: [] }

function Choice({ active, onClick, children, disabled }: { active: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return <button type="button" aria-pressed={active} onClick={onClick} disabled={disabled}
    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${active
      ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-700"
      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"}`}>{children}</button>
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return <div role="group" aria-label={label}><h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">{label}</h3><div className="flex flex-wrap gap-2">{children}</div></div>
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
  const [pending, startTransition] = useTransition()
  const [data, setData] = useState<Report | null>(null)
  const view = useMemo(() => readServicesView(new URLSearchParams(current), hasApplication), [current, hasApplication])
  const rows = useMemo(() => data ? servicesViewRows(data.devices, data.generatedAt, view) : [], [data, view])
  const [catalog, setCatalog] = useState<ServiceCatalog | null>(null)
  const [loading, setLoading] = useState(hasQuery)
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [expanded, setExpanded] = useState(!hasQuery)
  const [appPickerOpen, setAppPickerOpen] = useState(hasApplication)
  const [copied, setCopied] = useState(false)
  const [loadProgress, setLoadProgress] = useState("")
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
    setLoadProgress("")
    setError(null)
    setData(null)
    if (!hasQuery) return () => controller.abort()
    const run = async () => {
      try {
        const body = await fetchServicesReport(query, controller.signal, (loaded, total) => {
          if (!controller.signal.aborted) setLoadProgress(`${loaded.toLocaleString()} of ${total.toLocaleString()} devices`)
        })
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
    startTransition(() => router.push(`/system?${next}`, { scroll: false }))
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
    update(Object.fromEntries([...SERVICE_PARAMS, ...SERVICE_VIEW_PARAMS].map(key => [key, null])))
  }
  const sortColumn = (column: ServiceColumn) => update({ sort: column, direction: view.sort === column && view.direction === "asc" ? "desc" : "asc" })
  const toggleColumn = (column: ServiceColumn) => {
    const columns = view.columns.includes(column) ? view.columns.filter(key => key !== column) : [...view.columns, column]
    update({ columns: columns.join(","), ...(columns.includes(view.sort) ? {} : { sort: null, direction: null }) })
  }
  const copyLink = async () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.set("platform", platformFilter === "Windows" ? "win" : platformFilter === "macOS" ? "mac" : "all")
      url.searchParams.delete("offset")
      await navigator.clipboard.writeText(url.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { setError("Could not copy the link. Copy this page's address instead.") }
  }
  const exportCsv = () => {
    if (!data) return
    try {
      const reportUrl = new URL(window.location.href)
      reportUrl.searchParams.set("platform", platformFilter === "Windows" ? "win" : platformFilter === "macOS" ? "mac" : "all")
      reportUrl.searchParams.delete("offset")
      const blob = new Blob(["\uFEFF", servicesCsv(rows, data.generatedAt, reportUrl.toString(), view.checkinAgeHours)], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `services-report-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch {
      setError("The report could not be exported. Please retry.")
    }
  }
  const activeCount = serviceNames.length + applicationNames.length + selectedVersions.length +
    listParam(params, "states").length + listParam(params, "startups").length + listParam(params, "inventoryStates").length +
    (params.has("freshness") ? 1 : 0) + (params.has("maxAgeHours") ? 1 : 0) + (params.has("includeArchived") ? 1 : 0) + (view.evidence !== "all" ? 1 : 0) + (view.checkin !== "all" ? 1 : 0)
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
            <div className="flex flex-wrap items-start gap-3">
              <button type="button" onClick={copyLink} disabled={pending} title="Copy a shareable link to this exact report" className={copied ? `${actionButton} bg-emerald-600 hover:bg-emerald-700 text-white` : secondaryAction}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={copied ? "M5 13l4 4L19 7" : "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"} /></svg>
                {copied ? "Link Copied" : "Copy Link"}
              </button>
              <button type="button" onClick={() => setReload(n => n + 1)} disabled={loading || pending} className={secondaryAction}>
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Refresh
              </button>
              {!loading && data && rows.length > 0 && <div className="flex flex-col items-start gap-1 max-w-xs"><button type="button" onClick={exportCsv} disabled={pending} aria-describedby="services-export-details" title="Export all fields for the filtered devices" className={`${actionButton} bg-emerald-600 hover:bg-emerald-700 text-white`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Export CSV
              </button><p id="services-export-details" className="text-xs text-gray-500 dark:text-gray-400">CSV includes all inventory and evidence fields, including hidden columns, for the filtered devices.</p></div>}
            </div>
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
                {hasApplication && <Choices label="Versions"><Choice disabled={pending} active={selectedVersions.length === 0} onClick={() => update({ versions: null })}>All versions</Choice>{availableVersions.map(version => <Choice disabled={pending} key={version} active={selectedVersions.includes(version)} onClick={() => toggle("versions", version)}>{version}</Choice>)}</Choices>}
                <div className="flex flex-wrap gap-x-8 gap-y-4">
                  {startupOptions.length > 0 && <Choices label="Startup type"><Choice disabled={pending} active={!params.get("startups")} onClick={() => update({ startups: null })}>All</Choice>{startupOptions.map(value => <Choice disabled={pending} key={value} active={listParam(params, "startups").includes(value)} onClick={() => toggle("startups", value)}>{stateLabel(value)}</Choice>)}</Choices>}
                  <Choices label="Service collection age">{([['all', 'All'], ['fresh', 'Within maximum age'], ['stale', 'Older'], ['unknown', 'Unknown']] as const).map(([value, label]) => <Choice disabled={pending} key={value} active={freshness === value} onClick={() => update({ freshness: value === "all" ? null : value })}>{label}</Choice>)}</Choices>
                  <Choices label="Maximum service collection age">{[...new Set(["24", "168", "720", age])].map(value => <Choice disabled={pending} key={value} active={age === value} onClick={() => update({ maxAgeHours: value === "24" ? null : value })}>{value === "24" ? "24 hours" : value === "168" ? "7 days" : value === "720" ? "30 days" : `${value} hours`}</Choice>)}</Choices>
                  <Choices label="Device check-in age">{CHECKIN_CHOICES.map(([value, label]) => <Choice disabled={pending} key={value} active={view.checkin === value} onClick={() => update({ checkin: value === "all" ? null : value })}>{label}</Choice>)}</Choices>
                  <Choices label="Maximum check-in age">{[...new Set([24, 168, 720, view.checkinAgeHours])].map(value => <Choice disabled={pending} key={value} active={view.checkinAgeHours === value} onClick={() => update({ checkinAgeHours: value === 168 ? null : String(value) })}>{value === 24 ? "24 hours" : value === 168 ? "7 days" : value === 720 ? "30 days" : `${value} hours`}</Choice>)}</Choices>
                  <Choices label="Inventory state"><Choice disabled={pending} active={!params.get("inventoryStates")} onClick={() => update({ inventoryStates: null })}>All</Choice>{options.inventoryStates.map(value => <Choice disabled={pending} key={value} active={listParam(params, "inventoryStates").includes(value)} onClick={() => toggle("inventoryStates", value)}>{inventoryLabel(value)}</Choice>)}</Choices>
                  <Choices label="Archive"><Choice disabled={pending} active={params.get("includeArchived") === "true"} onClick={() => update({ includeArchived: params.get("includeArchived") === "true" ? null : "true" })}>Include archived</Choice></Choices>
                </div>
              </div>
            </DeviceFilters>
            {chips.length > 0 && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-2">
              {chips.map(chip => <button type="button" key={chip.key} onClick={chip.clear} title={`Remove ${chip.label}`} className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800">{chip.label}<span aria-hidden="true">×</span></button>)}
              <button type="button" onClick={clearAll} className="text-xs text-red-600 dark:text-red-400 hover:underline ml-2">Clear selections</button>
            </div>}
            {(error || optionsError) && <div role="alert" className="mx-6 my-4 p-3 text-sm text-red-800 dark:text-red-200 bg-red-50 dark:bg-red-900/20 rounded-lg">{error || optionsError}<button type="button" className="underline ml-2" onClick={() => setReload(n => n + 1)}>Retry</button></div>}
            {hasQuery && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3"><span className="text-sm text-gray-600 dark:text-gray-400">{loading ? "Updating report…" : data ? `${rows.length.toLocaleString()} devices${rows.length !== data.total ? ` of ${data.total.toLocaleString()}` : ""}` : ""}</span><input type="search" aria-label="Search devices" placeholder="Search devices…" value={deviceSearch} onChange={e => setDeviceSearch(e.target.value)} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-white" /></div>
              <div className="flex flex-wrap gap-2" aria-label="Service state filters"><Choice disabled={pending} active={!params.get("states")} onClick={() => update({ states: null })}>All states</Choice>{SERVICE_STATES.map(state => <Choice disabled={pending} key={state} active={listParam(params, "states").includes(state)} onClick={() => toggle("states", state)}>{stateLabel(state)}{data && view.evidence === "all" && view.checkin === "all" ? ` ${data.summary[state] || 0}` : ""}</Choice>)}</div>
            </div>}
            {hasQuery && <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-start justify-between gap-4">
              <Choices label="Matching evidence">{EVIDENCE_CHOICES.filter(([key]) => hasApplication || key !== "applications").map(([value, label]) => <Choice disabled={pending} key={value} active={view.evidence === value} onClick={() => update({ evidence: value === "all" ? null : value })}>{label}</Choice>)}</Choices>
              <details className="text-sm text-gray-600 dark:text-gray-300 max-w-xl"><summary className="cursor-pointer py-1">Columns</summary>
                <div className="flex flex-wrap gap-2 mt-2" aria-label="Visible columns">{SERVICE_COLUMNS.filter(([key]) => key !== "deviceName" && (hasApplication || (key !== "applications" && key !== "applicationsCollectedAt"))).map(([key, label]) => <Choice disabled={pending} key={key} active={view.columns.includes(key)} onClick={() => toggleColumn(key)}>{label}</Choice>)}
                  <button type="button" className="text-xs text-blue-600 dark:text-blue-400 hover:underline" disabled={pending} onClick={() => update({ columns: null, sort: null, direction: null })}>Reset columns</button>
                </div>
              </details>
              {view.checkin !== "all" && <button type="button" onClick={() => update({ checkin: null })} className="text-xs text-blue-600 dark:text-blue-400">Check-in: {view.checkin} · {view.checkinAgeHours} hours ×</button>}
            </div>}
            {!hasQuery ? <div className="px-6 py-12 text-center text-gray-500 dark:text-gray-400"><p className="font-medium">Choose services from Selections to build your report.</p><p className="text-sm mt-2">Pick the collected services you want to compare. Results update as you select.</p></div>
              : loading ? <div role="status" className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">Loading services report…{loadProgress && ` ${loadProgress}`}</div>
              : data && <ServicesTable devices={rows} generatedAt={data.generatedAt} view={view} onSort={sortColumn} pending={pending} />}
          </div>
          <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Last collected local state; matching evidence can be stale. Device check-in is ReportMate activity. A running service does not prove vendor connectivity.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

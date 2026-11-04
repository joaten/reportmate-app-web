"use client"

import Link from "next/link"
import { formatExactTime, formatRelativeTime } from "../../lib/time"
import { inventoryLabel, stateLabel, type ServiceDevice, type ServiceState } from "../../lib/system/services"
import { checkinAgeHours, SERVICE_COLUMNS, type ServiceColumn, type ServicesView } from "../../lib/system/services-view"

function When({ value }: { value: string | null }) {
  return value ? <time dateTime={value} title={formatExactTime(value)}>{formatRelativeTime(value)}</time> : <span className="text-gray-400">Unknown</span>
}

function Badge({ state }: { state: ServiceState }) {
  const color = state === "running" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
    : state === "stopped" || state === "missing" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
    : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{stateLabel(state)}</span>
}

function Cell({ device, column, generatedAt }: { device: ServiceDevice; column: ServiceColumn; generatedAt: string }) {
  switch (column) {
    case "deviceName": return <>
        <Link href={`/device/${encodeURIComponent(device.serialNumber)}?tab=system`} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">{device.deviceName}</Link>
        {device.hostname && device.hostname !== device.deviceName && <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">{device.hostname}</div>}
        <div className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-1">{device.serialNumber}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{device.assetTag} {device.platform}</div>
      </>
    case "state": return <><Badge state={device.state} />
        {device.state === "unknown" && device.services.length > 0 && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Last reported: {stateLabel(device.reportedState)}</div>}
      </>
    case "services": return <>
        {device.services.length ? <div className="space-y-2">{device.services.map((service, index) => <div key={`${service.name}-${index}`}>
          <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs break-all">{service.name || service.displayName || "Unnamed service"}</span><span className="text-xs text-gray-500 dark:text-gray-400">{service.status || "Unknown state"}</span></div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{service.startType || (service.type ? `${service.type}${service.onDemand ? " · on demand" : ""}` : "Startup type unknown")}</div>
        </div>)}
          <details className="text-xs text-gray-500 dark:text-gray-400"><summary className="cursor-pointer">Executable paths</summary>{device.services.map((service, index) => <p key={index} className="font-mono break-all mt-1">{service.path || "Not reported"}</p>)}</details>
        </div> : <span className="text-gray-500 dark:text-gray-400">{device.state === "missing" ? "Not found in service inventory" : "No matching service reported; coverage unknown"}</span>}
      </>
    case "applications": return <>
          {device.applications.length ? device.applications.map((app, index) => <div key={index} className="mb-2"><div className="text-xs text-gray-500 dark:text-gray-400">{app.name}</div><div className="font-mono">{app.version || "Version not reported"}</div></div>) : <span className="text-gray-500 dark:text-gray-400">No matching application reported</span>}
          <div className="text-xs text-gray-500 dark:text-gray-400"><When value={device.applicationsCollectedAt} />{device.applicationsFreshness !== "fresh" && ` · ${device.applicationsFreshness}`}</div>
      </>
    case "inventoryState": return <><div>{inventoryLabel(device.inventoryState)}</div>{device.archived && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Archived in ReportMate</div>}<div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{[device.catalog, device.usage, device.room].filter(Boolean).join(" · ")}</div></>
    case "collectedAt": return <><When value={device.collectedAt} /><div className={`text-xs mt-1 ${device.freshness === "fresh" ? "text-gray-500 dark:text-gray-400" : "text-amber-700 dark:text-amber-300"}`}>{device.freshness === "fresh" ? "Within maximum age" : device.freshness === "stale" ? "Older than maximum age" : "Collection age unknown"}</div></>
    case "lastSeen": return <><When value={device.lastSeen} /></>
    case "applicationsCollectedAt": return <><When value={device.applicationsCollectedAt} /><div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{device.applicationsFreshness}</div></>
    case "checkinAge": {
      const hours = checkinAgeHours(device.lastSeen, generatedAt)
      return hours === null ? <span className="text-gray-400">Unknown</span> : <span title={`${hours.toFixed(2)} hours at report generation`}>{hours < 24 ? `${Math.floor(hours)} hours` : `${Math.floor(hours / 24)} days`}</span>
    }
    default: return <>{device[column] || <span className="text-gray-400">Not reported</span>}</>
  }
}

export function ServicesTable({ devices, generatedAt, view, onSort, pending }: {
  devices: ServiceDevice[]; generatedAt: string; view: ServicesView; onSort: (column: ServiceColumn) => void; pending: boolean
}) {
  return <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
    <thead className="bg-gray-50 dark:bg-gray-900/50"><tr>{view.columns.map(column => {
      const label = SERVICE_COLUMNS.find(([key]) => key === column)![1]
      const active = view.sort === column
      return <th key={column} scope="col" aria-sort={active ? (view.direction === "asc" ? "ascending" : "descending") : "none"}
        className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
        <button type="button" onClick={() => onSort(column)} disabled={pending} className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white">
          {label}<span aria-hidden="true">{active ? view.direction === "asc" ? "↑" : "↓" : "↕"}</span>
        </button>
      </th>
    })}</tr></thead>
    <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-sm text-gray-900 dark:text-gray-100">
      {devices.length === 0 && <tr><td colSpan={view.columns.length} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">No devices match these filters.</td></tr>}
      {devices.map(device => <tr key={device.serialNumber} className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/30">
        {view.columns.map(column => <td key={column} className={`px-4 py-3 ${column === "services" || column === "applications" ? "min-w-[230px] max-w-md" : column === "deviceName" ? "min-w-[190px]" : "whitespace-nowrap"}`}>
          <Cell device={device} column={column} generatedAt={generatedAt} />
        </td>)}
      </tr>)}
    </tbody>
  </table></div>
}

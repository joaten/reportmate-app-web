"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePlatformFilterSafe, normalizePlatform } from '../../providers/PlatformFilterProvider'
import { fetchArcticWolfReport } from '../../lib/security/arcticWolfRequest'
import { WOLF_COLUMNS, wolfCsv, wolfTime, wolfValues, type WolfRow } from '../../lib/security/arcticWolf'

const control = 'rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-white'

export function ArcticWolfReport() {
  const { platformFilter } = usePlatformFilterSafe()
  const [data, setData] = useState<WolfRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [search, setSearch] = useState('')
  const [active, setActive] = useState('all')
  const [reporting, setReporting] = useState('all')
  const [sort, setSort] = useState<{ column: number; descending: boolean }>({ column: 0, descending: false })
  const platform = platformFilter === 'macOS' ? 'mac' : platformFilter === 'Windows' ? 'win' : 'all'

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)
    fetchArcticWolfReport(controller.signal).then(rows => {
      if (!controller.signal.aborted) setData(rows)
    }).catch(reason => {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The report could not be loaded.')
    })
    return () => controller.abort()
  }, [reload])

  const scoped = useMemo(() => (data || []).filter(row => platformFilter === 'all' || normalizePlatform(row.platform) === platformFilter), [data, platformFilter])
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = scoped.filter(row => (active === 'all' || row.active === active) &&
      (reporting === 'all' || row.reporting === reporting) &&
      (!query || wolfValues(row).some(value => String(value).toLowerCase().includes(query))))
    return filtered.sort((a, b) => {
      const column = sort.column
      const raw = (r: WolfRow) => column === 5 ? r.lastSeen : column === 6 ? r.collectedAt : column === 11 ? r.ageDays : wolfValues(r)[column]
      const av = raw(a), bv = raw(b)
      if (av === null) return bv === null ? 0 : 1
      if (bv === null) return -1
      const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true })
      return (sort.descending ? -1 : 1) * comparison
    })
  }, [scoped, search, active, reporting, sort])

  const download = () => {
    const blob = new Blob(['\uFEFF', wolfCsv(rows)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `arctic-wolf-devices-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black flex flex-col">
    <div className="page-container w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col flex-1 min-h-0">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 space-y-4">
          <nav aria-label="Security reports" className="flex flex-wrap items-center gap-4 text-sm">
            <Link href={`/security?platform=${platform}`} className="text-blue-600 dark:text-blue-400 hover:underline">Fleet Security</Link>
            <span className="font-semibold text-gray-900 dark:text-white" aria-current="page">Arctic Wolf Inventory</span>
            <Link href={`/system?tab=services&service=arctic&platform=${platform}`} className="text-blue-600 dark:text-blue-400 hover:underline">Arctic Wolf Services</Link>
          </nav>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Arctic Wolf Inventory</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Reported software components and versions across Mac and Windows devices.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setReload(value => value + 1)} className={control}>Refresh</button>
              <button type="button" onClick={download} disabled={data === null || !!error} className={`${control} disabled:opacity-50`}>Export CSV</button>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Check-ins are from ReportMate, not Arctic Wolf. App and package entries do not confirm a running or healthy agent. Active means checked out in inventory; stale means no ReportMate check-in within 7 days.</p>
          {data !== null && <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            <span><strong>{rows.length}</strong> shown of {scoped.length} devices</span>
            <span>{scoped.filter(row => row.active === 'Yes').length} active</span>
            <span>{scoped.filter(row => row.reporting === 'Reporting (within 7 days)').length} recently reporting</span>
            <span>{scoped.filter(row => row.detection.startsWith('Package entry')).length} package entry only</span>
            {data[0] && <span>As of {wolfTime(data[0].asOf)} · America/Vancouver</span>}
          </div>}
          <div className="flex flex-wrap gap-3">
            <input aria-label="Search Arctic Wolf inventory" placeholder="Search devices, versions, department…" value={search} onChange={event => setSearch(event.target.value)} className={`${control} min-w-64 flex-1`} />
            <select aria-label="Active device status" value={active} onChange={event => setActive(event.target.value)} className={control}>
              <option value="all">All inventory states</option><option value="Yes">Active</option><option value="No">In storage</option><option value="Unknown">Activity unknown</option>
            </select>
            <select aria-label="Reporting status" value={reporting} onChange={event => setReporting(event.target.value)} className={control}>
              <option value="all">All reporting statuses</option>
              {['Reporting (within 7 days)', 'Stale (over 7 days)', 'No check-in recorded', 'Check-in timestamp is in the future'].map(value => <option key={value}>{value}</option>)}
            </select>
          </div>
        </div>
        {error ? <div role="alert" className="p-6 text-red-700 dark:text-red-300">{error}</div> : data === null ? <div role="status" className="p-6 text-gray-500">Loading Arctic Wolf inventory…</div> :
          <div className="flex-1 overflow-auto min-h-0" tabIndex={0} aria-label="Arctic Wolf inventory table">
            <table className="w-full text-sm whitespace-nowrap">
              <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300">
                <tr>{WOLF_COLUMNS.map((column, index) => <th key={column} scope="col" className="px-4 py-3 text-left" aria-sort={sort.column === index ? sort.descending ? 'descending' : 'ascending' : 'none'}>
                  <button type="button" onClick={() => setSort({ column: index, descending: sort.column === index && !sort.descending })}>{column}{sort.column === index ? sort.descending ? ' ↓' : ' ↑' : ''}</button>
                </th>)}</tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
                {rows.map(row => <tr key={row.serial} className="hover:bg-gray-50 dark:hover:bg-gray-700/40">
                  {wolfValues(row).map((value, index) => <td key={WOLF_COLUMNS[index]} className={`px-4 py-3 align-top ${index === 4 ? 'whitespace-normal min-w-80 max-w-lg' : ''}`}>
                    {index === 0 ? <Link href={`/device/${encodeURIComponent(row.serial)}#security`} className="text-blue-600 dark:text-blue-400 hover:underline">{value}</Link> : value === '' ? '—' : value}
                  </td>)}
                </tr>)}
                {!rows.length && <tr><td colSpan={WOLF_COLUMNS.length} className="p-8 text-center text-gray-500">{scoped.length ? 'No devices match these filters.' : 'No Arctic Wolf components reported in this platform selection. This does not establish that background agents are absent.'}</td></tr>}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  </div>
}

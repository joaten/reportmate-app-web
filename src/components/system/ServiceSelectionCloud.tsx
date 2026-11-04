"use client"

import { useState } from "react"

export interface SelectionOption { value: string; label: string; devices?: number }

export function ServiceSelectionCloud({ label, options, selected, onToggle, onSelect, loading = false }: {
  label: string
  options: SelectionOption[]
  selected: string[]
  onToggle: (value: string) => void
  onSelect: (values: string[]) => void
  loading?: boolean
}) {
  const [search, setSearch] = useState("")
  const query = search.toLowerCase().trim()
  const visible = options.filter(o => !query || `${o.label} ${o.value}`.toLowerCase().includes(query))
  const displayed = visible.slice(0, 150)
  const selectResults = [...new Set([...selected, ...visible.map(o => o.value)])]
  return (
    <section aria-label={label}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}{selected.length > 0 && ` (${selected.length} selected)`}</h3>
        <div className="flex gap-2">
          {query && visible.length > 0 && <button type="button" disabled={JSON.stringify(selectResults).length > 7500} onClick={() => onSelect(selectResults)} className="px-2 py-1 text-xs rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200 disabled:opacity-40">Select {visible.length} results</button>}
          {selected.length > 0 && <button type="button" onClick={() => onSelect([])} className="px-2 py-1 text-xs rounded-lg bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-200">Clear</button>}
        </div>
      </div>
      <input type="search" aria-label={`Search ${label.toLowerCase()}`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)}
        className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
      {!loading && visible.length > displayed.length && <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">Showing {displayed.length} of {visible.length.toLocaleString()} choices. Search to narrow the list.</p>}
      <div className="min-h-24 max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-800">
        <div className="flex flex-wrap gap-1">
          {loading ? <span role="status" className="text-sm text-gray-500 p-2">Loading available {label.toLowerCase()}…</span> : displayed.map(option => {
            const active = selected.includes(option.value)
            return <button type="button" key={option.value} aria-pressed={active} title={option.value} onClick={() => onToggle(option.value)}
              className={`px-2 py-1 text-xs rounded-full border transition-colors ${active
                ? "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-600"
                : "bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-500 dark:hover:bg-gray-600"}`}>
              {option.label}{option.devices !== undefined && <span className="ml-1 opacity-60">{option.devices}</span>}
            </button>
          })}
          {!loading && visible.length === 0 && <span className="text-sm text-gray-500 dark:text-gray-400 p-2">{query ? "No matching choices." : "No choices reported in this scope."}</span>}
        </div>
      </div>
    </section>
  )
}

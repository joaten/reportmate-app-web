'use client'

import { useState, type ReactNode } from 'react'
import { CollapsibleSection } from '../ui/CollapsibleSection'

// Inventory YAMLs occasionally ship values with trailing commas/semicolons
// (e.g. "Foundation Studio,"). Strip them so pills don't render the punctuation.
const cleanLabel = (s: string) => s.replace(/[,;]+\s*$/, '').trim()

export interface FilterOptions {
  statuses: string[]
  catalogs: string[]
  areas: string[]
  locations: string[]
  fleets: string[]
  usages: string[]
}

interface DeviceFiltersProps {
  children?: ReactNode
  additionalActiveCount?: number
  filterOptions: FilterOptions
  selectedStatuses: string[]
  selectedCatalogs: string[]
  selectedAreas: string[]
  selectedLocations: string[]
  selectedFleets: string[]
  selectedUsages: string[]
  onStatusToggle: (status: string) => void
  onCatalogToggle: (catalog: string) => void
  onAreaToggle: (area: string) => void
  onLocationToggle: (location: string) => void
  onFleetToggle: (fleet: string) => void
  onUsageToggle: (usage: string) => void
  /** When provided, renders a Clear button in the accordion header that resets every dimension at once. */
  onClearAll?: () => void
  searchQuery: string
  onSearchChange: (query: string) => void
  /** Optional external control of expanded state (for scroll-collapse integration) */
  expanded?: boolean
  /** Optional callback when expanded state is toggled from within */
  onToggle?: () => void
  /** Optional device count per location for proportional sizing */
  locationCounts?: Record<string, number>
}

export default function DeviceFilters({
  children,
  additionalActiveCount = 0,
  filterOptions,
  selectedStatuses,
  selectedCatalogs,
  selectedAreas,
  selectedLocations,
  selectedFleets,
  selectedUsages,
  onStatusToggle,
  onCatalogToggle,
  onAreaToggle,
  onLocationToggle,
  onFleetToggle,
  onUsageToggle,
  onClearAll,
  expanded: externalExpanded,
  onToggle,
  locationCounts
}: DeviceFiltersProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const filtersExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded
  const setFiltersExpanded = (val: boolean) => setInternalExpanded(val)

  const totalActiveFilters = additionalActiveCount + selectedStatuses.length + selectedCatalogs.length + selectedAreas.length +
    selectedLocations.length + selectedFleets.length + selectedUsages.length

  return (
    <div className="border-b border-gray-200 dark:border-gray-700">
      {/* Accordion Header */}
      <button
        onClick={() => onToggle ? onToggle() : setFiltersExpanded(!filtersExpanded)}
        className="w-full px-6 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Selections</span>
          {totalActiveFilters > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
              {totalActiveFilters} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {totalActiveFilters > 0 && onClearAll && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.stopPropagation(); onClearAll() }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onClearAll() } }}
              className="px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 cursor-pointer transition-colors"
              title="Clear all selections"
            >
              Clear
            </span>
          )}
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${filtersExpanded ? 'rotate-90' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>
      
      {/* Accordion Content */}
      <CollapsibleSection expanded={filtersExpanded}>
        <div className="px-6 pb-4">
          {children}
          {/* Top row: short-pill dimensions share a single line. Catalog grows to fill the
              empty space to the right of Status/Usage (which have only 2-3 pills each). */}
          <div className="flex flex-wrap gap-x-8 gap-y-4">
            {/* Status Filter - When available */}
            {filterOptions.statuses.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Status</div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.statuses.map(status => {
                    const isSelected = selectedStatuses.some(s => s.toLowerCase() === status.toLowerCase())
                    return (
                      <button
                        key={status}
                        onClick={() => onStatusToggle(status)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                          isSelected
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Usage Filter - When available */}
            {filterOptions.usages.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Usage</div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.usages.map(usage => {
                    const isSelected = selectedUsages.some(s => s.toLowerCase() === usage.toLowerCase())
                    return (
                      <button
                        key={usage}
                        onClick={() => onUsageToggle(usage)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                          isSelected
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {usage}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Catalog Filter - flex-1 fills the remaining row width so its 6 pills sit on one line */}
            {filterOptions.catalogs.length > 0 && (
              <div className="flex-1 min-w-[260px]">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Catalog</div>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.catalogs.map(catalog => {
                    const isSelected = selectedCatalogs.some(s => s.toLowerCase() === catalog.toLowerCase())
                    return (
                      <button
                        key={catalog}
                        onClick={() => onCatalogToggle(catalog)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                          isSelected
                            ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {catalog}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Fleet Filter - Full width row (labels are long, e.g. "Digital Output Centre Print Room") */}
          {filterOptions.fleets.length > 0 && (() => {
            const dedupedFleets = Array.from(new Set(filterOptions.fleets.map(cleanLabel).filter(Boolean))).sort()
            return (
              <div className="mt-4">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Fleet</div>
                <div className="flex flex-wrap gap-2">
                  {dedupedFleets.map(fleet => {
                    const isSelected = selectedFleets.some(s => cleanLabel(s).toLowerCase() === fleet.toLowerCase())
                    return (
                      <button
                        key={fleet}
                        onClick={() => onFleetToggle(fleet)}
                        className={`px-3 py-1 text-xs font-medium rounded-full border whitespace-nowrap transition-colors ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200 border-indigo-300 dark:border-indigo-700'
                            : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                        }`}
                      >
                        {fleet}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Area Filter - Full width row above Location */}
          {filterOptions.areas.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Area</div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.areas.map(area => {
                  const isSelected = selectedAreas.some(s => s.toLowerCase() === area.toLowerCase())
                  return (
                    <button
                      key={area}
                      onClick={() => onAreaToggle(area)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                        isSelected
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {area}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Location Filter - Full width due to many options */}
          {filterOptions.locations.length > 0 && (
            <div className="mt-4">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Location</div>
              <div className="flex flex-wrap gap-2 items-center max-h-32 overflow-y-auto">
                {filterOptions.locations.map(location => {
                  const count = locationCounts?.[location] ?? 0
                  const maxCount = locationCounts ? Math.max(...Object.values(locationCounts), 1) : 1
                  // Scale from 0-1 based on device count relative to max
                  const scale = locationCounts ? count / maxCount : 0
                  // Map to size classes: text-xs (base), text-sm, text-base, text-lg
                  const sizeClass = !locationCounts ? 'px-3 py-1 text-xs'
                    : scale > 0.7 ? 'px-4 py-1.5 text-sm font-semibold'
                    : scale > 0.3 ? 'px-3 py-1 text-xs font-medium'
                    : 'px-2.5 py-0.5 text-[11px]'
                  const isSelected = selectedLocations.some(s => s.toLowerCase() === location.toLowerCase())
                  return (
                    <button
                      key={location}
                      onClick={() => onLocationToggle(location)}
                      className={`rounded-full border transition-colors ${sizeClass} ${
                        isSelected
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                      title={locationCounts ? `${location} (${count} device${count !== 1 ? 's' : ''})` : location}
                    >
                      {location}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>


    </div>
  )
}

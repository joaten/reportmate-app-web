"use client"

export const dynamic = 'force-dynamic'

import { useEffect, useMemo, useRef, useState, Suspense } from "react"
import Link from "next/link"
import { SystemViewSwitch } from "@/src/components/system/SystemViewSwitch"
import { ServicesReport } from "@/src/components/system/ServicesReport"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { formatRelativeTime } from "@/src/lib/time"
import { OSVersionPieChart } from "@/src/lib/modules/graphs/OSVersionPieChart"
import { EditionDonutChart } from "@/src/lib/modules/graphs/EditionDonutChart"
import { ActivationComplianceChart } from "@/src/lib/modules/graphs/ActivationComplianceChart"
import { UptimeDistributionChart } from "@/src/lib/modules/graphs/UptimeDistributionChart"
import { PendingUpdatesChart } from "@/src/lib/modules/graphs/PendingUpdatesChart"
import { LicenseSourceChart } from "@/src/lib/modules/graphs/LicenseSourceChart"
import { useDeviceData } from "@/src/hooks/useDeviceData"
import { cachedAt, peekCached } from "@/src/lib/data-cache"
import { RefreshErrorBanner } from "@/src/components/ui/RefreshErrorBanner"
import { usePlatformFilterSafe, normalizePlatform } from "@/src/providers/PlatformFilterProvider"
import { CollapsibleSection } from "@/src/components/ui/CollapsibleSection"
import { useScrollCollapse } from "@/src/hooks/useScrollCollapse"
import DeviceFilters, { FilterOptions } from "@/src/components/shared/DeviceFilters"
import { calculateDeviceStatus, type InventoryState } from "@/src/lib/data-processing"
import { InstalledUpdate, matchesSystemSearch, updatesToDisplay } from "@/src/lib/system/installedUpdates"
import { osCurrency, paramList, uptimeBucketKey, pendingBucketKey, hasDeferredUpdates, UPTIME_KEYS, PENDING_KEYS } from "@/src/lib/dashboard/reportRules"
import { SkeletonTimeout } from "@/src/components/ui/SkeletonTimeout"
import { csvCell } from "@/src/lib/csv"

interface SystemDevice {
  id: string
  deviceId: string
  deviceName: string
  serialNumber: string
  assetTag?: string
  lastSeen: string
  inventoryState?: InventoryState | null
  collectedAt: string
  usage?: string
  catalog?: string
  location?: string
  operatingSystem: string
  osVersion: string | null
  buildNumber: string | null
  uptime: number | null
  bootTime: string | null
  servicesCount: number
  updatesCount: number
  installedUpdates?: InstalledUpdate[]
  tasksCount: number
  // Enriched fields from backend
  platform?: string
  architecture?: string
  edition?: string
  displayVersion?: string
  locale?: string
  timeZone?: string
  keyboardLayout?: string
  installDate?: string
  featureUpdate?: string
  activationStatus?: boolean | null
  licenseType?: string
  licenseSource?: string
  hasFirmwareLicense?: boolean | null
  uptimeString?: string
  pendingUpdatesCount?: number
  deferredUpdatesCount?: number
  loginItemsCount?: number
  extensionsCount?: number
  kernelExtensionsCount?: number
}

function LoadingSkeleton() {
  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
      <div className="flex-1 page-container px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-h-0 overflow-hidden animate-pulse">
          {/* Title Section Skeleton */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-5 w-56 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            </div>
          </div>

          {/* Skeleton Selections Accordion Header */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="w-full px-6 py-3 flex items-center justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
              <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>

          {/* Skeleton Widgets Accordion Header */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="w-full px-6 py-3 flex items-center justify-between">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
              <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>

          {/* Skeleton Widgets Content */}
          <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 space-y-6">
            {/* Row 1: OS Version Charts (2-up) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[0, 1].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 ${i === 0 ? 'bg-blue-100 dark:bg-blue-900' : 'bg-red-100 dark:bg-red-900'} rounded-lg`}></div>
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-5"></div>
                        <div className="w-8 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 2: Edition + Activation + License Source (3-up) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[0, 1, 2].map(i => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                  <div className="p-4 flex items-center justify-center">
                    <div className="w-28 h-28 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 3: Uptime (full width) */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg"></div>
                  <div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {[...Array(4)].map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-5"></div>
                    <div className="w-8 h-3 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Search Section Skeleton */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="h-9 w-full bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>

          {/* Table Skeleton */}
          <div className="flex-1 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Device', 'OS', 'Version', 'Uptime', 'Last Seen'].map(h => (
                    <th key={h} className="px-4 py-3">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded" style={{ width: h === 'Device' ? '3rem' : '2.5rem' }}></div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {[...Array(10)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="px-4 py-4"><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                    <td className="px-4 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  
  if (days > 0) {
    return `${days}d ${hours}h`
  } else if (hours > 0) {
    return `${hours}h ${mins}m`
  } else {
    return `${mins}m`
  }
}

const macOSNames: Record<number, string> = {
  26: 'Tahoe', 15: 'Sequoia', 14: 'Sonoma', 13: 'Ventura',
  12: 'Monterey', 11: 'Big Sur',
}

function getOSDisplayName(sys: SystemDevice): string {
  const platform = sys.platform || ''
  const osName = sys.operatingSystem || ''
  
  if (platform === 'macOS' || osName.toLowerCase().includes('mac')) {
    const major = parseInt((sys.osVersion || '').split('.')[0], 10)
    const codename = macOSNames[major]
    return codename ? `macOS ${major} ${codename}` : `macOS ${major || ''}`
  }
  
  // Windows: extract major version (10, 11) and displayVersion (25H2, 24H2)
  const winMatch = osName.match(/Windows\s+(\d+)/)
  const winVer = winMatch ? winMatch[1] : ''
  const displayVer = sys.displayVersion || ''
  if (winVer && displayVer) return `Windows ${winVer} ${displayVer}`
  if (winVer) return `Windows ${winVer}`
  return osName || 'Unknown'
}

function SystemPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { platformFilter: globalPlatformFilter, isPlatformVisible } = usePlatformFilterSafe()
  // useDeviceData caches /api/v1/system; with it cached, skip the skeleton.
  const [loading, setLoading] = useState(() => peekCached('/api/v1/system') === undefined)
  const [systems, setSystems] = useState<SystemDevice[]>(() => peekCached<SystemDevice[]>('/api/v1/system') ?? [])
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '')
  // OS version filter, set from ?osVersion= or by clicking a version in the charts
  const [osVersionFilter, setOsVersionFilter] = useState<string | null>(searchParams.get('osVersion'))
  // Dashboard deep-link filters with no widget of their own: ?deferred=1,
  // ?os=unsupported|windows10 and ?patch=behind. Shown as removable pills by the search box.
  const [deferredOnly, setDeferredOnly] = useState(false)
  const [osCurrencyFilters, setOsCurrencyFilters] = useState<string[]>([])
  const [patchFilters, setPatchFilters] = useState<string[]>([])

  const [activationFilter, setActivationFilter] = useState('all')
  const [firmwareLicenseFilter, setFirmwareLicenseFilter] = useState('all')
  
  // Loading progress state (for progress bar)
  const [, setLoadingProgress] = useState({ current: 0, total: 0 })
  const [, setLoadingMessage] = useState<string>('')
  
  // Filters accordion state
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedUsages, setSelectedUsages] = useState<string[]>([])
  const [selectedCatalogs, setSelectedCatalogs] = useState<string[]>([])
  const [selectedLocations, setSelectedLocations] = useState<string[]>([])
  const [selectedAreas, setSelectedAreas] = useState<string[]>([])
  const [selectedFleets, setSelectedFleets] = useState<string[]>([])
  const [selectedEditions, setSelectedEditions] = useState<string[]>([])
  const [selectedActivationStatus, setSelectedActivationStatus] = useState<string[]>([])
  const [selectedLicenseType, setSelectedLicenseType] = useState<string[]>([])
  const [selectedArchitectures, setSelectedArchitectures] = useState<string[]>([])
  const [selectedTimeZones, setSelectedTimeZones] = useState<string[]>([])
  const [selectedUptimeBuckets, setSelectedUptimeBuckets] = useState<string[]>([])
  const [selectedLicenseSources, setSelectedLicenseSources] = useState<string[]>([])
  const [selectedPendingBuckets, setSelectedPendingBuckets] = useState<string[]>([])
  
  // Widgets accordion state
  const [widgetsExpanded, setWidgetsExpanded] = useState(true)

  useEffect(() => {
    if (searchQuery.trim()) setWidgetsExpanded(false)
  }, [searchQuery])

  const { tableContainerRef, effectiveFiltersExpanded, effectiveWidgetsExpanded } = useScrollCollapse(
    { filters: filtersExpanded, widgets: widgetsExpanded },
    { enabled: !loading }
  )
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<'device' | 'os' | 'version' | 'updates' | 'edition' | 'activation' | 'uptime' | 'lastSeen'>('device')
  const isWindowsOnly = globalPlatformFilter === 'Windows'
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  
  const handleSort = (column: typeof sortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      setSortDirection('asc')
    }
  }

  // Toggle functions for filters
  const toggleUsage = (usage: string) => {
    setSelectedUsages(prev => 
      prev.includes(usage) ? prev.filter(u => u !== usage) : [...prev, usage]
    )
  }
  
  const toggleCatalog = (catalog: string) => {
    setSelectedCatalogs(prev => 
      prev.includes(catalog) ? prev.filter(c => c !== catalog) : [...prev, catalog]
    )
  }
  
  const toggleLocation = (location: string) => {
    setSelectedLocations(prev =>
      prev.includes(location) ? prev.filter(l => l !== location) : [...prev, location]
    )
  }

  // Status is derived from lastSeen, the same rule every other report uses
  const statusOf = (d: { lastSeen?: string; inventoryState?: InventoryState | null }) =>
    calculateDeviceStatus(d.lastSeen, {}, false, d.inventoryState)

  const toggleStatus = (status: string) => {
    setSelectedStatuses(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
  }

  const toggleArea = (area: string) => {
    setSelectedAreas(prev =>
      prev.includes(area) ? prev.filter(a => a !== area) : [...prev, area]
    )
  }

  const toggleFleet = (fleet: string) => {
    setSelectedFleets(prev =>
      prev.includes(fleet) ? prev.filter(f => f !== fleet) : [...prev, fleet]
    )
  }

  const toggleEdition = (edition: string) => {
    setSelectedEditions(prev => 
      prev.includes(edition) ? prev.filter(e => e !== edition) : [...prev, edition]
    )
    setWidgetsExpanded(false)
  }
  
  const toggleActivationStatus = (status: string) => {
    setSelectedActivationStatus(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    )
    setWidgetsExpanded(false)
  }
  
  const toggleUptimeBucket = (bucket: string) => {
    setSelectedUptimeBuckets(prev =>
      prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]
    )
    setWidgetsExpanded(false)
  }
  
  const toggleLicenseSource = (source: string) => {
    setSelectedLicenseSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    )
    setWidgetsExpanded(false)
  }
  
  const togglePendingBucket = (bucket: string) => {
    setSelectedPendingBuckets(prev =>
      prev.includes(bucket) ? prev.filter(b => b !== bucket) : [...prev, bucket]
    )
    setWidgetsExpanded(false)
  }
  
  const clearAllFilters = () => {
    setSelectedStatuses([])
    setSelectedUsages([])
    setSelectedCatalogs([])
    setSelectedLocations([])
    setSelectedAreas([])
    setSelectedFleets([])
    setSelectedEditions([])
    setSelectedActivationStatus([])
    setSelectedLicenseType([])
    setSelectedArchitectures([])
    setSelectedTimeZones([])
    setSelectedUptimeBuckets([])
    setSelectedLicenseSources([])
    setSelectedPendingBuckets([])
    setActivationFilter('all')
    setFirmwareLicenseFilter('all')
    setSearchQuery('')
    setOsVersionFilter(null)
    setDeferredOnly(false)
    setOsCurrencyFilters([])
    setPatchFilters([])
    setWidgetsExpanded(true)
  }

  // URL → state: on mount and when the URL changes from outside (a dashboard
  // deep link, Back). The page's own writes are recognised and skipped.
  const lastWrittenQuery = useRef<string | null>(null)
  const urlHydrated = useRef(false)
  const skipNextUrlWrite = useRef(false)
  useEffect(() => {
    if (urlHydrated.current && searchParams.toString() === lastWrittenQuery.current) return
    const known = (key: string, allowed: readonly string[]) =>
      paramList(searchParams.get(key)).filter(v => allowed.includes(v))
    setSearchQuery(searchParams.get('search') || '')
    setOsVersionFilter(searchParams.get('osVersion'))
    setSelectedUptimeBuckets(known('uptime', UPTIME_KEYS))
    setSelectedPendingBuckets(known('pending', PENDING_KEYS))
    setSelectedEditions(paramList(searchParams.get('edition')))
    setDeferredOnly(searchParams.get('deferred') === '1')
    setOsCurrencyFilters(known('os', ['unsupported', 'windows10']))
    setPatchFilters(known('patch', ['behind']))
    urlHydrated.current = true
    skipNextUrlWrite.current = true
  }, [searchParams])

  // State → URL: defaults omitted, other parameters (platform, from) kept,
  // replace rather than push so filter changes stay out of history.
  useEffect(() => {
    if (!urlHydrated.current) return
    if (skipNextUrlWrite.current) { skipNextUrlWrite.current = false; return }
    const timer = setTimeout(() => {
      const params = new URLSearchParams(window.location.search)
      const put = (key: string, value: string | null) => (value ? params.set(key, value) : params.delete(key))
      put('search', searchQuery.trim())
      put('osVersion', osVersionFilter)
      put('uptime', selectedUptimeBuckets.join(','))
      put('pending', selectedPendingBuckets.join(','))
      put('edition', selectedEditions.join(','))
      put('deferred', deferredOnly ? '1' : null)
      put('os', osCurrencyFilters.join(','))
      put('patch', patchFilters.join(','))
      const next = params.toString().replace(/%2C/gi, ',')
      if (next === window.location.search.replace(/^\?/, '')) return
      lastWrittenQuery.current = next
      router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false })
    }, 150)
    return () => clearTimeout(timer)
  }, [searchQuery, osVersionFilter, selectedUptimeBuckets, selectedPendingBuckets, selectedEditions,
      deferredOnly, osCurrencyFilters, patchFilters, pathname, router])
  
  const totalActiveFilters = selectedStatuses.length + selectedUsages.length + selectedCatalogs.length +
    selectedLocations.length + selectedAreas.length + selectedFleets.length +
    selectedEditions.length + selectedActivationStatus.length + selectedLicenseType.length +
    selectedArchitectures.length + selectedTimeZones.length + selectedUptimeBuckets.length + selectedLicenseSources.length +
    selectedPendingBuckets.length + (deferredOnly ? 1 : 0) + osCurrencyFilters.length + patchFilters.length +
    (activationFilter !== 'all' ? 1 : 0) + (firmwareLicenseFilter !== 'all' ? 1 : 0) +
    (osVersionFilter ? 1 : 0)

  // Use the new hook to get both devices data (with inventory) and system module data
  const { devices, moduleData: systemModuleData, devicesLoading, moduleLoading, error, refreshError, refetch } = useDeviceData({
    includeModuleData: true,
    moduleType: 'system'
  })
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    console.log('[SystemPage] Hook data:', {
      devices: devices.length,
      systemModuleData: systemModuleData.length,
      devicesLoading,
      moduleLoading,
      error
    })
  }, [devices, systemModuleData, devicesLoading, moduleLoading, error])

  useEffect(() => {
    // Set the systems from the module data when it's available
    if (systemModuleData && systemModuleData.length > 0) {
      console.log('[SystemPage] Setting systems from module data:', systemModuleData.length, 'items')
      setSystems(systemModuleData)
      setLoading(false)
    } else if (!moduleLoading && systemModuleData.length === 0) {
      console.log('[SystemPage] No system module data available')
      setLoading(false)
    }
  }, [systemModuleData, moduleLoading])
  
  useEffect(() => {
    // Progress tracking for loading state
    let progressInterval: NodeJS.Timeout | null = null
    
    if (moduleLoading) {
      setLoading(true)
      
      // Start progress tracking
      let progress = 0
      setLoadingProgress({ current: 0, total: 100 })
      setLoadingMessage('Fetching system data...')
      
      progressInterval = setInterval(() => {
        if (progress < 85) {
          progress += 5
          setLoadingMessage('Loading operating system information...')
        } else if (progress < 95) {
          progress += 1
          setLoadingMessage('Processing system details...')
        } else {
          progress += 0.1
          setLoadingMessage('Finalizing data...')
        }
        progress = Math.min(progress, 99.9)
        setLoadingProgress({ current: Math.floor(progress), total: 100 })
      }, 200)
    } else if (!moduleLoading) {
      // Data loaded - clear progress and hide loading
      if (progressInterval) clearInterval(progressInterval)
      setLoadingProgress({ current: 100, total: 100 })
      setLoadingMessage('Complete!')
      setTimeout(() => {
        setLoading(false)
      }, 300)
    }
    
    return () => {
      if (progressInterval) clearInterval(progressInterval)
    }
  }, [moduleLoading])

  // Extract unique filter options from devices (inventory data)
  const filterOptions = {
    usages: Array.from(new Set(
      devices.map(d => d.modules?.inventory?.usage).filter(Boolean)
    )).sort() as string[],
    catalogs: Array.from(new Set(
      devices.map(d => d.modules?.inventory?.catalog).filter(Boolean)
    )).sort() as string[],
    locations: Array.from(new Set(
      devices.map(d => d.modules?.inventory?.location).filter(Boolean)
    )).sort() as string[],
    areas: Array.from(new Set(
      devices.map(d => d.modules?.inventory?.area || d.modules?.inventory?.department).filter(Boolean)
    )).sort() as string[],
    fleets: Array.from(new Set(
      devices.map(d => d.modules?.inventory?.fleet).filter(Boolean)
    )).sort() as string[],
    editions: Array.from(new Set(
      systems.map(s => s.edition).filter(Boolean)
    )).sort() as string[],
    architectures: Array.from(new Set(
      systems.map(s => s.architecture).filter(Boolean)
    )).sort() as string[],
    timeZones: Array.from(new Set(
      systems.map(s => s.timeZone).filter(Boolean)
    )).sort() as string[],
    licenseSources: Array.from(new Set(
      systems.map(s => s.licenseSource).filter(Boolean)
    )).sort() as string[],
  }

  // FilterOptions slice fed to the shared DeviceFilters component (inventory dimensions only)
  const selectionFilterOptions: FilterOptions = {
    statuses: Array.from(new Set(systems.map(statusOf))).sort(),
    usages: filterOptions.usages,
    catalogs: filterOptions.catalogs,
    areas: filterOptions.areas,
    locations: filterOptions.locations,
    fleets: filterOptions.fleets,
  }

  // Compute location counts for proportional pill sizing
  const locationCounts = devices.reduce((acc: Record<string, number>, d: any) => {
    const loc = d.modules?.inventory?.location
    if (loc) acc[loc] = (acc[loc] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  // OS currency is relative to the whole fleet, so it is computed over every
  // system row, before any filter, exactly as the dashboard card computes it.
  const currency = useMemo(() => osCurrency(systems), [systems])

  // Filter systems
  const filteredSystems = systems.filter(s => {
    // Find the corresponding device from the main devices API to get inventory data
    const deviceFromMainAPI = devices.find(d => 
      d.deviceId === s.deviceId || 
      d.serialNumber === s.serialNumber
    )
    const inventory = deviceFromMainAPI?.modules?.inventory
    
    // Filter by activation status (dropdown)
    if (activationFilter !== 'all') {
      if (activationFilter === 'activated' && s.activationStatus !== true) return false
      if (activationFilter === 'not-activated' && s.activationStatus !== false) return false
    }
    
    // Filter by activation status (chips)
    if (selectedActivationStatus.length > 0) {
      const status = s.activationStatus === true ? 'Activated' : s.activationStatus === false ? 'Not Activated' : null
      if (!status || !selectedActivationStatus.includes(status)) return false
    }
    
    // Filter by firmware license (dropdown)
    if (firmwareLicenseFilter !== 'all') {
      if (firmwareLicenseFilter === 'has-oem' && s.hasFirmwareLicense !== true) return false
      if (firmwareLicenseFilter === 'no-oem' && s.hasFirmwareLicense !== false) return false
    }
    
    // Filter by license type (chips)
    if (selectedLicenseType.length > 0) {
      const type = s.hasFirmwareLicense === true ? 'Has OEM License' : 'No OEM License'
      if (!selectedLicenseType.includes(type)) return false
    }
    
    // Filter by edition (chips) - use enriched field
    if (selectedEditions.length > 0) {
      if (!s.edition || !selectedEditions.includes(s.edition)) return false
    }
    
    // Filter by architecture
    if (selectedArchitectures.length > 0) {
      if (!s.architecture || !selectedArchitectures.includes(s.architecture)) return false
    }
    
    // Filter by time zone
    if (selectedTimeZones.length > 0) {
      if (!s.timeZone || !selectedTimeZones.includes(s.timeZone)) return false
    }
    
    // Filter by uptime bucket
    if (selectedUptimeBuckets.length > 0) {
      const bucket = uptimeBucketKey(s)
      if (!bucket || !selectedUptimeBuckets.includes(bucket)) return false
    }
    
    // Filter by license source
    if (selectedLicenseSources.length > 0) {
      if (!s.licenseSource || !selectedLicenseSources.includes(s.licenseSource)) return false
    }
    
    // Filter by pending updates bucket
    if (selectedPendingBuckets.length > 0) {
      const bucket = pendingBucketKey(s)
      if (!bucket || !selectedPendingBuckets.includes(bucket)) return false
    }

    // Dashboard deep-link filters (?deferred=1, ?os=, ?patch=behind)
    if (deferredOnly && !hasDeferredUpdates(s)) return false
    if (osCurrencyFilters.length > 0) {
      const matchesOs =
        (osCurrencyFilters.includes('unsupported') && currency.isUnsupportedMac(s)) ||
        (osCurrencyFilters.includes('windows10') && currency.isWindows10(s))
      if (!matchesOs) return false
    }
    if (patchFilters.includes('behind') && !currency.isBehind(s)) return false
    
    // URL-based OS Version filter
    if (osVersionFilter) {
      const decodedFilter = decodeURIComponent(osVersionFilter)
      
      // Check for Windows Group (e.g., "Windows 11")
      if (decodedFilter.startsWith('Windows ')) {
        const osName = s.operatingSystem || ''
        // Handle "Windows 10" vs "Windows 11"
        if (!osName.includes(decodedFilter)) return false
      } 
      else {
        // Try strict match on normalized version
        const sysVersion = s.osVersion || ''
        
        // Construct the Windows chart keys to match against from flat fields
        let windowsChildKey = ''
        let windowsGroupKey = ''
        const osName = s.operatingSystem || ''
        const nameMatch = osName.match(/Windows\s+(\d+)/)
        if (nameMatch) {
          const windowsVersion = nameMatch[1]
          const build = s.buildNumber || '0'
          windowsGroupKey = `${windowsVersion}.${build}`
          windowsChildKey = `${windowsVersion}.${build}.0`
        }

        // Normalize version to at least 3 parts (e.g. '26.4' -> '26.4.0')
        // The chart pads missing patch to .0, so '26.4' stored must match filter '26.4.0'
        const normalizeVer = (v: string) => {
          if (!v) return ''
          const parts = v.split('.')
          while (parts.length < 3) parts.push('0')
          return parts.slice(0, 3).join('.')
        }

        // Match Logic:
        // 1. Exact match version (Mac full version e.g. 15.4.1)
        // 2. Normalized match (e.g. stored '26.4' matches filter '26.4.0')
        // 3. Exact match windows chart key (e.g. 11.26200.1)
        // 4. Exact match windows group key (e.g. 11.26200)
        // 5. Starts with (Mac group e.g. 15.4 matches 15.4.1)
        
        const matchesWindowKey = windowsChildKey === decodedFilter
        const matchesWindowGroup = windowsGroupKey === decodedFilter
        const matchesVersion = sysVersion === decodedFilter || normalizeVer(sysVersion) === normalizeVer(decodedFilter)
        const matchesGroup = sysVersion.startsWith(`${decodedFilter}.`)
        
        if (!matchesWindowKey && !matchesWindowGroup && !matchesVersion && !matchesGroup) return false
      }
    }

    // Inventory-based filters
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(statusOf(s))) return false
    if (selectedUsages.length > 0 && !selectedUsages.includes(inventory?.usage || '')) return false
    if (selectedCatalogs.length > 0 && !selectedCatalogs.includes(inventory?.catalog || '')) return false
    if (selectedLocations.length > 0 && !selectedLocations.includes(inventory?.location || '')) return false
    if (selectedAreas.length > 0 && !selectedAreas.includes((inventory as any)?.area || (inventory as any)?.department || '')) return false
    if (selectedFleets.length > 0 && !selectedFleets.includes((inventory as any)?.fleet || '')) return false
    
    return true
  })

  // Process system info for each device using extractSystem
  const processedSystems = filteredSystems.map(systemDevice => {
    // Find the corresponding device from the main devices API to get the proper name
    const deviceFromMainAPI = devices.find(d => 
      d.deviceId === systemDevice.deviceId || 
      d.serialNumber === systemDevice.serialNumber
    )
    
    // Debug logging to verify device name mapping
    if (deviceFromMainAPI && deviceFromMainAPI.name !== systemDevice.deviceName) {
          }
    
    // Create system info directly from flat API fields (no raw needed)
    const systemInfo = {
      operatingSystem: systemDevice.operatingSystem,
      osVersion: systemDevice.osVersion,
      osBuild: systemDevice.buildNumber,
      uptime: systemDevice.uptime,
      lastBootTime: systemDevice.bootTime,
      servicesCount: systemDevice.servicesCount,
      updatesCount: systemDevice.updatesCount,
      tasksCount: systemDevice.tasksCount
    }
    
    return {
      ...systemDevice,
      // Use the device name from the main API if available, fallback to system module data
      deviceName: deviceFromMainAPI?.name || systemDevice.deviceName,
      // Include assetTag from inventory data if available
      assetTag: deviceFromMainAPI?.modules?.inventory?.assetTag,
      systemInfo
    }
  })

  // Create devices formatted for OS Version Widget from systems data
  // Uses flat fields from lean API response (no raw needed)
  // Apply global platform filter so charts respect ?platform= URL param
  const platformFilteredSystems = systems.filter(sys => {
    if (!globalPlatformFilter || globalPlatformFilter === 'all') return true
    const p = sys.platform || (() => {
      const osName = sys.operatingSystem?.toLowerCase() || ''
      if (osName.includes('windows') || osName.includes('microsoft')) return 'Windows'
      if (osName.includes('macos') || osName.includes('mac os') || osName.includes('darwin')) return 'macOS'
      return 'Unknown'
    })()
    return isPlatformVisible(p)
  })

  const devicesForOSWidget = platformFilteredSystems.map(sys => {
    const platform = sys.platform || (() => {
      const osName = sys.operatingSystem?.toLowerCase() || ''
      if (osName.includes('windows') || osName.includes('microsoft')) return 'Windows'
      if (osName.includes('macos') || osName.includes('mac os') || osName.includes('darwin')) return 'macOS'
      return 'Unknown'
    })()
    
    return {
      deviceId: sys.deviceId,
      serialNumber: sys.serialNumber,
      name: sys.deviceName,
      lastSeen: sys.lastSeen,
      status: 'active',
      totalEvents: 0,
      lastEventTime: sys.lastSeen,
      platform,
      edition: sys.edition,
      architecture: sys.architecture,
      activationStatus: sys.activationStatus,
      licenseSource: sys.licenseSource,
      hasFirmwareLicense: sys.hasFirmwareLicense,
      timeZone: sys.timeZone,
      uptime: sys.uptime,
      pendingUpdatesCount: sys.pendingUpdatesCount,
      deferredUpdatesCount: sys.deferredUpdatesCount,
      installedUpdates: sys.installedUpdates,
      osVersion: {
        name: sys.operatingSystem,
        version: sys.osVersion,
        build: sys.buildNumber,
        edition: sys.edition || undefined,
        displayVersion: sys.displayVersion || undefined
      },
      modules: {
        system: {
          operatingSystem: {
            name: sys.operatingSystem,
            version: sys.osVersion,
            build: sys.buildNumber,
            edition: sys.edition || undefined,
            displayVersion: sys.displayVersion || undefined
          }
        }
      }
    }
  })

  // When an OS version filter is active, restrict Uptime and Pending widgets to matching devices only
  const osVersionFilteredForWidgets = (() => {
    if (!osVersionFilter) return devicesForOSWidget
    const decodedFilter = decodeURIComponent(osVersionFilter)
    const normalizeVer = (v: string) => {
      if (!v) return ''
      const parts = v.split('.')
      while (parts.length < 3) parts.push('0')
      return parts.slice(0, 3).join('.')
    }
    return devicesForOSWidget.filter(d => {
      const version = d.osVersion?.version || ''
      if (decodedFilter.startsWith('Windows ')) {
        return (d.osVersion?.name || '').includes(decodedFilter)
      }
      return (
        version === decodedFilter ||
        normalizeVer(version) === normalizeVer(decodedFilter) ||
        version.startsWith(`${decodedFilter}.`)
      )
    })
  })()

  // Apply search filter after processing (so we search the correct device names)
  const searchFilteredSystems = processedSystems.filter(sys => {
    // Global platform filter first
    if (globalPlatformFilter) {
      const platform = normalizePlatform(sys.operatingSystem)
      if (!isPlatformVisible(platform)) {
        return false
      }
    }
    
    if (searchQuery.trim()) {
      return matchesSystemSearch(sys, searchQuery)
    }
    return true
  }).sort((a, b) => {
    let aValue: string | number, bValue: string | number
    switch (sortColumn) {
      case 'device':
        aValue = a.deviceName?.toLowerCase() || ''
        bValue = b.deviceName?.toLowerCase() || ''
        return sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue))
      case 'os':
        aValue = getOSDisplayName(a).toLowerCase()
        bValue = getOSDisplayName(b).toLowerCase()
        return sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue))
      case 'version':
        aValue = a.osVersion?.toLowerCase() || ''
        bValue = b.osVersion?.toLowerCase() || ''
        return sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue))
      case 'updates':
        aValue = a.pendingUpdatesCount ?? 0
        bValue = b.pendingUpdatesCount ?? 0
        return sortDirection === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
      case 'edition':
        aValue = a.edition?.toLowerCase() || ''
        bValue = b.edition?.toLowerCase() || ''
        return sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue))
      case 'activation':
        aValue = a.activationStatus === true ? 0 : a.activationStatus === false ? 1 : 2
        bValue = b.activationStatus === true ? 0 : b.activationStatus === false ? 1 : 2
        return sortDirection === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
      case 'uptime':
        aValue = a.uptime || 0
        bValue = b.uptime || 0
        return sortDirection === 'asc' ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue)
      case 'lastSeen':
        aValue = a.lastSeen || ''
        bValue = b.lastSeen || ''
        return sortDirection === 'asc' ? String(aValue).localeCompare(String(bValue)) : String(bValue).localeCompare(String(aValue))
    }
    return 0
  })

  // Removable pills for the active filters that have no widget showing them
  const deepLinkPills: { key: string; label: string; clear: () => void }[] = [
    ...osCurrencyFilters.map(v => ({
      key: `os-${v}`,
      label: v === 'unsupported' ? 'Unsupported macOS' : 'Windows 10',
      clear: () => setOsCurrencyFilters(prev => prev.filter(x => x !== v)),
    })),
    ...patchFilters.map(v => ({
      key: `patch-${v}`,
      label: 'Behind on patches',
      clear: () => setPatchFilters(prev => prev.filter(x => x !== v)),
    })),
    ...(deferredOnly ? [{ key: 'deferred', label: 'Deferred updates', clear: () => setDeferredOnly(false) }] : []),
    // The edition chart is only drawn when the platform filter is Windows
    ...(globalPlatformFilter !== 'Windows'
      ? selectedEditions.map(v => ({
          key: `edition-${v}`,
          label: `Edition: ${v}`,
          clear: () => setSelectedEditions(prev => prev.filter(x => x !== v)),
        }))
      : []),
  ]

  if (loading) {
    return <SkeletonTimeout page><LoadingSkeleton /></SkeletonTimeout>
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50 dark:bg-black flex flex-col overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 page-container px-4 sm:px-6 lg:px-8 py-8 flex flex-col min-h-0">
        <div className="flex-1 bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col min-h-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <SystemViewSwitch current="os" />
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  OS versions, activation status, and system uptime {searchFilteredSystems.length} devices
                </p>
                <RefreshErrorBanner
                  error={refreshError}
                  updatedAt={cachedAt('/api/v1/system')}
                  retrying={retrying}
                  onRetry={() => { setRetrying(true); refetch().finally(() => setRetrying(false)) }}
                  className="mt-2 w-fit"
                />
              </div>
              <div className="flex items-center gap-4">
                {/* Export to CSV Button */}
                <button
                  onClick={() => {
                    // Build CSV from filtered data only
                    const headers = ['Device Name', 'Serial Number', 'Asset Tag', 'OS', 'Version', 'Build', 'Installed Updates', 'Edition', 'Activation', 'License Source', 'Time Zone', 'Locale', 'Uptime', 'Boot Time', 'Last Seen']
                    const rows = searchFilteredSystems.map(s => {
                      const uptimeStr = s.uptime ? `${Math.floor(s.uptime / 86400)}d ${Math.floor((s.uptime % 86400) / 3600)}h` : ''
                      return [
                        s.deviceName || '',
                        s.serialNumber || '',
                        s.assetTag || '',
                        getOSDisplayName(s),
                        s.osVersion || '',
                        s.buildNumber || '',
                        (s.installedUpdates || []).map(update => update.id || update.title).filter(Boolean).join('; '),
                        s.edition || '',
                        s.activationStatus === true ? 'Activated' : s.activationStatus === false ? 'Not Activated' : '',
                        s.licenseSource || '',
                        s.timeZone || '',
                        s.locale || '',
                        uptimeStr,
                        s.bootTime || '',
                        s.lastSeen || ''
                      ].map(csvCell).join(',')
                    })
                    
                    const csv = [headers.join(','), ...rows].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                    const url = URL.createObjectURL(blob)
                    const link = document.createElement('a')
                    link.href = url
                    link.download = `system-report-${new Date().toISOString().split('T')[0]}.csv`
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                    URL.revokeObjectURL(url)
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
                  title="Export filtered devices to CSV"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Selections accordion (shared component) */}
          <DeviceFilters
            filterOptions={selectionFilterOptions}
            selectedStatuses={selectedStatuses}
            selectedCatalogs={selectedCatalogs}
            selectedAreas={selectedAreas}
            selectedLocations={selectedLocations}
            selectedFleets={selectedFleets}
            selectedUsages={selectedUsages}
            onStatusToggle={toggleStatus}
            onCatalogToggle={toggleCatalog}
            onAreaToggle={toggleArea}
            onLocationToggle={toggleLocation}
            onFleetToggle={toggleFleet}
            onUsageToggle={toggleUsage}
            onClearAll={clearAllFilters}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            expanded={effectiveFiltersExpanded}
            onToggle={() => setFiltersExpanded(!filtersExpanded)}
            locationCounts={locationCounts}
          />

          {/* Widgets Accordion - OS Version Charts */}
          <div className={widgetsExpanded ? '' : 'border-b border-gray-200 dark:border-gray-700'}>
            {/* Widgets Accordion Header */}
            <button
              onClick={() => setWidgetsExpanded(!effectiveWidgetsExpanded)}
              className="w-full px-6 py-3 flex items-center justify-between bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Widgets</span>
              </div>
              <svg 
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform ${effectiveWidgetsExpanded ? 'rotate-90' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* Widgets Content - Collapsible */}
          <CollapsibleSection expanded={effectiveWidgetsExpanded} maxHeight="60vh">
            <div className="px-6 py-6 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-6">
              {/* Row 1: OS Version Charts */}
              <div className={`grid grid-cols-1 ${globalPlatformFilter === 'all' ? 'md:grid-cols-2' : ''} gap-6`}>
                {/* Windows OS Version Pie Chart */}
                {globalPlatformFilter !== 'macOS' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 3h8v8H3V3zm10 0h8v8h-8V3zM3 13h8v8H3v-8zm10 0h8v8h-8v-8z"/>
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Windows Versions</h2>
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <OSVersionPieChart
                      devices={devicesForOSWidget as any}
                      loading={loading || moduleLoading}
                      osType="Windows"
                      activeVersion={osVersionFilter || undefined}
                      onFilterApplied={() => setWidgetsExpanded(false)}
                      onVersionSelect={(version) => setOsVersionFilter(version)}
                      onUpdateSelect={setSearchQuery}
                      onClearFilter={() => setOsVersionFilter(null)}
                    />
                  </div>
                </div>
                )}
                
                {/* macOS OS Version Pie Chart */}
                {globalPlatformFilter !== 'Windows' && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-red-500 dark:text-red-300" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">macOS Versions</h2>
                    </div>
                  </div>
                  <div className="px-3 py-2">
                    <OSVersionPieChart
                      devices={devicesForOSWidget as any}
                      loading={loading || moduleLoading}
                      osType="macOS"
                      activeVersion={osVersionFilter || undefined}
                      onFilterApplied={() => setWidgetsExpanded(false)}
                      onVersionSelect={(version) => setOsVersionFilter(version)}
                      onClearFilter={() => setOsVersionFilter(null)}
                    />
                  </div>
                </div>
                )}
              </div>

              {/* Row 2: Edition + Activation + License Source (Windows-only) */}
              {globalPlatformFilter === 'Windows' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Edition Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Edition</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <EditionDonutChart
                      devices={devicesForOSWidget}
                      loading={loading || moduleLoading}
                      selectedEditions={selectedEditions}
                      onEditionToggle={toggleEdition}
                    />
                  </div>
                </div>

                {/* Activation Compliance */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Activation</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <ActivationComplianceChart
                      devices={devicesForOSWidget}
                      loading={loading || moduleLoading}
                      selectedStatuses={selectedActivationStatus}
                      onStatusToggle={toggleActivationStatus}
                    />
                  </div>
                </div>

                {/* License Source */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">License Source</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <LicenseSourceChart
                      devices={devicesForOSWidget}
                      loading={loading || moduleLoading}
                      selectedSources={selectedLicenseSources}
                      onSourceToggle={toggleLicenseSource}
                    />
                  </div>
                </div>
              </div>
              )}

              {/* Row 3: Uptime + Pending Updates (2-up) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Uptime Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Uptime Distribution</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <UptimeDistributionChart
                      devices={osVersionFilteredForWidgets}
                      loading={loading || moduleLoading}
                      selectedBuckets={selectedUptimeBuckets}
                      onBucketToggle={toggleUptimeBucket}
                    />
                  </div>
                </div>

                {/* Pending Updates Distribution */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      </div>
                      <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Updates</h2>
                    </div>
                  </div>
                  <div className="p-4">
                    <PendingUpdatesChart
                      devices={osVersionFilteredForWidgets}
                      loading={loading || moduleLoading}
                      selectedBuckets={selectedPendingBuckets}
                      onBucketToggle={togglePendingBucket}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CollapsibleSection>

          {/* Search Section */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search device, serial, OS build, update title, or KB..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              {(totalActiveFilters > 0 || searchQuery) && (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 rounded-lg hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors whitespace-nowrap"
                >
                  Clear Selections
                </button>
              )}
            </div>
            {deepLinkPills.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {deepLinkPills.map(pill => (
                  <span
                    key={pill.key}
                    className="inline-flex items-center gap-1 pl-3 pr-1 py-1 text-xs font-medium rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800"
                  >
                    {pill.label}
                    <button
                      type="button"
                      onClick={pill.clear}
                      aria-label={`Remove filter: ${pill.label}`}
                      className="rounded-full p-0.5 hover:bg-blue-200 dark:hover:bg-blue-800"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div ref={tableContainerRef} className="flex-1 overflow-auto min-h-0 table-scrollbar">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <th 
                    onClick={() => handleSort('device')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Device
                      {sortColumn === 'device' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('os')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      OS
                      {sortColumn === 'os' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('version')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Version
                      {sortColumn === 'version' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('updates')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Updates
                      {sortColumn === 'updates' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                  {isWindowsOnly && (
                    <th 
                      onClick={() => handleSort('edition')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Edition
                        {sortColumn === 'edition' && (
                          <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  )}
                  {isWindowsOnly && (
                    <th 
                      onClick={() => handleSort('activation')}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                    >
                      <div className="flex items-center gap-1">
                        Activation
                        {sortColumn === 'activation' && (
                          <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </th>
                  )}
                  <th 
                    onClick={() => handleSort('uptime')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Uptime
                      {sortColumn === 'uptime' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th 
                    onClick={() => handleSort('lastSeen')}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  >
                    <div className="flex items-center gap-1">
                      Last Seen
                      {sortColumn === 'lastSeen' && (
                        <svg className={`w-3 h-3 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {error ? (
                  <tr>
                    <td colSpan={isWindowsOnly ? 8 : 6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 mb-4 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-base font-medium text-gray-900 dark:text-white mb-2">Failed to load system data</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{error}</p>
                        <button 
                          onClick={() => window.location.reload()} 
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                          Try Again
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : searchFilteredSystems.length === 0 ? (
                  <tr>
                    <td colSpan={isWindowsOnly ? 8 : 6} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.50 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">No system records found</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">No system records match your current search.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  searchFilteredSystems.map((sys) => {
                    const displayedUpdates = updatesToDisplay(sys, searchQuery)
                    return (
                      <tr key={sys.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-4 py-4 max-w-56">
                        <Link 
                          href={`/device/${sys.serialNumber}#system`}
                          className="group block min-w-0"
                          title={sys.deviceName || 'Unknown Device'}
                        >
                          <div className="text-sm font-medium text-gray-900 group-hover:text-gray-700 dark:text-white dark:group-hover:text-gray-200 truncate">{sys.deviceName}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                            {sys.serialNumber}
                            {sys.assetTag ? ` | ${sys.assetTag}` : ''}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900 dark:text-white font-medium">
                          {getOSDisplayName(sys)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {sys.osVersion || '-'}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        {((sys.pendingUpdatesCount ?? 0) > 0 || (sys.deferredUpdatesCount ?? 0) > 0 || displayedUpdates.length > 0) ? (
                          <div className="flex flex-col gap-1">
                            {displayedUpdates.map((update, index) => (
                              <span
                                key={`${update.id || update.title}-${index}`}
                                className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-gray-700 dark:text-gray-300"
                                title={['Installed', update.title, update.installedOn].filter(Boolean).join(' · ')}
                              >
                                <span className="inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-300 whitespace-nowrap">
                                  Installed
                                </span>
                                <span className="font-mono font-medium">{update.id || update.title}</span>
                                {update.installedOn ? ` · ${update.installedOn.slice(0, 10)}` : ''}
                              </span>
                            ))}
                            {(sys.pendingUpdatesCount ?? 0) > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 whitespace-nowrap">
                                {sys.pendingUpdatesCount} pending
                              </span>
                            )}
                            {(sys.deferredUpdatesCount ?? 0) > 0 && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 whitespace-nowrap">
                                {sys.deferredUpdatesCount} deferred
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      {isWindowsOnly && (
                        <td className="px-4 py-4">
                          <div className="text-sm text-gray-900 dark:text-white">
                            {sys.edition || '-'}
                          </div>
                        </td>
                      )}
                      {isWindowsOnly && (
                        <td className="px-4 py-4">
                          {sys.activationStatus != null ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              sys.activationStatus === true
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {sys.activationStatus ? 'Activated' : 'Not Activated'}
                            </span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          {sys.uptime ? (
                            <div className="text-gray-900 dark:text-white">
                              {formatUptime(sys.uptime)}
                            </div>
                          ) : (
                            <div className="text-gray-500 dark:text-gray-400">-</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-900 dark:text-white">
                        {sys.lastSeen ? formatRelativeTime(sys.lastSeen) : '-'}
                      </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function SystemTabs() {
  const searchParams = useSearchParams()
  return searchParams.get('tab') === 'services' ? <ServicesReport /> : <SystemPageContent />
}

export default function SystemPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 dark:bg-black animate-pulse"></div>}>
      <SystemTabs />
    </Suspense>
  )
}

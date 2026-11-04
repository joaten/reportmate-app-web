"use client"

import { createContext, useContext, useState, useCallback, ReactNode, useMemo, useEffect } from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'

export type Platform = 'macOS' | 'Windows' | 'all'

const STORAGE_KEY = 'reportmate-platform-filter'

interface PlatformFilterContextType {
  // Current platform filter
  platformFilter: Platform
  // Toggle a specific platform on/off
  setPlatformFilter: (platform: Platform) => void
  // Quick toggle to show only one platform
  showOnlyMac: () => void
  showOnlyWindows: () => void
  showAll: () => void
  // Check if a platform is visible
  isPlatformVisible: (platform: string) => boolean
  // Filter an array of devices by platform
  filterByPlatform: <T extends { platform?: string }>(items: T[]) => T[]
}

const PlatformFilterContext = createContext<PlatformFilterContextType | undefined>(undefined)

/**
 * Normalizes various platform string formats to canonical form
 */
function normalizePlatform(platform?: string): 'macOS' | 'Windows' | 'unknown' {
  if (!platform) return 'unknown'
  
  const lower = platform.toLowerCase()
  
  // Mac variants
  if (lower === 'macos' || lower === 'mac' || lower === 'macintosh' || 
      lower === 'darwin' || lower === 'munki') {
    return 'macOS'
  }
  
  // Windows variants
  if (lower === 'windows' || lower.startsWith('win') || lower === 'cimian') {
    return 'Windows'
  }
  
  // Also check for OS names that indicate platform
  if (lower.includes('mac') || lower.includes('darwin') || lower.includes('macos')) {
    return 'macOS'
  }
  if (lower.includes('windows')) {
    return 'Windows'
  }
  
  return 'unknown'
}

interface PlatformFilterProviderProps {
  children: ReactNode
  defaultPlatform?: Platform
}

/**
 * The `platform` URL parameter. The toggle writes `mac` / `win`; deep links
 * from the dashboard insights API may say `macOS` / `Windows`, which are
 * accepted and rewritten to the short form.
 */
export function platformFromParam(value: string | null): Platform | null {
  const v = (value || '').trim().toLowerCase()
  if (v === 'mac' || v === 'macos') return 'macOS'
  if (v === 'win' || v === 'windows') return 'Windows'
  if (v === 'all') return 'all'
  return null
}

export function PlatformFilterProvider({ children, defaultPlatform = 'all' }: PlatformFilterProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  // Initialize platform filter with priority:
  //   1) URL parameter (highest priority for sharing links)
  //   2) localStorage (for persistence across navigation)
  //   3) default value
  const getInitialPlatform = (): Platform => {
    const fromUrl = platformFromParam(searchParams.get('platform'))
    if (fromUrl) return fromUrl
    
    // Check localStorage (client-side only)
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'macOS' || stored === 'Windows') return stored
    }
    
    return defaultPlatform
  }
  
  const [platformFilter, setPlatformFilterState] = useState<Platform>(getInitialPlatform)

  // The URL is authoritative when it names a platform. When navigation drops
  // the parameter, restore the persisted selection. Keeping both decisions in
  // one effect prevents URL-to-state and state-to-URL effects from reversing
  // one another while a router.replace is still in flight.
  useEffect(() => {
    const urlPlatform = searchParams.get('platform')
    const nextPlatform = platformFromParam(urlPlatform)
    if (nextPlatform) {
      setPlatformFilterState(nextPlatform)
      localStorage.setItem(STORAGE_KEY, nextPlatform)
      const short = nextPlatform === 'all' ? 'all' : nextPlatform === 'macOS' ? 'mac' : 'win'
      if (urlPlatform !== short) {
        const params = new URLSearchParams(searchParams.toString())
        params.set('platform', short)
        router.replace(`${pathname}?${params.toString()}`)
      }
      return
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    const storedPlatform = stored === 'macOS' || stored === 'Windows' ? stored : defaultPlatform
    setPlatformFilterState(storedPlatform)

    // The toggle is hidden on these pages, so leave their URLs untouched.
    if (pathname.match(/^\/device\/[^/]+$/) || pathname === '/settings') return
    if (storedPlatform === 'all') return

    const params = new URLSearchParams(searchParams.toString())
    params.set('platform', storedPlatform === 'macOS' ? 'mac' : 'win')
    router.replace(`${pathname}?${params.toString()}`)
  }, [defaultPlatform, pathname, router, searchParams])

  const setPlatformFilter = useCallback((platform: Platform) => {
    // Persist to localStorage for global persistence across navigation
    if (platform === 'all') {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, platform)
    }
    
    // Update URL parameter (for sharing/bookmarking)
    const params = new URLSearchParams(searchParams.toString())
    if (platform === 'macOS') {
      params.set('platform', 'mac')
    } else if (platform === 'Windows') {
      params.set('platform', 'win')
    } else {
      params.delete('platform')
    }
    
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl) // Use replace instead of push to avoid polluting history
  }, [pathname, router, searchParams])

  const showOnlyMac = useCallback(() => {
    setPlatformFilter('macOS')
  }, [setPlatformFilter])

  const showOnlyWindows = useCallback(() => {
    setPlatformFilter('Windows')
  }, [setPlatformFilter])

  const showAll = useCallback(() => {
    setPlatformFilter('all')
  }, [setPlatformFilter])

  const isPlatformVisible = useCallback((platform: string): boolean => {
    if (platformFilter === 'all') return true
    const normalized = normalizePlatform(platform)
    // If platform is unknown when a filter is active, hide it (don't pollute filtered results)
    if (normalized === 'unknown') return false
    return normalized === platformFilter
  }, [platformFilter])

  const filterByPlatform = useCallback(<T extends { platform?: string }>(items: T[]): T[] => {
    if (platformFilter === 'all') return items
    return items.filter(item => {
      const normalized = normalizePlatform(item.platform)
      // If platform is unknown when a filter is active, hide it
      if (normalized === 'unknown') return false
      return normalized === platformFilter
    })
  }, [platformFilter])

  const value = useMemo(() => ({
    platformFilter,
    setPlatformFilter,
    showOnlyMac,
    showOnlyWindows,
    showAll,
    isPlatformVisible,
    filterByPlatform,
  }), [platformFilter, setPlatformFilter, showOnlyMac, showOnlyWindows, showAll, isPlatformVisible, filterByPlatform])

  return (
    <PlatformFilterContext.Provider value={value}>
      {children}
    </PlatformFilterContext.Provider>
  )
}

export function usePlatformFilter() {
  const context = useContext(PlatformFilterContext)
  if (context === undefined) {
    throw new Error('usePlatformFilter must be used within a PlatformFilterProvider')
  }
  return context
}

/**
 * Helper hook that can be used when the provider might not be present
 * Returns default values if not within a provider
 */
export function usePlatformFilterSafe() {
  const context = useContext(PlatformFilterContext)
  
  // Return default no-op values if not in provider
  if (context === undefined) {
    return {
      platformFilter: 'all' as Platform,
      setPlatformFilter: () => {},
      showOnlyMac: () => {},
      showOnlyWindows: () => {},
      showAll: () => {},
      isPlatformVisible: () => true,
      filterByPlatform: <T extends { platform?: string }>(items: T[]) => items,
    }
  }
  
  return context
}

/**
 * Utility to get platform from various device data structures
 * Priority: 1) system.operatingSystem.name (kernel data - authoritative)
 *           2) device.platform (root level)
 *           3) inventory.platform (fallback)
 *           4) configType (Cimian/Munki for installs page)
 */
export function getDevicePlatform(device: any): 'macOS' | 'Windows' | 'unknown' {
  // Priority 1: System module operatingSystem.name (kernel data - most authoritative)
  const osName = device.modules?.system?.operatingSystem?.name
  if (osName) {
    return normalizePlatform(osName)
  }
  
  // Priority 2: Direct platform field at device root
  if (device.platform) {
    return normalizePlatform(device.platform)
  }
  
  // Priority 3: Inventory module platform (fallback)
  const inventoryPlatform = device.modules?.inventory?.platform
  if (inventoryPlatform) {
    return normalizePlatform(inventoryPlatform)
  }
  
  // Priority 4: configType for installs page
  if (device.configType) {
    if (device.configType === 'Cimian') return 'Windows'
    if (device.configType === 'Munki') return 'macOS'
  }
  
  // Legacy fallbacks
  const legacyOs = device.osName || device.os
  if (legacyOs) {
    return normalizePlatform(legacyOs)
  }
  
  // Priority 5: Hardware module model/manufacturer detection
  const modelName = device.modules?.hardware?.system?.model_name || device.modules?.hardware?.model || ''
  if (modelName) {
    const modelLower = modelName.toLowerCase()
    if (modelLower.includes('mac') || modelLower.includes('imac')) return 'macOS'
    if (modelLower.includes('surface') || modelLower.includes('thinkpad') || modelLower.includes('latitude') || modelLower.includes('optiplex')) return 'Windows'
  }
  
  const hwVendor = device.modules?.hardware?.system?.hardware_vendor || device.modules?.hardware?.manufacturer || ''
  if (hwVendor) {
    const vendorLower = hwVendor.toLowerCase()
    if (vendorLower.includes('apple')) return 'macOS'
  }
  
  return 'unknown'
}

/**
 * Chart-friendly platform label using full detection chain.
 * Returns 'Macintosh'/'Windows'/'Other' for chart display contexts.
 */
export function getDevicePlatformLabel(device: any): 'Windows' | 'Macintosh' | 'Other' {
  const platform = getDevicePlatform(device)
  if (platform === 'macOS') return 'Macintosh'
  if (platform === 'Windows') return 'Windows'
  return 'Other'
}

export { normalizePlatform }

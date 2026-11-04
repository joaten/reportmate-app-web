"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

export function SystemViewSwitch({ current }: { current: "os" | "services" }) {
  const params = useSearchParams()
  const href = (services: boolean) => {
    const next = new URLSearchParams()
    if (services) next.set("tab", "services")
    const platform = params.get("platform")
    if (platform) next.set("platform", platform)
    return `/system${next.size ? `?${next}` : ""}`
  }
  return (
    <nav aria-label="System tabs" className="inline-flex flex-wrap rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 bg-gray-100 dark:bg-gray-900">
      {([
        { key: "os", label: "Operating System Information", href: href(false) },
        { key: "services", label: "Services", href: href(true) },
      ] as const).map(item => (
        <Link key={item.key} href={item.href} aria-current={current === item.key ? "page" : undefined}
          className={`px-3 py-0.5 rounded-md text-lg font-semibold transition-colors ${current === item.key
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"}`}>
          {item.label}
        </Link>
      ))}
    </nav>
  )
}

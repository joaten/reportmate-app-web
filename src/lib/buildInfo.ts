export interface BuildInfo {
  version: string
  buildId: string
  buildTime: string
  imageTag: string
}

/** Image metadata survives redeploys whose runtime environment still describes an older image. */
export function resolveBuildInfo(image: unknown, fallback: BuildInfo): BuildInfo {
  const result = { ...fallback }
  if (!image || typeof image !== 'object' || Array.isArray(image)) return result
  const fields = image as Record<string, unknown>
  for (const key of ['version', 'buildId', 'buildTime', 'imageTag'] as const) {
    const value = fields[key]
    if (typeof value === 'string' && value.trim() && value !== 'unknown') result[key] = value
  }
  return result
}

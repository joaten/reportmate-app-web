import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { resolveBuildInfo } from '@/src/lib/buildInfo'

// Get version information from various sources
function getVersionInfo() {
  let version = 'unknown'
  let buildId = 'unknown'
  let buildTime = 'unknown'
  let imageTag = 'unknown'
  
  try {
    // Runtime settings remain a fallback for development and older images.
    version = process.env.CONTAINER_IMAGE_TAG || process.env.NEXT_PUBLIC_VERSION || process.env.VERSION || process.env.DOCKER_TAG || 'unknown'
    buildId = process.env.BUILD_ID || process.env.NEXT_PUBLIC_BUILD_ID || process.env.GITHUB_SHA || 'unknown'
    buildTime = process.env.BUILD_TIME || process.env.NEXT_PUBLIC_BUILD_TIME || 'unknown'
    imageTag = process.env.CONTAINER_IMAGE_TAG || process.env.IMAGE_TAG || process.env.DOCKER_IMAGE_TAG || 'unknown'
    
    // Try to read from .next/BUILD_ID if available
    if (buildId === 'unknown') {
      try {
        const buildIdPath = path.join(process.cwd(), '.next', 'BUILD_ID')
        if (fs.existsSync(buildIdPath)) {
          buildId = fs.readFileSync(buildIdPath, 'utf8').trim()
        }
      } catch (readBuildIdError) {
        console.debug('Version API: could not read BUILD_ID', readBuildIdError)
      }
    }
    
    // Only fall back to package.json version if container version is not available
    // This is less useful since it doesn't reflect the actual running container
    if (version === 'unknown') {
      try {
        const packagePath = path.join(process.cwd(), 'package.json')
        if (fs.existsSync(packagePath)) {
          const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
          version = packageJson.version || 'unknown'
        }
      } catch (readPackageError) {
        console.debug('Version API: could not read package.json', readPackageError)
      }
    }
    
    // If no image tag found in environment, construct from version
    if (imageTag === 'unknown' && version !== 'unknown') {
      // If version looks like a tag format (YYYYMMDDHHMMSS-hash), use it as image tag
      if (version.match(/^\d{14}-[a-f0-9]+$/)) {
        // Only qualify the tag when the registry is actually known; guessing a
        // host would show an image reference that does not exist anywhere.
        const registry = process.env.CONTAINER_REGISTRY
        imageTag = registry ? `${registry}/reportmate:${version}` : version
      }
    }
    
  } catch (error) {
    console.warn('Error getting version info:', error)
  }
  
  let imageInfo: unknown
  try {
    imageInfo = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'build-info.json'), 'utf8'))
  } catch {
    // Development and older images do not carry this build artifact.
  }
  return {
    ...resolveBuildInfo(imageInfo, { version, buildId, buildTime, imageTag }),
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch
  }
}

export async function GET(_request: NextRequest) {
  try {
    const versionInfo = getVersionInfo()
    
    return NextResponse.json({
      success: true,
      data: versionInfo
    })
  } catch (error) {
    console.error('Version API error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to get version information'
    }, { status: 500 })
  }
}

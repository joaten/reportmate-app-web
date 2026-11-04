import { resolveBuildInfo } from './buildInfo'

const runtime = { version: 'older-image', buildId: 'older-commit', buildTime: 'older-build-time', imageTag: 'older-image' }

it('reports the image build even when runtime environment values describe an older deployment', () => {
  const image = { version: 'current-image', buildId: 'current-commit', buildTime: 'current-build-time', imageTag: 'current-image' }
  expect(resolveBuildInfo(image, runtime)).toEqual(image)
  expect(runtime.buildId).toBe('older-commit')
})

it('retains legacy development information when no usable image metadata is present', () => {
  for (const value of [null, undefined, [], 'invalid', { buildId: '', version: 'unknown', buildTime: 0 }]) {
    expect(resolveBuildInfo(value, runtime)).toEqual(runtime)
  }
})

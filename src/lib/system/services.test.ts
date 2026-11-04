import { listParam, servicesApiQuery, servicesUrlQuery, serviceOptionsQuery } from './services'
import { platformFromParam } from '../../providers/PlatformFilterProvider'

it('preserves service, version, inventory, freshness and device scope in a shared request', () => {
  const params = new URLSearchParams('tab=services&service=service%25_name&application=package&versions=1.2,2.0&states=unknown&freshness=stale&maxAgeHours=168&inventoryStates=storage&catalogs=Staff&rooms=Studio&search=serial&includeArchived=true&offset=50')
  const query = new URLSearchParams(servicesApiQuery(params, 'Windows'))
  expect(query.get('service')).toBe('service%_name')
  expect(query.get('versions')).toBe('1.2,2.0')
  expect(query.get('platform')).toBe('Windows')
  expect(query.get('limit')).toBe('50')
  for (const key of ['application', 'states', 'freshness', 'maxAgeHours', 'inventoryStates', 'catalogs', 'rooms', 'search', 'includeArchived', 'offset']) {
    expect(query.get(key)).toBe(params.get(key))
  }
  expect(query.has('tab')).toBe(false)
})

it('starts changed filters at page one and preserves unrelated state', () => {
  const next = new URLSearchParams(servicesUrlQuery('tab=services&platform=mac&service=daemon&offset=50', { states: 'stopped' }))
  expect(next.get('states')).toBe('stopped')
  expect(next.get('service')).toBe('daemon')
  expect(next.get('platform')).toBe('mac')
  expect(next.has('offset')).toBe(false)
  expect(new URLSearchParams(servicesUrlQuery(next.toString(), { offset: '100' })).get('offset')).toBe('100')
})

it('removes cleared filters rather than retaining stale URL values', () => {
  const next = new URLSearchParams(servicesUrlQuery('service=daemon&application=package&versions=1.2', { application: null, versions: null }))
  expect(next.has('application')).toBe(false)
  expect(next.has('versions')).toBe(false)
  expect(listParam(new URLSearchParams('states=running,unknown'), 'states')).toEqual(['running', 'unknown'])
})

it('recognizes an explicit all-platform link independently of stored preferences', () => {
  expect(platformFromParam('all')).toBe('all')
})


it('keeps selected names containing commas intact through a shared request', () => {
  const names = ['Agent Service', 'Application (x64, English)']
  const params = new URLSearchParams({ serviceNames: JSON.stringify(names), applicationNames: JSON.stringify(names) })
  const shared = new URLSearchParams(servicesApiQuery(params, 'Windows'))
  expect(listParam(shared, 'serviceNames')).toEqual(names)
  expect(listParam(shared, 'applicationNames')).toEqual(names)
})

it('scopes available choices independently of the current service and report state', () => {
  const query = new URLSearchParams(serviceOptionsQuery(new URLSearchParams('service=daemon&states=missing&catalogs=Shared&includeArchived=true'), 'macOS'))
  expect([...query.keys()].sort()).toEqual(['catalogs', 'includeArchived', 'platform'])
  expect(query.get('catalogs')).toBe('Shared')
})

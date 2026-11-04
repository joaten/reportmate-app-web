import { servicesCsv } from './services-export'
import { servicesPageQuery } from './services'

it('reads from page one at the largest supported page size without losing report filters', () => {
  const query = new URLSearchParams({ serviceNames: JSON.stringify(['Agent Service']), application: 'package', versions: '1.2,2.0', states: 'unknown', platform: 'all', includeArchived: 'true', inventoryStates: 'storage', maxAgeHours: '168', offset: '50', limit: '50' })
  const first = new URLSearchParams(servicesPageQuery(query.toString()))
  expect(first.get('offset')).toBe('0')
  expect(first.get('limit')).toBe('500')
  for (const key of ['serviceNames', 'application', 'versions', 'states', 'platform', 'includeArchived', 'inventoryStates', 'maxAgeHours']) expect(first.get(key)).toBe(query.get(key))
  expect(new URLSearchParams(servicesPageQuery(query.toString(), 500)).get('offset')).toBe('500')
  expect(query.get('offset')).toBe('50')
})

it('exports explicit lifecycle and collection columns even when the current selection becomes empty', () => {
  const csv = servicesCsv([], '', '')
  for (const header of ['Serial Number', 'Inventory State', 'Archived in ReportMate', 'Last Reported Service State', 'Service Collection Time', 'Last Seen', 'Report URL']) expect(csv).toContain(`"${header}"`)
  expect(csv.split('\r\n')).toHaveLength(1)
})

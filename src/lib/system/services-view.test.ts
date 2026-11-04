import { checkinAgeHours, checkinState, compareReportValues, matchesEvidence, readServicesView } from "./services-view"
import { servicesApiQuery, servicesUrlQuery } from "./services"

it("treats absent, invalid and future check-ins as unknown at a fixed report snapshot", () => {
  const snapshot = "2025-01-08T12:00:00Z"
  for (const value of [null, "", "invalid", "2025-01-08T12:00:01Z"]) expect(checkinAgeHours(value, snapshot)).toBeNull()
  expect(checkinAgeHours(snapshot, "invalid")).toBeNull()
  expect(checkinAgeHours("2025-01-01T12:00:00Z", snapshot)).toBe(168)
  expect(checkinState(168, 168)).toBe("recent")
  expect(checkinState(168.001, 168)).toBe("stale")
  expect(checkinState(null, 168)).toBe("unknown")
})

it("includes service-only and application-only evidence without classifying an installation", () => {
  for (const counts of [[1, 0], [0, 1], [1, 1]]) expect(matchesEvidence(counts[0], counts[1], "any")).toBe(true)
  expect(matchesEvidence(0, 0, "any")).toBe(false)
  expect(matchesEvidence(1, 0, "applications")).toBe(false)
  expect(matchesEvidence(0, 1, "services")).toBe(false)
  expect(matchesEvidence(0, 0, "none")).toBe(true)
  expect(matchesEvidence(1, 0, "none")).toBe(false)
  expect(matchesEvidence(0, 0, "all")).toBe(true)
})

it("sorts numbers and natural text in either direction with unknown values always last", () => {
  expect([null, 24, 168, 0].sort((a, b) => compareReportValues(a, b, "desc"))).toEqual([168, 24, 0, null])
  expect(["10.0", null, "2.0"].sort((a, b) => compareReportValues(a, b, "asc"))).toEqual(["2.0", "10.0", null])
  expect(compareReportValues(null, null, "desc")).toBe(0)
  expect(compareReportValues("SAME", "same", "asc")).toBe(0)
})

it("preserves view controls in shared URLs without altering either API request or its cache key", () => {
  const original = "service=daemon&application=package&includeArchived=true&platform=all"
  const changed = servicesUrlQuery(original, { evidence: "any", checkin: "stale", checkinAgeHours: "720", columns: "deviceName,area,checkinAge", sort: "checkinAge", direction: "desc" })
  expect(servicesApiQuery(new URLSearchParams(changed), "all")).toBe(servicesApiQuery(new URLSearchParams(original), "all"))
  const view = readServicesView(new URLSearchParams(changed), true)
  expect(view).toEqual({ evidence: "any", checkin: "stale", checkinAgeHours: 720, columns: ["deviceName", "area", "checkinAge"], sort: "checkinAge", direction: "desc" })
})

it("pins the device column and ignores unsupported, hidden or application-only controls", () => {
  const view = readServicesView(new URLSearchParams("columns=area,applications,bogus&sort=applications&evidence=applications&checkinAgeHours=Infinity&checkin=bogus&direction=bogus"), false)
  expect(view).toEqual({ evidence: "all", checkin: "all", checkinAgeHours: 168, sort: "deviceName", direction: "asc", columns: ["deviceName", "area"] })
  for (const value of ["0", "-1", "invalid"]) expect(readServicesView(new URLSearchParams({ checkinAgeHours: value }), true).checkinAgeHours).toBe(168)
})

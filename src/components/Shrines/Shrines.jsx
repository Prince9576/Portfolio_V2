import { useMemo } from 'react'
import meta from '../../content/worldMeta.json'
import { COMPANIES } from '../../content/companies.js'
import { landmarks } from '../../stores/shrineStore.js'
import Shrine from './Shrine.jsx'

// Deduplicate fountains and assign one per company
export default function Shrines() {
  const pairs = useMemo(() => {
    const seen = new Set()
    const unique = landmarks.fountains.filter((f) => {
      const key = `${Math.round(f.x)},${Math.round(f.z)}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    const ordered = unique.sort(
      (a, b) =>
        Math.hypot(a.x - meta.spawn.x, a.z - meta.spawn.z) -
        Math.hypot(b.x - meta.spawn.x, b.z - meta.spawn.z),
    )
    return COMPANIES.map((company, i) => ({ company, fountain: ordered[i] })).filter((p) => p.fountain)
  }, [])

  return (
    <>
      {pairs.map(({ company, fountain }) => (
        <Shrine key={company.id} company={company} fountain={fountain} />
      ))}
    </>
  )
}

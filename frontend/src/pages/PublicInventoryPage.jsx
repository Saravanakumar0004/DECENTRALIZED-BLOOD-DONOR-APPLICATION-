// pages/PublicInventoryPage.jsx  ── NEW FILE
import { useState, useEffect } from 'react'
import { getPublicInventory } from '../api/inventory'
import { LoadingSpinner, EmptyState } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { MapPin, Search, Droplets } from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

function bgColor(group) {
  const map = {
    'A+': 'text-red-400', 'A-': 'text-red-300',
    'B+': 'text-blue-400', 'B-': 'text-blue-300',
    'O+': 'text-green-400', 'O-': 'text-green-300',
    'AB+': 'text-purple-400', 'AB-': 'text-purple-300',
  }
  return map[group] || 'text-slate-300'
}

export default function PublicInventoryPage() {
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading]     = useState(true)
  const [bloodGroup, setBloodGroup] = useState('')
  const [city, setCity]             = useState('')
  const [minUnits, setMinUnits]     = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getPublicInventory({
        bloodGroup: bloodGroup || undefined,
        city:       city       || undefined,
        minUnits,
        limit: 50,
      })
      setHospitals(res.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [bloodGroup, minUnits])

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h2 className="font-display text-3xl text-slate-100 mb-1">BLOOD AVAILABILITY</h2>
        <p className="text-slate-500 text-sm">Real-time blood stock across all hospitals</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto text-sm" value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
          <option value="">All Blood Groups</option>
          {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
        </select>
        <input className="input w-48 text-sm" placeholder="Filter by city..."
          value={city} onChange={e => setCity(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()} />
        <select className="input w-auto text-sm" value={minUnits} onChange={e => setMinUnits(parseInt(e.target.value))}>
          <option value={0}>Show all (including 0)</option>
          <option value={1}>1+ units</option>
          <option value={3}>3+ units</option>
          <option value={5}>5+ units</option>
        </select>
        <button onClick={load} className="btn-secondary text-sm flex items-center gap-2">
          <Search size={14} /> Search
        </button>
      </div>

      {loading ? <LoadingSpinner className="py-16" /> : hospitals.length === 0 ? (
        <EmptyState
          icon="🩸"
          title="No hospitals found"
          description="Try adjusting your filters or check back later."
        />
      ) : (
        <div className="space-y-4">
          {hospitals.map(({ hospital, stock, lastStockUpdate }) => (
            <div key={hospital._id} className="card hover:border-slate-700 transition-all">
              {/* Hospital header */}
              <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-medium text-slate-100 text-lg">
                    {hospital.hospitalName || hospital.name}
                    {hospital.isVerified && (
                      <span className="ml-2 text-xs bg-green-900 text-green-400 px-1.5 py-0.5 rounded-full">✓ Verified</span>
                    )}
                  </h3>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs mt-0.5">
                    <MapPin size={11} />
                    {hospital.location?.city || 'Unknown location'}
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Updated {lastStockUpdate ? formatDate(lastStockUpdate) : 'N/A'}
                </p>
              </div>

              {/* Blood stock grid */}
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {BLOOD_GROUPS.map(bg => {
                  const entry = stock?.find(s => s.bloodGroup === bg)
                  const units = entry?.units ?? 0
                  return (
                    <div key={bg} className={`text-center p-2 rounded-lg border ${
                      units === 0
                        ? 'border-slate-800 bg-slate-900/30 opacity-40'
                        : units < 3
                        ? 'border-red-800/50 bg-red-900/10'
                        : 'border-slate-800 bg-slate-900/50'
                    } ${bloodGroup === bg ? 'ring-1 ring-blood-500' : ''}`}>
                      <p className={`font-display text-sm mb-0.5 ${bgColor(bg)}`}>{bg}</p>
                      <p className={`text-lg font-bold ${
                        units === 0 ? 'text-slate-700' :
                        units < 3  ? 'text-red-400'   : 'text-slate-100'
                      }`}>{units}</p>
                      {units > 0 && units < 3 && (
                        <p className="text-[9px] text-red-400">Low</p>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Total available */}
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                <Droplets size={11} />
                Total: {stock?.reduce((sum, s) => sum + s.units, 0) || 0} units available
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
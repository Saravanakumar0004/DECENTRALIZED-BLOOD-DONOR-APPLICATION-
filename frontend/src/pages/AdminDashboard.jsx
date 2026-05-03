// ── AdminDashboard.jsx ────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getAdminStats } from '../api/admin'
import { getAdminTransfers } from '../api/inventory'
import { LoadingSpinner } from '../components/ui/index'
import { formatDate } from '../utils/formatters'

function StatCard({ label, value, color = 'text-slate-100', sub }) {
  return (
    <div className="card text-center hover:border-slate-700 transition-all">
      <p className={`font-display text-4xl ${color} mb-1`}>{value ?? '—'}</p>
      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
      {sub && <p className="text-xs text-slate-600 mt-1">{sub}</p>}
    </div>
  )
}

// ── Transfer status badge ─────────────────────────────────────────────────────
function TransferBadge({ status }) {
  const map = {
    PENDING:    'bg-yellow-900 text-yellow-400',
    ACCEPTED:   'bg-blue-900 text-blue-400',
    IN_TRANSIT: 'bg-orange-900 text-orange-400',
    DELIVERED:  'bg-green-900 text-green-400',
    CANCELLED:  'bg-slate-800 text-slate-500',
    REJECTED:   'bg-red-900 text-red-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-slate-800 text-slate-400'}`}>
      {status}
    </span>
  )
}

export function AdminDashboard() {
  const [stats, setStats]         = useState(null)
  const [loading, setLoading]     = useState(true)
  const [transfers, setTransfers] = useState([])
  const [trLoading, setTrLoading] = useState(true)
  const [tab, setTab]             = useState('overview')
  const [trStatus, setTrStatus]   = useState('')

  useEffect(() => {
    getAdminStats().then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const loadTransfers = async () => {
    setTrLoading(true)
    try {
      const res = await getAdminTransfers({ status: trStatus || undefined, limit: 50 })
      setTransfers(res.data.data || [])
    } catch {} finally { setTrLoading(false) }
  }

  useEffect(() => {
    if (tab === 'transfers') loadTransfers()
  }, [tab, trStatus])

  if (loading) return <LoadingSpinner size="lg" className="py-24" />

  const TABS = [
    { id: 'overview',   label: '📊 Overview' },
    { id: 'transfers',  label: '🚑 Transfers' },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      <h2 className="font-display text-3xl text-slate-100">PLATFORM OVERVIEW</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit border border-slate-800">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-blood-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Donors"    value={stats?.users?.donors}              color="text-blood-400" />
            <StatCard label="Hospitals"        value={stats?.users?.hospitals}           color="text-blue-400" />
            <StatCard label="Completed"        value={stats?.donations?.completed}       color="text-green-400" />
            <StatCard label="BDC Issued"       value={stats?.totalBDCIssued}             color="text-yellow-400" />
            <StatCard label="Open Requests"    value={stats?.requests?.open}             color="text-orange-400" />
            <StatCard label="Total Donations"  value={stats?.donations?.total}           color="text-purple-400" />
            <StatCard label="Disputed"         value={stats?.donations?.disputed}        color="text-red-400" />
            <StatCard label="Total Requests"   value={stats?.requests?.total}            color="text-slate-300" />
          </div>

          {/* Blood group breakdown */}
          {stats?.bloodGroupBreakdown?.length > 0 && (
            <div className="card">
              <h3 className="font-display text-xl text-slate-200 mb-4">DONATIONS BY BLOOD GROUP</h3>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-3">
                {stats.bloodGroupBreakdown.map(({ _id, count }) => (
                  <div key={_id} className="text-center card p-3">
                    <p className="font-display text-2xl text-blood-400">{count}</p>
                    <p className="text-xs text-slate-500 font-mono">{_id}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TRANSFERS TAB ── */}
      {tab === 'transfers' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <select className="input w-auto text-sm" value={trStatus} onChange={e => setTrStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {['PENDING','ACCEPTED','IN_TRANSIT','DELIVERED','CANCELLED','REJECTED'].map(s => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500">{transfers.length} transfers</span>
          </div>

          {trLoading ? <LoadingSpinner className="py-12" /> : transfers.length === 0 ? (
            <div className="card text-center py-10 text-slate-500">No inter-hospital transfers found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
                  <tr>
                    {['From Hospital', 'To Hospital', 'Blood', 'Units', 'Urgency', 'Status', 'Ambulance', 'Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {transfers.map(t => (
                    <tr key={t._id} className="hover:bg-slate-900/50">
                      <td className="px-4 py-3">
                        <p className="text-slate-200 text-xs font-medium">
                          {t.supplyingHospital?.hospitalName || t.supplyingHospital?.name}
                        </p>
                        <p className="text-xs text-slate-600">{t.supplyingHospital?.location?.city}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-200 text-xs font-medium">
                          {t.requestingHospital?.hospitalName || t.requestingHospital?.name}
                        </p>
                        <p className="text-xs text-slate-600">{t.requestingHospital?.location?.city}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-display text-base text-blood-400">{t.bloodGroup}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono">{t.unitsRequested}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          t.urgencyLevel === 'Critical' ? 'bg-red-900 text-red-400' :
                          t.urgencyLevel === 'High'     ? 'bg-orange-900 text-orange-400' :
                          'bg-slate-800 text-slate-400'}`}>
                          {t.urgencyLevel}
                        </span>
                      </td>
                      <td className="px-4 py-3"><TransferBadge status={t.status} /></td>
                      <td className="px-4 py-3 text-xs text-orange-300 font-mono">
                        {t.ambulanceInfo?.vehicleNumber
                          ? `🚑 ${t.ambulanceInfo.vehicleNumber}`
                          : <span className="text-slate-700">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default AdminDashboard
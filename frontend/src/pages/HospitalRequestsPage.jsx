// ── HospitalRequestsPage.jsx ──────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getHospitalRequests } from '../api/admin'
import { cancelRequest } from '../api/requests'
import { BloodBadge, UrgencyChip, EmptyState, LoadingSpinner, ConfirmDialog } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

export function HospitalRequestsPage() {
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [confirm,  setConfirm]  = useState(null)

  const load = async () => {
    setLoading(true)
    try { const r = await getHospitalRequests(); setRequests(r.data.data) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCancel = async () => {
    try { await cancelRequest(confirm.id); toast.success('Request cancelled'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setConfirm(null) }
  }

  if (loading) return <LoadingSpinner className="py-20" />
  if (!requests.length) return <EmptyState title="No requests" description="Post your first blood request from the dashboard." />

  return (
    <div className="animate-fade-in space-y-3">
      {requests.map(r => (
        <div key={r._id} className="card hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-wrap">
              <BloodBadge group={r.bloodGroup} />
              <UrgencyChip level={r.urgencyLevel} />
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                r.status === 'OPEN'      ? 'bg-green-900 text-green-400' :
                r.status === 'ACCEPTED'  ? 'bg-blue-900 text-blue-400'  :
                r.status === 'COMPLETED' ? 'bg-purple-900 text-purple-400' :
                'bg-slate-800 text-slate-500'}`}>{r.status}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{formatDate(r.createdAt)}</span>
              {r.status === 'OPEN' && (
                <button onClick={() => setConfirm({ id: r._id })}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancel</button>
              )}
            </div>
          </div>
          <div className="mt-2 flex gap-4 text-xs text-slate-400">
            <span>{r.unitsRequired} unit{r.unitsRequired > 1 ? 's' : ''}</span>
            <span>{r.location?.city}</span>
            {r.donationCount > 0 && <span className="text-blue-400">{r.donationCount} donor{r.donationCount > 1 ? 's' : ''} responded</span>}
          </div>
          {r.notes && <p className="mt-2 text-xs text-slate-500 line-clamp-1">{r.notes}</p>}
        </div>
      ))}
      <ConfirmDialog open={!!confirm} title="Cancel Request?"
        message="This will cancel the blood request. Any accepted donations will remain active."
        onConfirm={handleCancel} onCancel={() => setConfirm(null)} danger />
    </div>
  )
}
export default HospitalRequestsPage

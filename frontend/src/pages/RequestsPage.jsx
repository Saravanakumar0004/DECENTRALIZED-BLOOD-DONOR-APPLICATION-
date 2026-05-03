// ── RequestsPage.jsx — Donor view of all open requests ────────────────────────
import { useEffect, useState } from 'react'
import { getRequests, acceptRequest } from '../api/requests'
import { BloodBadge, UrgencyChip, CardSkeleton, EmptyState, ConfirmDialog } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { MapPin, Droplets, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

function RequestCard({ req, onAccept }) {
  const [conf, setConf] = useState(false)
  const [loading, setLoading] = useState(false)
  const doAccept = async () => { setLoading(true); try { await onAccept(req._id) } finally { setLoading(false); setConf(false) } }
  return (
    <>
      <div className="card hover:border-slate-700 transition-all animate-fade-in">
        <div className="flex justify-between mb-3"><BloodBadge group={req.bloodGroup} /><UrgencyChip level={req.urgencyLevel} /></div>
        <h3 className="font-medium text-slate-100 mb-1 truncate">{req.hospital?.hospitalName || req.hospital?.name}</h3>
        <div className="text-xs text-slate-400 flex items-center gap-1 mb-1"><MapPin size={10} />{req.location?.city}</div>
        <div className="text-xs text-slate-400 flex items-center gap-1 mb-3"><Droplets size={10} />{req.unitsRequired} unit{req.unitsRequired>1?'s':''}</div>
        {req.notes && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{req.notes}</p>}
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-600"><Clock size={10} className="inline mr-1" />{formatDate(req.createdAt)}</span>
          <button onClick={() => setConf(true)} className="btn-primary text-xs px-3 py-1.5">Accept</button>
        </div>
      </div>
      <ConfirmDialog open={conf} title="Accept Request?"
        message={`Commit to donate ${req.bloodGroup} blood to ${req.hospital?.hospitalName || 'this hospital'}?`}
        onConfirm={doAccept} onCancel={() => setConf(false)} danger />
    </>
  )
}

export function RequestsPage() {
  const [reqs, setReqs]   = useState([])
  const [loading, setLoading] = useState(true)
  const [bg, setBg]   = useState('')
  const [urg, setUrg] = useState('')

  const load = async () => {
    setLoading(true)
    try { const r = await getRequests({ status:'OPEN', bloodGroup: bg||undefined, urgency: urg||undefined }); setReqs(r.data.data) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [bg, urg])

  const handleAccept = async (id) => {
    try { await acceptRequest(id); toast.success('Accepted!'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  return (
    <div className="animate-fade-in">
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input w-auto text-sm" value={bg} onChange={e => setBg(e.target.value)}>
          <option value="">All Blood Groups</option>
          {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
        </select>
        <select className="input w-auto text-sm" value={urg} onChange={e => setUrg(e.target.value)}>
          <option value="">All Urgency</option>
          {['Critical','High','Medium'].map(u => <option key={u}>{u}</option>)}
        </select>
      </div>
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}</div>
      ) : reqs.length === 0 ? (
        <EmptyState title="No open requests" description="Check back later for new blood requests." />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {reqs.map(r => <RequestCard key={r._id} req={r} onAccept={handleAccept} />)}
        </div>
      )}
    </div>
  )
}
export default RequestsPage

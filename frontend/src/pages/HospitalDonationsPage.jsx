// ── HospitalDonationsPage.jsx ─────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getHospitalDonations } from '../api/admin'
import { receiverConfirm } from '../api/donations'
import { BloodBadge, StatusBadge, TxHashBadge, LoadingSpinner, EmptyState } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export function HospitalDonationsPage() {
  const [donations, setDonations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [bagIds,    setBagIds]    = useState({})
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    try { const r = await getHospitalDonations(); setDonations(r.data.data) }
    catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const handleConfirm = async (id) => {
    const bid = bagIds[id]?.trim()
    if (!bid) return toast.error('Enter Blood Bag ID first')
    try { await receiverConfirm(id, bid); toast.success('Receipt confirmed!'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  if (loading) return <LoadingSpinner className="py-20" />
  if (!donations.length) return <EmptyState title="No donations" description="Donations appear here when donors accept your requests." />

  return (
    <div className="animate-fade-in overflow-x-auto rounded-xl border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
          <tr>{['Donor','Blood','Status','Blood Bag ID','Date','Actions'].map(h => (
            <th key={h} className="px-4 py-3 text-left">{h}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {donations.map(d => (
            <tr key={d._id} className="hover:bg-slate-900/50">
              <td className="px-4 py-3">
                <p className="text-slate-200 font-medium">{d.donor?.name}</p>
                <p className="text-xs text-slate-500">{d.donor?.email}</p>
              </td>
              <td className="px-4 py-3"><BloodBadge group={d.request?.bloodGroup} /></td>
              <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
              <td className="px-4 py-3">
                {d.receiverConfirmed ? (
                  <span className="text-xs font-mono text-slate-400">{d.bloodBagId}</span>
                ) : (
                  <input className="input text-xs py-1.5 w-36" placeholder="BAG-001"
                    value={bagIds[d._id] || ''}
                    onChange={e => setBagIds(p => ({ ...p, [d._id]: e.target.value }))} />
                )}
              </td>
              <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(d.createdAt)}</td>
              <td className="px-4 py-3">
                <div className="flex gap-2 flex-wrap">
                  {!d.receiverConfirmed && (
                    <button onClick={() => handleConfirm(d._id)} className="btn-primary text-xs py-1 px-2">Confirm</button>
                  )}
                  {d.readyForBlockchain && d.status !== 'COMPLETED' && (
                    <button onClick={() => navigate(`/donations/${d._id}`)}
                      className="bg-purple-700 hover:bg-purple-600 text-white text-xs py-1 px-2 rounded-lg">⛓</button>
                  )}
                  {d.txHash && <TxHashBadge hash={d.txHash} />}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export default HospitalDonationsPage

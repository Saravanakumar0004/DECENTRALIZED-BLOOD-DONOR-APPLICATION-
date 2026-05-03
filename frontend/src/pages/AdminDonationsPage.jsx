import { useState, useEffect } from 'react'
import { getAdminDonations, resolveDispute } from '../api/admin'
import { StatusBadge, BloodBadge, TxHashBadge, LoadingSpinner, EmptyState, ConfirmDialog } from '../components/ui/index'
import { formatDate, truncateAddress } from '../utils/formatters'
import toast from 'react-hot-toast'

export default function AdminDonationsPage() {
  const [donations, setDonations] = useState([])
  const [loading,   setLoading]   = useState(true)
  const [status,    setStatus]    = useState('')
  const [confirm,   setConfirm]   = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAdminDonations({ status: status || undefined })
      setDonations(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [status])

  const handleResolve = async (resolution) => {
    try {
      await resolveDispute(confirm.id, resolution)
      toast.success(`Dispute ${resolution === 'COMPLETE' ? 'completed' : 'cancelled'}`)
      load()
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setConfirm(null) }
  }

  const STATUSES = ['PENDING','DONOR_CONFIRMED','RECEIVER_CONFIRMED','COMPLETED','DISPUTED','CANCELLED']

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex gap-3 flex-wrap">
        <select className="input w-auto text-sm" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      {loading ? <LoadingSpinner className="py-12" /> : donations.length === 0 ? (
        <EmptyState title="No donations found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>{['Donor','Hospital','Blood','Status','BDC','Tx Hash','Date','Action'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {donations.map(d => (
                <tr key={d._id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3">
                    <p className="text-slate-200 font-medium">{d.donor?.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{truncateAddress(d.donor?.walletAddress)}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300 text-xs">{d.hospital?.hospitalName || d.hospital?.name}</td>
                  <td className="px-4 py-3"><BloodBadge group={d.request?.bloodGroup} /></td>
                  <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                  <td className="px-4 py-3 text-yellow-400 font-mono text-xs">{d.bdcAwarded || 0}</td>
                  <td className="px-4 py-3"><TxHashBadge hash={d.txHash} /></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(d.createdAt)}</td>
                  <td className="px-4 py-3">
                    {d.status === 'DISPUTED' && (
                      <button onClick={() => setConfirm({ id: d._id })}
                        className="text-xs bg-purple-900 hover:bg-purple-800 text-purple-300 px-2.5 py-1 rounded-lg">
                        Resolve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card max-w-sm mx-4 border-slate-700">
            <h3 className="font-semibold text-slate-100 mb-4">Resolve Dispute</h3>
            <div className="flex gap-3">
              <button onClick={() => handleResolve('COMPLETE')}
                className="flex-1 bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg text-sm">
                Mark Completed
              </button>
              <button onClick={() => handleResolve('CANCEL')}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white py-2 rounded-lg text-sm">
                Cancel Donation
              </button>
            </div>
            <button onClick={() => setConfirm(null)} className="w-full btn-ghost text-sm mt-2">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

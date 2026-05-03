// ── AdminUsersPage.jsx
import { useState, useEffect } from 'react'
import { getAdminUsers, verifyUser, deactivateUser } from '../api/admin'
import { LoadingSpinner, EmptyState, ConfirmDialog } from '../components/ui/index'
import { roleColor, formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

export function AdminUsersPage() {
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [role,    setRole]    = useState('')
  const [search,  setSearch]  = useState('')
  const [confirm, setConfirm] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAdminUsers({ role: role || undefined, search: search || undefined })
      setUsers(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [role])

  const handleVerify = async (id) => {
    try { await verifyUser(id); toast.success('User verified'); load() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setConfirm(null) }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap gap-3">
        <select className="input w-auto text-sm" value={role} onChange={e => setRole(e.target.value)}>
          <option value="">All Roles</option>
          {['DONOR','HOSPITAL','ADMIN'].map(r => <option key={r}>{r}</option>)}
        </select>
        <input className="input w-60 text-sm" placeholder="Search name or email..."
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load()} />
        <button onClick={load} className="btn-secondary text-sm">Search</button>
      </div>
      {loading ? <LoadingSpinner className="py-12" /> : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>{['Name','Email','Role','Blood Grp','Verified','Joined','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map(u => (
                <tr key={u._id} className="hover:bg-slate-900/50">
                  <td className="px-4 py-3 font-medium text-slate-200">{u.name}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3"><span className={`badge ${roleColor(u.role)}`}>{u.role}</span></td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{u.bloodGroup || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isVerified ? 'bg-green-900 text-green-400' : 'bg-slate-800 text-slate-500'}`}>
                      {u.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    {!u.isVerified && (
                      <button onClick={() => setConfirm({ id: u._id, name: u.name })}
                        className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-2.5 py-1 rounded-lg transition-all">
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={!!confirm} title="Verify User"
        message={`Verify ${confirm?.name}? They will gain full platform access.`}
        onConfirm={() => handleVerify(confirm?.id)} onCancel={() => setConfirm(null)} />
    </div>
  )
}

export default AdminUsersPage

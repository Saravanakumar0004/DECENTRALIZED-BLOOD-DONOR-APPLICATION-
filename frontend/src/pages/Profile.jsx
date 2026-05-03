// ── Profile.jsx ───────────────────────────────────────────────────────────────
import { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { updateProfile, updateWallet } from '../api/auth'
import { getBDCHistory } from '../api/admin'
import { useEffect } from 'react'
import { WalletButton, BDCCounter, TxHashBadge, LoadingSpinner } from '../components/ui/index'
import { connectWallet } from '../utils/blockchain'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'

export function Profile() {
  const { user, setUser, setWallet, walletAddress } = useAuthStore()
  const [form, setForm] = useState({ name: user?.name || '', city: user?.location?.city || '', age: user?.age || '', weight: user?.weight || '' })
  const [saving, setSaving] = useState(false)
  const [history, setHistory] = useState([])
  const [histLoading, setHistLoading] = useState(true)

  useEffect(() => {
    getBDCHistory().then(r => setHistory(r.data.data)).catch(() => {}).finally(() => setHistLoading(false))
  }, [])

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const res = await updateProfile({ ...form, age: parseInt(form.age), weight: parseFloat(form.weight) })
      setUser(res.data.user); toast.success('Profile updated!')
    } catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setSaving(false) }
  }

  const handleWallet = async () => {
    try {
      const { address } = await connectWallet()
      await updateWallet(address)
      setWallet(address)
      toast.success('Wallet linked!')
    } catch (err) { toast.error(err.message) }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in space-y-6">
      <h2 className="font-display text-3xl text-slate-100">MY PROFILE</h2>

      {user?.role === 'DONOR' && <BDCCounter balance={user?.bdcBalance || 0} />}

      <div className="card border-slate-700">
        <h3 className="font-display text-xl text-slate-200 mb-4">WALLET</h3>
        <WalletButton address={walletAddress} onClick={handleWallet} />
        {walletAddress && <p className="text-xs text-slate-500 font-mono mt-2">{walletAddress}</p>}
      </div>

      <div className="card border-slate-700">
        <h3 className="font-display text-xl text-slate-200 mb-4">EDIT PROFILE</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">City</label>
            <input className="input" value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} />
          </div>
          {user?.role === 'DONOR' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Age</label>
                <input type="number" className="input" min="18" max="65" value={form.age} onChange={e => setForm(p => ({ ...p, age: e.target.value }))} />
              </div>
              <div>
                <label className="label">Weight (kg)</label>
                <input type="number" className="input" min="50" value={form.weight} onChange={e => setForm(p => ({ ...p, weight: e.target.value }))} />
              </div>
            </div>
          )}
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save Changes'}</button>
        </form>
      </div>

      {user?.role === 'DONOR' && (
        <div className="card border-slate-700">
          <h3 className="font-display text-xl text-slate-200 mb-4">BDC HISTORY</h3>
          {histLoading ? <LoadingSpinner /> : history.length === 0 ? (
            <p className="text-slate-500 text-sm">No BDC transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map(h => (
                <div key={h._id} className="flex items-center justify-between py-2 border-b border-slate-800 last:border-0">
                  <div>
                    <p className="text-sm text-slate-300">{h.reason.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-slate-500">{formatDate(h.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono font-medium ${h.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {h.amount > 0 ? '+' : ''}{h.amount} BDC
                    </p>
                    {h.txHash && <TxHashBadge hash={h.txHash} />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Profile

export const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export const formatDateTime = (d) =>
  d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

export const truncateAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '—'

export const truncateHash = (h) =>
  h ? `${h.slice(0, 10)}...${h.slice(-6)}` : '—'

export const bloodGroupColor = (bg) => {
  const map = {
    'O+': 'bg-green-900 text-green-300 border-green-700',
    'O-': 'bg-green-950 text-green-400 border-green-800',
    'A+': 'bg-red-900 text-red-300 border-red-700',
    'A-': 'bg-red-950 text-red-400 border-red-800',
    'B+': 'bg-orange-900 text-orange-300 border-orange-700',
    'B-': 'bg-orange-950 text-orange-400 border-orange-800',
    'AB+': 'bg-purple-900 text-purple-300 border-purple-700',
    'AB-': 'bg-purple-950 text-purple-400 border-purple-800',
  }
  return map[bg] || 'bg-slate-800 text-slate-300 border-slate-600'
}

export const urgencyColor = (u) => {
  const map = {
    Critical: 'bg-red-500/20 text-red-400 border-red-500/40',
    High:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
    Medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  }
  return map[u] || 'bg-slate-700 text-slate-300'
}

export const statusColor = (s) => {
  const map = {
    PENDING:            'bg-yellow-500/20 text-yellow-400',
    DONOR_CONFIRMED:    'bg-blue-500/20 text-blue-400',
    RECEIVER_CONFIRMED: 'bg-purple-500/20 text-purple-400',
    COMPLETED:          'bg-green-500/20 text-green-400',
    DISPUTED:           'bg-red-500/20 text-red-400',
    CANCELLED:          'bg-slate-700 text-slate-400',
  }
  return map[s] || 'bg-slate-700 text-slate-300'
}

export const roleColor = (r) => {
  const map = {
    DONOR:    'bg-blood-900 text-blood-300',
    HOSPITAL: 'bg-blue-900 text-blue-300',
    ADMIN:    'bg-purple-900 text-purple-300',
  }
  return map[r] || 'bg-slate-800 text-slate-300'
}

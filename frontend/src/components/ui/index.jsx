// ── BloodBadge ────────────────────────────────────────────────────────────────
import { bloodGroupColor, urgencyColor, statusColor, truncateHash } from '../../utils/formatters'

export function BloodBadge({ group }) {
  return (
    <span className={`badge border ${bloodGroupColor(group)} font-mono font-bold text-sm px-3 py-1`}>
      {group}
    </span>
  )
}

// ── UrgencyChip ───────────────────────────────────────────────────────────────
export function UrgencyChip({ level }) {
  return (
    <span className={`badge border ${urgencyColor(level)} text-xs uppercase tracking-wide`}>
      {level === 'Critical' && '🔴 '}
      {level === 'High'     && '🟠 '}
      {level === 'Medium'   && '🟡 '}
      {level}
    </span>
  )
}

// ── StatusStep ────────────────────────────────────────────────────────────────
const STEPS = ['PENDING', 'DONOR_CONFIRMED', 'RECEIVER_CONFIRMED', 'COMPLETED']
const STEP_LABELS = ['Pending', 'Donor Confirmed', 'Hospital Confirmed', 'Completed']

export function StatusStep({ status }) {
  const idx = STEPS.indexOf(status)
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${i < idx  ? 'bg-green-500 text-white'
            : i === idx ? 'bg-blood-600 text-white ring-2 ring-blood-400'
            : 'bg-slate-700 text-slate-500'}`}>
            {i < idx ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-0.5 ${i < idx ? 'bg-green-500' : 'bg-slate-700'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ── StatusBadge ───────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  return (
    <span className={`badge ${statusColor(status)} text-xs font-medium px-2.5 py-1 rounded-full`}>
      {status?.replace(/_/g, ' ')}
    </span>
  )
}

// ── BDCCounter ────────────────────────────────────────────────────────────────
export function BDCCounter({ balance = 0 }) {
  return (
    <div className="flex items-center gap-2 bg-blood-900/40 border border-blood-800/50 rounded-xl px-4 py-2">
      <div className="w-8 h-8 rounded-full bg-blood-600 flex items-center justify-center text-sm font-bold text-white">B</div>
      <div>
        <p className="text-xs text-slate-400 leading-none">BDC Balance</p>
        <p className="text-xl font-display text-blood-400 leading-tight">{balance.toLocaleString()}</p>
      </div>
    </div>
  )
}

// ── WalletButton ──────────────────────────────────────────────────────────────
export function WalletButton({ address, onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading}
      className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-sm px-3 py-2 rounded-lg transition-all">
      <span className={`w-2 h-2 rounded-full ${address ? 'bg-green-400' : 'bg-slate-500'}`} />
      <span className="font-mono text-xs text-slate-300">
        {loading ? 'Connecting...' : address ? `${address.slice(0,6)}...${address.slice(-4)}` : 'Connect Wallet'}
      </span>
    </button>
  )
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────
export function LoadingSpinner({ size = 'md', className = '' }) {
  const s = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size]
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${s} border-2 border-slate-700 border-t-blood-500 rounded-full animate-spin`} />
    </div>
  )
}

// ── PageLoader ────────────────────────────────────────────────────────────────
export function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="w-16 h-16 border-2 border-slate-700 border-t-blood-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-slate-400 text-sm">Loading...</p>
      </div>
    </div>
  )
}

// ── EmptyState ────────────────────────────────────────────────────────────────
export function EmptyState({ icon = '🩸', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-4">
      <div className="text-5xl mb-4 opacity-60">{icon}</div>
      <h3 className="text-lg font-medium text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-sm text-slate-500 mb-6 max-w-xs">{description}</p>}
      {action}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function Skeleton({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

export function CardSkeleton() {
  return (
    <div className="card animate-pulse">
      <div className="flex justify-between mb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-16" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <Skeleton className="h-9 w-28" />
    </div>
  )
}

// ── TxHashBadge ───────────────────────────────────────────────────────────────
export function TxHashBadge({ hash }) {
  const base = import.meta.env.VITE_ETHERSCAN_BASE || 'https://sepolia.etherscan.io/tx/'
  if (!hash) return <span className="text-slate-500 text-xs">—</span>
  return (
    <a href={`${base}${hash}`} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs font-mono text-blood-400 hover:text-blood-300 underline-offset-2 hover:underline transition-colors">
      {truncateHash(hash)}
      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
    </a>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
export function ConfirmDialog({ open, title, message, onConfirm, onCancel, danger = false }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="card max-w-md w-full mx-4 shadow-2xl border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">{title}</h3>
        <p className="text-sm text-slate-400 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary text-sm">Cancel</button>
          <button onClick={onConfirm} className={`text-sm px-4 py-2 rounded-lg font-medium transition-all active:scale-95 ${danger ? 'bg-blood-600 hover:bg-blood-700 text-white' : 'btn-primary'}`}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

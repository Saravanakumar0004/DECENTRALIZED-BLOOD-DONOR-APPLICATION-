// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/pages/AIAnalystPage.jsx  (FULL REPLACEMENT)
// WHAT CHANGED vs old version:
//   • Uses new src/api/ai.js instead of raw fetch()
//   • Added DonorProfileModal — shows full donor profile from any request ID
//   • Added RequestDonorsPanel — GET all donors for a request + accept/reject buttons
//   • All GET / POST / PUT / DELETE actions wired to new api/ai.js helpers
//   • AI chat responses now detect IDs and show "View Donor" clickable buttons
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  fetchAIData, sendAIChat, executeAIAction, generateAIReport, getAIDashboard,
  getAIDonorProfile, getRequestDonors, acceptDonorForRequest,
  selectDonorForRequest, removeDonorFromRequest,
  getAIRequests, getAIRequestById, cancelAIRequest,
  getAIDonations, resolveAIDispute,
  getAIUsers, verifyAIUser, deactivateAIUser,
  getAIInventory, getAITransfers, acceptAITransfer, deliverAITransfer,
} from '../api/ai'
import {
  Bot, AlertTriangle, Send, X, Zap, RefreshCw, ChevronDown, Sparkles,
  Activity, TrendingUp, Droplets, Users, Building2, Shield, Download,
  CheckCircle, XCircle, UserCheck, FileText, BarChart2, AlertCircle,
  ChevronRight, Play, Loader2, Database, Cpu, Lock, Eye, UserX,
  Truck, Package, ArrowRight,
} from 'lucide-react'

// ─────────────────────────────────────────────────────────────────────────────
//  QUICK PROMPTS (role-specific)
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_PROMPTS = {
  ADMIN: [
    { icon: '🚨', label: 'Critical Alerts',     text: 'What are the most critical issues right now? List urgent actions with specific IDs.', color: 'from-red-900/40 to-red-900/10 border-red-800/50 hover:border-red-600' },
    { icon: '📊', label: 'Platform Health',      text: 'Give me a complete executive platform health summary — users, donations, requests, BDC, blockchain rates, key trends.', color: 'from-blue-900/40 to-blue-900/10 border-blue-800/50 hover:border-blue-600' },
    { icon: '🩸', label: 'Supply vs Demand',     text: 'Analyse blood supply vs demand for every blood group. Which groups face critical shortages?', color: 'from-rose-900/40 to-rose-900/10 border-rose-800/50 hover:border-rose-600' },
    { icon: '👥', label: 'Donor Segmentation',   text: 'Segment all donors into Elite/Regular/New/Inactive with IDs. Show re-engagement strategies.', color: 'from-green-900/40 to-green-900/10 border-green-800/50 hover:border-green-600' },
    { icon: '🏥', label: 'Hospital Ranking',     text: 'Rank all hospitals by performance. Identify underperformers with IDs.', color: 'from-purple-900/40 to-purple-900/10 border-purple-800/50 hover:border-purple-600' },
    { icon: '⚖️', label: 'Resolve Disputes',    text: 'List all disputed donations with IDs. Recommend COMPLETE or CANCEL for each.', color: 'from-orange-900/40 to-orange-900/10 border-orange-800/50 hover:border-orange-600' },
    { icon: '✅', label: 'Pending Verifications', text: 'Show all users waiting for verification. Who should I verify first?', color: 'from-teal-900/40 to-teal-900/10 border-teal-800/50 hover:border-teal-600' },
    { icon: '📋', label: 'Open Requests + Donors', text: 'Show all open blood requests with their accepted donor IDs and profiles.', color: 'from-indigo-900/40 to-indigo-900/10 border-indigo-800/50 hover:border-indigo-600' },
    { icon: '📈', label: 'Monthly Trends',       text: 'Show donation trends over the last 6 months. Growing or declining?', color: 'from-yellow-900/40 to-yellow-900/10 border-yellow-800/50 hover:border-yellow-600' },
    { icon: '🪙', label: 'BDC Economy',          text: 'Analyse BDC token economy. How much issued, redeemed? Is it driving more donations?', color: 'from-amber-900/40 to-amber-900/10 border-amber-800/50 hover:border-amber-600' },
    { icon: '🔄', label: 'Transfer Analysis',    text: 'Review all inter-hospital transfers. Which hospitals are net suppliers vs net receivers?', color: 'from-cyan-900/40 to-cyan-900/10 border-cyan-800/50 hover:border-cyan-600' },
    { icon: '⛓️', label: 'Blockchain Compliance', text: 'Analyse blockchain and proof compliance. What % of donations are fully on-chain?', color: 'from-slate-800/60 to-slate-800/20 border-slate-700/50 hover:border-slate-500' },
  ],
  HOSPITAL: [
    { icon: '🚨', label: 'Urgent Actions',       text: 'What are the top 5 most urgent things I need to do RIGHT NOW? Be specific with IDs.', color: 'from-red-900/40 to-red-900/10 border-red-800/50 hover:border-red-600' },
    { icon: '📊', label: 'Full Dashboard',       text: 'Give me a complete operational summary — donations, requests, inventory, transfers.', color: 'from-blue-900/40 to-blue-900/10 border-blue-800/50 hover:border-blue-600' },
    { icon: '🩸', label: 'Inventory Analysis',   text: 'Analyse my current blood inventory. Which groups are critically low?', color: 'from-rose-900/40 to-rose-900/10 border-rose-800/50 hover:border-rose-600' },
    { icon: '👤', label: 'Donor Profiles',       text: 'Show all donors who accepted my open requests. Give their full profiles and IDs.', color: 'from-green-900/40 to-green-900/10 border-green-800/50 hover:border-green-600' },
    { icon: '⏳', label: 'Awaiting Confirmation', text: 'Which donations need my confirmation right now? Give me the IDs to act on.', color: 'from-yellow-900/40 to-yellow-900/10 border-yellow-800/50 hover:border-yellow-600' },
    { icon: '⚖️', label: 'My Disputes',          text: 'Review my disputed donations. What action should I take?', color: 'from-orange-900/40 to-orange-900/10 border-orange-800/50 hover:border-orange-600' },
    { icon: '📋', label: 'Request + Donors',     text: 'Show all my open requests with the donors who accepted them and their contact details.', color: 'from-purple-900/40 to-purple-900/10 border-purple-800/50 hover:border-purple-600' },
    { icon: '🔄', label: 'Transfers',            text: 'Review my inter-hospital transfers. Any pending ones I need to act on?', color: 'from-cyan-900/40 to-cyan-900/10 border-cyan-800/50 hover:border-cyan-600' },
  ],
  DONOR: [
    { icon: '📊', label: 'My Profile',           text: 'Give me a complete personal summary — category, donation history, BDC balance, pending actions.', color: 'from-blue-900/40 to-blue-900/10 border-blue-800/50 hover:border-blue-600' },
    { icon: '🩺', label: 'Am I Eligible?',       text: 'Am I currently eligible to donate based on my age, weight, and donation history?', color: 'from-teal-900/40 to-teal-900/10 border-teal-800/50 hover:border-teal-600' },
    { icon: '🩸', label: 'Help Nearby',          text: 'Which open blood requests match my blood group? How urgently are hospitals needing my type?', color: 'from-rose-900/40 to-rose-900/10 border-rose-800/50 hover:border-rose-600' },
    { icon: '⏳', label: 'Pending Actions',      text: 'Do I have donations where I need to confirm or upload proof? Give specific steps.', color: 'from-yellow-900/40 to-yellow-900/10 border-yellow-800/50 hover:border-yellow-600' },
    { icon: '🪙', label: 'BDC Earnings',         text: 'How much BDC have I earned? How can I earn more? What are Elite status benefits?', color: 'from-amber-900/40 to-amber-900/10 border-amber-800/50 hover:border-amber-600' },
    { icon: '⛓️', label: 'Blockchain Status',    text: 'Are my donations recorded on blockchain? Do I have any proof uploads missing?', color: 'from-purple-900/40 to-purple-900/10 border-purple-800/50 hover:border-purple-600' },
    { icon: '🚀', label: 'Become Elite',         text: 'I want to reach Elite status. Give me a personalised step-by-step plan.', color: 'from-orange-900/40 to-orange-900/10 border-orange-800/50 hover:border-orange-600' },
    { icon: '📰', label: 'Donor Health',         text: 'What are the latest health tips for regular blood donors?', color: 'from-slate-800/60 to-slate-800/20 border-slate-700/50 hover:border-slate-500' },
  ],
}

const REPORT_TYPES = {
  ADMIN: [
    { id: 'platform_health',      label: 'Platform Health',       icon: '📊' },
    { id: 'blood_supply',         label: 'Blood Supply Analysis', icon: '🩸' },
    { id: 'donor_engagement',     label: 'Donor Engagement',      icon: '👥' },
    { id: 'hospital_performance', label: 'Hospital Performance',  icon: '🏥' },
    { id: 'compliance',           label: 'Compliance Report',     icon: '⛓️' },
  ],
  HOSPITAL: [
    { id: 'platform_health',      label: 'My Hospital Report',    icon: '🏥' },
    { id: 'blood_supply',         label: 'Inventory Analysis',    icon: '🩸' },
    { id: 'compliance',           label: 'Compliance Status',     icon: '⛓️' },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  DONOR PROFILE MODAL
//  Opens when you click "View Donor" on any donor ID from AI response or panel
// ─────────────────────────────────────────────────────────────────────────────
function DonorProfileModal({ donorId, requestId, onClose, onAccept, onRemove }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [acting,  setActing]  = useState(null)
  const [msg,     setMsg]     = useState(null)

  useEffect(() => {
    if (!donorId) return
    setLoading(true)
    getAIDonorProfile(donorId)
      .then(r => setProfile(r.data?.donor || r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [donorId])

  const act = async (fn, label) => {
    setActing(label); setMsg(null)
    try {
      await fn()
      setMsg({ type: 'success', text: `${label} successful!` })
      onAccept?.()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-slate-100 font-semibold flex items-center gap-2">
            <Users size={16} className="text-red-400" /> Donor Profile
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="p-4">
          {loading && (
            <div className="flex items-center justify-center py-10 gap-3">
              <Loader2 size={20} className="animate-spin text-red-400" />
              <span className="text-slate-400 text-sm">Loading donor profile…</span>
            </div>
          )}
          {error && <p className="text-red-400 text-sm p-3 bg-red-900/20 rounded-xl">{error}</p>}

          {profile && (
            <div className="space-y-4">
              {/* Avatar + name */}
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-900 to-slate-800 border border-red-800/50 flex items-center justify-center text-2xl font-bold text-red-400">
                  {profile.name?.[0] || 'D'}
                </div>
                <div>
                  <p className="text-slate-100 font-semibold">{profile.name}</p>
                  <p className="text-slate-500 text-xs">{profile.email}</p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 border border-red-800/40 text-red-400">{profile.bloodGroup}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">{profile.donorCategory || 'New'}</span>
                    {profile.isVerified && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-900/40 border border-green-800/40 text-green-400">✓ Verified</span>}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Total Donations', value: profile.totalDonations ?? '—' },
                  { label: 'BDC Balance',     value: profile.bdcBalance ?? '—' },
                  { label: 'Age / Weight',    value: `${profile.age ?? '—'}y / ${profile.weight ?? '—'}kg` },
                  { label: 'City',            value: profile.city || '—' },
                  { label: 'Last Donation',   value: profile.lastDonationDate ? new Date(profile.lastDonationDate).toLocaleDateString() : '—' },
                  { label: 'Eligible',        value: profile.canDonateAgain ? '✓ Yes' : '✗ No' },
                ].map(s => (
                  <div key={s.label} className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <p className="text-slate-100 font-semibold text-sm truncate">{s.value}</p>
                    <p className="text-slate-500 text-[10px] mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Health info */}
              {(profile.healthConditions?.length > 0 || profile.currentMedications?.length > 0) && (
                <div className="p-3 rounded-xl bg-yellow-900/10 border border-yellow-800/30">
                  <p className="text-yellow-400 text-xs font-medium mb-1">⚕️ Health Notes</p>
                  {profile.healthConditions?.length > 0 && <p className="text-slate-400 text-xs">Conditions: {profile.healthConditions.join(', ')}</p>}
                  {profile.currentMedications?.length > 0 && <p className="text-slate-400 text-xs">Medications: {profile.currentMedications.join(', ')}</p>}
                </div>
              )}

              {/* Donor ID */}
              <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                <p className="text-slate-600 text-[10px] uppercase tracking-wide mb-0.5">Donor ID</p>
                <p className="text-slate-300 font-mono text-xs break-all">{profile._id || donorId}</p>
              </div>

              {msg && (
                <div className={`p-3 rounded-xl border text-sm ${msg.type === 'success' ? 'bg-green-900/20 border-green-800/40 text-green-400' : 'bg-red-900/20 border-red-800/40 text-red-400'}`}>
                  {msg.text}
                </div>
              )}

              {/* Action buttons (only when requestId is provided) */}
              {requestId && (
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => act(() => acceptDonorForRequest(requestId, donorId), 'Accept Donor')}
                    disabled={!!acting}
                    className="flex-1 py-2.5 rounded-xl bg-green-900/40 border border-green-800/50 text-green-400 text-sm font-medium hover:bg-green-900/60 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {acting === 'Accept Donor' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                    Accept Donor
                  </button>
                  <button
                    onClick={() => act(() => removeDonorFromRequest(requestId, donorId), 'Remove Donor')}
                    disabled={!!acting}
                    className="flex-1 py-2.5 rounded-xl bg-red-900/40 border border-red-800/50 text-red-400 text-sm font-medium hover:bg-red-900/60 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
                  >
                    {acting === 'Remove Donor' ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  REQUEST DONORS PANEL
//  Shows all donors who accepted a specific request + accept/remove buttons
// ─────────────────────────────────────────────────────────────────────────────
function RequestDonorsPanel({ requestId, onClose }) {
  const [donors,  setDonors]  = useState([])
  const [request, setRequest] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [acting,  setActing]  = useState(null)
  const [msg,     setMsg]     = useState(null)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Run both calls independently — one failing must not block the other
      const [reqRes, donRes] = await Promise.allSettled([
        getAIRequestById(requestId),
        getRequestDonors(requestId),
      ])

      if (reqRes.status === 'fulfilled') {
        const reqData = reqRes.value.data
        // Backend returns found:false for expired/deleted requests instead of 404
        if (reqData?.found === false) {
          setRequest({ _expired: true, message: reqData.message })
        } else {
          setRequest(reqData?.request || reqData)
        }
      } else {
        setRequest({ _expired: true, message: 'Request not found or expired' })
      }

      if (donRes.status === 'fulfilled') {
        setDonors(donRes.value.data?.donors || donRes.value.data || [])
      } else {
        setDonors([])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [requestId])

  useEffect(() => { load() }, [load])

  const act = async (fn, label) => {
    setActing(label); setMsg(null)
    try {
      await fn()
      setMsg({ type: 'success', text: `${label} done!` })
      load()
    } catch (e) {
      setMsg({ type: 'error', text: e.message })
    } finally {
      setActing(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h3 className="text-slate-100 font-semibold flex items-center gap-2">
            <Users size={16} className="text-red-400" /> Request Donors
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={18} /></button>
        </div>

        <div className="p-4 space-y-4">
          {request && !request._expired && (
            <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-100 font-medium text-sm">Request:</span>
                <span className="text-red-400 font-mono text-xs">{requestId}</span>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-800/40 text-red-400">{request.bloodGroup}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-900/40 border border-orange-800/40 text-orange-400">{request.urgencyLevel}</span>
                <span className="text-xs text-slate-500">{request.unitsRequired} units</span>
              </div>
            </div>
          )}
          {request?._expired && (
            <div className="p-3 rounded-xl bg-yellow-900/20 border border-yellow-800/40 flex items-center gap-2">
              <AlertCircle size={14} className="text-yellow-400 shrink-0" />
              <p className="text-yellow-400 text-xs">This request has expired or been deleted. Showing any linked donors below.</p>
            </div>
          )}

          {loading && <div className="flex items-center justify-center py-8 gap-3"><Loader2 size={18} className="animate-spin text-red-400" /><span className="text-slate-400 text-sm">Loading donors…</span></div>}
          {error && <p className="text-red-400 text-sm p-3 bg-red-900/20 rounded-xl">{error}</p>}

          {msg && (
            <div className={`p-3 rounded-xl border text-sm ${msg.type === 'success' ? 'bg-green-900/20 border-green-800/40 text-green-400' : 'bg-red-900/20 border-red-800/40 text-red-400'}`}>
              {msg.text}
            </div>
          )}

          {!loading && donors.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">No donors have accepted this request yet.</div>
          )}

          {donors.map(d => (
            <div key={d._id} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/50 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-900 to-slate-800 border border-red-800/50 flex items-center justify-center text-lg font-bold text-red-400">
                  {d.name?.[0] || 'D'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-100 font-medium text-sm truncate">{d.name}</p>
                  <p className="text-slate-500 text-xs">{d.email} · {d.city}</p>
                </div>
                <div className="flex gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-red-900/40 border border-red-800/40 text-red-400">{d.bloodGroup}</span>
                  {d.isVerified && <span className="text-[10px] px-1.5 py-0.5 rounded-lg bg-green-900/40 border border-green-800/40 text-green-400">✓</span>}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800"><p className="text-slate-100 text-xs font-semibold">{d.totalDonations ?? '—'}</p><p className="text-slate-600 text-[9px]">Donations</p></div>
                <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800"><p className="text-slate-100 text-xs font-semibold">{d.bdcBalance ?? '—'}</p><p className="text-slate-600 text-[9px]">BDC</p></div>
                <div className="p-1.5 rounded-lg bg-slate-900/60 border border-slate-800"><p className={`text-xs font-semibold ${d.canDonateAgain ? 'text-green-400' : 'text-red-400'}`}>{d.canDonateAgain ? 'Eligible' : 'Not eligible'}</p><p className="text-slate-600 text-[9px]">Status</p></div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => act(() => acceptDonorForRequest(requestId, d._id), `Accept ${d.name}`)}
                  disabled={!!acting}
                  className="flex-1 py-2 rounded-xl bg-green-900/40 border border-green-800/50 text-green-400 text-xs font-medium hover:bg-green-900/60 transition-all disabled:opacity-30 flex items-center justify-center gap-1.5"
                >
                  {acting === `Accept ${d.name}` ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />} Accept
                </button>
                <button
                  onClick={() => setSelected({ donorId: d._id, requestId })}
                  className="px-3 py-2 rounded-xl bg-blue-900/40 border border-blue-800/50 text-blue-400 text-xs font-medium hover:bg-blue-900/60 transition-all flex items-center gap-1.5"
                >
                  <Eye size={11} /> Profile
                </button>
                <button
                  onClick={() => act(() => removeDonorFromRequest(requestId, d._id), `Remove ${d.name}`)}
                  disabled={!!acting}
                  className="px-3 py-2 rounded-xl bg-red-900/40 border border-red-800/50 text-red-400 text-xs font-medium hover:bg-red-900/60 transition-all disabled:opacity-30 flex items-center gap-1.5"
                >
                  {acting === `Remove ${d.name}` ? <Loader2 size={11} className="animate-spin" /> : <UserX size={11} />} Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <DonorProfileModal
          donorId={selected.donorId}
          requestId={selected.requestId}
          onClose={() => setSelected(null)}
          onAccept={load}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  ACTION PANEL (upgraded with all actions)
// ─────────────────────────────────────────────────────────────────────────────
function ActionPanel({ liveData, role, onActionDone }) {
  const [executing,    setExecuting]    = useState(null)
  const [actionResult, setActionResult] = useState(null)
  const [actionError,  setActionError]  = useState(null)
  const [viewRequest,  setViewRequest]  = useState(null)

  const doAction = async (action, params, label) => {
    setExecuting(label); setActionResult(null); setActionError(null)
    try {
      const res = await executeAIAction(action, params)
      setActionResult(res.data?.result?.message || 'Action completed successfully.')
      onActionDone?.()
    } catch (e) {
      setActionError(e.message)
    } finally {
      setExecuting(null)
    }
  }

  if (role === 'DONOR') return null
  const alerts = liveData?.alertsAndActions

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Play size={14} className="text-red-400" />
        <h3 className="text-sm font-semibold text-slate-300">Quick Actions</h3>
        <span className="text-[10px] text-slate-600 ml-auto">AI-powered actions</span>
      </div>

      {actionResult && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-green-900/20 border border-green-800/40">
          <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
          <p className="text-green-300 text-xs">{actionResult}</p>
          <button onClick={() => setActionResult(null)} className="ml-auto text-green-600 hover:text-green-400"><X size={12} /></button>
        </div>
      )}
      {actionError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-900/20 border border-red-800/40">
          <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-300 text-xs">{actionError}</p>
          <button onClick={() => setActionError(null)} className="ml-auto text-red-600 hover:text-red-400"><X size={12} /></button>
        </div>
      )}

      {/* OPEN REQUESTS — with "View Donors" button */}
      {role === 'HOSPITAL' && alerts?.openRequests?.length > 0 && (
        <div>
          <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertCircle size={10} /> {alerts.openRequests.length} Open Requests
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-hide">
            {alerts.openRequests.map(r => (
              <div key={r.requestId || r.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium">{r.bloodGroup} · {r.units} units</p>
                  <p className="text-[10px] text-slate-500">{r.urgency} · {r.acceptedDonorCount || 0} donors accepted</p>
                  <p className="text-[10px] text-slate-600 font-mono truncate">{r.requestId || r.id}</p>
                </div>
                <button
                  onClick={() => setViewRequest(r.requestId || r.id)}
                  className="px-2.5 py-1 rounded-lg bg-blue-900/40 border border-blue-800/50 text-blue-400 text-[10px] font-medium hover:bg-blue-900/60 transition-all shrink-0 flex items-center gap-1"
                >
                  <Users size={9} /> Donors
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN: Disputed donations */}
      {role === 'ADMIN' && alerts?.disputedDonations?.length > 0 && (
        <div>
          <p className="text-[10px] text-orange-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertCircle size={10} /> {alerts.disputedDonations.length} Disputed Donations</p>
          <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
            {alerts.disputedDonations.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{d.donor} → {d.hospital}</p>
                  <p className="text-[10px] text-slate-500">{d.bloodGroup} · {d.reason || 'No reason'}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => doAction('resolve_dispute', { donationId: d.id, resolution: 'COMPLETE' }, `Complete #${d.id}`)} disabled={!!executing}
                    className="px-2 py-1 rounded-lg bg-green-900/40 border border-green-800/50 text-green-400 text-[10px] font-medium hover:bg-green-900/60 transition-all disabled:opacity-30">
                    {executing === `Complete #${d.id}` ? <Loader2 size={10} className="animate-spin" /> : '✓ Complete'}
                  </button>
                  <button onClick={() => doAction('resolve_dispute', { donationId: d.id, resolution: 'CANCEL' }, `Cancel #${d.id}`)} disabled={!!executing}
                    className="px-2 py-1 rounded-lg bg-red-900/40 border border-red-800/50 text-red-400 text-[10px] font-medium hover:bg-red-900/60 transition-all disabled:opacity-30">
                    {executing === `Cancel #${d.id}` ? <Loader2 size={10} className="animate-spin" /> : '✕ Cancel'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN: Pending verifications */}
      {role === 'ADMIN' && alerts?.pendingVerifications?.length > 0 && (
        <div>
          <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><UserCheck size={10} /> {alerts.pendingVerifications.length} Awaiting Verification</p>
          <div className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
            {alerts.pendingVerifications.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{u.name}</p>
                  <p className="text-[10px] text-slate-500">{u.role} · {u.bloodGroup || u.hospitalName || u.email}</p>
                </div>
                <button onClick={() => doAction('verify_user', { userId: u.id }, `Verify ${u.name}`)} disabled={!!executing}
                  className="px-2.5 py-1 rounded-lg bg-blue-900/40 border border-blue-800/50 text-blue-400 text-[10px] font-medium hover:bg-blue-900/60 transition-all disabled:opacity-30 shrink-0">
                  {executing === `Verify ${u.name}` ? <Loader2 size={10} className="animate-spin" /> : '✓ Verify'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HOSPITAL: Awaiting confirmation */}
      {role === 'HOSPITAL' && alerts?.awaitingHospitalConfirmation?.length > 0 && (
        <div>
          <p className="text-[10px] text-yellow-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><AlertCircle size={10} /> {alerts.awaitingHospitalConfirmation.length} Awaiting Confirmation</p>
          <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide">
            {alerts.awaitingHospitalConfirmation.map(d => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-medium truncate">{d.donor}</p>
                  <p className="text-[10px] text-slate-500">{d.bloodGroup} · {d.urgency} · Donor confirmed</p>
                </div>
                <a href={`/donations/${d.id}`}
                  className="px-2.5 py-1 rounded-lg bg-yellow-900/40 border border-yellow-800/50 text-yellow-400 text-[10px] font-medium hover:bg-yellow-900/60 transition-all shrink-0">
                  Confirm →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low stock alerts */}
      {role === 'ADMIN' && alerts?.lowStockHospitals?.length > 0 && (
        <div>
          <p className="text-[10px] text-red-400 font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"><Droplets size={10} /> {alerts.lowStockHospitals.length} Hospitals Low Stock</p>
          <div className="space-y-1.5 max-h-28 overflow-y-auto scrollbar-hide">
            {alerts.lowStockHospitals.slice(0, 4).map((h, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 border border-slate-700/40">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 truncate">{h.hospital}</p>
                  <p className="text-[10px] text-red-400">{h.criticalGroups?.length > 0 ? `Zero: ${h.criticalGroups.join(', ')}` : `Low: ${h.lowGroups?.join(', ')}`}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!alerts?.disputedDonations?.length && !alerts?.pendingVerifications?.length &&
       !alerts?.awaitingHospitalConfirmation?.length && !alerts?.lowStockHospitals?.length &&
       !alerts?.openRequests?.length && (
        <div className="text-center py-4">
          <CheckCircle size={20} className="text-green-500 mx-auto mb-2" />
          <p className="text-slate-500 text-xs">No immediate actions required</p>
        </div>
      )}

      {viewRequest && <RequestDonorsPanel requestId={viewRequest} onClose={() => setViewRequest(null)} />}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  REPORT PANEL
// ─────────────────────────────────────────────────────────────────────────────
function ReportPanel({ role }) {
  const [generating, setGenerating] = useState(null)
  const [report,     setReport]     = useState(null)
  const [reportError, setReportError] = useState(null)
  const types = REPORT_TYPES[role] || []
  if (!types.length) return null

  const generate = async (type) => {
    setGenerating(type); setReport(null); setReportError(null)
    try {
      const res = await generateAIReport(type)
      setReport({ ...res.data, typeLabel: types.find(t => t.id === type)?.label })
    } catch (e) { setReportError(e.message) }
    finally { setGenerating(null) }
  }

  const downloadReport = () => {
    if (!report) return
    const blob = new Blob([report.report], { type: 'text/markdown' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `bloodlink-${report.reportType}-${new Date().toISOString().split('T')[0]}.md`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <FileText size={14} className="text-blue-400" />
        <h3 className="text-sm font-semibold text-slate-300">AI Reports</h3>
        <span className="text-[10px] text-slate-600 ml-auto">Click to generate</span>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        {types.map(t => (
          <button key={t.id} onClick={() => generate(t.id)} disabled={!!generating}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-slate-200 hover:border-blue-800/60 hover:bg-blue-900/10 transition-all text-xs disabled:opacity-40">
            <span>{t.icon}</span><span className="font-medium flex-1 text-left">{t.label}</span>
            {generating === t.id ? <Loader2 size={12} className="animate-spin text-blue-400" /> : <ChevronRight size={12} />}
          </button>
        ))}
      </div>
      {reportError && <div className="p-2.5 rounded-xl bg-red-900/20 border border-red-800/40 text-red-400 text-xs">{reportError}</div>}
      {report && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-green-400 font-medium">✓ {report.typeLabel} ready</p>
            <button onClick={downloadReport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-900/40 border border-blue-800/50 text-blue-400 text-xs hover:bg-blue-900/60 transition-all">
              <Download size={11} /> Download .md
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-hide bg-slate-950/50 rounded-xl p-3 border border-slate-800/60">
            <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">{report.report?.slice(0, 1500)}{report.report?.length > 1500 ? '\n\n… (download for full report)' : ''}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  STAT TILES
// ─────────────────────────────────────────────────────────────────────────────
function StatTiles({ data }) {
  if (!data) return null
  let tiles = []
  if (data.role === 'ADMIN') {
    const s = data.snapshot
    tiles = [
      { label: 'Total Donors',      value: s.users.donors,           accent: '#60a5fa', icon: '👥' },
      { label: 'Unverified',        value: s.users.unverifiedDonors + s.users.unverifiedHospitals, accent: '#fb923c', icon: '⚠️' },
      { label: 'Open Requests',     value: s.requests.open,          accent: '#f87171', icon: '📋' },
      { label: 'Critical Open',     value: s.requests.criticalOpen,  accent: '#ef4444', icon: '🚨' },
      { label: 'Completed Dons',    value: s.donations.completed,    accent: '#4ade80', icon: '✅' },
      { label: 'Disputed',          value: s.donations.disputed,     accent: '#f97316', icon: '⚖️' },
      { label: 'On Blockchain',     value: s.donations.onBlockchain, accent: '#a78bfa', icon: '⛓️' },
      { label: 'BDC Issued',        value: s.bdc.totalIssued,        accent: '#fde047', icon: '🪙' },
      { label: 'Transfers',         value: s.transfers.total,        accent: '#38bdf8', icon: '🔄' },
      { label: 'In Transit',        value: s.transfers.inTransit,    accent: '#0ea5e9', icon: '🚑' },
      { label: 'New (30d)',          value: s.users.newLast30d,       accent: '#86efac', icon: '🆕' },
      { label: 'Blockchain Rate',   value: s.donations.blockchainRate, accent: '#c4b5fd', icon: '📈' },
    ]
  } else if (data.role === 'HOSPITAL') {
    const s = data.stats
    tiles = [
      { label: 'Open Requests',     value: s.requests.open,          accent: '#f87171', icon: '📋' },
      { label: 'Critical',          value: s.requests.criticalOpen,  accent: '#ef4444', icon: '🚨' },
      { label: 'Completed Dons',    value: s.donations.completed,    accent: '#4ade80', icon: '✅' },
      { label: 'Awaiting Confirm',  value: data.alertsAndActions?.awaitingHospitalConfirmation?.length || 0, accent: '#fbbf24', icon: '⏳' },
      { label: 'Disputed',          value: s.donations.disputed,     accent: '#fb923c', icon: '⚖️' },
      { label: 'Total Stock',       value: data.inventory?.totalUnits, accent: '#60a5fa', icon: '🩸' },
      { label: 'Zero Stock Groups', value: data.inventory?.zeroStock?.length, accent: '#f87171', icon: '📉' },
      { label: 'On Blockchain',     value: s.donations.onBlockchain, accent: '#a78bfa', icon: '⛓️' },
      { label: 'BDC Issued',        value: s.bdc.totalIssued,        accent: '#fde047', icon: '🪙' },
      { label: 'Transfers In',      value: data.transfers?.incoming?.length, accent: '#38bdf8', icon: '📥' },
      { label: 'Transfers Out',     value: data.transfers?.outgoing?.length, accent: '#0ea5e9', icon: '📤' },
      { label: 'Proof Uploaded',    value: s.donations.proofUploaded, accent: '#86efac', icon: '📷' },
    ]
  } else {
    const cat = data.donationSummary
    tiles = [
      { label: 'Category',          value: cat.category,             accent: cat.category === 'Elite' ? '#fbbf24' : '#4ade80', icon: '🎖️' },
      { label: 'Completed Dons',    value: cat.completed,            accent: '#4ade80', icon: '✅' },
      { label: 'BDC Balance',       value: data.donor?.bdcBalance,   accent: '#fde047', icon: '🪙' },
      { label: 'BDC Earned',        value: data.proofStatus?.totalBDCEarned, accent: '#fbbf24', icon: '💰' },
      { label: 'On Blockchain',     value: data.proofStatus?.onBlockchain,   accent: '#a78bfa', icon: '⛓️' },
      { label: 'Pending Proof',     value: data.proofStatus?.pendingProof,   accent: '#f87171', icon: '⏳' },
      { label: 'Nearby Requests',   value: data.compatibleRequests?.nearby,  accent: '#60a5fa', icon: '📍' },
      { label: 'Days Since Last',   value: cat.daysSinceLastDonation != null ? `${cat.daysSinceLastDonation}d` : '—', accent: '#fb923c', icon: '📅' },
      { label: 'Can Donate?',       value: cat.canDonateAgain ? 'Yes ✓' : `${cat.daysUntilEligible}d wait`, accent: cat.canDonateAgain ? '#4ade80' : '#f87171', icon: '🩺' },
      { label: 'Blood Group',       value: data.donor?.bloodGroup,   accent: '#f87171', icon: '🩸' },
      { label: 'Compatible Open',   value: data.compatibleRequests?.totalOpen, accent: '#38bdf8', icon: '🔔' },
      { label: 'Actions Needed',    value: (data.alertsAndActions?.needsDonorConfirmation?.length || 0) + (data.alertsAndActions?.needsProofUpload?.length || 0), accent: '#fb923c', icon: '📝' },
    ]
  }
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
      {tiles.map((t, i) => (
        <div key={t.label} className="relative overflow-hidden rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all duration-300 p-3 cursor-default group col-span-2">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: `radial-gradient(circle at 50% 0%, ${t.accent}18 0%, transparent 70%)` }} />
          <div className="text-lg mb-1">{t.icon}</div>
          <p className="font-mono text-base font-bold leading-none mb-1 truncate" style={{ color: t.accent }}>{t.value ?? '—'}</p>
          <p className="text-slate-500 text-[9px] leading-tight font-medium uppercase tracking-wide">{t.label}</p>
        </div>
      ))}
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 items-end">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-900 to-slate-800 border border-red-800/50 flex items-center justify-center shrink-0"><Bot size={14} className="text-red-400" /></div>
      <div className="bg-slate-800/80 border border-slate-700/50 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <Cpu size={11} className="text-red-400/60 mr-1" />
        <span className="text-slate-400 text-xs mr-1">BloodLink AI thinking</span>
        {[0, 1, 2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ animation: 'bounce 1.2s infinite', animationDelay: `${i * 200}ms` }} />)}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MESSAGE BUBBLE — detects IDs in AI replies and makes them clickable
// ─────────────────────────────────────────────────────────────────────────────
function MessageBubble({ msg, isNew, onViewDonor, onViewRequest }) {
  const isUser = msg.role === 'user'

  // Extract MongoDB-like IDs from assistant text and make them clickable
  const renderContent = (text) => {
    if (isUser) return text
    // Match 24-char hex IDs
    const parts = text.split(/\b([a-f0-9]{24})\b/gi)
    return parts.map((part, i) => {
      if (/^[a-f0-9]{24}$/i.test(part)) {
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <span className="font-mono text-yellow-400 bg-yellow-900/20 px-1.5 py-0.5 rounded text-[10px]">{part}</span>
            <button
              onClick={() => onViewDonor?.(part)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-blue-900/40 border border-blue-800/40 text-blue-400 hover:bg-blue-900/60 transition-all"
            >
              👤 Donor
            </button>
            <button
              onClick={() => onViewRequest?.(part)}
              className="text-[9px] px-1.5 py-0.5 rounded bg-purple-900/40 border border-purple-800/40 text-purple-400 hover:bg-purple-900/60 transition-all"
            >
              📋 Req
            </button>
          </span>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} ${isNew ? 'animate-fade-in' : ''}`}>
      {isUser
        ? <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-700 to-red-900 flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-lg shadow-red-900/30">U</div>
        : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-900 to-slate-800 border border-red-800/50 flex items-center justify-center shrink-0"><Bot size={14} className="text-red-400" /></div>
      }
      <div className={`max-w-[80%] ${isUser
        ? 'bg-gradient-to-br from-red-700 to-red-800 text-white rounded-2xl rounded-tr-sm shadow-lg shadow-red-900/20'
        : 'bg-slate-800/80 border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-sm backdrop-blur-sm'
      } px-4 py-3 text-sm leading-relaxed`}>
        <p className="whitespace-pre-wrap">{isUser ? msg.content : renderContent(msg.content)}</p>
        {msg.model && <p className="text-[10px] text-red-300/40 mt-2 font-mono">via {msg.model}</p>}
      </div>
    </div>
  )
}

const ROLE_ICON = { ADMIN: Shield, HOSPITAL: Building2, DONOR: Droplets }

function WelcomeCard({ role, name, onPrompt, quickPrompts }) {
  const RoleIcon  = ROLE_ICON[role] || Bot
  const roleLabel = role === 'ADMIN' ? 'Platform Admin' : role === 'HOSPITAL' ? 'Hospital Manager' : 'Blood Donor'
  const roleColor = role === 'ADMIN' ? 'text-purple-400' : role === 'HOSPITAL' ? 'text-blue-400' : 'text-red-400'
  const roleBg    = role === 'ADMIN' ? 'from-purple-900/30 to-transparent border-purple-800/30' : role === 'HOSPITAL' ? 'from-blue-900/30 to-transparent border-blue-800/30' : 'from-red-900/30 to-transparent border-red-800/30'
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 py-2">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${roleBg} border flex items-center justify-center`}><RoleIcon size={24} className={roleColor} /></div>
      <div className="text-center">
        <p className="text-slate-100 font-semibold text-base mb-1">Hello{name ? `, ${name.split(' ')[0]}` : ''}! 👋</p>
        <p className="text-slate-400 text-xs max-w-xs leading-relaxed">
          I'm BloodLink AI with <span className="text-green-400 font-medium">full data access</span> — analyse, act, and generate reports for your <span className={`font-medium ${roleColor}`}>{roleLabel}</span> role.
        </p>
      </div>
      <div className="w-full">
        <p className="text-slate-500 text-[10px] text-center mb-2.5 flex items-center justify-center gap-1.5">
          <Database size={10} className="text-green-500" /><span>Live data loaded · Choose a quick action</span>
        </p>
        <div className="grid grid-cols-2 gap-2">
          {quickPrompts.slice(0, 4).map(qp => (
            <button key={qp.label} onClick={() => onPrompt(qp.text)}
              className={`text-left p-3 rounded-xl border bg-gradient-to-br ${qp.color} transition-all duration-200 group hover:scale-[1.02] active:scale-[0.98]`}>
              <span className="text-xl block mb-1">{qp.icon}</span>
              <span className="text-xs font-medium text-slate-300 group-hover:text-white transition-colors">{qp.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function DataLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className="rounded-xl bg-slate-900 border border-slate-800 p-3 h-20 animate-pulse col-span-2" />)}
      </div>
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-8 flex items-center justify-center gap-3 h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full border-2 border-red-800/50 border-t-red-500 animate-spin" />
            <Database size={14} className="text-red-400 absolute inset-0 m-auto" />
          </div>
          <p className="text-slate-400 text-sm">Mining platform data…</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function AIAnalystPage() {
  const { user } = useAuthStore()
  const role = user?.role

  const [liveData,       setLiveData]       = useState(null)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [dataError,      setDataError]      = useState(null)
  const [messages,       setMessages]       = useState([])
  const [input,          setInput]          = useState('')
  const [aiLoading,      setAiLoading]      = useState(false)
  const [aiError,        setAiError]        = useState(null)
  const [newMsgIdx,      setNewMsgIdx]      = useState(-1)
  const [showAllPrompts, setShowAllPrompts] = useState(false)
  const [charCount,      setCharCount]      = useState(0)
  const [sidePanel,      setSidePanel]      = useState('actions')

  // Modals
  const [donorModal,   setDonorModal]   = useState(null) // { donorId }
  const [requestModal, setRequestModal] = useState(null) // requestId string

  const historyRef     = useRef([])
  const systemRef      = useRef('')
  const messagesEndRef = useRef(null)
  const inputRef       = useRef(null)

  const quickPrompts = QUICK_PROMPTS[role] || QUICK_PROMPTS.DONOR
  const hasMessages  = messages.length > 0

  const load = useCallback(async () => {
    setDataLoading(true); setDataError(null); setLiveData(null); setMessages([])
    historyRef.current = []; systemRef.current = ''
    try {
      const res = await fetchAIData()
      const data = res.data?.data || res.data
      setLiveData(data)
      systemRef.current = `You are BloodLink AI with full platform data access. Role: ${data.role}. Use ONLY the data below. Be concise, specific, actionable. Use emojis for headers. Highlight critical issues with 🚨.\n\nCRITICAL ID RULES — always follow these exactly:\n- When referring to a DONOR, always use the \`donorId\` field (a 24-char hex User ID). NEVER use donationId as a donor reference.\n- When referring to a BLOOD REQUEST, always use the \`requestId\` field. NEVER use donationId as a request reference.\n- When referring to a DONATION record, use \`donationId\`.\n- In your responses, when you mention a donorId or requestId, write ONLY the raw 24-char hex ID so the user can click it to view the full profile.\n\nFULL DATA: ${JSON.stringify(data)}`
    } catch (e) {
      setDataError(e.message || 'Failed to load platform data.')
    } finally {
      setDataLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, aiLoading])

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || aiLoading) return
    setInput(''); setCharCount(0); setAiError(null)
    const userIdx = messages.length
    setMessages(p => [...p, { role: 'user', content: msg }])
    setNewMsgIdx(userIdx)
    setAiLoading(true)
    try {
      const res = await sendAIChat({ system: systemRef.current, messages: [...historyRef.current, { role: 'user', content: msg }], liveData })
      const reply = res.data?.text || 'No response.'
      const model = res.data?.model || null
      historyRef.current = [...historyRef.current, { role: 'user', content: msg }, { role: 'assistant', content: reply }]
      setMessages(p => [...p, { role: 'assistant', content: reply, model }])
      setNewMsgIdx(userIdx + 1)
    } catch (e) {
      setAiError(e.message)
      setMessages(p => [...p, { role: 'assistant', content: `⚠️ ${e.message}` }])
    } finally {
      setAiLoading(false)
      inputRef.current?.focus()
    }
  }

  const clearChat  = () => { historyRef.current = []; setAiError(null); setMessages([]); setNewMsgIdx(-1) }
  const handleKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }
  const handleInput = (e) => {
    setInput(e.target.value); setCharCount(e.target.value.length)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const visiblePrompts = showAllPrompts ? quickPrompts : quickPrompts.slice(0, 4)
  const hasSidePanel   = role === 'ADMIN' || role === 'HOSPITAL'

  return (
    <div className="animate-fade-in flex flex-col gap-4 max-w-7xl mx-auto pb-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-900/80 to-slate-900 border border-red-800/50 flex items-center justify-center shadow-lg shadow-red-900/20"><Bot size={20} className="text-red-400" /></div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl text-slate-100 tracking-tight">BloodLink AI</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/40 border border-red-800/50 text-red-400 font-mono">FULL ACCESS</span>
            </div>
            <p className="text-slate-500 text-xs flex items-center gap-1.5">
              <Database size={9} className="text-green-500" /> Full data access ·{' '}
              <Lock size={9} className="text-yellow-500" />
              <span className={`font-semibold ${role === 'ADMIN' ? 'text-purple-400' : role === 'HOSPITAL' ? 'text-blue-400' : 'text-red-400'}`}>{role}</span>
              {' '}mode · <Sparkles size={9} className="text-yellow-500" /> Groq AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={dataLoading} title="Refresh all data"
            className="p-2 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-600 transition-all disabled:opacity-30">
            <RefreshCw size={14} className={dataLoading ? 'animate-spin' : ''} />
          </button>
          {hasMessages && (
            <button onClick={clearChat} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-red-400 hover:border-red-800/50 transition-all text-xs">
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Error banners */}
      {dataError && !dataLoading && (
        <div className="p-3.5 rounded-xl border border-red-800/50 bg-red-900/10 flex items-center gap-3">
          <AlertTriangle size={15} className="text-red-400 shrink-0" />
          <p className="text-red-400 text-sm flex-1">{dataError}</p>
          <button onClick={load} className="text-xs text-red-400 hover:text-red-300 underline">Retry</button>
        </div>
      )}
      {aiError && (
        <div className="p-3.5 rounded-xl border border-orange-800/50 bg-orange-900/10 flex items-center gap-3">
          <AlertTriangle size={15} className="text-orange-400 shrink-0" />
          <p className="text-orange-400 text-sm">{aiError}</p>
        </div>
      )}

      {dataLoading ? <DataLoadingSkeleton /> : liveData ? (
        <>
          <StatTiles data={liveData} />

          <div className={`flex gap-4 ${hasSidePanel ? 'flex-col xl:flex-row' : ''}`}>

            {/* Chat panel */}
            <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide" style={{ maxHeight: 480 }}>
                {!hasMessages
                  ? <WelcomeCard role={role} name={user?.name} onPrompt={sendMessage} quickPrompts={quickPrompts} />
                  : <>
                    {messages.map((m, i) => (
                      <MessageBubble
                        key={i} msg={m} isNew={i === newMsgIdx}
                        onViewDonor={(id) => setDonorModal({ donorId: id })}
                        onViewRequest={(id) => setRequestModal(id)}
                      />
                    ))}
                    {aiLoading && <TypingIndicator />}
                    <div ref={messagesEndRef} />
                  </>
                }
              </div>

              {/* Quick prompts strip */}
              {hasMessages && (
                <div className="px-4 pt-3 pb-2 border-t border-slate-800/70">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-slate-600 text-xs flex items-center gap-1.5"><Zap size={10} className="text-yellow-600" /> Quick prompts</p>
                    <button onClick={() => setShowAllPrompts(v => !v)} className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 transition-colors">
                      {showAllPrompts ? 'Show less' : `Show all ${quickPrompts.length}`}
                      <ChevronDown size={11} className={`transition-transform ${showAllPrompts ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  <div className={`${showAllPrompts ? 'grid grid-cols-2 sm:grid-cols-3' : 'flex overflow-x-auto scrollbar-hide'} gap-2`}>
                    {visiblePrompts.map(qp => (
                      <button key={qp.label} onClick={() => sendMessage(qp.text)} disabled={aiLoading}
                        className={`${showAllPrompts ? '' : 'shrink-0'} flex items-center gap-2 text-xs px-3 py-2 rounded-xl border bg-gradient-to-br ${qp.color} text-slate-400 hover:text-white transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]`}>
                        <span className="text-base">{qp.icon}</span>
                        <span className="font-medium whitespace-nowrap">{qp.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="px-4 pb-4 pt-2 border-t border-slate-800/70">
                <div className="flex gap-2 items-end">
                  <div className="relative flex-1">
                    <textarea
                      ref={inputRef}
                      className="w-full bg-slate-800/60 border border-slate-700/70 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-red-700/60 focus:bg-slate-800 transition-all leading-relaxed"
                      style={{ minHeight: 44, maxHeight: 120 }}
                      rows={1}
                      placeholder={`Ask about your ${role === 'ADMIN' ? 'platform' : role === 'HOSPITAL' ? 'hospital' : 'donations'}… (full data access)`}
                      value={input}
                      onChange={handleInput}
                      onKeyDown={handleKey}
                      disabled={aiLoading}
                    />
                    {charCount > 200 && <span className="absolute bottom-2 right-3 text-[10px] text-slate-600">{charCount}</span>}
                  </div>
                  <button onClick={() => sendMessage()} disabled={aiLoading || !input.trim()}
                    className="w-11 h-11 rounded-xl bg-gradient-to-br from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white flex items-center justify-center shrink-0 transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 shadow-lg shadow-red-900/30">
                    {aiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send size={15} />}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2 px-1">
                  <p className="text-slate-700 text-[10px]">Enter to send · Shift+Enter for new line · Click IDs for donor/request details</p>
                  <p className="text-slate-700 text-[10px] flex items-center gap-1"><Database size={9} className="text-green-600" /> Full access · <Activity size={9} /> Groq AI</p>
                </div>
              </div>
            </div>

            {/* Side panel */}
            {hasSidePanel && (
              <div className="xl:w-72 flex flex-col gap-3">
                <div className="flex rounded-xl border border-slate-800 overflow-hidden">
                  {[{ id: 'actions', label: 'Actions', icon: Play }, { id: 'reports', label: 'Reports', icon: FileText }].map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => setSidePanel(id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-all ${sidePanel === id ? 'bg-slate-800 text-slate-200' : 'bg-slate-900/40 text-slate-600 hover:text-slate-400'}`}>
                      <Icon size={12} /> {label}
                    </button>
                  ))}
                </div>
                {sidePanel === 'actions' && <ActionPanel liveData={liveData} role={role} onActionDone={load} />}
                {sidePanel === 'reports' && <ReportPanel role={role} />}
              </div>
            )}
          </div>
        </>
      ) : null}

      {/* Modals */}
      {donorModal && (
        <DonorProfileModal
          donorId={donorModal.donorId}
          requestId={donorModal.requestId}
          onClose={() => setDonorModal(null)}
          onAccept={load}
        />
      )}
      {requestModal && (
        <RequestDonorsPanel
          requestId={requestModal}
          onClose={() => setRequestModal(null)}
        />
      )}
      
    </div>
  )
}
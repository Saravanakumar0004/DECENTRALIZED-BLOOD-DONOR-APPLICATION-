// ── AdminUsersPage.jsx ────────────────────────────────────────────────────────
import { useState, useEffect } from 'react'
import { getAdminUsers, verifyUser, deactivateUser } from '../api/admin'
import { LoadingSpinner, EmptyState, ConfirmDialog } from '../components/ui/index'
import { roleColor, formatDate } from '../utils/formatters'
import { fileUrl, isPdf } from '../utils/fileUrl'
import toast from 'react-hot-toast'
import {
  X, BadgeCheck, User, HeartPulse, ShieldCheck,
  FileText, ImageIcon, ChevronRight,
} from 'lucide-react'

// ── Helpers ───────────────────────────────────────────────────────────────────
function TagList({ items }) {
  if (!items || items.length === 0)
    return <span className="text-slate-600 text-xs italic">None</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <span key={t} className="px-2 py-0.5 rounded-full text-xs bg-slate-800 border border-slate-700 text-slate-300">
          {t}
        </span>
      ))}
    </div>
  )
}

function InfoRow({ label, value, children }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-800/70 last:border-0">
      <span className="text-xs text-slate-500 shrink-0 w-40">{label}</span>
      <div className="text-xs text-slate-200 text-right break-words max-w-[55%]">
        {children ?? (value != null && value !== ''
          ? value
          : <span className="text-slate-700 italic">—</span>
        )}
      </div>
    </div>
  )
}

function SectionHead({ icon: Icon, title }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <Icon size={13} className="text-blood-400 shrink-0" />
      <span className="text-xs font-semibold uppercase tracking-widest text-slate-500">{title}</span>
    </div>
  )
}

// ── DocPreview ────────────────────────────────────────────────────────────────
function DocPreview({ path, label }) {
  const [err, setErr] = useState(false)
  const url = fileUrl(path)
  if (!url) return <span className="text-slate-700 italic text-xs">Not uploaded</span>
  if (isPdf(path)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
        <FileText size={11} /> View PDF
      </a>
    )
  }
  if (!err) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        <img src={url} alt={label} onError={() => setErr(true)}
          className="h-14 w-20 object-cover rounded-lg border border-slate-700 hover:border-blood-600 transition-colors" />
      </a>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-blood-400 hover:text-blood-300 underline underline-offset-2">
      <ImageIcon size={11} /> View Image
    </a>
  )
}

// ── UserDrawer ────────────────────────────────────────────────────────────────
function UserDrawer({ user: u, onClose, onVerify, verifying }) {
  if (!u) return null

  const initials    = u.name ? u.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : '?'
  const photoPath   = u.profilePhoto || u.hospitalPhoto
  const photoUrl    = fileUrl(photoPath)
  const [imgErr, setImgErr] = useState(false)

  const fitColor = u.fitForDonation === true
    ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800'
    : u.fitForDonation === false
      ? 'bg-red-900/40 text-red-400 border-red-800'
      : 'bg-slate-800 text-slate-500 border-slate-700'

  const fitLabel = u.fitForDonation === true ? '✓ Fit to Donate'
    : u.fitForDonation === false ? '✗ Not Fit' : '—'

  const isHospital = u.role === 'HOSPITAL'
  const isDonor    = u.role === 'DONOR'

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-slate-950 border-l border-slate-800 z-50
                      overflow-y-auto flex flex-col shadow-2xl animate-slide-in-right">

        {/* Drawer header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-slate-950 z-10">
          <span className="text-sm font-semibold text-slate-200 uppercase tracking-wider">User Details</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 px-5 py-4 space-y-1 pb-24">

          {/* ── Identity hero ── */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-14 h-14 rounded-xl bg-blood-900/50 border border-blood-800 flex items-center justify-center shrink-0 overflow-hidden">
              {photoUrl && !imgErr
                ? <img src={photoUrl} alt="photo" className="w-full h-full object-cover" onError={() => setImgErr(true)} />
                : <span className="text-blood-300 font-display text-lg">{initials}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-100 truncate">{u.name}</p>
              <p className="text-xs text-slate-500 truncate">{u.email}</p>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleColor(u.role)}`}>{u.role}</span>
                {u.bloodGroup && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blood-900/50 border border-blood-800 text-blood-300 font-mono">
                    {u.bloodGroup}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.isVerified
                  ? 'bg-green-900/40 text-green-400 border border-green-800'
                  : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                  {u.isVerified ? '✓ Verified' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Account ── */}
          <SectionHead icon={BadgeCheck} title="Account" />
          <InfoRow label="Role"         value={u.role} />
          <InfoRow label="Verified"     value={u.isVerified ? 'Yes' : 'No'} />
          <InfoRow label="Member Since" value={u.createdAt ? formatDate(u.createdAt) : null} />
          <InfoRow label="BDC Balance"  value={u.bdcBalance ?? 0} />
          <InfoRow label="Wallet"       value={u.walletAddress} />

          {/* ── DONOR fields ── */}
          {isDonor && <>
            <SectionHead icon={User} title="Personal Details" />
            <InfoRow label="Gender"            value={u.gender} />
            <InfoRow label="Date of Birth"     value={u.dateOfBirth ? new Date(u.dateOfBirth).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : null} />
            <InfoRow label="Age"               value={u.age ? `${u.age} yrs` : null} />
            <InfoRow label="Weight"            value={u.weight ? `${u.weight} kg` : null} />
            <InfoRow label="Mobile"            value={u.mobileNumber} />
            <InfoRow label="Emergency Contact" value={u.emergencyContactNumber} />
            <InfoRow label="Govt. ID"          value={u.governmentIdNumber} />
            <InfoRow label="Address"           value={u.address} />
            <InfoRow label="City / State"      value={[u.city, u.state].filter(Boolean).join(', ') || null} />
            <InfoRow label="Pincode"           value={u.pincode} />
            <InfoRow label="Coordinates"       value={(u.lat && u.lng) ? `${u.lat}, ${u.lng}` : null} />

            <SectionHead icon={HeartPulse} title="Medical" />
            <InfoRow label="Hemoglobin"        value={u.hemoglobinLevel ? `${u.hemoglobinLevel} g/dL` : null} />
            <InfoRow label="Last Donation"     value={u.lastDonationDate ? formatDate(u.lastDonationDate) : 'First time'} />
            <InfoRow label="Smoking"           value={u.smokingStatus} />
            <InfoRow label="Alcohol"           value={u.alcoholStatus} />
            <InfoRow label="COVID / Vaccination" value={u.covidVaccinationStatus} />
            <InfoRow label="Health Conditions"><TagList items={u.healthConditions} /></InfoRow>
            <InfoRow label="Medications"><TagList items={u.currentMedications} /></InfoRow>
            <InfoRow label="Allergies"><TagList items={u.allergies} /></InfoRow>
            <InfoRow label="Surgery History"><TagList items={u.surgeryHistory} /></InfoRow>

            <SectionHead icon={ShieldCheck} title="Eligibility & Documents" />
            <InfoRow label="Fit for Donation">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${fitColor}`}>{fitLabel}</span>
            </InfoRow>
            <InfoRow label="Profile Photo">
              <DocPreview path={u.profilePhoto} label="Profile Photo" />
            </InfoRow>
            <InfoRow label="Medical Report">
              <DocPreview path={u.medicalReportCertificate} label="Medical Report" />
            </InfoRow>
          </>}

          {/* ── HOSPITAL fields ── */}
          {isHospital && <>
            <SectionHead icon={User} title="Hospital Info" />
            <InfoRow label="Hospital Name"      value={u.hospitalName} />
            <InfoRow label="Type"               value={u.hospitalType} />
            <InfoRow label="License No."        value={u.licenseNumber} />
            <InfoRow label="Reg. Number"        value={u.registrationNumber} />
            <InfoRow label="Established"        value={u.establishedYear} />
            <InfoRow label="GST Number"         value={u.gstNumber} />

            <SectionHead icon={HeartPulse} title="Contact & Address" />
            <InfoRow label="Contact Person"     value={u.contactPersonName} />
            <InfoRow label="Mobile"             value={u.hospitalMobile || u.mobileNumber} />
            <InfoRow label="Telephone"          value={u.hospitalTelephone} />
            <InfoRow label="Website"            value={u.hospitalWebsite} />
            <InfoRow label="Address"            value={u.hospitalAddress || u.address} />
            <InfoRow label="City / State"       value={[u.city, u.hospitalState || u.state].filter(Boolean).join(', ') || null} />
            <InfoRow label="Pincode"            value={u.hospitalPincode || u.pincode} />
            <InfoRow label="Landmark"           value={u.hospitalLandmark} />
            <InfoRow label="Coordinates"        value={(u.lat && u.lng) ? `${u.lat}, ${u.lng}` : null} />

            <SectionHead icon={ShieldCheck} title="Blood Bank & Documents" />
            <InfoRow label="Blood Bank"         value={u.bloodBankAvailable === true ? 'Yes' : u.bloodBankAvailable === false ? 'No' : null} />
            <InfoRow label="Storage Capacity"   value={u.bloodStorageCapacity ? `${u.bloodStorageCapacity} units` : null} />
            <InfoRow label="Emergency Service"  value={u.emergencyServiceAvailable === true ? 'Yes' : u.emergencyServiceAvailable === false ? 'No' : null} />
            <InfoRow label="24×7 Service"       value={u.is24x7Service === true ? 'Yes' : u.is24x7Service === false ? 'No' : null} />
            <InfoRow label="Available Groups">
              <TagList items={u.availableBloodGroups} />
            </InfoRow>
            <InfoRow label="Hospital Photo">
              <DocPreview path={u.hospitalPhoto} label="Hospital Photo" />
            </InfoRow>
            <InfoRow label="License Certificate">
              <DocPreview path={u.hospitalLicenseCertificate} label="License Certificate" />
            </InfoRow>
            <InfoRow label="Govt. Approval">
              <DocPreview path={u.governmentApprovalDocument} label="Govt. Approval" />
            </InfoRow>
            <InfoRow label="Admin ID Proof">
              <DocPreview path={u.adminIdProof} label="Admin ID Proof" />
            </InfoRow>
          </>}
        </div>

        {/* ── Sticky footer: Verify button ── */}
        {!u.isVerified && (
          <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 px-5 py-4">
            <button onClick={() => onVerify(u._id)} disabled={verifying}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 disabled:opacity-50">
              {verifying
                ? 'Verifying…'
                : <><BadgeCheck size={16} /> Verify {u.name?.split(' ')[0]}</>
              }
            </button>
          </div>
        )}
        {u.isVerified && (
          <div className="sticky bottom-0 bg-slate-950 border-t border-slate-800 px-5 py-4">
            <div className="w-full text-center text-sm text-green-400 flex items-center justify-center gap-2 py-2">
              <BadgeCheck size={16} /> Already Verified
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// ── AdminUsersPage ────────────────────────────────────────────────────────────
export function AdminUsersPage() {
  const [users,     setUsers]     = useState([])
  const [loading,   setLoading]   = useState(true)
  const [role,      setRole]      = useState('')
  const [search,    setSearch]    = useState('')
  const [selected,  setSelected]  = useState(null)   // user shown in drawer
  const [verifying, setVerifying] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await getAdminUsers({ role: role || undefined, search: search || undefined })
      setUsers(res.data.data)
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [role])

  const handleVerify = async (id) => {
    setVerifying(true)
    try {
      await verifyUser(id)
      toast.success('User verified')
      // Update both the list and the open drawer
      setUsers(prev => prev.map(u => u._id === id ? { ...u, isVerified: true } : u))
      setSelected(prev => prev?._id === id ? { ...prev, isVerified: true } : prev)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-5">

      {/* Filters */}
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

      {/* Table */}
      {loading ? <LoadingSpinner className="py-12" /> : users.length === 0 ? (
        <EmptyState title="No users found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs uppercase tracking-wider">
              <tr>
                {['Name','Email','Role','Blood Grp','Verified','Joined','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map(u => (
                <tr
                  key={u._id}
                  onClick={() => setSelected(u)}
                  className="hover:bg-slate-900/50 cursor-pointer transition-colors group">
                  <td className="px-4 py-3 font-medium text-slate-200 flex items-center gap-2">
                    {u.name}
                    <ChevronRight size={12} className="text-slate-700 group-hover:text-slate-400 transition-colors" />
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${roleColor(u.role)}`}>{u.role}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-mono text-xs">{u.bloodGroup || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.isVerified
                      ? 'bg-green-900 text-green-400'
                      : 'bg-slate-800 text-slate-500'}`}>
                      {u.isVerified ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {!u.isVerified && (
                      <button
                        onClick={() => { setSelected(u); }}
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

      {/* Detail drawer */}
      <UserDrawer
        user={selected}
        onClose={() => setSelected(null)}
        onVerify={handleVerify}
        verifying={verifying}
      />
    </div>
  )
}

export default AdminUsersPage
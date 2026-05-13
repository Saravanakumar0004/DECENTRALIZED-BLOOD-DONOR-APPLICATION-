// pages/HospitalInventoryPage.jsx
import { useState, useEffect } from 'react'
import {
  getMyInventory, updateStock, setInventoryVisibility,
  getPublicInventory, createTransfer,
  getMyTransfers, acceptTransfer, rejectTransfer,
  dispatchTransfer, confirmDelivery, cancelTransfer,
} from '../api/inventory'
import { LoadingSpinner, EmptyState } from '../components/ui/index'
import { formatDate } from '../utils/formatters'
import toast from 'react-hot-toast'
import {
  Eye, EyeOff, Plus, Truck, CheckCircle, X,
  Package, ArrowLeftRight, MapPin, Phone, Building2,
  Globe, Droplets,
} from 'lucide-react'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

function bgColor(group) {
  const map = {
    'A+': 'text-red-400',    'A-': 'text-red-300',
    'B+': 'text-blue-400',   'B-': 'text-blue-300',
    'O+': 'text-green-400',  'O-': 'text-green-300',
    'AB+': 'text-purple-400','AB-': 'text-purple-300',
  }
  return map[group] || 'text-slate-300'
}

function TransferBadge({ status }) {
  const map = {
    PENDING:    'bg-yellow-900 text-yellow-400',
    ACCEPTED:   'bg-blue-900 text-blue-400',
    IN_TRANSIT: 'bg-orange-900 text-orange-400',
    DELIVERED:  'bg-green-900 text-green-400',
    CANCELLED:  'bg-slate-800 text-slate-500',
    REJECTED:   'bg-red-900 text-red-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-slate-800 text-slate-400'}`}>
      {status}
    </span>
  )
}


// ── Hospital Profile Modal ────────────────────────────────────────────────────
// Reads from the fully-populated hospital object — no extra API fetch needed
// because the backend now returns all fields in every transfer populate.
function HospitalProfileModal({ hospital, onClose }) {
  if (!hospital) return null

  const name     = hospital.hospitalName || hospital.name
  const address  = [hospital.hospitalAddress, hospital.hospitalState, hospital.hospitalPincode]
    .filter(Boolean).join(', ')
  const phone    = hospital.hospitalMobile || hospital.hospitalTelephone
  const initials = name?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-900/40 border border-blue-800/50 flex items-center justify-center text-blue-300 font-bold text-lg shrink-0">
              {initials}
            </div>
            <div>
              <h3 className="font-display text-xl text-slate-100 leading-tight">{name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                {hospital.hospitalType && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                    {hospital.hospitalType}
                  </span>
                )}
                {hospital.isVerified && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-900/40 text-green-400">
                    ✓ Verified
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost p-1 shrink-0"><X size={18} /></button>
        </div>

        <div className="space-y-4">

          {/* Contact */}
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Phone size={11} /> Contact
              </p>
            </div>
            <div className="px-3 py-3 space-y-2">
              {hospital.contactPersonName && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Contact Person</span>
                  <span className="text-slate-200">{hospital.contactPersonName}</span>
                </div>
              )}
              {phone && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Mobile</span>
                  <a href={`tel:${phone}`} className="text-green-400 font-mono font-semibold hover:text-green-300">
                    📞 {phone}
                  </a>
                </div>
              )}
              {hospital.hospitalTelephone && hospital.hospitalTelephone !== phone && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Telephone</span>
                  <a href={`tel:${hospital.hospitalTelephone}`} className="text-green-400 font-mono hover:text-green-300">
                    {hospital.hospitalTelephone}
                  </a>
                </div>
              )}
              {hospital.hospitalEmail && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Email</span>
                  <a href={`mailto:${hospital.hospitalEmail}`} className="text-blue-400 hover:text-blue-300 text-xs">
                    {hospital.hospitalEmail}
                  </a>
                </div>
              )}
              {hospital.hospitalWebsite && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Website</span>
                  <a href={hospital.hospitalWebsite} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Globe size={11} /> {hospital.hospitalWebsite.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
              {!hospital.contactPersonName && !phone && !hospital.hospitalEmail && !hospital.hospitalWebsite && (
                <p className="text-xs text-slate-600 italic">No contact details on record</p>
              )}
            </div>
          </div>

          {/* Address */}
          {address && (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <MapPin size={11} /> Address
                </p>
              </div>
              <div className="px-3 py-3 space-y-1.5">
                <p className="text-sm text-slate-300">{address}</p>
                {hospital.hospitalLandmark && (
                  <p className="text-xs text-slate-500">📍 Near {hospital.hospitalLandmark}</p>
                )}
                {hospital.location?.city && (
                  <p className="text-xs text-slate-500">City: {hospital.location.city}</p>
                )}
              </div>
            </div>
          )}

          {/* Blood Bank */}
          <div className="rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                <Droplets size={11} /> Blood Bank
              </p>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Blood Bank</span>
                <span className={hospital.bloodBankAvailable ? 'text-green-400' : 'text-slate-500'}>
                  {hospital.bloodBankAvailable ? '✓ Available' : '✗ Not available'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Emergency Service</span>
                <span className={hospital.emergencyServiceAvailable ? 'text-green-400' : 'text-slate-500'}>
                  {hospital.emergencyServiceAvailable ? '✓ Available' : '✗ Not available'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">24×7 Service</span>
                <span className={hospital.is24x7Service ? 'text-green-400' : 'text-slate-500'}>
                  {hospital.is24x7Service ? '✓ Yes' : '✗ No'}
                </span>
              </div>
              {hospital.availableBloodGroups?.length > 0 && (
                <div className="pt-1">
                  <p className="text-xs text-slate-500 mb-1.5">Blood groups stocked:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {hospital.availableBloodGroups.map(bg => (
                      <span key={bg} className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 font-mono">
                        {bg}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Registration */}
          {(hospital.licenseNumber || hospital.registrationNumber || hospital.gstNumber || hospital.establishedYear) && (
            <div className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-3 py-2 bg-slate-900/60 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Building2 size={11} /> Registration
                </p>
              </div>
              <div className="px-3 py-3 space-y-2">
                {hospital.licenseNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">License No.</span>
                    <span className="text-slate-200 font-mono text-xs">{hospital.licenseNumber}</span>
                  </div>
                )}
                {hospital.registrationNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Reg. Number</span>
                    <span className="text-slate-200 font-mono text-xs">{hospital.registrationNumber}</span>
                  </div>
                )}
                {hospital.gstNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">GST Number</span>
                    <span className="text-slate-200 font-mono text-xs">{hospital.gstNumber}</span>
                  </div>
                )}
                {hospital.establishedYear && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Established</span>
                    <span className="text-slate-200">{hospital.establishedYear}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-5">Close</button>
      </div>
    </div>
  )
}


// ── Hospital Info Strip (requester view) ──────────────────────────────────────
function HospitalInfoStrip({ hospital }) {
  if (!hospital) return null
  const address = [hospital.hospitalAddress, hospital.hospitalState, hospital.hospitalPincode]
    .filter(Boolean).join(', ')
  const phone = hospital.hospitalMobile || hospital.hospitalTelephone || hospital.mobileNumber
  if (!address && !phone) return null
  return (
    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
      {address && (
        <div className="flex items-start gap-1.5 text-xs text-slate-400">
          <MapPin size={11} className="mt-0.5 shrink-0 text-slate-500" />
          <span>{address}</span>
        </div>
      )}
      {phone && (
        <div className="flex items-center gap-1.5 text-xs">
          <Phone size={11} className="shrink-0 text-slate-500" />
          <a href={`tel:${phone}`} className="text-green-400 font-mono font-semibold hover:text-green-300 underline underline-offset-2">
            {phone}
          </a>
        </div>
      )}
    </div>
  )
}


// ── Deliver-To Card (supplier view) ──────────────────────────────────────────
function DeliverToCard({ hospital }) {
  if (!hospital) return null
  const address  = [hospital.hospitalAddress, hospital.hospitalState, hospital.hospitalPincode]
    .filter(Boolean).join(', ')
  const phone    = hospital.hospitalMobile || hospital.hospitalTelephone || hospital.mobileNumber
  const name     = hospital.hospitalName   || hospital.name
  const city     = hospital.location?.city
  const landmark = hospital.hospitalLandmark

  if (!address && !phone) return null

  return (
    <div className="mt-2 rounded-lg border border-blue-800/50 bg-blue-900/10 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/25 border-b border-blue-800/40">
        <MapPin size={12} className="text-blue-400 shrink-0" />
        <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Deliver To</span>
        {city && <span className="text-xs text-blue-400/70 ml-auto">{city}</span>}
      </div>
      <div className="px-3 py-2.5 space-y-1.5">
        {name && <p className="text-sm font-medium text-slate-100">{name}</p>}
        {address && (
          <div className="flex items-start gap-2 text-xs text-slate-400">
            <MapPin size={10} className="mt-0.5 shrink-0 text-slate-600" />
            <span>{address}</span>
          </div>
        )}
        {landmark && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="text-slate-600">📍</span>
            <span>Near {landmark}</span>
          </div>
        )}
        {phone && (
          <div className="flex items-center gap-2 text-xs mt-1">
            <Phone size={10} className="shrink-0 text-slate-600" />
            <span className="text-slate-500">Contact:</span>
            <a href={`tel:${phone}`} className="text-green-400 font-mono font-bold hover:text-green-300 underline underline-offset-2">
              📞 {phone}
            </a>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Stock Editor Modal ─────────────────────────────────────────────────────────
function StockEditorModal({ stock, onClose, onSaved }) {
  const [values, setValues] = useState(() => {
    const init = {}
    BLOOD_GROUPS.forEach(bg => {
      const found = stock.find(s => s.bloodGroup === bg)
      init[bg] = { units: found?.units ?? 0, action: 'SET' }
    })
    return init
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = BLOOD_GROUPS.map(bg => ({
        bloodGroup: bg,
        units:      parseInt(values[bg].units, 10) || 0,
        action:     values[bg].action,
      }))
      await updateStock({ updates })
      toast.success('Inventory updated!')
      onSaved()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4 border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-2xl text-slate-100">UPDATE BLOOD STOCK</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          {BLOOD_GROUPS.map(bg => (
            <div key={bg} className="flex items-center gap-3 p-3 rounded-lg bg-slate-900 border border-slate-800">
              <span className={`font-display text-lg w-10 text-center ${bgColor(bg)}`}>{bg}</span>
              <select
                className="input text-xs py-1.5 w-28"
                value={values[bg].action}
                onChange={e => setValues(p => ({ ...p, [bg]: { ...p[bg], action: e.target.value } }))}
              >
                <option value="SET">Set to</option>
                <option value="ADD">Add</option>
                <option value="SUBTRACT">Subtract</option>
              </select>
              <input
                type="number" min="0"
                className="input text-sm py-1.5 w-24"
                value={values[bg].units}
                onChange={e => setValues(p => ({ ...p, [bg]: { ...p[bg], units: e.target.value } }))}
              />
              <span className="text-slate-500 text-xs">units</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Request Transfer Modal ─────────────────────────────────────────────────────
function RequestTransferModal({ onClose, onSuccess }) {
  const [hospitals, setHospitals] = useState([])
  const [loading, setLoading]     = useState(true)
  const [form, setForm] = useState({
    supplyingHospitalId: '',
    bloodGroup:    'O+',
    unitsRequested: 1,
    urgencyLevel:  'Medium',
    notes:         '',
  })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  useEffect(() => {
    getPublicInventory({ limit: 100 })
      .then(r => setHospitals(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectedHospital = hospitals.find(h => h.hospital?._id === form.supplyingHospitalId)
  const availableUnits   = selectedHospital?.stock?.find(s => s.bloodGroup === form.bloodGroup)?.units ?? null

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.supplyingHospitalId) return toast.error('Select a supplying hospital')
    setSubmitting(true)
    try {
      await createTransfer({ ...form, unitsRequested: parseInt(form.unitsRequested, 10) })
      toast.success('Transfer request sent!')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create transfer')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-lg mx-4 border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-display text-2xl text-slate-100">REQUEST BLOOD TRANSFER</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>
        {loading ? <LoadingSpinner className="py-8" /> : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Blood Group</label>
              <select className="input" value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}>
                {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Supplying Hospital</label>
              <select className="input" value={form.supplyingHospitalId}
                onChange={e => set('supplyingHospitalId', e.target.value)} required>
                <option value="">Select hospital...</option>
                {hospitals.map(h => {
                  const avail = h.stock?.find(s => s.bloodGroup === form.bloodGroup)?.units ?? 0
                  return (
                    <option key={h.hospital?._id} value={h.hospital?._id}>
                      {h.hospital?.hospitalName || h.hospital?.name} — {h.hospital?.location?.city} ({avail} units {form.bloodGroup})
                    </option>
                  )
                })}
              </select>
              {availableUnits !== null && (
                <p className="text-xs mt-1 text-slate-500">
                  Available at selected hospital:{' '}
                  <span className={availableUnits > 0 ? 'text-green-400' : 'text-red-400'}>
                    {availableUnits} units
                  </span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Units Needed</label>
                <input type="number" min="1" max="50" className="input"
                  value={form.unitsRequested}
                  onChange={e => set('unitsRequested', e.target.value)} required />
              </div>
              <div>
                <label className="label">Urgency</label>
                <select className="input" value={form.urgencyLevel} onChange={e => set('urgencyLevel', e.target.value)}>
                  {['Critical', 'High', 'Medium'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Notes (optional)</label>
              <textarea className="input resize-none" rows={2} placeholder="Additional details..."
                value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Sending...' : 'Send Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


// ── Dispatch Modal ─────────────────────────────────────────────────────────────
function DispatchModal({ transfer, onClose, onSuccess }) {
  const [form, setForm]         = useState({ vehicleNumber: '', driverName: '', driverPhone: '' })
  const [submitting, setSubmitting] = useState(false)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const dest         = transfer.requestingHospital
  const destAddress  = [dest?.hospitalAddress, dest?.hospitalState, dest?.hospitalPincode].filter(Boolean).join(', ')
  const destPhone    = dest?.hospitalMobile || dest?.hospitalTelephone
  const destLandmark = dest?.hospitalLandmark

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await dispatchTransfer(transfer._id, form)
      toast.success('Ambulance dispatched! Inventory deducted.')
      onSuccess()
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to dispatch')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="card w-full max-w-md mx-4 border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-display text-xl text-slate-100">DISPATCH AMBULANCE</h3>
          <button onClick={onClose} className="btn-ghost p-1"><X size={18} /></button>
        </div>

        {(destAddress || destPhone) && (
          <div className="mb-4 rounded-lg border border-blue-800/50 bg-blue-900/10 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-900/25 border-b border-blue-800/40">
              <MapPin size={12} className="text-blue-400 shrink-0" />
              <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">Destination Hospital</span>
              {dest?.location?.city && (
                <span className="text-xs text-blue-400/70 ml-auto">{dest.location.city}</span>
              )}
            </div>
            <div className="px-3 py-2.5 space-y-1.5">
              {(dest?.hospitalName || dest?.name) && (
                <p className="text-sm font-medium text-slate-100">{dest?.hospitalName || dest?.name}</p>
              )}
              {destAddress && (
                <div className="flex items-start gap-2 text-xs text-slate-400">
                  <MapPin size={10} className="mt-0.5 shrink-0 text-slate-600" />
                  <span>{destAddress}</span>
                </div>
              )}
              {destLandmark && (
                <p className="text-xs text-slate-500">📍 Near {destLandmark}</p>
              )}
              {destPhone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone size={10} className="shrink-0 text-slate-600" />
                  <span className="text-slate-500">Hospital Contact:</span>
                  <a href={`tel:${destPhone}`} className="text-green-400 font-mono font-bold hover:text-green-300 underline underline-offset-2">
                    📞 {destPhone}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-4 p-3 rounded-lg bg-orange-900/20 border border-orange-800/40 text-xs text-orange-300">
          ⚠️ Dispatching will deduct{' '}
          <strong>{transfer.unitsRequested} units of {transfer.bloodGroup}</strong>{' '}
          from your inventory.
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Vehicle Number</label>
            <input className="input" placeholder="TN-01-AB-1234"
              value={form.vehicleNumber} onChange={e => set('vehicleNumber', e.target.value)} />
          </div>
          <div>
            <label className="label">Driver Name</label>
            <input className="input" placeholder="Rajan Kumar"
              value={form.driverName} onChange={e => set('driverName', e.target.value)} />
          </div>
          <div>
            <label className="label">Driver Phone</label>
            <input className="input" placeholder="9876543210"
              value={form.driverPhone} onChange={e => set('driverPhone', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={submitting}
              className="bg-orange-700 hover:bg-orange-600 text-white font-medium py-2 px-4 rounded-lg transition-all flex-1">
              {submitting ? 'Dispatching...' : '🚑 Dispatch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


// ── Ambulance Info Card ────────────────────────────────────────────────────────
function AmbulanceInfoCard({ ambulanceInfo }) {
  const { vehicleNumber, driverName, driverPhone, dispatchedAt } = ambulanceInfo || {}
  return (
    <div className="mt-2 p-3 rounded-lg bg-orange-900/25 border border-orange-700/50">
      <p className="text-xs font-semibold text-orange-300 mb-2 flex items-center gap-1.5">
        <Truck size={12} /> 🚑 Ambulance Dispatched — Contact Details
      </p>
      <div className="grid grid-cols-1 gap-1.5">
        {vehicleNumber && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-24 shrink-0">Vehicle No.</span>
            <span className="text-orange-200 font-mono text-xs font-bold">{vehicleNumber}</span>
          </div>
        )}
        {driverName && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-24 shrink-0">Driver Name</span>
            <span className="text-slate-100 text-xs font-medium">{driverName}</span>
          </div>
        )}
        {driverPhone && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-24 shrink-0">Mobile No.</span>
            <a href={`tel:${driverPhone}`}
              className="text-green-400 text-xs font-mono font-bold hover:text-green-300 underline underline-offset-2">
              📞 {driverPhone}
            </a>
          </div>
        )}
        {dispatchedAt && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-xs w-24 shrink-0">Dispatched At</span>
            <span className="text-slate-400 text-xs">{formatDate(dispatchedAt)}</span>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Transfers Table ────────────────────────────────────────────────────────────
function TransfersTable({ transfers, myId, onAction }) {
  const [rejectId, setRejectId]         = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [dispatchItem, setDispatch]     = useState(null)
  const [cancelId, setCancelId]         = useState(null)
  const [profileHospital, setProfile]   = useState(null)

  const myIdStr = typeof myId === 'object'
    ? (myId?._id || myId?.id || String(myId))
    : String(myId ?? '')

  const isSupplier  = (t) => String(t.supplyingHospital?._id  || t.supplyingHospital)  === myIdStr
  const isRequester = (t) => String(t.requestingHospital?._id || t.requestingHospital) === myIdStr

  const handleAccept = async (id) => {
    try { await acceptTransfer(id); toast.success('Transfer accepted!'); onAction() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const handleReject = async () => {
    try { await rejectTransfer(rejectId, rejectReason); toast.success('Transfer rejected'); onAction() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setRejectId(null); setRejectReason('') }
  }

  const handleDeliver = async (id) => {
    try { await confirmDelivery(id); toast.success('Delivery confirmed! Stock added to your inventory.'); onAction() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
  }

  const handleCancel = async () => {
    try { await cancelTransfer(cancelId); toast.success('Transfer cancelled'); onAction() }
    catch (err) { toast.error(err.response?.data?.message || 'Failed') }
    finally { setCancelId(null) }
  }

  if (!transfers.length) return <EmptyState title="No transfers" description="No inter-hospital transfers found." />

  return (
    <>
      <div className="space-y-3">
        {transfers.map(t => {
          const iAm = isSupplier(t) ? 'supplier' : 'requester'

          const otherHospital = iAm === 'supplier' ? t.requestingHospital : t.supplyingHospital
          const otherName     = otherHospital?.hospitalName || otherHospital?.name
          const otherCity     = otherHospital?.location?.city

          const hasAmbulanceInfo = (
            t.ambulanceInfo?.vehicleNumber ||
            t.ambulanceInfo?.driverName    ||
            t.ambulanceInfo?.driverPhone
          )

          return (
            <div key={t._id} className={`card border transition-all ${
              t.status === 'IN_TRANSIT' && iAm === 'requester'
                ? 'border-orange-700/60 bg-orange-900/10'
                : 'border-slate-800 hover:border-slate-700'
            }`}>

              {/* Row 1 */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-slate-200 font-medium text-sm">
                    {iAm === 'supplier' ? '📤 Supplying to' : '📥 Requesting from'}{' '}
                    <span className="text-slate-100">{otherName}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {otherCity} · {formatDate(t.createdAt)}
                  </p>
                  <button
                    onClick={() => setProfile(otherHospital)}
                    className="mt-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 flex items-center gap-1"
                  >
                    <Building2 size={10} /> View hospital profile
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`font-display text-xl ${bgColor(t.bloodGroup)}`}>{t.bloodGroup}</span>
                  <span className="text-slate-400 text-sm font-mono">{t.unitsRequested} units</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    t.urgencyLevel === 'Critical' ? 'bg-red-900 text-red-400' :
                    t.urgencyLevel === 'High'     ? 'bg-orange-900 text-orange-400' :
                    'bg-slate-800 text-slate-400'}`}>
                    {t.urgencyLevel}
                  </span>
                  <TransferBadge status={t.status} />
                </div>
              </div>

              {/* Row 2: address */}
              {iAm === 'supplier'
                ? <DeliverToCard hospital={otherHospital} />
                : <HospitalInfoStrip hospital={otherHospital} />
              }

              {/* Ambulance info — requester */}
              {iAm === 'requester' && t.status === 'IN_TRANSIT' && (
                hasAmbulanceInfo
                  ? <AmbulanceInfoCard ambulanceInfo={t.ambulanceInfo} />
                  : (
                    <div className="mt-2 p-3 rounded-lg bg-yellow-900/20 border border-yellow-700/40 text-xs text-yellow-300">
                      ⏳ Blood is on the way. Supplier hasn't entered ambulance details yet.
                    </div>
                  )
              )}

              {/* Ambulance info — supplier summary */}
              {iAm === 'supplier' && t.status === 'IN_TRANSIT' && hasAmbulanceInfo && (
                <div className="mt-2 p-2.5 rounded-lg bg-slate-800/60 border border-slate-700 flex flex-wrap gap-4 text-xs">
                  <span className="text-slate-400">🚑 <span className="text-orange-300 font-mono">{t.ambulanceInfo.vehicleNumber}</span></span>
                  {t.ambulanceInfo.driverName  && <span className="text-slate-400">Driver: <span className="text-slate-200">{t.ambulanceInfo.driverName}</span></span>}
                  {t.ambulanceInfo.driverPhone && <span className="text-slate-400">Phone: <span className="text-green-400 font-mono">{t.ambulanceInfo.driverPhone}</span></span>}
                </div>
              )}

              {/* Rejection reason */}
              {t.status === 'REJECTED' && t.rejectionReason && (
                <div className="mt-2 p-2.5 rounded-lg bg-red-900/20 border border-red-800/40 text-xs text-red-300">
                  Rejected: {t.rejectionReason}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 flex-wrap mt-3 pt-3 border-t border-slate-800">
                {iAm === 'supplier' && t.status === 'PENDING' && (
                  <>
                    <button onClick={() => handleAccept(t._id)}
                      className="text-xs bg-green-900 hover:bg-green-800 text-green-300 px-3 py-1.5 rounded-lg">
                      ✓ Accept
                    </button>
                    <button onClick={() => setRejectId(t._id)}
                      className="text-xs bg-red-900 hover:bg-red-800 text-red-300 px-3 py-1.5 rounded-lg">
                      ✗ Reject
                    </button>
                  </>
                )}
                {iAm === 'supplier' && t.status === 'ACCEPTED' && (
                  <button onClick={() => setDispatch(t)}
                    className="text-xs bg-orange-800 hover:bg-orange-700 text-orange-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                    <Truck size={12} /> 🚑 Dispatch Ambulance
                  </button>
                )}
                {iAm === 'requester' && t.status === 'IN_TRANSIT' && (
                  <button onClick={() => handleDeliver(t._id)}
                    className="text-xs bg-green-800 hover:bg-green-700 text-green-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium">
                    <CheckCircle size={12} /> ✓ Confirm Delivery Received
                  </button>
                )}
                {['PENDING', 'ACCEPTED'].includes(t.status) && (
                  <button onClick={() => setCancelId(t._id)}
                    className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 px-3 py-1.5 rounded-lg ml-auto">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Reject dialog */}
      {rejectId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card max-w-sm mx-4 border-slate-700 w-full">
            <h3 className="font-semibold text-slate-100 mb-3">Reject Transfer</h3>
            <textarea className="input resize-none w-full mb-3" rows={3}
              placeholder="Reason for rejection..."
              value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
            <div className="flex gap-3">
              <button onClick={() => setRejectId(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleReject}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white py-2 rounded-lg text-sm">
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel dialog */}
      {cancelId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="card max-w-sm mx-4 border-slate-700 w-full">
            <h3 className="font-semibold text-slate-100 mb-3">Cancel Transfer?</h3>
            <p className="text-sm text-slate-400 mb-4">This will cancel the transfer request.</p>
            <div className="flex gap-3">
              <button onClick={() => setCancelId(null)} className="btn-secondary flex-1">Keep</button>
              <button onClick={handleCancel}
                className="flex-1 bg-red-800 hover:bg-red-700 text-white py-2 rounded-lg text-sm">
                Cancel Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch modal */}
      {dispatchItem && (
        <DispatchModal transfer={dispatchItem} onClose={() => setDispatch(null)} onSuccess={onAction} />
      )}

      {/* Profile modal — reads from fully-populated transfer data */}
      {profileHospital && (
        <HospitalProfileModal hospital={profileHospital} onClose={() => setProfile(null)} />
      )}
    </>
  )
}


// ── Main Page ──────────────────────────────────────────────────────────────────
export default function HospitalInventoryPage({ hospitalId }) {
  const [inventory, setInventory]       = useState(null)
  const [transfers, setTransfers]       = useState([])
  const [invLoading, setInvLoading]     = useState(true)
  const [trLoading, setTrLoading]       = useState(true)
  const [tab, setTab]                   = useState('inventory')
  const [showEditor, setShowEditor]     = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [isPublic, setIsPublic]         = useState(true)
  const [togglingVis, setTogglingVis]   = useState(false)

  const loadInventory = async () => {
    setInvLoading(true)
    try {
      const res = await getMyInventory()
      setInventory(res.data)
      setIsPublic(res.data.isPublic)
    } catch { toast.error('Failed to load inventory') }
    finally { setInvLoading(false) }
  }

  const loadTransfers = async () => {
    setTrLoading(true)
    try {
      const res = await getMyTransfers({ role: 'all', limit: 50 })
      setTransfers(res.data.data || [])
    } catch {}
    finally { setTrLoading(false) }
  }

  useEffect(() => { loadInventory(); loadTransfers() }, [])

  const handleToggleVisibility = async () => {
    setTogglingVis(true)
    try {
      await setInventoryVisibility(!isPublic)
      setIsPublic(!isPublic)
      toast.success(`Inventory is now ${!isPublic ? 'public' : 'private'}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally { setTogglingVis(false) }
  }

  const TABS = [
    { id: 'inventory', label: '🩸 My Stock',  icon: Package },
    { id: 'transfers', label: '🚑 Transfers', icon: ArrowLeftRight },
  ]

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-3xl text-slate-100">BLOOD INVENTORY</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleToggleVisibility} disabled={togglingVis}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-all ${
              isPublic
                ? 'bg-green-900/30 border-green-800 text-green-400 hover:bg-green-900/50'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}>
            {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
            {isPublic ? 'Public' : 'Private'}
          </button>
          <button onClick={() => setShowTransfer(true)} className="btn-secondary flex items-center gap-2 text-sm">
            <ArrowLeftRight size={14} /> Request Transfer
          </button>
          <button onClick={() => setShowEditor(true)} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={14} /> Update Stock
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 rounded-xl p-1 w-fit border border-slate-800">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === id ? 'bg-blood-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {tab === 'inventory' && (
        invLoading ? <LoadingSpinner className="py-12" /> : !inventory ? (
          <EmptyState title="No inventory data" />
        ) : (
          <>
            <p className="text-xs text-slate-500">
              Last updated: {inventory.lastStockUpdate ? formatDate(inventory.lastStockUpdate) : 'Never'}
              {' · '}
              <span className={isPublic ? 'text-green-400' : 'text-slate-500'}>
                {isPublic ? '👁 Visible to other hospitals' : '🔒 Private'}
              </span>
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {(inventory.stock || []).map(({ bloodGroup, units }) => (
                <div key={bloodGroup} className={`card text-center border transition-all hover:border-slate-700 ${
                  units === 0 ? 'opacity-50' : units < 3 ? 'border-red-800/50 bg-red-900/10' : ''}`}>
                  <p className={`font-display text-3xl mb-1 ${bgColor(bloodGroup)}`}>{bloodGroup}</p>
                  <p className={`text-2xl font-bold mb-1 ${
                    units === 0 ? 'text-slate-600' : units < 3 ? 'text-red-400' : 'text-slate-100'}`}>
                    {units}
                  </p>
                  <p className="text-xs text-slate-600">units</p>
                  {units > 0 && units < 3 && <p className="text-xs text-red-400 mt-1">Low!</p>}
                </div>
              ))}
            </div>
            {inventory.stock?.some(s => s.units > 0 && s.units < 3) && (
              <div className="p-3 rounded-lg bg-red-900/20 border border-red-800/40 text-sm text-red-300">
                ⚠️ Some blood groups are running low. Consider requesting a transfer from another hospital.
              </div>
            )}
          </>
        )
      )}

      {/* Transfers Tab */}
      {tab === 'transfers' && (
        trLoading ? <LoadingSpinner className="py-12" /> : (
          <TransfersTable
            transfers={transfers}
            myId={hospitalId}
            onAction={() => { loadTransfers(); loadInventory() }}
          />
        )
      )}

      {/* Modals */}
      {showEditor && (
        <StockEditorModal
          stock={inventory?.stock || []}
          onClose={() => setShowEditor(false)}
          onSaved={loadInventory}
        />
      )}
      {showTransfer && (
        <RequestTransferModal
          onClose={() => setShowTransfer(false)}
          onSuccess={loadTransfers}
        />
      )}
    </div>
  )
}
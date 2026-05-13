import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register as registerAPI } from '../api/auth'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Upload, X, ChevronRight, ChevronLeft, Check } from 'lucide-react'

// ── Constants ──────────────────────────────────────────────────────────────────
const BLOOD_GROUPS   = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
const ROLES          = [
  { value: 'DONOR',    label: '🩸 Donor',    sub: 'I want to donate blood' },
  { value: 'HOSPITAL', label: '🏥 Hospital', sub: 'We need blood donors'   },
]
const SMOKING_OPTIONS  = ['Non-Smoker', 'Smoker', 'Ex-Smoker']
const ALCOHOL_OPTIONS  = ['None', 'Occasional', 'Regular']
const HOSPITAL_TYPES   = ['Government', 'Private', 'Clinic']

// ── Step config ────────────────────────────────────────────────────────────────
const DONOR_STEPS    = ['Account', 'Personal', 'Medical', 'Eligibility']
const HOSPITAL_STEPS = ['Account', 'Basic Info', 'Contact & Address', 'Blood Bank & Docs']

// ── Tiny helpers ───────────────────────────────────────────────────────────────
const Input = ({ label, required, className = '', ...props }) => (
  <div className={className}>
    <label className="label">{label}{required && <span className="text-blood-500 ml-0.5">*</span>}</label>
    <input className="input" {...props} />
  </div>
)

const Select = ({ label, options, required, className = '', ...props }) => (
  <div className={className}>
    <label className="label">{label}{required && <span className="text-blood-500 ml-0.5">*</span>}</label>
    <select className="input" {...props}>
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
  </div>
)

const TagInput = ({ label, value = [], onChange, placeholder }) => {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim()
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input className="input flex-1" placeholder={placeholder} value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" onClick={add}
          className="px-3 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 text-sm">Add</button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((tag) => (
            <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blood-900/40 border border-blood-700/50 text-blood-300 text-xs">
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))}>
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

const FileUpload = ({ label, name, value, onChange, accept = 'image/jpeg,image/png,image/webp,application/pdf', optional = true }) => {
  const ref = useRef()
  return (
    <div>
      <label className="label">{label}{!optional && <span className="text-blood-500 ml-0.5">*</span>}</label>
      <div
        onClick={() => ref.current.click()}
        className="border border-dashed border-slate-600 hover:border-blood-600 rounded-lg p-4 cursor-pointer transition-colors flex items-center gap-3 bg-slate-800/50">
        <Upload size={16} className="text-slate-400 shrink-0" />
        {value ? (
          <span className="text-sm text-blood-300 truncate">{value.name}</span>
        ) : (
          <span className="text-sm text-slate-500">Click to upload · PDF / JPG / PNG (max 10 MB)</span>
        )}
        {value && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null) }}
            className="ml-auto text-slate-500 hover:text-red-400">
            <X size={14} />
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden"
        onChange={(e) => onChange(e.target.files[0] || null)} />
    </div>
  )
}

const ToggleGroup = ({ label, options, value, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.label ?? o} type="button" onClick={() => onChange(o.value ?? o)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-all
            ${value === (o.value ?? o)
              ? 'border-blood-600 bg-blood-900/40 text-blood-300'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
          {o.label ?? o}
        </button>
      ))}
    </div>
  </div>
)

// BooleanToggle stores actual true/false, not strings.
const BooleanToggle = ({ label, value, onChange }) => (
  <ToggleGroup
    label={label}
    options={[
      { label: 'Yes', value: true  },
      { label: 'No',  value: false },
    ]}
    value={value}
    onChange={onChange}
  />
)

const BloodGroupMulti = ({ value = [], onChange }) => (
  <div>
    <label className="label">Available Blood Groups</label>
    <div className="flex flex-wrap gap-2">
      {BLOOD_GROUPS.map((g) => (
        <button key={g} type="button"
          onClick={() => onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g])}
          className={`w-12 h-9 rounded-lg text-sm border font-mono transition-all
            ${value.includes(g)
              ? 'border-blood-600 bg-blood-900/40 text-blood-300'
              : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
          {g}
        </button>
      ))}
    </div>
  </div>
)

// ── Step Progress Bar ──────────────────────────────────────────────────────────
const StepBar = ({ steps, current }) => (
  <div className="flex items-center gap-1 mb-8">
    {steps.map((s, i) => (
      <div key={s} className="flex items-center gap-1 flex-1">
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border transition-all shrink-0
          ${i < current  ? 'border-blood-600 bg-blood-600 text-white'
          : i === current ? 'border-blood-500 bg-blood-900/40 text-blood-300'
          : 'border-slate-700 bg-slate-800 text-slate-500'}`}>
          {i < current ? <Check size={12} /> : i + 1}
        </div>
        <span className={`text-xs hidden sm:block truncate transition-colors
          ${i === current ? 'text-blood-300' : i < current ? 'text-slate-400' : 'text-slate-600'}`}>
          {s}
        </span>
        {i < steps.length - 1 && (
          <div className={`flex-1 h-px mx-1 transition-colors ${i < current ? 'bg-blood-700' : 'bg-slate-800'}`} />
        )}
      </div>
    ))}
  </div>
)

// ── Main Component ─────────────────────────────────────────────────────────────
export default function Register() {
  const [step, setStep]       = useState(0)
  const [show, setShow]       = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate  = useNavigate()

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    // Account (step 0 – both roles)
    name: '', email: '', password: '', role: 'DONOR',

    // DONOR – Personal (step 1)
    bloodGroup: 'O+', gender: '', dateOfBirth: '', mobileNumber: '',
    age: '', weight: '',
    address: '', city: 'Chennai', state: 'Tamil Nadu', pincode: '',
    lat: '13.0827', lng: '80.2707',
    profilePhoto: null,

    // DONOR – Medical (step 2)
    hemoglobinLevel: '', currentMedications: [], allergies: [],
    surgeryHistory: [], smokingStatus: '', alcoholStatus: '',
    covidVaccinationStatus: '', healthConditions: [],
    lastDonationDate: '',

    // DONOR – Eligibility (step 3)
    // '' means "not answered yet"; true/false means answered
    fitForDonation: '', governmentIdNumber: '', emergencyContactNumber: '',
    medicalReportCertificate: null,

    // HOSPITAL – Basic (step 1)
    hospitalName: '', licenseNumber: '', hospitalType: '',
    registrationNumber: '', establishedYear: '',

    // HOSPITAL – Contact & Address (step 2)
    contactPersonName: '', hospitalMobile: '', hospitalTelephone: '',
    hospitalWebsite: '', hospitalAddress: '', hospitalState: '',
    hospitalPincode: '', hospitalLandmark: '',

    // HOSPITAL – Blood Bank & Docs (step 3)
    // boolean fields start as '' so they're omitted if user never touches them
    bloodBankAvailable: '', bloodStorageCapacity: '',
    availableBloodGroups: [], emergencyServiceAvailable: '',
    is24x7Service: '', gstNumber: '',
    hospitalLicenseCertificate: null,
    governmentApprovalDocument: null,
    adminIdProof: null,
    hospitalPhoto: null,
  })

  const set   = (k, v) => setForm((p) => ({ ...p, [k]: v }))
  const steps = form.role === 'DONOR' ? DONOR_STEPS : HOSPITAL_STEPS

  // ── Navigation ──────────────────────────────────────────────────────────────
  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (step < steps.length - 1) { next(); return }

    setLoading(true)
    try {
      // Filter: keep actual false and 0, only exclude null/undefined/''
      const data = Object.fromEntries(
        Object.entries(form).filter(([, v]) => {
          if (v === null || v === undefined || v === '') return false
          if (Array.isArray(v) && v.length === 0) return false
          return true // keeps false, 0, and any real value
        })
      )

      const res = await registerAPI(data)
      login(res.data.user, res.data.token)
      toast.success('Account created!')
      navigate(res.data.user.role === 'HOSPITAL' ? '/hospital' : '/donor', { replace: true })
    } catch (err) {
      const serverErrors = err.response?.data?.errors
      if (Array.isArray(serverErrors) && serverErrors.length > 0) {
        const msg = serverErrors.map((e) => e.msg || e.message || JSON.stringify(e)).join(' · ')
        toast.error(msg, { duration: 6000 })
      } else {
        toast.error(err.response?.data?.message || 'Registration failed')
      }
      console.error('Register error:', err.response?.data)
    } finally {
      setLoading(false)
    }
  }

  // ── Step content ─────────────────────────────────────────────────────────────
  const renderStep = () => {
    // ── STEP 0: Account (both roles) ──────────────────────────────────────────
    if (step === 0) return (
      <div className="space-y-4">
        <div>
          <label className="label">I am a…</label>
          <div className="grid grid-cols-2 gap-3">
            {ROLES.map(({ value, label, sub }) => (
              <button key={value} type="button" onClick={() => { set('role', value); setStep(0) }}
                className={`p-3 rounded-lg border text-left transition-all
                  ${form.role === value
                    ? 'border-blood-600 bg-blood-900/30 text-blood-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600'}`}>
                <div className="text-sm font-semibold">{label}</div>
                <div className="text-xs mt-0.5 opacity-70">{sub}</div>
              </button>
            ))}
          </div>
        </div>
        <Input label="Full Name" required placeholder="Arun Kumar"
          value={form.name} onChange={(e) => set('name', e.target.value)} />
        <Input label="Email" required type="email" placeholder="you@example.com"
          value={form.email} onChange={(e) => set('email', e.target.value)} />
        <div>
          <label className="label">Password <span className="text-blood-500">*</span></label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} className="input pr-10"
              placeholder="Min. 8 characters" required minLength={8}
              value={form.password} onChange={(e) => set('password', e.target.value)} />
            <button type="button" onClick={() => setShow(!show)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200">
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </div>
    )

    // ── DONOR STEPS ───────────────────────────────────────────────────────────
    if (form.role === 'DONOR') {
      // Step 1 – Personal
      if (step === 1) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select label="Blood Group" required options={BLOOD_GROUPS}
              value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} />
            <Select label="Gender" options={['Male', 'Female', 'Other']}
              value={form.gender} onChange={(e) => set('gender', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Date of Birth" type="date"
              value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            <Input label="Age" type="number" placeholder="25" min="18" max="65"
              value={form.age} onChange={(e) => set('age', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Weight (kg)" type="number" placeholder="60" min="50"
              value={form.weight} onChange={(e) => set('weight', e.target.value)} />
            <Input label="Mobile Number" type="tel" placeholder="9876543210"
              value={form.mobileNumber} onChange={(e) => set('mobileNumber', e.target.value)} />
          </div>
          <Input label="Address" placeholder="123 Anna Salai"
            value={form.address} onChange={(e) => set('address', e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City" placeholder="Chennai"
              value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input label="State" placeholder="Tamil Nadu"
              value={form.state} onChange={(e) => set('state', e.target.value)} />
            <Input label="Pincode" placeholder="600001" maxLength={10}
              value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" type="number" step="any" placeholder="13.0827"
              value={form.lat} onChange={(e) => set('lat', e.target.value)} />
            <Input label="Longitude" type="number" step="any" placeholder="80.2707"
              value={form.lng} onChange={(e) => set('lng', e.target.value)} />
          </div>
          <FileUpload label="Profile Photo (optional)" name="profilePhoto"
            accept="image/jpeg,image/png,image/webp"
            value={form.profilePhoto} onChange={(f) => set('profilePhoto', f)} />
        </div>
      )

      // Step 2 – Medical
      if (step === 2) return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Weight (kg)" type="number" placeholder="60" min="50"
              value={form.weight} onChange={(e) => set('weight', e.target.value)} />
            <Input label="Hemoglobin Level (g/dL)" type="number" step="0.1" placeholder="13.5"
              value={form.hemoglobinLevel} onChange={(e) => set('hemoglobinLevel', e.target.value)} />
          </div>
          <Input label="Last Blood Donation Date" type="date"
            value={form.lastDonationDate} onChange={(e) => set('lastDonationDate', e.target.value)} />
          <TagInput label="Any Diseases (Diabetes, BP, etc.)" value={form.healthConditions}
            onChange={(v) => set('healthConditions', v)} placeholder="e.g. Diabetes — press Enter" />
          <TagInput label="Current Medications" value={form.currentMedications}
            onChange={(v) => set('currentMedications', v)} placeholder="e.g. Metformin — press Enter" />
          <TagInput label="Allergies" value={form.allergies}
            onChange={(v) => set('allergies', v)} placeholder="e.g. Penicillin — press Enter" />
          <TagInput label="Surgery History" value={form.surgeryHistory}
            onChange={(v) => set('surgeryHistory', v)} placeholder="e.g. Appendectomy 2019 — press Enter" />
          <div className="grid grid-cols-2 gap-3">
            <ToggleGroup label="Smoking Status" options={SMOKING_OPTIONS}
              value={form.smokingStatus} onChange={(v) => set('smokingStatus', v)} />
            <ToggleGroup label="Alcohol Status" options={ALCOHOL_OPTIONS}
              value={form.alcoholStatus} onChange={(v) => set('alcoholStatus', v)} />
          </div>
          <Input label="COVID / Vaccination Status (optional)" placeholder="e.g. Fully vaccinated — Covishield"
            value={form.covidVaccinationStatus} onChange={(e) => set('covidVaccinationStatus', e.target.value)} />
        </div>
      )

      // Step 3 – Eligibility
      if (step === 3) return (
        <div className="space-y-4">
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-sm text-slate-400 space-y-1">
            <p className="text-slate-300 font-medium">Eligibility Checklist</p>
            <p>✓ Age above 18 &nbsp;·&nbsp; ✓ Weight above 50 kg</p>
          </div>
          <BooleanToggle label="Fit for Donation?"
            value={form.fitForDonation}
            onChange={(v) => set('fitForDonation', v)} />
          <Input label="Aadhaar / Government ID Number" placeholder="XXXX XXXX XXXX"
            value={form.governmentIdNumber} onChange={(e) => set('governmentIdNumber', e.target.value)} />
          <Input label="Emergency Contact Number" type="tel" placeholder="9876543210"
            value={form.emergencyContactNumber} onChange={(e) => set('emergencyContactNumber', e.target.value)} />
          <FileUpload label="Medical Report / Certificate (optional)" name="medicalReportCertificate"
            value={form.medicalReportCertificate} onChange={(f) => set('medicalReportCertificate', f)} />
        </div>
      )
    }

    // ── HOSPITAL STEPS ────────────────────────────────────────────────────────
    if (form.role === 'HOSPITAL') {
      // Step 1 – Basic Info
      if (step === 1) return (
        <div className="space-y-4">
          <Input label="Hospital Name" required placeholder="Apollo Hospitals Chennai"
            value={form.hospitalName} onChange={(e) => set('hospitalName', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Hospital Type" options={HOSPITAL_TYPES}
              value={form.hospitalType} onChange={(e) => set('hospitalType', e.target.value)} />
            <Input label="Established Year" type="number" placeholder="2000" min="1800" max={new Date().getFullYear()}
              value={form.establishedYear} onChange={(e) => set('establishedYear', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Registration Number" placeholder="TN-REG-12345"
              value={form.registrationNumber} onChange={(e) => set('registrationNumber', e.target.value)} />
            <Input label="License Number" placeholder="TN-HOSP-001"
              value={form.licenseNumber} onChange={(e) => set('licenseNumber', e.target.value)} />
          </div>
          <FileUpload label="Hospital Photo (optional)" name="hospitalPhoto"
            accept="image/jpeg,image/png,image/webp"
            value={form.hospitalPhoto} onChange={(f) => set('hospitalPhoto', f)} />
        </div>
      )

      // Step 2 – Contact & Address
      if (step === 2) return (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Contact Details</p>
          <Input label="Contact Person Name" placeholder="Dr. Ramesh"
            value={form.contactPersonName} onChange={(e) => set('contactPersonName', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Mobile Number" type="tel" placeholder="9876543210"
              value={form.hospitalMobile} onChange={(e) => set('hospitalMobile', e.target.value)} />
            <Input label="Telephone" placeholder="04412345678"
              value={form.hospitalTelephone} onChange={(e) => set('hospitalTelephone', e.target.value)} />
          </div>
          <Input label="Email" type="email" placeholder="info@hospital.com"
            value={form.email} onChange={(e) => set('email', e.target.value)} />
          <Input label="Website (optional)" type="url" placeholder="https://hospital.com"
            value={form.hospitalWebsite} onChange={(e) => set('hospitalWebsite', e.target.value)} />

          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold pt-2">Address Details</p>
          <Input label="Address" placeholder="123 Greams Road"
            value={form.hospitalAddress} onChange={(e) => set('hospitalAddress', e.target.value)} />
          <div className="grid grid-cols-3 gap-3">
            <Input label="City" placeholder="Chennai"
              value={form.city} onChange={(e) => set('city', e.target.value)} />
            <Input label="State" placeholder="Tamil Nadu"
              value={form.hospitalState} onChange={(e) => set('hospitalState', e.target.value)} />
            <Input label="Pincode" placeholder="600006"
              value={form.hospitalPincode} onChange={(e) => set('hospitalPincode', e.target.value)} />
          </div>
          <Input label="Landmark (optional)" placeholder="Near YMCA"
            value={form.hospitalLandmark} onChange={(e) => set('hospitalLandmark', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" type="number" step="any" placeholder="13.0827"
              value={form.lat} onChange={(e) => set('lat', e.target.value)} />
            <Input label="Longitude" type="number" step="any" placeholder="80.2707"
              value={form.lng} onChange={(e) => set('lng', e.target.value)} />
          </div>
        </div>
      )

      // Step 3 – Blood Bank & Docs
      if (step === 3) return (
        <div className="space-y-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Blood Bank Details</p>
          <div className="grid grid-cols-2 gap-3">
            <BooleanToggle label="Blood Bank Available?"
              value={form.bloodBankAvailable}
              onChange={(v) => set('bloodBankAvailable', v)} />
            <Input label="Storage Capacity (units)" type="number" placeholder="500" min="0"
              value={form.bloodStorageCapacity} onChange={(e) => set('bloodStorageCapacity', e.target.value)} />
          </div>
          <BloodGroupMulti value={form.availableBloodGroups}
            onChange={(v) => set('availableBloodGroups', v)} />
          <div className="grid grid-cols-2 gap-3">
            <BooleanToggle label="Emergency Service?"
              value={form.emergencyServiceAvailable}
              onChange={(v) => set('emergencyServiceAvailable', v)} />
            <BooleanToggle label="24×7 Service?"
              value={form.is24x7Service}
              onChange={(v) => set('is24x7Service', v)} />
          </div>

          <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold pt-2">Verification Documents</p>
          <FileUpload label="Hospital License Certificate" name="hospitalLicenseCertificate" optional={false}
            value={form.hospitalLicenseCertificate} onChange={(f) => set('hospitalLicenseCertificate', f)} />
          <FileUpload label="Government Approval Document" name="governmentApprovalDocument" optional={false}
            value={form.governmentApprovalDocument} onChange={(f) => set('governmentApprovalDocument', f)} />
          <FileUpload label="ID Proof of Admin" name="adminIdProof" optional={false}
            value={form.adminIdProof} onChange={(f) => set('adminIdProof', f)} />
          <Input label="GST Number (optional)" placeholder="22AAAAA0000A1Z5"
            value={form.gstNumber} onChange={(e) => set('gstNumber', e.target.value)} />
        </div>
      )
    }
  }

  const isLastStep = step === steps.length - 1

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#e51d1d10_0%,_transparent_70%)]" />
      <div className="relative w-full max-w-lg">

        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blood-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-display text-lg">B</span>
            </div>
            <span className="font-display text-3xl text-blood-400 tracking-wider">BLOODLINK</span>
          </Link>
          <h1 className="font-display text-4xl text-slate-100">CREATE ACCOUNT</h1>
        </div>

        <div className="card border-slate-700">
          <StepBar steps={steps} current={step} />

          <form onSubmit={handleSubmit} className="space-y-4">
            {renderStep()}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {step > 0 && (
                <button type="button" onClick={prev}
                  className="flex items-center gap-1 px-4 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:border-slate-600 text-sm transition-colors">
                  <ChevronLeft size={15} /> Back
                </button>
              )}
              <button type="submit" disabled={loading}
                className="btn-primary flex-1 py-3 flex items-center justify-center gap-2">
                {loading ? 'Creating account…' : isLastStep ? 'Create Account' : (
                  <><span>Continue</span><ChevronRight size={15} /></>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Already have an account?{' '}
            <Link to="/login" className="text-blood-400 hover:text-blood-300">Sign In</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
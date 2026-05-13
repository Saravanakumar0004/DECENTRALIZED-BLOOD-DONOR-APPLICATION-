import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDonationById, donorConfirm, uploadProof, recordBlockchain } from '../api/donations'
import { useAuthStore } from '../store/authStore'
import { BloodBadge, StatusBadge, TxHashBadge, LoadingSpinner, ConfirmDialog } from '../components/ui/index'
import { formatDateTime, truncateAddress } from '../utils/formatters'
import { recordOnChain, connectWallet } from '../utils/blockchain'
import toast from 'react-hot-toast'
import { CheckCircle, Upload, Link as LinkIcon, Shield, ExternalLink } from 'lucide-react'

const ETHERSCAN_BASE = import.meta.env.VITE_ETHERSCAN_BASE || 'https://sepolia.etherscan.io/tx/'

function StepCard({ number, title, description, done, active, children }) {
  return (
    <div className={`card border transition-all ${
      done   ? 'border-green-700 bg-green-900/10'  :
      active ? 'border-blood-700 bg-blood-900/10'  :
               'border-slate-800 opacity-60'
    }`}>
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
          done   ? 'bg-green-500 text-white'   :
          active ? 'bg-blood-600 text-white'   :
                   'bg-slate-700 text-slate-400'
        }`}>
          {done ? '✓' : number}
        </div>
        <div>
          <h3 className="font-medium text-slate-100">{title}</h3>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {(active || done) && children}
    </div>
  )
}

export default function DonationDetail() {
  const { id }                        = useParams()
  const { user, walletAddress, setWallet } = useAuthStore()
  const navigate                      = useNavigate()
  const [donation, setDonation]       = useState(null)
  const [loading, setLoading]         = useState(true)
  const [confirming, setConfirming]   = useState(false)
  const [bcLoading, setBCLoading]     = useState(false)
  const [completed, setCompleted]     = useState(null)
  const [proofOpen, setProofOpen]     = useState(false)

  const load = async () => {
    try {
      const res = await getDonationById(id)
      setDonation(res.data.data)
    } catch {
      toast.error('Donation not found')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return <LoadingSpinner size="lg" className="py-24" />
  if (!donation) return null

  const isDonor    = donation.donor?._id === user?.id || donation.donor?.id === user?.id
  const isHospital = user?.role === 'HOSPITAL'

  const step1Done  = donation.donorConfirmed
  const step2Done  = !!donation.proofImageUrl
  const step3Done  = donation.receiverConfirmed
  const step4Done  = donation.status === 'COMPLETED'
  const readyForBC = donation.readyForBlockchain

  const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : !step4Done ? 4 : 5

  const handleDonorConfirm = async () => {
    try {
      await donorConfirm(id)
      toast.success('Donation confirmed!')
      load()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed')
    } finally {
      setConfirming(false)
    }
  }

  const handleUpload = async (file) => {
    try {
      await uploadProof(id, file)
      toast.success('Proof uploaded!')
      load()
    } catch {
      toast.error('Upload failed')
    }
  }

  const handleBlockchain = async () => {
    setBCLoading(true)
    try {
      const { address } = await connectWallet()
      setWallet(address)

      const result = await recordOnChain({
        donationId:       id,
        bloodBagId:       donation.bloodBagId,
        donorAddress:     donation.donor?.walletAddress || address,
        hospitalAddress:  donation.hospital?.walletAddress || '0x0000000000000000000000000000000000000001',
        donorConfirmedAt: donation.donorConfirmedAt,
      })

      await recordBlockchain(id, { txHash: result.txHash, blockchainHash: result.blockchainHash })

      setCompleted(result)
      toast.success('Donation recorded on blockchain! 100 BDC earned!')
      load()
    } catch (err) {
      toast.error(err.message || 'Blockchain recording failed')
    } finally {
      setBCLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-3xl text-slate-100">DONATION DETAIL</h2>
          <p className="text-xs font-mono text-slate-500 mt-1">{id}</p>
        </div>
        <StatusBadge status={donation.status} />
      </div>

      {/* ── Info card ── */}
      <div className="card mb-6 border-slate-700">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500 text-xs mb-1">Blood Group</p>
            <BloodBadge group={donation.request?.bloodGroup} />
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Hospital</p>
            <p className="text-slate-200">{donation.hospital?.hospitalName || donation.hospital?.name}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Donor</p>
            <p className="text-slate-200">{donation.donor?.name}</p>
            {donation.donor?.walletAddress && (
              <p className="text-xs font-mono text-slate-500">{truncateAddress(donation.donor.walletAddress)}</p>
            )}
          </div>
          <div>
            <p className="text-slate-500 text-xs mb-1">Date</p>
            <p className="text-slate-200">{formatDateTime(donation.createdAt)}</p>
          </div>
          {donation.bloodBagId && (
            <div className="col-span-2">
              <p className="text-slate-500 text-xs mb-1">Blood Bag ID</p>
              <p className="text-slate-200 font-mono">{donation.bloodBagId}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Steps ── */}
      <div className="space-y-4">

        {/* Step 1 — Donor Confirmation */}
        <StepCard
          number={1}
          title="Donor Confirmation"
          description="Confirm you have donated blood"
          done={step1Done}
          active={currentStep === 1 && isDonor}
        >
          {isDonor && !step1Done && (
            <>
              <p className="text-sm text-slate-400 mb-4">
                By confirming, you certify that you have physically donated blood at the hospital.
              </p>
              <button onClick={() => setConfirming(true)} className="btn-primary">
                <CheckCircle size={16} className="inline mr-2" />
                Confirm My Donation
              </button>
              <ConfirmDialog
                open={confirming}
                title="Confirm Donation"
                message="Confirm that you have physically donated blood at this hospital. This action cannot be undone."
                onConfirm={handleDonorConfirm}
                onCancel={() => setConfirming(false)}
                danger
              />
            </>
          )}
          {step1Done && (
            <p className="text-xs text-green-400">
              Confirmed on {formatDateTime(donation.donorConfirmedAt)}
            </p>
          )}
        </StepCard>

        {/* Step 2 — Upload Proof */}
        <StepCard
          number={2}
          title="Upload Proof"
          description="Upload photo of your donation certificate or receipt"
          done={step2Done}
          active={currentStep === 2 && isDonor}
        >
          {/* Donor: upload button (only when not yet uploaded) */}
          {isDonor && !step2Done && (
            <label className="btn-secondary cursor-pointer inline-flex items-center gap-2">
              <Upload size={16} /> Upload Proof Image
              <input
                type="file"
                hidden
                accept="image/*,.pdf"
                onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
              />
            </label>
          )}

          {/* Proof image — visible to BOTH donor and hospital once uploaded */}
          {step2Done && donation.proofImageUrl && (
            <div className="mt-1">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-400">
                  Uploaded by <span className="text-slate-200">{donation.donor?.name}</span>
                </p>
                <a
                  href={donation.proofImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink size={12} /> Open full size
                </a>
              </div>

              {/* Thumbnail — click to open lightbox */}
              <button
                onClick={() => setProofOpen(true)}
                className="block w-full group relative rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 transition-colors bg-slate-900"
              >
                <img
                  src={donation.proofImageUrl}
                  alt="Donation proof"
                  className="w-full max-h-56 object-contain"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-sm font-medium">Click to enlarge</span>
                </div>
              </button>

              {/* Donor: re-upload option */}
              {isDonor && (
                <label className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors">
                  <Upload size={12} /> Replace proof
                  <input
                    type="file"
                    hidden
                    accept="image/*,.pdf"
                    onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])}
                  />
                </label>
              )}
            </div>
          )}
        </StepCard>

        {/* Step 3 — Hospital Confirmation */}
        <StepCard
          number={3}
          title="Hospital Confirmation"
          description="Hospital enters blood bag ID and confirms receipt"
          done={step3Done}
          active={currentStep === 3}
        >
          {currentStep === 3 && !step3Done && (
            <p className="text-sm text-slate-400">
              Waiting for hospital to enter the blood bag ID and confirm receipt. You will be notified once confirmed.
            </p>
          )}
          {step3Done && (
            <p className="text-xs text-green-400">
              Confirmed on {formatDateTime(donation.receiverConfirmedAt)}
            </p>
          )}
        </StepCard>

        {/* Step 4 — Record on Blockchain */}
        <StepCard
          number={4}
          title="Record on Blockchain"
          description="Mint BDC tokens and NFT certificate"
          done={step4Done}
          active={currentStep === 4 && isDonor}
        >
          {isDonor && readyForBC && !step4Done && (
            <div>
              <p className="text-sm text-slate-400 mb-4">
                Both confirmations are complete. Record this donation on the Ethereum blockchain to earn 100 BDC and your soulbound NFT certificate.
              </p>
              {!walletAddress && (
                <p className="text-xs text-yellow-400 bg-yellow-900/30 border border-yellow-800 rounded-lg px-3 py-2 mb-3">
                  ⚠️ You need to connect your MetaMask wallet to proceed.
                </p>
              )}
              <button
                onClick={handleBlockchain}
                disabled={bcLoading}
                className="bg-purple-700 hover:bg-purple-600 text-white font-medium px-5 py-2.5 rounded-lg transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
              >
                <Shield size={16} />
                {bcLoading ? 'Recording on Blockchain...' : '⛓ Record on Blockchain'}
              </button>
            </div>
          )}
          {step4Done && (
            <p className="text-xs text-green-400">Recorded on {formatDateTime(donation.completedAt)}</p>
          )}
        </StepCard>
      </div>

      {/* ── Success banner ── */}
      {(step4Done || completed) && (
        <div className="mt-6 card border-green-700 bg-green-900/20 text-center animate-slide-up">
          <div className="text-4xl mb-3">🎉</div>
          <h3 className="font-display text-2xl text-green-400 mb-2">DONATION COMPLETE!</h3>
          <p className="text-slate-300 text-sm mb-4">
            You earned <strong className="text-yellow-400">100 BDC tokens</strong> and a soulbound NFT certificate.
          </p>
          {(completed?.txHash || donation.txHash) && (
            <div className="flex items-center justify-center gap-2">
              <LinkIcon size={14} className="text-slate-500" />
              <TxHashBadge hash={completed?.txHash || donation.txHash} />
            </div>
          )}
        </div>
      )}

      {/* ── Proof lightbox modal ── */}
      {proofOpen && donation.proofImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setProofOpen(false)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-200">Donation Proof</p>
                <p className="text-xs text-slate-500">Submitted by {donation.donor?.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={donation.proofImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <ExternalLink size={13} /> Full size
                </a>
                <button
                  onClick={() => setProofOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal image */}
            <div className="p-4 bg-slate-950">
              <img
                src={donation.proofImageUrl}
                alt="Donation proof"
                className="w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
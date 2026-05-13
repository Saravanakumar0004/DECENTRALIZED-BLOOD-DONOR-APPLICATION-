// ─────────────────────────────────────────────────────────────────────────────
// FILE: src/routes/ai.routes.js
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express'
import Groq from 'groq-sdk'

import User from '../models/User.js'
import Donation from '../models/Donation.js'
import BloodRequest from '../models/BloodRequest.js'
import BloodInventory from '../models/BloodInventory.js'
import InterHospitalTransfer from '../models/InterHospitalTransfer.js'
import BDCLedger from '../models/BDCLedger.js'

import { protect } from '../middleware/auth.js'

const router = express.Router()

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const GROQ_MODEL = 'llama-3.3-70b-versatile'

// ─────────────────────────────────────────────────────────────────────────────
//  INLINE ROLE GUARD  (replaces the missing `authorise` export)
// ─────────────────────────────────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' })
  }
  next()
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — flatten Mongoose Map stock to plain object { 'A+': units, … }
// ─────────────────────────────────────────────────────────────────────────────
function flatStock(stock) {
  if (!stock) return {}
  const map = stock instanceof Map ? stock : new Map(Object.entries(stock))
  const out = {}
  for (const [bg, v] of map) out[bg] = v?.units ?? v ?? 0
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
//  HELPER — build full DB snapshot per role
// ─────────────────────────────────────────────────────────────────────────────
async function buildLiveData(user) {
  const role = user.role

  // ── ADMIN ──────────────────────────────────────────────────────────────────
  if (role === 'ADMIN') {
    const [users, donations, requests, transfers, bdcLedger, inventory] = await Promise.all([
      User.find().select('-password').lean(),
      Donation.find()
        .populate('donor', 'name email bloodGroup city bdcBalance')
        .populate('hospital', 'name city')
        .lean(),
      BloodRequest.find().populate('hospital', 'name city').lean(),
      InterHospitalTransfer.find()
        .populate('requestingHospital', 'name city')
        .populate('supplyingHospital', 'name city')
        .lean(),
      BDCLedger.find().lean(),
      BloodInventory.find().populate('hospital', 'name city').lean(),
    ])

    const donors    = users.filter(u => u.role === 'DONOR')
    const hospitals = users.filter(u => u.role === 'HOSPITAL')
    const now       = Date.now()
    const d30       = now - 30 * 24 * 3600 * 1000

    // Monthly trend — last 6 months
    const monthlyTrend = []
    for (let i = 5; i >= 0; i--) {
      const start = new Date()
      start.setMonth(start.getMonth() - i)
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setMonth(end.getMonth() + 1)
      monthlyTrend.push({
        month: start.toLocaleString('default', { month: 'short', year: '2-digit' }),
        donations: donations.filter(d => new Date(d.createdAt) >= start && new Date(d.createdAt) < end).length,
      })
    }

    // Supply vs demand
    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
    const supplyDemandMap = bloodGroups.map(bg => {
      const supply = inventory.reduce((acc, inv) => acc + (flatStock(inv.stock)[bg] || 0), 0)
      const demand = requests
        .filter(r => r.bloodGroup === bg && r.status === 'OPEN')
        .reduce((acc, r) => acc + (r.unitsRequired || 0), 0)
      return { bloodGroup: bg, supply, demand, deficit: demand - supply }
    })

    // Hospital rankings
    const hospitalRankings = hospitals.map(h => {
      const hDons     = donations.filter(d => d.hospital?._id?.toString() === h._id.toString())
      const total     = hDons.length
      const completed = hDons.filter(d => d.status === 'COMPLETED').length
      const disputed  = hDons.filter(d => d.status === 'DISPUTED').length
      return {
        id: h._id, name: h.name, city: h.city,
        total, completed, disputed,
        completionRate: total ? Math.round((completed / total) * 100) : 0,
      }
    }).sort((a, b) => b.completionRate - a.completionRate)

    const bdcTotal    = bdcLedger.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0)
    const bdcRedeemed = Math.abs(bdcLedger.filter(l => l.amount < 0).reduce((a, l) => a + l.amount, 0))

    const snapshot = {
      users: {
        total: users.length, donors: donors.length, hospitals: hospitals.length,
        unverifiedDonors: donors.filter(u => !u.isVerified).length,
        unverifiedHospitals: hospitals.filter(u => !u.isVerified).length,
        newLast30d: users.filter(u => new Date(u.createdAt) > new Date(d30)).length,
      },
      donations: {
        total: donations.length,
        completed: donations.filter(d => d.status === 'COMPLETED').length,
        pending:   donations.filter(d => d.status === 'PENDING').length,
        disputed:  donations.filter(d => d.status === 'DISPUTED').length,
        onBlockchain:  donations.filter(d => d.blockchainHash).length,
        proofUploaded: donations.filter(d => d.proofImageUrl).length,
        blockchainRate: donations.length
          ? `${Math.round((donations.filter(d => d.blockchainHash).length / donations.length) * 100)}%`
          : '0%',
      },
      requests: {
        total:        requests.length,
        open:         requests.filter(r => r.status === 'OPEN').length,
        criticalOpen: requests.filter(r => r.status === 'OPEN' && r.urgencyLevel === 'Critical').length,
        closed:       requests.filter(r => r.status !== 'OPEN').length,
      },
      bdc: { totalIssued: bdcTotal, totalRedeemed: bdcRedeemed, net: bdcTotal - bdcRedeemed },
      transfers: {
        total:     transfers.length,
        pending:   transfers.filter(t => t.status === 'PENDING').length,
        inTransit: transfers.filter(t => t.status === 'IN_TRANSIT').length,
        completed: transfers.filter(t => t.status === 'DELIVERED').length,
      },
    }

    const alertsAndActions = {
      disputedDonations: donations
        .filter(d => d.status === 'DISPUTED')
        .map(d => ({ id: d._id, donor: d.donor?.name, hospital: d.hospital?.name, bloodGroup: d.bloodGroup, reason: d.disputeReason })),
      pendingVerifications: users
        .filter(u => !u.isVerified && u.role !== 'ADMIN')
        .map(u => ({ id: u._id, name: u.name, role: u.role, email: u.email, bloodGroup: u.bloodGroup, hospitalName: u.hospitalName })),
      lowStockHospitals: inventory
        .filter(inv => Object.values(flatStock(inv.stock)).some(v => v < 5))
        .map(inv => {
          const s = flatStock(inv.stock)
          return {
            hospital: inv.hospital?.name,
            city: inv.hospital?.city,
            criticalGroups: Object.entries(s).filter(([, v]) => v === 0).map(([k]) => k),
            lowGroups:      Object.entries(s).filter(([, v]) => v > 0 && v < 5).map(([k]) => k),
          }
        }),
    }

    return {
      role: 'ADMIN',
      snapshot, alertsAndActions, monthlyTrend, supplyDemandMap, hospitalRankings,
      topDonors: donors
        .sort((a, b) => (b.bdcBalance || 0) - (a.bdcBalance || 0))
        .slice(0, 10)
        .map(d => ({ id: d._id, name: d.name, bloodGroup: d.bloodGroup, city: d.city, bdcBalance: d.bdcBalance })),
      openRequests: requests
        .filter(r => r.status === 'OPEN')
        .map(r => ({
          id: r._id, bloodGroup: r.bloodGroup, units: r.unitsRequired, urgency: r.urgencyLevel,
          hospital: r.hospital?.name, city: r.hospital?.city,
          acceptedDonorCount: r.acceptedDonorCount || 0,
        })),
      recentDonations: donations.slice(-20).map(d => ({
        id: d._id, donor: d.donor?.name, hospital: d.hospital?.name,
        bloodGroup: d.bloodGroup, status: d.status, createdAt: d.createdAt,
        onBlockchain: !!d.blockchainHash,
      })),
    }
  }

  // ── HOSPITAL ───────────────────────────────────────────────────────────────
  if (role === 'HOSPITAL') {
    const [hDonations, hRequests, inventory, transfers, bdcLedger] = await Promise.all([
      Donation.find({ hospital: user._id })
        .populate('donor', 'name email bloodGroup city bdcBalance isVerified age weight')
        .lean(),
      BloodRequest.find({ hospital: user._id }).lean(),
      BloodInventory.findOne({ hospital: user._id }).lean(),
      InterHospitalTransfer.find({ $or: [{ requestingHospital: user._id }, { supplyingHospital: user._id }] })
        .populate('requestingHospital', 'name city')
        .populate('supplyingHospital', 'name city')
        .lean(),
      BDCLedger.find({ user: user._id }).lean(),
    ])

    const bdcTotal = bdcLedger.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0)

    const stats = {
      donations: {
        total:        hDonations.length,
        completed:    hDonations.filter(d => d.status === 'COMPLETED').length,
        pending:      hDonations.filter(d => ['PENDING', 'DONOR_CONFIRMED'].includes(d.status)).length,
        disputed:     hDonations.filter(d => d.status === 'DISPUTED').length,
        onBlockchain: hDonations.filter(d => d.blockchainHash).length,
        proofUploaded:hDonations.filter(d => d.proofImageUrl).length,
      },
      requests: {
        total:        hRequests.length,
        open:         hRequests.filter(r => r.status === 'OPEN').length,
        criticalOpen: hRequests.filter(r => r.status === 'OPEN' && r.urgencyLevel === 'Critical').length,
        closed:       hRequests.filter(r => r.status !== 'OPEN').length,
      },
      bdc: { totalIssued: bdcTotal },
    }

    let invSummary = null
    if (inventory) {
      const s = flatStock(inventory.stock)
      invSummary = {
        totalUnits:  Object.values(s).reduce((a, v) => a + v, 0),
        stock:       s,
        zeroStock:   Object.entries(s).filter(([, v]) => v === 0).map(([k]) => k),
        lowStock:    Object.entries(s).filter(([, v]) => v > 0 && v < 5).map(([k]) => k),
      }
    }

    // Build full donor profiles map so AI has complete donor information
    const donorProfiles = {}
    hDonations.forEach(d => {
      if (d.donor?._id) {
        const donorId = d.donor._id.toString()
        if (!donorProfiles[donorId]) {
          donorProfiles[donorId] = {
            donorId, name: d.donor.name, email: d.donor.email,
            bloodGroup: d.donor.bloodGroup, city: d.donor.city,
            bdcBalance: d.donor.bdcBalance, isVerified: d.donor.isVerified,
            age: d.donor.age, weight: d.donor.weight,
          }
        }
      }
    })

    return {
      role: 'HOSPITAL',
      hospital: { id: user._id, name: user.hospitalName || user.name, city: user.city },
      stats,
      inventory: invSummary,
      donorProfiles: Object.values(donorProfiles),
      alertsAndActions: {
        awaitingHospitalConfirmation: hDonations
          .filter(d => d.status === 'DONOR_CONFIRMED')
          .map(d => ({
            donationId: d._id, donorId: d.donor?._id,
            donorName: d.donor?.name, donorEmail: d.donor?.email,
            donorBloodGroup: d.donor?.bloodGroup, donorCity: d.donor?.city,
            donorAge: d.donor?.age, donorWeight: d.donor?.weight,
            donorIsVerified: d.donor?.isVerified, bloodGroup: d.bloodGroup,
          })),
        openRequests: hRequests
          .filter(r => r.status === 'OPEN')
          .map(r => ({
            requestId: r._id, bloodGroup: r.bloodGroup, units: r.unitsRequired,
            urgency: r.urgencyLevel, acceptedDonorCount: r.acceptedDonorCount || 0,
            notes: r.notes, expiresAt: r.expiresAt,
          })),
      },
      transfers: {
        incoming: transfers.filter(t => t.requestingHospital?._id?.toString() === user._id.toString()),
        outgoing: transfers.filter(t => t.supplyingHospital?._id?.toString() === user._id.toString()),
      },
      recentDonations: hDonations.slice(-20).map(d => ({
        donationId: d._id, donorId: d.donor?._id, donorName: d.donor?.name,
        donorEmail: d.donor?.email, donorBloodGroup: d.donor?.bloodGroup,
        donorCity: d.donor?.city, donorAge: d.donor?.age, donorWeight: d.donor?.weight,
        donorIsVerified: d.donor?.isVerified, bloodGroup: d.bloodGroup,
        status: d.status, createdAt: d.createdAt, onBlockchain: !!d.blockchainHash,
      })),
      openRequestsDetail: hRequests
        .filter(r => r.status === 'OPEN')
        .map(r => ({
          requestId: r._id, bloodGroup: r.bloodGroup, units: r.unitsRequired,
          urgency: r.urgencyLevel, acceptedDonorCount: r.acceptedDonorCount,
          notes: r.notes, expiresAt: r.expiresAt,
        })),
    }
  }

  // ── DONOR ──────────────────────────────────────────────────────────────────
  const [myDonations, openRequests, bdcLedger] = await Promise.all([
    Donation.find({ donor: user._id }).populate('hospital', 'name city').lean(),
    BloodRequest.find({ status: 'OPEN' }).populate('hospital', 'name city').lean(),
    BDCLedger.find({ user: user._id }).lean(),
  ])

  const completed         = myDonations.filter(d => d.status === 'COMPLETED').length
  const now               = Date.now()
  const lastDon           = myDonations
    .filter(d => d.status === 'COMPLETED')
    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
  const daysSinceLast     = lastDon ? Math.floor((now - new Date(lastDon.completedAt)) / 86400000) : null
  const canDonateAgain    = daysSinceLast === null || daysSinceLast >= 56
  const daysUntilEligible = canDonateAgain ? 0 : 56 - daysSinceLast
  const totalBDCEarned    = bdcLedger.filter(l => l.amount > 0).reduce((a, l) => a + l.amount, 0)

  const compatMap = {
    'O-':  ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
    'O+':  ['A+', 'B+', 'AB+', 'O+'],
    'A-':  ['A+', 'A-', 'AB+', 'AB-'],
    'A+':  ['A+', 'AB+'],
    'B-':  ['B+', 'B-', 'AB+', 'AB-'],
    'B+':  ['B+', 'AB+'],
    'AB-': ['AB+', 'AB-'],
    'AB+': ['AB+'],
  }
  const compatibleOpen = openRequests.filter(r => (compatMap[user.bloodGroup] || []).includes(r.bloodGroup))

  return {
    role: 'DONOR',
    donor: {
      id: user._id, name: user.name, email: user.email,
      bloodGroup: user.bloodGroup, city: user.city,
      bdcBalance: user.bdcBalance, age: user.age, weight: user.weight,
      isVerified: user.isVerified,
    },
    donationSummary: {
      total: myDonations.length, completed,
      pending: myDonations.filter(d => d.status === 'PENDING').length,
      category: completed >= 10 ? 'Elite' : completed >= 3 ? 'Regular' : 'New',
      canDonateAgain, daysSinceLastDonation: daysSinceLast, daysUntilEligible,
    },
    proofStatus: {
      totalBDCEarned,
      onBlockchain: myDonations.filter(d => d.blockchainHash).length,
      pendingProof: myDonations.filter(d => d.status === 'COMPLETED' && !d.proofImageUrl).length,
    },
    compatibleRequests: {
      totalOpen: compatibleOpen.length,
      nearby: compatibleOpen.filter(r => r.hospital?.city === user.city).length,
    },
    alertsAndActions: {
      needsDonorConfirmation: myDonations
        .filter(d => d.status === 'PENDING')
        .map(d => ({ id: d._id, hospital: d.hospital?.name, bloodGroup: d.bloodGroup })),
      needsProofUpload: myDonations
        .filter(d => d.status === 'COMPLETED' && !d.proofImageUrl)
        .map(d => ({ id: d._id, hospital: d.hospital?.name })),
    },
    recentDonations: myDonations.slice(-10).map(d => ({
      id: d._id, hospital: d.hospital?.name, bloodGroup: d.bloodGroup,
      status: d.status, createdAt: d.createdAt, bdcAwarded: d.bdcAwarded,
    })),
    compatibleOpenRequests: compatibleOpen.slice(0, 10).map(r => ({
      id: r._id, hospital: r.hospital?.name, city: r.hospital?.city,
      bloodGroup: r.bloodGroup, units: r.unitsRequired, urgency: r.urgencyLevel,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/data
// ─────────────────────────────────────────────────────────────────────────────
router.post('/data', protect, async (req, res) => {
  try {
    const data = await buildLiveData(req.user)
    res.json({ success: true, data })
  } catch (e) {
    console.error('AI /data error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/chat
// ─────────────────────────────────────────────────────────────────────────────
router.post('/chat', protect, async (req, res) => {
  try {
    const { messages = [], system = '', liveData } = req.body
    if (!messages.length) return res.status(400).json({ message: 'messages required' })

    const data = liveData || await buildLiveData(req.user)
    const systemPrompt = system ||
      `You are BloodLink AI with full platform data access. Role: ${data?.role}. Be concise, specific, actionable. Use emojis for headers. Highlight critical issues with 🚨. Include MongoDB IDs when recommending actions.\n\nFULL DATA: ${JSON.stringify(data)}`

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      temperature: 0.4,
      max_tokens: 1500,
    })

    res.json({ success: true, text: completion.choices[0]?.message?.content, model: GROQ_MODEL })
  } catch (e) {
    console.error('AI /chat error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/analyse
// ─────────────────────────────────────────────────────────────────────────────
router.post('/analyse', protect, async (req, res) => {
  try {
    const { topic = 'overall platform status' } = req.body
    const data = await buildLiveData(req.user)
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: `You are BloodLink AI analyst. Analyse the following platform data deeply and answer the topic.\n\nDATA: ${JSON.stringify(data)}` },
        { role: 'user', content: `Topic: ${topic}` },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    })
    res.json({ success: true, analysis: completion.choices[0]?.message?.content, model: GROQ_MODEL })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/action
// ─────────────────────────────────────────────────────────────────────────────
router.post('/action', protect, async (req, res) => {
  try {
    const { action, params = {} } = req.body
    let result = {}

    switch (action) {
      case 'resolve_dispute': {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' })
        const don = await Donation.findById(params.donationId)
        if (!don) return res.status(404).json({ message: 'Donation not found' })
        don.status     = params.resolution === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED'
        don.completedAt = new Date()
        await don.save()
        result = { message: `Dispute resolved as ${params.resolution}` }
        break
      }
      case 'verify_user': {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' })
        await User.findByIdAndUpdate(params.userId, { isVerified: true })
        result = { message: 'User verified successfully' }
        break
      }
      case 'deactivate_user': {
        if (req.user.role !== 'ADMIN') return res.status(403).json({ message: 'Admin only' })
        await User.findByIdAndUpdate(params.userId, { isActive: false })
        result = { message: 'User deactivated' }
        break
      }
      case 'cancel_request': {
        const bloodReq = await BloodRequest.findById(params.requestId)
        if (!bloodReq) return res.status(404).json({ message: 'Request not found' })
        if (req.user.role !== 'ADMIN' && bloodReq.hospital.toString() !== req.user._id.toString())
          return res.status(403).json({ message: 'Forbidden' })
        bloodReq.status = 'CANCELLED'
        await bloodReq.save()
        result = { message: 'Request cancelled' }
        break
      }
      case 'accept_transfer': {
        await InterHospitalTransfer.findByIdAndUpdate(params.transferId, { status: 'ACCEPTED', acceptedAt: new Date() })
        result = { message: 'Transfer accepted' }
        break
      }
      case 'confirm_delivery': {
        await InterHospitalTransfer.findByIdAndUpdate(params.transferId, { status: 'DELIVERED', deliveredAt: new Date() })
        result = { message: 'Delivery confirmed' }
        break
      }
      default:
        return res.status(400).json({ message: `Unknown action: ${action}` })
    }

    res.json({ success: true, result })
  } catch (e) {
    console.error('AI /action error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/report
// ─────────────────────────────────────────────────────────────────────────────
router.post('/report', protect, async (req, res) => {
  try {
    const { reportType = 'platform_health' } = req.body
    const data = await buildLiveData(req.user)

    const prompts = {
      platform_health:      'Write a comprehensive executive platform health report in markdown with sections for Users, Donations, Requests, BDC Economy, Blockchain Compliance, and Key Recommendations.',
      blood_supply:         'Write a detailed blood supply and demand analysis in markdown. Include per-blood-group supply/demand tables, critical shortage alerts, and recommended actions.',
      donor_engagement:     'Write a donor engagement report in markdown. Segment donors, identify top performers, flag inactive donors, and provide re-engagement strategies.',
      hospital_performance: 'Write a hospital performance ranking report in markdown. Rank by completion rate, dispute rate, inventory management, and provide recommendations for underperformers.',
      compliance:           'Write a blockchain and proof compliance report in markdown. Show compliance rates, identify non-compliant donations, and provide actionable steps to improve.',
    }

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: `You are BloodLink AI. Generate a professional report based on real platform data. Use markdown with tables where appropriate.\n\nDATA: ${JSON.stringify(data)}` },
        { role: 'user', content: prompts[reportType] || prompts.platform_health },
      ],
      temperature: 0.3,
      max_tokens: 3000,
    })

    res.json({ success: true, report: completion.choices[0]?.message?.content, reportType, generatedAt: new Date() })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/ai/dashboard
// ─────────────────────────────────────────────────────────────────────────────
router.get('/dashboard', protect, async (req, res) => {
  try {
    const data = await buildLiveData(req.user)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/ai/donor/:id
// ─────────────────────────────────────────────────────────────────────────────
router.get('/donor/:id', protect, async (req, res) => {
  try {
    let donor = await User.findById(req.params.id).select('-password').lean()

    // If not found as a User, try resolving as a Donation ID — AI often mentions donation IDs
    if (!donor) {
      const donation = await Donation.findById(req.params.id).populate('donor').lean()
      if (donation?.donor) {
        donor = await User.findById(donation.donor._id).select('-password').lean()
      }
    }

    if (!donor) return res.status(404).json({ message: 'Donor not found' })
    if (donor.role !== 'DONOR') return res.status(400).json({ message: 'User is not a donor' })

    const donations      = await Donation.find({ donor: donor._id }).populate('hospital', 'name city').lean()
    const completedDons  = donations.filter(d => d.status === 'COMPLETED')
    const lastDon        = completedDons.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
    const daysSinceLast  = lastDon ? Math.floor((Date.now() - new Date(lastDon.completedAt)) / 86400000) : null
    const canDonateAgain = daysSinceLast === null || daysSinceLast >= 56

    res.json({
      success: true,
      donor: {
        ...donor,
        totalDonations: completedDons.length,
        lastDonationDate: lastDon?.completedAt,
        canDonateAgain,
        daysSinceLast,
        recentDonations: donations.slice(-5),
      },
    })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  USER MANAGEMENT (ADMIN only)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/users', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    const { role } = req.query
    const users = await User.find(role ? { role } : {}).select('-password').lean()
    res.json({ success: true, users })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.get('/users/:id', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password').lean()
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ success: true, user })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/users/:id/verify', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ success: true, user, message: 'User verified' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/users/:id/deactivate', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json({ success: true, user, message: 'User deactivated' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  DONATIONS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/donations', protect, async (req, res) => {
  try {
    const { status } = req.query
    const filter = req.user.role === 'ADMIN' ? {} : req.user.role === 'HOSPITAL' ? { hospital: req.user._id } : { donor: req.user._id }
    if (status) filter.status = status
    const donations = await Donation.find(filter)
      .populate('donor', 'name email bloodGroup city')
      .populate('hospital', 'name city')
      .lean()
    res.json({ success: true, donations })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.get('/donations/:id', protect, async (req, res) => {
  try {
    const donation = await Donation.findById(req.params.id)
      .populate('donor', '-password')
      .populate('hospital', '-password')
      .lean()
    if (!donation) return res.status(404).json({ message: 'Donation not found' })
    res.json({ success: true, donation })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/donations/:id/resolve', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    const { resolution } = req.body
    if (!['COMPLETE', 'CANCEL'].includes(resolution))
      return res.status(400).json({ message: 'resolution must be COMPLETE or CANCEL' })
    const don = await Donation.findByIdAndUpdate(req.params.id, {
      status: resolution === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED',
      completedAt: new Date(),
    }, { new: true })
    if (!don) return res.status(404).json({ message: 'Donation not found' })
    res.json({ success: true, donation: don, message: `Dispute resolved as ${resolution}` })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete('/donations/:id', protect, requireRole('ADMIN'), async (req, res) => {
  try {
    await Donation.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Donation deleted' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  REQUESTS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/requests', protect, async (req, res) => {
  try {
    const { status } = req.query
    const filter = req.user.role === 'ADMIN' ? {} : req.user.role === 'HOSPITAL' ? { hospital: req.user._id } : {}
    if (status) filter.status = status
    const requests = await BloodRequest.find(filter).populate('hospital', 'name city').lean()
    res.json({ success: true, requests })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.get('/requests/:id', protect, async (req, res) => {
  try {
    let request = await BloodRequest.findById(req.params.id).populate('hospital', 'name city').lean()

    // If not found as a BloodRequest, try resolving via Donation ID
    if (!request) {
      const donation = await Donation.findById(req.params.id).lean()
      if (donation?.request) {
        request = await BloodRequest.findById(donation.request).populate('hospital', 'name city').lean()
      }
    }

    // Return 200 with found:false so the frontend can handle gracefully (e.g. expired/deleted requests)
    if (!request) return res.json({ success: true, found: false, request: null, message: 'Request not found or has expired' })
    res.json({ success: true, found: true, request })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/requests/:id/cancel', protect, async (req, res) => {
  try {
    const bloodReq = await BloodRequest.findById(req.params.id)
    if (!bloodReq) return res.status(404).json({ message: 'Request not found' })
    if (req.user.role !== 'ADMIN' && bloodReq.hospital.toString() !== req.user._id.toString())
      return res.status(403).json({ message: 'Forbidden' })
    bloodReq.status = 'CANCELLED'
    await bloodReq.save()
    res.json({ success: true, request: bloodReq, message: 'Request cancelled' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  INVENTORY
// ─────────────────────────────────────────────────────────────────────────────
router.get('/inventory', protect, async (req, res) => {
  try {
    const inv = await BloodInventory.find().populate('hospital', 'name city').lean()
    res.json({ success: true, inventory: inv })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSFERS
// ─────────────────────────────────────────────────────────────────────────────
router.get('/transfers', protect, async (req, res) => {
  try {
    const { status } = req.query
    const filter = req.user.role === 'ADMIN'
      ? {}
      : { $or: [{ requestingHospital: req.user._id }, { supplyingHospital: req.user._id }] }
    if (status) filter.status = status
    const transfers = await InterHospitalTransfer.find(filter)
      .populate('requestingHospital', 'name city')
      .populate('supplyingHospital', 'name city')
      .lean()
    res.json({ success: true, transfers })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/transfers/:id/accept', protect, async (req, res) => {
  try {
    const t = await InterHospitalTransfer.findByIdAndUpdate(req.params.id, { status: 'ACCEPTED', acceptedAt: new Date() }, { new: true })
    if (!t) return res.status(404).json({ message: 'Transfer not found' })
    res.json({ success: true, transfer: t, message: 'Transfer accepted' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.put('/transfers/:id/deliver', protect, async (req, res) => {
  try {
    const t = await InterHospitalTransfer.findByIdAndUpdate(req.params.id, { status: 'DELIVERED', deliveredAt: new Date() }, { new: true })
    if (!t) return res.status(404).json({ message: 'Transfer not found' })
    res.json({ success: true, transfer: t, message: 'Delivery confirmed' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

router.delete('/transfers/:id', protect, async (req, res) => {
  try {
    await InterHospitalTransfer.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Transfer cancelled and removed' })
  } catch (e) {
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/ai/request/:id/donors
//  Returns all donors who have a Donation linked to this request
// ─────────────────────────────────────────────────────────────────────────────
router.get('/request/:id/donors', protect, async (req, res) => {
  try {
    const donations = await Donation.find({ request: req.params.id })
      .populate('donor', '-password')
      .lean()

    const donors = await Promise.all(
      donations.map(async (d) => {
        const donor = d.donor
        if (!donor) return null
        const allDonations = await Donation.find({ donor: donor._id, status: 'COMPLETED' }).lean()
        const lastDon = allDonations.sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0]
        const daysSinceLast = lastDon ? Math.floor((Date.now() - new Date(lastDon.completedAt)) / 86400000) : null
        const canDonateAgain = daysSinceLast === null || daysSinceLast >= 56
        return {
          ...donor,
          totalDonations: allDonations.length,
          lastDonationDate: lastDon?.completedAt,
          canDonateAgain,
          daysSinceLast,
          donationId: d._id,
          donationStatus: d.status,
        }
      })
    )

    res.json({ success: true, donors: donors.filter(Boolean) })
  } catch (e) {
    console.error('AI /request/:id/donors error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  POST /api/ai/request/:id/accept-donor
//  Creates a donation record linking a donor to this request (or updates status)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/request/:id/accept-donor', protect, async (req, res) => {
  try {
    const { donorId } = req.body
    if (!donorId) return res.status(400).json({ message: 'donorId is required' })

    const request = await BloodRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })

    // Only admin or the owning hospital can accept donors
    if (req.user.role !== 'ADMIN' && request.hospital.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    // Check if a donation already exists for this donor+request
    let donation = await Donation.findOne({ donor: donorId, request: req.params.id })
    if (donation) {
      donation.status = 'DONOR_CONFIRMED'
      await donation.save()
    } else {
      const donor = await User.findById(donorId)
      if (!donor) return res.status(404).json({ message: 'Donor not found' })
      donation = await Donation.create({
        donor: donorId,
        hospital: request.hospital,
        request: request._id,
        bloodGroup: donor.bloodGroup || request.bloodGroup,
        status: 'DONOR_CONFIRMED',
      })
      await BloodRequest.findByIdAndUpdate(req.params.id, { $inc: { acceptedDonorCount: 1 } })
    }

    res.json({ success: true, donation, message: 'Donor accepted for request' })
  } catch (e) {
    console.error('AI /request/:id/accept-donor error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/ai/request/:id/select-donor
//  Marks one donor's donation as the selected/confirmed one
// ─────────────────────────────────────────────────────────────────────────────
router.put('/request/:id/select-donor', protect, async (req, res) => {
  try {
    const { donorId } = req.body
    if (!donorId) return res.status(400).json({ message: 'donorId is required' })

    const request = await BloodRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })

    if (req.user.role !== 'ADMIN' && request.hospital.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const donation = await Donation.findOneAndUpdate(
      { donor: donorId, request: req.params.id },
      { status: 'RECEIVER_CONFIRMED' },
      { new: true }
    )
    if (!donation) return res.status(404).json({ message: 'Donation record not found for this donor and request' })

    res.json({ success: true, donation, message: 'Donor selected for request' })
  } catch (e) {
    console.error('AI /request/:id/select-donor error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/ai/request/:id/remove-donor/:donorId
//  Cancels/removes a donor from a request
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/request/:id/remove-donor/:donorId', protect, async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id)
    if (!request) return res.status(404).json({ message: 'Request not found' })

    if (req.user.role !== 'ADMIN' && request.hospital.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden' })
    }

    const donation = await Donation.findOneAndUpdate(
      { donor: req.params.donorId, request: req.params.id },
      { status: 'CANCELLED' },
      { new: true }
    )
    if (!donation) return res.status(404).json({ message: 'Donation record not found for this donor and request' })

    await BloodRequest.findByIdAndUpdate(req.params.id, { $inc: { acceptedDonorCount: -1 } })

    res.json({ success: true, message: 'Donor removed from request' })
  } catch (e) {
    console.error('AI /request/:id/remove-donor error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

export default router
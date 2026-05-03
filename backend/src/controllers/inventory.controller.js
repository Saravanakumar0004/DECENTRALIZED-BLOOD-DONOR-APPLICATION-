// controllers/inventory.controller.js  ── NEW FILE
import BloodInventory     from '../models/BloodInventory.js';
import InterHospitalTransfer from '../models/InterHospitalTransfer.js';
import User               from '../models/User.js';
import { createError }    from '../utils/errors.js';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// ── Helper: get-or-create inventory doc for a hospital ────────────────────────
const getOrCreateInventory = async (hospitalId) => {
  let inv = await BloodInventory.findOne({ hospital: hospitalId });
  if (!inv) {
    inv = await BloodInventory.create({ hospital: hospitalId });
  }
  return inv;
};

// ═════════════════════════════════════════════════════════════════════════════
//  INVENTORY — own hospital
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/inventory/my ─────────────────────────────────────────────────────
// Returns own hospital's full inventory
export const getMyInventory = async (req, res, next) => {
  try {
    const inv = await getOrCreateInventory(req.user._id);
    res.json({
      hospitalId: req.user._id,
      isPublic:   inv.isPublic,
      stock:      inv.stockSummary,
      lastStockUpdate: inv.lastStockUpdate,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/my/stock ───────────────────────────────────────────────
// Hospital manually sets or adjusts units for one or more blood groups.
// Body: { updates: [{ bloodGroup: 'A+', units: 10 }, ...] }
// units can be absolute (set) — use `action: 'SET'` — or relative (`ADD`/`SUBTRACT`)
export const updateStock = async (req, res, next) => {
  try {
    const { updates } = req.body; // [{ bloodGroup, units, action? }]

    if (!Array.isArray(updates) || updates.length === 0) {
      return next(createError(422, 'updates array is required'));
    }

    const inv = await getOrCreateInventory(req.user._id);

    for (const item of updates) {
      const { bloodGroup, units, action = 'SET' } = item;

      if (!BLOOD_GROUPS.includes(bloodGroup)) {
        return next(createError(422, `Invalid blood group: ${bloodGroup}`));
      }
      if (typeof units !== 'number' || units < 0) {
        return next(createError(422, `units must be a non-negative number for ${bloodGroup}`));
      }

      const current = inv.stock.get(bloodGroup) || { units: 0 };

      let newUnits;
      if (action === 'ADD') {
        newUnits = current.units + units;
      } else if (action === 'SUBTRACT') {
        newUnits = current.units - units;
        if (newUnits < 0) return next(createError(400, `Insufficient stock for ${bloodGroup}`));
      } else {
        // SET (default)
        newUnits = units;
      }

      inv.stock.set(bloodGroup, { units: newUnits, lastUpdated: new Date() });
    }

    inv.lastStockUpdate = new Date();
    inv.markModified('stock'); // required for Map mutation detection
    await inv.save();

    res.json({
      message: 'Inventory updated',
      stock:   inv.stockSummary,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/my/visibility ─────────────────────────────────────────
// Toggle whether this hospital's inventory is publicly visible
export const setInventoryVisibility = async (req, res, next) => {
  try {
    const { isPublic } = req.body;
    if (typeof isPublic !== 'boolean') {
      return next(createError(422, 'isPublic must be a boolean'));
    }

    const inv = await getOrCreateInventory(req.user._id);
    inv.isPublic = isPublic;
    await inv.save();

    res.json({ message: `Inventory is now ${isPublic ? 'public' : 'private'}`, isPublic });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  PUBLIC INVENTORY — any hospital's stock visible to all
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/inventory/public ─────────────────────────────────────────────────
// Returns all hospitals with public inventory.
// Supports: ?bloodGroup=O+&city=Chennai&lat=13.08&lng=80.27&radius=50&minUnits=1
export const getPublicInventory = async (req, res, next) => {
  try {
    const { bloodGroup, city, lat, lng, radius, minUnits = 1, page = 1, limit = 20 } = req.query;

    // Build hospital filter
    const hospitalFilter = { role: 'HOSPITAL', isActive: true };
    if (city) hospitalFilter['location.city'] = { $regex: city, $options: 'i' };

    // If geo provided — geo-filter hospitals first
    let hospitalIds;
    if (lat && lng) {
      const radiusMeters = (parseFloat(radius) || 50) * 1000;
      const nearbyHospitals = await User.find({
        ...hospitalFilter,
        location: {
          $nearSphere: {
            $geometry:   { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
            $maxDistance: radiusMeters,
          },
        },
      }).select('_id');
      hospitalIds = nearbyHospitals.map((h) => h._id);
      if (hospitalIds.length === 0) return res.json({ total: 0, data: [] });
    }

    // Build inventory filter
    const invFilter = { isPublic: true };
    if (hospitalIds) invFilter.hospital = { $in: hospitalIds };
    if (bloodGroup) {
      invFilter[`stock.${bloodGroup}.units`] = { $gte: parseInt(minUnits, 10) };
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [inventories, total] = await Promise.all([
      BloodInventory.find(invFilter)
        .populate('hospital', 'name hospitalName location walletAddress isVerified')
        .sort({ lastStockUpdate: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      BloodInventory.countDocuments(invFilter),
    ]);

    const data = inventories.map((inv) => ({
      hospital:        inv.hospital,
      stock:           inv.stockSummary,
      lastStockUpdate: inv.lastStockUpdate,
    }));

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/inventory/hospital/:id ──────────────────────────────────────────
// Get a specific hospital's public inventory (or own inventory if authenticated)
export const getHospitalInventory = async (req, res, next) => {
  try {
    const { id } = req.params;

    const hospital = await User.findOne({ _id: id, role: 'HOSPITAL', isActive: true })
      .select('name hospitalName location isVerified');
    if (!hospital) return next(createError(404, 'Hospital not found'));

    const inv = await BloodInventory.findOne({ hospital: id });
    if (!inv) return res.json({ hospital, stock: [] });

    // If private and not the owning hospital — deny
    const isOwner = req.user && req.user._id.toString() === id;
    const isAdmin = req.user && req.user.role === 'ADMIN';
    if (!inv.isPublic && !isOwner && !isAdmin) {
      return next(createError(403, 'This hospital\'s inventory is private'));
    }

    res.json({
      hospital,
      stock:           inv.stockSummary,
      isPublic:        inv.isPublic,
      lastStockUpdate: inv.lastStockUpdate,
    });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  INTER-HOSPITAL TRANSFERS
// ═════════════════════════════════════════════════════════════════════════════

// ── POST /api/inventory/transfers ─────────────────────────────────────────────
// Requesting hospital creates a transfer request to a supplying hospital
export const createTransferRequest = async (req, res, next) => {
  try {
    const { supplyingHospitalId, bloodGroup, unitsRequested, urgencyLevel, notes } = req.body;

    if (supplyingHospitalId === req.user._id.toString()) {
      return next(createError(400, 'Cannot request blood from your own hospital'));
    }

    // Validate supplying hospital exists
    const supplier = await User.findOne({
      _id:      supplyingHospitalId,
      role:     'HOSPITAL',
      isActive: true,
    }).select('name hospitalName');
    if (!supplier) return next(createError(404, 'Supplying hospital not found'));

    // Check if supplier has enough stock (advisory — not hard-blocked here)
    const supplyInv = await BloodInventory.findOne({ hospital: supplyingHospitalId });
    const available = supplyInv?.stock?.get(bloodGroup)?.units || 0;

    const transfer = await InterHospitalTransfer.create({
      requestingHospital: req.user._id,
      supplyingHospital:  supplyingHospitalId,
      bloodGroup,
      unitsRequested:     parseInt(unitsRequested, 10),
      urgencyLevel:       urgencyLevel || 'Medium',
      notes:              notes || undefined,
    });

    await transfer.populate([
      { path: 'requestingHospital', select: 'name hospitalName location.city' },
      { path: 'supplyingHospital',  select: 'name hospitalName location.city' },
    ]);

    res.status(201).json({
      message:           'Transfer request created',
      availableAtSupplier: available,
      data:              transfer,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/inventory/transfers/my ──────────────────────────────────────────
// Get transfers where this hospital is either requester or supplier
export const getMyTransfers = async (req, res, next) => {
  try {
    const { role: side = 'all', status, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (side === 'requesting') filter.requestingHospital = req.user._id;
    else if (side === 'supplying') filter.supplyingHospital = req.user._id;
    else filter.$or = [{ requestingHospital: req.user._id }, { supplyingHospital: req.user._id }];

    if (status) filter.status = status;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [transfers, total] = await Promise.all([
      InterHospitalTransfer.find(filter)
        .populate('requestingHospital', 'name hospitalName location.city')
        .populate('supplyingHospital',  'name hospitalName location.city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      InterHospitalTransfer.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  transfers,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/inventory/transfers/:id ─────────────────────────────────────────
export const getTransferById = async (req, res, next) => {
  try {
    const transfer = await InterHospitalTransfer.findById(req.params.id)
      .populate('requestingHospital', 'name hospitalName location walletAddress')
      .populate('supplyingHospital',  'name hospitalName location walletAddress');

    if (!transfer) return next(createError(404, 'Transfer not found'));

    const uid = req.user._id.toString();
    const isParty =
      transfer.requestingHospital._id.toString() === uid ||
      transfer.supplyingHospital._id.toString()  === uid;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isParty && !isAdmin) return next(createError(403, 'Access denied'));

    res.json({ data: transfer });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/transfers/:id/accept ───────────────────────────────────
// Supplying hospital accepts → blood is RESERVED (not yet deducted)
export const acceptTransfer = async (req, res, next) => {
  try {
    const transfer = await InterHospitalTransfer.findById(req.params.id);
    if (!transfer) return next(createError(404, 'Transfer not found'));

    if (transfer.supplyingHospital.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the supplying hospital can accept this transfer'));
    }
    if (transfer.status !== 'PENDING') {
      return next(createError(400, `Transfer is already ${transfer.status}`));
    }

    // Hard-check stock before accepting
    const inv = await getOrCreateInventory(req.user._id);
    if (!inv.hasStock(transfer.bloodGroup, transfer.unitsRequested)) {
      const available = inv.stock.get(transfer.bloodGroup)?.units || 0;
      return next(createError(400, `Insufficient stock. Available: ${available} units of ${transfer.bloodGroup}`));
    }

    transfer.status     = 'ACCEPTED';
    transfer.acceptedAt = new Date();
    await transfer.save();

    await transfer.populate([
      { path: 'requestingHospital', select: 'name hospitalName location.city' },
      { path: 'supplyingHospital',  select: 'name hospitalName location.city' },
    ]);

    res.json({ message: 'Transfer accepted. Dispatch ambulance when ready.', data: transfer });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/transfers/:id/reject ───────────────────────────────────
export const rejectTransfer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const transfer = await InterHospitalTransfer.findById(req.params.id);
    if (!transfer) return next(createError(404, 'Transfer not found'));

    if (transfer.supplyingHospital.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the supplying hospital can reject this transfer'));
    }
    if (!['PENDING'].includes(transfer.status)) {
      return next(createError(400, `Cannot reject a transfer in ${transfer.status} status`));
    }

    transfer.status          = 'REJECTED';
    transfer.rejectionReason = reason || 'No reason provided';
    await transfer.save();

    res.json({ message: 'Transfer rejected', data: transfer });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/transfers/:id/dispatch ─────────────────────────────────
// Supplying hospital marks ambulance as dispatched → inventory DEDUCTED here
export const dispatchTransfer = async (req, res, next) => {
  try {
    const { vehicleNumber, driverName, driverPhone } = req.body;

    const transfer = await InterHospitalTransfer.findById(req.params.id);
    if (!transfer) return next(createError(404, 'Transfer not found'));

    if (transfer.supplyingHospital.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the supplying hospital can dispatch'));
    }
    if (transfer.status !== 'ACCEPTED') {
      return next(createError(400, 'Transfer must be ACCEPTED before dispatch'));
    }

    // ── Deduct inventory atomically ───────────────────────────────────────
    const inv = await getOrCreateInventory(req.user._id);
    const current = inv.stock.get(transfer.bloodGroup) || { units: 0 };

    if (current.units < transfer.unitsRequested) {
      return next(createError(400, `Insufficient stock at dispatch time. Available: ${current.units}`));
    }

    inv.stock.set(transfer.bloodGroup, {
      units:       current.units - transfer.unitsRequested,
      lastUpdated: new Date(),
    });
    inv.lastStockUpdate = new Date();
    inv.markModified('stock');
    await inv.save();

    // ── Update transfer ───────────────────────────────────────────────────
    transfer.status      = 'IN_TRANSIT';
    transfer.inTransitAt = new Date();
    transfer.ambulanceInfo = {
      vehicleNumber: vehicleNumber || '',
      driverName:    driverName    || '',
      driverPhone:   driverPhone   || '',
      dispatchedAt:  new Date(),
    };
    await transfer.save();

    await transfer.populate([
      { path: 'requestingHospital', select: 'name hospitalName location.city' },
      { path: 'supplyingHospital',  select: 'name hospitalName location.city' },
    ]);

    res.json({
      message:          `Ambulance dispatched. ${transfer.unitsRequested} units of ${transfer.bloodGroup} deducted from inventory.`,
      inventoryDeducted: { bloodGroup: transfer.bloodGroup, units: transfer.unitsRequested },
      data:             transfer,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/transfers/:id/deliver ──────────────────────────────────
// Receiving hospital confirms delivery → their inventory ADDED
export const confirmDelivery = async (req, res, next) => {
  try {
    const transfer = await InterHospitalTransfer.findById(req.params.id);
    if (!transfer) return next(createError(404, 'Transfer not found'));

    if (transfer.requestingHospital.toString() !== req.user._id.toString()) {
      return next(createError(403, 'Only the requesting hospital can confirm delivery'));
    }
    if (transfer.status !== 'IN_TRANSIT') {
      return next(createError(400, 'Transfer must be IN_TRANSIT to confirm delivery'));
    }

    // ── Add to receiving hospital's inventory ─────────────────────────────
    const inv = await getOrCreateInventory(req.user._id);
    const current = inv.stock.get(transfer.bloodGroup) || { units: 0 };

    inv.stock.set(transfer.bloodGroup, {
      units:       current.units + transfer.unitsRequested,
      lastUpdated: new Date(),
    });
    inv.lastStockUpdate = new Date();
    inv.markModified('stock');
    await inv.save();

    // ── Complete the transfer ─────────────────────────────────────────────
    transfer.status      = 'DELIVERED';
    transfer.deliveredAt = new Date();
    await transfer.save();

    await transfer.populate([
      { path: 'requestingHospital', select: 'name hospitalName location.city' },
      { path: 'supplyingHospital',  select: 'name hospitalName location.city' },
    ]);

    res.json({
      message:          `Delivery confirmed. ${transfer.unitsRequested} units of ${transfer.bloodGroup} added to your inventory.`,
      inventoryAdded:   { bloodGroup: transfer.bloodGroup, units: transfer.unitsRequested },
      data:             transfer,
    });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/inventory/transfers/:id/cancel ───────────────────────────────────
// Either party or admin can cancel PENDING/ACCEPTED transfers
// If ACCEPTED (stock reserved but not dispatched), no inventory change needed
export const cancelTransfer = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const transfer = await InterHospitalTransfer.findById(req.params.id);
    if (!transfer) return next(createError(404, 'Transfer not found'));

    const uid = req.user._id.toString();
    const isParty =
      transfer.requestingHospital.toString() === uid ||
      transfer.supplyingHospital.toString()  === uid;
    const isAdmin = req.user.role === 'ADMIN';

    if (!isParty && !isAdmin) return next(createError(403, 'Access denied'));

    if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(transfer.status)) {
      return next(createError(400, `Cannot cancel a ${transfer.status} transfer`));
    }

    if (transfer.status === 'IN_TRANSIT') {
      // Blood already dispatched — restore supplier's inventory
      const inv = await getOrCreateInventory(transfer.supplyingHospital);
      const current = inv.stock.get(transfer.bloodGroup) || { units: 0 };
      inv.stock.set(transfer.bloodGroup, {
        units:       current.units + transfer.unitsRequested,
        lastUpdated: new Date(),
      });
      inv.lastStockUpdate = new Date();
      inv.markModified('stock');
      await inv.save();
    }

    transfer.status          = 'CANCELLED';
    transfer.cancelledAt     = new Date();
    transfer.rejectionReason = reason || 'Cancelled';
    await transfer.save();

    res.json({ message: 'Transfer cancelled', data: transfer });
  } catch (err) {
    next(err);
  }
};

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN — view all transfers
// ═════════════════════════════════════════════════════════════════════════════

// ── GET /api/admin/transfers ──────────────────────────────────────────────────
export const getAllTransfers = async (req, res, next) => {
  try {
    const { status, bloodGroup, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (status)     filter.status     = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const [transfers, total] = await Promise.all([
      InterHospitalTransfer.find(filter)
        .populate('requestingHospital', 'name hospitalName location.city')
        .populate('supplyingHospital',  'name hospitalName location.city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit, 10)),
      InterHospitalTransfer.countDocuments(filter),
    ]);

    res.json({
      total,
      page:  parseInt(page, 10),
      pages: Math.ceil(total / parseInt(limit, 10)),
      data:  transfers,
    });
  } catch (err) {
    next(err);
  }
};
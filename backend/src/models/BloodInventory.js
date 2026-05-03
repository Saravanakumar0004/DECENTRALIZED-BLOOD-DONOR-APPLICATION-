// models/BloodInventory.js  ── NEW FILE
import mongoose from 'mongoose';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

/**
 * One document per hospital.
 * `stock` is a map of bloodGroup → { units, lastUpdated }
 * This makes atomic $inc updates simple and avoids race conditions.
 */
const bloodInventorySchema = new mongoose.Schema(
  {
    hospital: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      unique:   true, // one inventory doc per hospital
    },

    stock: {
      type: Map,
      of: new mongoose.Schema(
        {
          units:       { type: Number, default: 0, min: 0 },
          lastUpdated: { type: Date,   default: Date.now },
        },
        { _id: false }
      ),
      default: () => {
        const map = new Map();
        BLOOD_GROUPS.forEach((bg) => map.set(bg, { units: 0, lastUpdated: new Date() }));
        return map;
      },
    },

    // Whether this hospital makes its inventory publicly visible
    isPublic: { type: Boolean, default: true },

    // Timestamp of last any-stock change (for quick sorting)
    lastStockUpdate: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_, ret) { delete ret.__v; return ret; },
    },
  }
);

// ── Indexes ──────────────────────────────────────────────────────────────────
bloodInventorySchema.index({ hospital: 1 }, { unique: true });
bloodInventorySchema.index({ isPublic: 1 });

// ── Virtual: flat array of { bloodGroup, units } for easy iteration ───────────
bloodInventorySchema.virtual('stockSummary').get(function () {
  const summary = [];
  for (const [bg, data] of this.stock) {
    summary.push({ bloodGroup: bg, units: data.units, lastUpdated: data.lastUpdated });
  }
  return summary.sort((a, b) => BLOOD_GROUPS.indexOf(a.bloodGroup) - BLOOD_GROUPS.indexOf(b.bloodGroup));
});

// ── Helper method: check if specific blood group has enough stock ──────────────
bloodInventorySchema.methods.hasStock = function (bloodGroup, unitsNeeded = 1) {
  const entry = this.stock.get(bloodGroup);
  return entry ? entry.units >= unitsNeeded : false;
};

const BloodInventory = mongoose.model('BloodInventory', bloodInventorySchema);
export default BloodInventory;
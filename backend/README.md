# 🩸 BloodLink Backend

**Express.js + MongoDB REST API** for the BloodLink Blood Donation DApp.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20+ (ESM) |
| Framework | Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Validation | express-validator |
| File Uploads | Multer + Cloudinary |
| Email | Nodemailer (Gmail SMTP) |
| Geo Queries | MongoDB 2dsphere + $nearSphere |
| Blockchain Utils | ethers.js (server-side hash verify) |
| Scheduler | node-cron |
| Logging | Winston |

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, Cloudinary keys, Gmail creds

# 3. Seed the database (optional — creates sample data)
npm run seed

# 4. Start development server
npm run dev

# 5. Health check
curl http://localhost:5000/api/health
```

---

## Project Structure

```
src/
  config/
    db.js            ← MongoDB connection
    cloudinary.js    ← Cloudinary SDK init
    email.js         ← Nodemailer transporter
    cron.js          ← Scheduled jobs (hourly request expiry)
    seed.js          ← Dev seed script
  models/
    User.js          ← Donor, Hospital, Admin schema + 2dsphere index
    BloodRequest.js  ← Request schema + geo index + TTL
    Donation.js      ← Donation lifecycle schema
    BDCLedger.js     ← Token transaction ledger
  middleware/
    auth.js          ← JWT verify → req.user
    roleGuard.js     ← Role-based access control
    upload.js        ← Multer + Cloudinary storage
    validate.js      ← express-validator error formatter
    errorHandler.js  ← Global error handler
  controllers/
    auth.controller.js       ← register, login, getMe, updateWallet, updateProfile
    request.controller.js    ← CRUD + geo search + accept
    donation.controller.js   ← Full lifecycle + blockchain verify + BDC award
    hospital.controller.js   ← Hospital dashboard views
    bdc.controller.js        ← Balance, history, redeem
    admin.controller.js      ← Platform stats, user management, dispute resolution
  routes/
    auth.routes.js
    request.routes.js
    donation.routes.js
    index.routes.js  ← hospital, bdc, admin, health routers
  utils/
    logger.js        ← Winston logger
    errors.js        ← createError helper
    generateToken.js ← JWT signing
    hashDonation.js  ← keccak256 verification (ethers.js)
    sendEmail.js     ← Email templates
    bdcService.js    ← Atomic BDC award/deduct with ledger
  app.js             ← Express setup, middleware, routes
  server.js          ← HTTP server + graceful shutdown
```

---

## API Reference

### Base URL: `http://localhost:5000/api`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account |
| POST | `/auth/login` | — | Login, get JWT |
| GET | `/auth/me` | ✅ | Get own profile |
| PUT | `/auth/wallet` | ✅ | Link MetaMask wallet |
| PUT | `/auth/profile` | ✅ | Update profile + location |

### Blood Requests
| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/requests` | — | Any | List + geo filter requests |
| GET | `/requests/:id` | — | Any | Get single request |
| POST | `/requests` | ✅ | HOSPITAL | Post new request |
| PUT | `/requests/:id/cancel` | ✅ | HOSPITAL/ADMIN | Cancel request |
| POST | `/requests/:id/accept` | ✅ | DONOR | Accept request (creates donation) |

**Geo query example:**
```
GET /api/requests?bloodGroup=O%2B&urgency=Critical&lat=13.08&lng=80.27&radius=25
```

### Donations
| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/donations/my` | ✅ | DONOR | My donations |
| GET | `/donations/:id` | ✅ | Donor/Hospital/Admin | Get donation |
| POST | `/donations/:id/donor-confirm` | ✅ | DONOR | Step 1: donor confirms |
| POST | `/donations/:id/receiver-confirm` | ✅ | HOSPITAL | Step 2: hospital confirms + blood bag ID |
| POST | `/donations/:id/upload-proof` | ✅ | DONOR | Upload proof image |
| POST | `/donations/:id/upload-receipt` | ✅ | HOSPITAL | Upload hospital receipt |
| POST | `/donations/:id/blockchain` | ✅ | DONOR | Step 3: record on blockchain + earn BDC |
| POST | `/donations/:id/dispute` | ✅ | Donor/Hospital | Raise dispute |

### Hospital Dashboard
| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| GET | `/hospital/requests` | ✅ | HOSPITAL | My posted requests |
| GET | `/hospital/donations` | ✅ | HOSPITAL | My incoming donations |
| GET | `/hospital/stats` | ✅ | HOSPITAL | Dashboard stats |

### BDC Tokens
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/bdc/balance` | ✅ | Current BDC balance |
| GET | `/bdc/history` | ✅ | Transaction ledger |
| POST | `/bdc/redeem` | ✅ (DONOR) | Redeem BDC |

### Admin
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/admin/stats` | ✅ ADMIN | Full platform analytics |
| GET | `/admin/users` | ✅ ADMIN | All users (paginated) |
| PUT | `/admin/users/:id/verify` | ✅ ADMIN | Verify a user |
| PUT | `/admin/users/:id/deactivate` | ✅ ADMIN | Deactivate user |
| GET | `/admin/donations` | ✅ ADMIN | All donations |
| PUT | `/admin/donations/:id/resolve-dispute` | ✅ ADMIN | Resolve dispute |
| PUT | `/admin/requests/:id/cancel` | ✅ ADMIN | Cancel any request |

---

## Donation Lifecycle

```
Donor accepts request
       │
       ▼
  [PENDING]
       │ POST /donations/:id/donor-confirm
       ▼
  [DONOR_CONFIRMED]
       │ POST /donations/:id/receiver-confirm  (hospital enters bloodBagId)
       ▼
  [RECEIVER_CONFIRMED]  ← readyForBlockchain = true
       │ POST /donations/:id/blockchain (MetaMask tx → backend verifies hash)
       ▼
  [COMPLETED]
  → 100 BDC minted to donor
  → Email sent to donor
  → BDCLedger entry created
  → lastDonationDate updated (56-day cooldown starts)
```

---

## Business Rules

| Rule | Detail |
|---|---|
| Donation cooldown | 56 days between donations |
| Minimum donor age | 18 years |
| Minimum donor weight | 50 kg |
| Blood request expiry | 72 hours (auto-expires via cron) |
| BDC reward | 100 BDC per completed donation |
| Hash verification | Server recomputes `keccak256(bloodBagId + walletAddress + donorConfirmedAt)` before accepting |
| Soulbound NFT | Minted by smart contract (referenced by nftTokenId in Donation) |

---

## Error Response Format

```json
{
  "message": "Human-readable description",
  "errors": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```

HTTP Status codes used:
- `400` Bad request / business rule violation
- `401` Unauthenticated
- `403` Forbidden (wrong role or not resource owner)
- `404` Not found
- `409` Conflict (duplicate)
- `422` Validation failed
- `429` Rate limited
- `500` Server error

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB Atlas connection string |
| `JWT_SECRET` | ✅ | Min 64-char random string |
| `JWT_EXPIRES_IN` | — | Default: `7d` |
| `CLOUDINARY_CLOUD_NAME` | ✅ | Cloudinary account |
| `CLOUDINARY_API_KEY` | ✅ | Cloudinary key |
| `CLOUDINARY_API_SECRET` | ✅ | Cloudinary secret |
| `EMAIL_HOST` | — | SMTP host |
| `EMAIL_PORT` | — | SMTP port (587) |
| `EMAIL_USER` | — | SMTP user |
| `EMAIL_PASS` | — | Gmail app password |
| `FRONTEND_URL` | — | CORS origin (default: localhost:5173) |
| `BDC_REWARD_PER_DONATION` | — | Default: 100 |
| `DONATION_COOLDOWN_DAYS` | — | Default: 56 |
| `REQUEST_EXPIRY_HOURS` | — | Default: 72 |
| `GEO_DEFAULT_RADIUS_KM` | — | Default: 50 |
| `MAX_FILE_SIZE_MB` | — | Default: 5 |

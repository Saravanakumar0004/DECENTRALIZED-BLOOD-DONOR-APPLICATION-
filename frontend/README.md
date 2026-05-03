# 🩸 BloodLink Frontend

React + Vite + TailwindCSS + ethers.js frontend for the BloodLink Blood Donation DApp.

## Stack
| | |
|---|---|
| Framework | React 18 + Vite |
| Styling | TailwindCSS v3 |
| State | Zustand (persist) |
| Routing | React Router v6 |
| HTTP | Axios + JWT interceptor |
| Web3 | ethers.js v6 (MetaMask) |
| Maps | react-leaflet + Leaflet.js |
| Notifications | react-hot-toast |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Set VITE_API_URL, VITE_CONTRACT_ADDRESS, VITE_ETHERSCAN_BASE

# 3. Run dev server
npm run dev
# → http://localhost:5173
```

## Environment Variables

```
VITE_API_URL=http://localhost:5000/api
VITE_CONTRACT_ADDRESS=0x_your_deployed_registry_address
VITE_ETHERSCAN_BASE=https://sepolia.etherscan.io/tx/
```

## Pages & Routes

| Route | Role | Page |
|---|---|---|
| `/` | Public | Landing |
| `/login` | Guest | Login |
| `/register` | Guest | Register |
| `/donor` | DONOR | Dashboard (requests + my donations + map) |
| `/requests` | DONOR | Browse all requests |
| `/map` | DONOR | Full-screen Leaflet map |
| `/hospital` | HOSPITAL | Dashboard (stats + incoming donations) |
| `/hospital/requests` | HOSPITAL | My posted requests |
| `/hospital/donations` | HOSPITAL | Incoming donation management |
| `/admin` | ADMIN | Platform analytics |
| `/admin/users` | ADMIN | User management |
| `/admin/donations` | ADMIN | All donations audit |
| `/donations/:id` | Auth | 4-step donation flow |
| `/profile` | Auth | Profile + wallet + BDC history |

## Donation Flow (4 Steps)
1. **Donor Confirm** → `POST /api/donations/:id/donor-confirm`
2. **Upload Proof** → `POST /api/donations/:id/upload-proof` (multipart)
3. **Hospital Confirms** → done from hospital dashboard
4. **Record Blockchain** → MetaMask → smart contract → `POST /api/donations/:id/blockchain`

## API Integration
All API calls go through `src/api/axios.js` which:
- Sets `baseURL` from `VITE_API_URL`
- Attaches `Authorization: Bearer <token>` from localStorage
- Auto-redirects to `/login` on 401

## Zustand Stores
- `authStore` — user, token, walletAddress, login, logout, setWallet, updateBDC
- `requestStore` — requests list, loading, fetchRequests

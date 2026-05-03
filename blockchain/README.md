# ⛓️ BloodLink Blockchain

**Solidity Smart Contracts** for the BloodLink Blood Donation DApp.

---

## Contracts Overview

| Contract | Standard | Purpose |
|---|---|---|
| `BDCToken.sol` | ERC-20 | Blood Donor Coin — reward token minted per verified donation |
| `DonationCertificate.sol` | ERC-721 | Soulbound NFT certificate — proof of contribution |
| `BloodLinkRegistry.sol` | — | Core registry — records donations, coordinates minting |

---

## Architecture

```
                         ┌─────────────────────────┐
                         │   BloodLinkRegistry      │
                         │                         │
                         │  recordDonation()       │
                         │  ─────────────────────  │
                         │  → mints BDC reward     │
                         │  → mints NFT cert       │
                         │  → stores on-chain hash │
                         │  → emits event          │
                         └────────┬────────┬───────┘
                                  │        │
                    ┌─────────────┘        └──────────────┐
                    ▼                                      ▼
         ┌──────────────────┐                  ┌──────────────────────┐
         │   BDCToken        │                  │ DonationCertificate  │
         │   (ERC-20)        │                  │   (ERC-721)          │
         │                  │                  │                      │
         │ 100 BDC / donor  │                  │ Soulbound NFT / donor│
         │ Transferable     │                  │ Non-transferable     │
         │ Burnable         │                  │ Burnable by owner    │
         └──────────────────┘                  └──────────────────────┘
```

---

## Quick Start

```bash
# 1. Install
npm install

# 2. Configure environment
cp .env.example .env
# Fill in DEPLOYER_PRIVATE_KEY, SEPOLIA_RPC_URL, ETHERSCAN_API_KEY

# 3. Compile contracts
npx hardhat compile

# 4. Run full test suite
npm test

# 5. Gas report
npm run gas-report

# 6. Deploy to local Hardhat node
npx hardhat node          # terminal 1
npm run deploy:local       # terminal 2

# 7. Deploy to Sepolia testnet
npm run deploy:sepolia

# 8. Verify on Etherscan
# First: add deployed addresses to .env
npm run verify

# 9. Export ABIs to backend + frontend
npm run export-abi
```

---

## Contract Details

### BDCToken (ERC-20)

```
Name:     Blood Donor Coin
Symbol:   BDC
Decimals: 18
Reward:   100 BDC (100 * 10^18 wei) per donation
Supply:   Uncapped, but only registry can mint
```

**Key functions:**
```solidity
mintReward(address donor, uint256 donationId)  // onlyRegistry
mintCustom(address to, uint256 amount)          // onlyOwner (admin adjustments)
burn(uint256 amount)                            // any holder
balanceOfFormatted(address account)             // returns human-readable balance
```

---

### DonationCertificate (ERC-721 Soulbound)

```
Name:   BloodLink Donation Certificate
Symbol: BLDC
```

**Soulbound rules:**
- Minting ✅ (address(0) → donor)
- Burning  ✅ (donor → address(0), owner only)
- Transfer ❌ (reverts with `SoulboundToken` error)

**Key functions:**
```solidity
mintCertificate(address donor, string tokenURI_, uint256 donationId)  // onlyRegistry
burn(uint256 tokenId)                                                  // token owner only
tokensOfDonor(address donor) → uint256[]
totalMinted() → uint256
tokenDonationId(uint256 tokenId) → uint256   // tokenId → donationId mapping
donationTokenId(uint256 donationId) → uint256 // donationId → tokenId mapping
```

---

### BloodLinkRegistry (Core)

**Access Control Roles:**

| Role | Holder | Can Call |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | Deployer | `registerHospital`, `revokeHospital`, `setOperator`, `pause/unpause` |
| `OPERATOR_ROLE` | Backend server wallet | `recordDonation` |
| `HOSPITAL_ROLE` | Hospital wallets | (reserved for future on-chain hospital actions) |

**Key functions:**
```solidity
// Core
recordDonation(uint256 donationId, address donor, address hospital, bytes32 hash, string nftURI)

// Verification
verifyDonation(uint256 donationId, bytes32 hash) → (bool valid, uint256 timestamp)
getDonation(uint256 donationId) → DonationRecord
getDonorHistory(address donor) → uint256[]
getDonorDonationCount(address donor) → uint256
getPlatformStats() → (totalDonations, totalBDCIssued, totalNFTs, totalBDCFormatted)

// Admin
registerHospital(address hospital, string name)
revokeHospital(address hospital)
setOperator(address operator)
revokeOperator(address operator)
pause() / unpause()
```

---

## Donation Hash

The `donationHash` is a `bytes32` keccak256 hash used to link on-chain records to off-chain data immutably.

**Formula:**
```
hash = keccak256( bloodBagId + donorWalletAddress + donorConfirmedAt.toISOString() )
```

**Frontend (ethers.js):**
```js
const raw  = `${bloodBagId}${donorAddress.toLowerCase()}${donorConfirmedAt}`;
const hash = ethers.keccak256(ethers.toUtf8Bytes(raw));
```

**Backend (ethers.js — server-side verify):**
```js
import { ethers } from 'ethers';
const expected = ethers.keccak256(ethers.toUtf8Bytes(
  `${donation.bloodBagId}${donor.walletAddress}${donation.donorConfirmedAt.toISOString()}`
));
const valid = expected.toLowerCase() === submittedHash.toLowerCase();
```

**On-chain (public audit):**
```js
const [valid, timestamp] = await registry.verifyDonation(donationId, hash);
```

---

## NFT Metadata (IPFS)

Upload JSON to Pinata before calling `recordDonation()`:

```json
{
  "name": "BloodLink Donation Certificate #42",
  "description": "Soulbound NFT certifying a verified blood donation.",
  "image": "ipfs://Qm.../badge.png",
  "external_url": "https://bloodlink.io/certificate/42",
  "attributes": [
    { "trait_type": "Blood Group",   "value": "O+" },
    { "trait_type": "Hospital",      "value": "Apollo Hospitals Chennai" },
    { "trait_type": "Donation Date", "value": "2026-04-12" },
    { "trait_type": "BDC Earned",    "value": "100" },
    { "trait_type": "Certificate",   "value": "Verified" }
  ]
}
```

Use `scripts/generateMetadata.js` to build this object in code.

---

## Test Coverage

**56 test cases** covering:

| Suite | Tests |
|---|---|
| BDCToken — Deployment | name, symbol, decimals, supply, registry |
| BDCToken — Access Control | non-registry mint, non-owner, zero address |
| BDCToken — Minting | 100 BDC reward, totalSupply, events |
| BDCToken — Burning | holder burn, non-holder rejected |
| BDCToken — ERC-20 | transfer, approve + transferFrom, formatted balance |
| DonationCertificate — Deployment | name, symbol, totalMinted, registry |
| DonationCertificate — Minting | mint to donor, URI, tokenId increment, mappings |
| DonationCertificate — Soulbound | transfer reverts, safeTransfer reverts, owner burn works |
| DonationCertificate — View | tokensOfDonor |
| BloodLinkRegistry — Deployment | addresses, roles, zero counters |
| BloodLinkRegistry — recordDonation | event, storage, counters, history, multi-donation |
| BloodLinkRegistry — Guard cases | duplicate, zero donor, zero hospital, empty hash, empty URI |
| BloodLinkRegistry — Access | non-operator, paused state |
| BloodLinkRegistry — verifyDonation | valid, wrong hash, non-existent |
| BloodLinkRegistry — getPlatformStats | accurate after multiple donations |
| BloodLinkRegistry — Hospital mgmt | register, revoke, non-admin, zero address |
| BloodLinkRegistry — Operator mgmt | grant, revoke, non-admin |
| BloodLinkRegistry — Pausable | pause, unpause, resume, non-admin |

---

## Security Features

| Feature | Implementation |
|---|---|
| Reentrancy protection | `ReentrancyGuard` on `recordDonation` |
| Role-based access | OpenZeppelin `AccessControl` |
| Emergency stop | `Pausable` — admin can halt all recording |
| Soulbound NFT | `_update()` override blocks all transfers |
| Duplicate guard | `DonationAlreadyRecorded` error on duplicate donationId |
| Zero-address checks | Custom errors for donor, hospital, registry |
| Hash integrity | donationHash stored immutably; verifiable publicly |
| No ETH handling | No `payable` functions — no ETH attack surface |

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | ✅ | Wallet that deploys + becomes admin |
| `OPERATOR_ADDRESS` | — | Backend server wallet for OPERATOR_ROLE |
| `SEPOLIA_RPC_URL` | ✅ (Sepolia) | Infura/Alchemy RPC endpoint |
| `ETHERSCAN_API_KEY` | ✅ (verify) | For contract verification |
| `REPORT_GAS` | — | Set to `true` for gas report |

---

## Post-Deployment Checklist

```
□ Run npm test — all tests green
□ Deploy to Sepolia: npm run deploy:sepolia
□ Copy addresses to backend .env
□ Run npm run verify
□ Run npm run export-abi
□ Copy ABIs to frontend src/abi/
□ Test recordDonation() on Sepolia with a real MetaMask tx
□ Run Slither static analysis: slither .
□ Submit for audit before mainnet
```


 npx hardhat compile

  npx hardhat node


  npx hardhat run scripts/deploy.js --network localhost
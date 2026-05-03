const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

/**
 * BloodLinkModule — Deploys all three contracts in correct dependency order:
 *
 *  1. BDCToken           (no deps)
 *  2. DonationCertificate (no deps)
 *  3. BloodLinkRegistry  (depends on 1 & 2)
 *  4. setRegistry()      on BDCToken  → points to Registry
 *  5. setRegistry()      on DonationCertificate → points to Registry
 *  6. setOperator()      on Registry → sets the backend server wallet
 *
 * After deployment:
 *   - Copy contract addresses to backend .env
 *   - Copy ABIs from artifacts/ to frontend/src/abi/
 *   - Run verify script for Etherscan
 */
module.exports = buildModule("BloodLinkModule", (m) => {

  // ── Accounts ───────────────────────────────────────────────────────────────
  const deployer = m.getAccount(0);

  // Optional: set a separate operator wallet (backend server)
  // If not set, deployer acts as operator
  const operatorAddress = process.env.OPERATOR_ADDRESS || undefined;

  // ── Step 1 & 2: Deploy token contracts ────────────────────────────────────
  const bdcToken = m.contract("BDCToken", [deployer]);
  const nftCert  = m.contract("DonationCertificate", [deployer]);

  // ── Step 3: Deploy Registry ───────────────────────────────────────────────
  const registry = m.contract("BloodLinkRegistry", [deployer, bdcToken, nftCert]);

  // ── Step 4 & 5: Wire Registry as minter for both token contracts ──────────
  m.call(bdcToken, "setRegistry", [registry], { id: "BDCToken_setRegistry" });
  m.call(nftCert,  "setRegistry", [registry], { id: "NFT_setRegistry" });

  // ── Step 6: Grant OPERATOR_ROLE to backend server wallet ─────────────────
  if (operatorAddress && operatorAddress !== deployer) {
    m.call(registry, "setOperator", [operatorAddress], { id: "Registry_setOperator" });
  }

  return { bdcToken, nftCert, registry };
});

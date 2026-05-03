/**
 * verify.js — Verifies all three BloodLink contracts on Etherscan (Sepolia).
 *
 * Usage:
 *   npx hardhat run scripts/verify.js --network sepolia
 *
 * Prerequisites:
 *   - Contracts already deployed via: npm run deploy:sepolia
 *   - Addresses set in .env (BDC_TOKEN_ADDRESS, NFT_CERTIFICATE_ADDRESS, REGISTRY_ADDRESS)
 *   - ETHERSCAN_API_KEY set in .env
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const BDC_TOKEN_ADDRESS      = process.env.BDC_TOKEN_ADDRESS;
  const NFT_CERTIFICATE_ADDRESS = process.env.NFT_CERTIFICATE_ADDRESS;
  const REGISTRY_ADDRESS        = process.env.REGISTRY_ADDRESS;

  if (!BDC_TOKEN_ADDRESS || !NFT_CERTIFICATE_ADDRESS || !REGISTRY_ADDRESS) {
    throw new Error(
      "Missing contract addresses. Set BDC_TOKEN_ADDRESS, NFT_CERTIFICATE_ADDRESS, " +
      "and REGISTRY_ADDRESS in your .env file after deployment."
    );
  }

  console.log("Verifying BloodLink contracts on Etherscan (Sepolia)...");
  console.log("Deployer:", deployer.address);

  // ── BDCToken ──────────────────────────────────────────────────────────────
  console.log("\n[1/3] Verifying BDCToken at", BDC_TOKEN_ADDRESS);
  try {
    await hre.run("verify:verify", {
      address:              BDC_TOKEN_ADDRESS,
      constructorArguments: [deployer.address],
      contract:             "contracts/BDCToken.sol:BDCToken",
    });
    console.log("✅ BDCToken verified");
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("⚠️  BDCToken already verified");
    } else {
      console.error("❌ BDCToken verification failed:", e.message);
    }
  }

  // ── DonationCertificate ───────────────────────────────────────────────────
  console.log("\n[2/3] Verifying DonationCertificate at", NFT_CERTIFICATE_ADDRESS);
  try {
    await hre.run("verify:verify", {
      address:              NFT_CERTIFICATE_ADDRESS,
      constructorArguments: [deployer.address],
      contract:             "contracts/DonationCertificate.sol:DonationCertificate",
    });
    console.log("✅ DonationCertificate verified");
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("⚠️  DonationCertificate already verified");
    } else {
      console.error("❌ DonationCertificate verification failed:", e.message);
    }
  }

  // ── BloodLinkRegistry ─────────────────────────────────────────────────────
  console.log("\n[3/3] Verifying BloodLinkRegistry at", REGISTRY_ADDRESS);
  try {
    await hre.run("verify:verify", {
      address:              REGISTRY_ADDRESS,
      constructorArguments: [deployer.address, BDC_TOKEN_ADDRESS, NFT_CERTIFICATE_ADDRESS],
      contract:             "contracts/BloodLinkRegistry.sol:BloodLinkRegistry",
    });
    console.log("✅ BloodLinkRegistry verified");
  } catch (e) {
    if (e.message.includes("Already Verified")) {
      console.log("⚠️  BloodLinkRegistry already verified");
    } else {
      console.error("❌ BloodLinkRegistry verification failed:", e.message);
    }
  }

  console.log("\n🔗 View on Etherscan:");
  console.log(`  BDCToken:             https://sepolia.etherscan.io/address/${BDC_TOKEN_ADDRESS}`);
  console.log(`  DonationCertificate:  https://sepolia.etherscan.io/address/${NFT_CERTIFICATE_ADDRESS}`);
  console.log(`  BloodLinkRegistry:    https://sepolia.etherscan.io/address/${REGISTRY_ADDRESS}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

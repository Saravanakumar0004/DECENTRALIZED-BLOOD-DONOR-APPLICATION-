/**
 * deploy.js - Deploys all BloodLink contracts in the correct order.
 *
 * Local:
 *   npx hardhat run scripts/deploy.js --network localhost
 *
 * Sepolia:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *
 * After deployment, copy the printed addresses into your .env file:
 *   BDC_TOKEN_ADDRESS, NFT_CERTIFICATE_ADDRESS, REGISTRY_ADDRESS
 */

require("dotenv").config();
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const operatorAddress = process.env.OPERATOR_ADDRESS;

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  BloodLink Contract Deployment");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Network :", hre.network.name);
  console.log("  Deployer:", deployer.address);
  console.log("  Operator:", operatorAddress || "(same as deployer)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // -- Step 1: Deploy BDCToken ----------------------------------------------
  // No constructor args - OZ v4 Ownable sets owner to msg.sender automatically
  console.log("[1/5] Deploying BDCToken...");
  const BDCToken = await hre.ethers.getContractFactory("BDCToken");
  const bdcToken = await BDCToken.deploy();
  await bdcToken.waitForDeployment();
  const bdcAddress = await bdcToken.getAddress();
  console.log("  ✅ BDCToken deployed to:", bdcAddress);

  // -- Step 2: Deploy DonationCertificate -----------------------------------
  // No constructor args - OZ v4 Ownable sets owner to msg.sender automatically
  console.log("\n[2/5] Deploying DonationCertificate...");
  const DonationCertificate = await hre.ethers.getContractFactory("DonationCertificate");
  const nftCert = await DonationCertificate.deploy();
  await nftCert.waitForDeployment();
  const nftAddress = await nftCert.getAddress();
  console.log("  ✅ DonationCertificate deployed to:", nftAddress);

  // -- Step 3: Deploy BloodLinkRegistry -------------------------------------
  // Still takes (admin, bdcToken, nftCert) args
  console.log("\n[3/5] Deploying BloodLinkRegistry...");
  const BloodLinkRegistry = await hre.ethers.getContractFactory("BloodLinkRegistry");
  const registry = await BloodLinkRegistry.deploy(
    deployer.address,
    bdcAddress,
    nftAddress
  );
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  ✅ BloodLinkRegistry deployed to:", registryAddress);

  // -- Step 4: Wire registry address into token contracts -------------------
  console.log("\n[4/5] Wiring registry into BDCToken and DonationCertificate...");
  const tx1 = await bdcToken.setRegistry(registryAddress);
  await tx1.wait();
  const tx2 = await nftCert.setRegistry(registryAddress);
  await tx2.wait();
  console.log("  ✅ Registry address set on both token contracts");

  // -- Step 5: Grant OPERATOR_ROLE to backend wallet ------------------------
  if (operatorAddress && operatorAddress.toLowerCase() !== deployer.address.toLowerCase()) {
    console.log("\n[5/5] Granting OPERATOR_ROLE to:", operatorAddress);
    const tx3 = await registry.setOperator(operatorAddress);
    await tx3.wait();
    console.log("  ✅ OPERATOR_ROLE granted to operator wallet");
  } else {
    console.log("\n[5/5] Skipping operator grant - deployer acts as operator");
  }

  // -- Summary --------------------------------------------------------------
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Deployment Complete! Copy these to your .env:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`BDC_TOKEN_ADDRESS=${bdcAddress}`);
  console.log(`NFT_CERTIFICATE_ADDRESS=${nftAddress}`);
  console.log(`REGISTRY_ADDRESS=${registryAddress}`);

  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  Etherscan Links (may take ~1 min to index):");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`  BDCToken:             https://sepolia.etherscan.io/address/${bdcAddress}`);
    console.log(`  DonationCertificate:  https://sepolia.etherscan.io/address/${nftAddress}`);
    console.log(`  BloodLinkRegistry:    https://sepolia.etherscan.io/address/${registryAddress}`);
    console.log("\n  Run verification:");
    console.log("  npm run verify");
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message);
  process.exitCode = 1;
});
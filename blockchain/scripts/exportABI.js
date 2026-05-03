/**
 * exportABI.js — After compilation, copies the relevant ABI files to:
 *   - ../bloodlink-backend/abi/   (for backend ethers.js calls)
 *   - ../bloodlink-frontend/src/abi/  (for frontend MetaMask integration)
 *
 * Usage:
 *   npm run export-abi
 *   (run AFTER: npx hardhat compile)
 */

const fs   = require("fs");
const path = require("path");

const contracts = [
  { name: "BDCToken",            file: "contracts/BDCToken.sol/BDCToken.json" },
  { name: "DonationCertificate", file: "contracts/DonationCertificate.sol/DonationCertificate.json" },
  { name: "BloodLinkRegistry",   file: "contracts/BloodLinkRegistry.sol/BloodLinkRegistry.json" },
];

const outputDirs = [
  path.join(__dirname, "../../bloodlink-backend/abi"),
  path.join(__dirname, "../../bloodlink-frontend/src/abi"),
  path.join(__dirname, "../abi"), // local copy
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function main() {
  console.log("Exporting ABIs...\n");

  for (const outDir of outputDirs) {
    ensureDir(outDir);
  }

  for (const { name, file } of contracts) {
    const artifactPath = path.join(__dirname, "../artifacts", file);

    if (!fs.existsSync(artifactPath)) {
      console.warn(`⚠️  Artifact not found: ${artifactPath}`);
      console.warn(`   Run 'npx hardhat compile' first.\n`);
      continue;
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

    // Extract only ABI (not bytecode — frontend doesn't need bytecode)
    const abiOnly = { contractName: artifact.contractName, abi: artifact.abi };
    const outFile = `${name}.json`;
    const content = JSON.stringify(abiOnly, null, 2);

    for (const outDir of outputDirs) {
      const outPath = path.join(outDir, outFile);
      fs.writeFileSync(outPath, content);
      console.log(`✅ ${name}.json → ${outPath}`);
    }
    console.log();
  }

  console.log("ABI export complete.");
}

main();

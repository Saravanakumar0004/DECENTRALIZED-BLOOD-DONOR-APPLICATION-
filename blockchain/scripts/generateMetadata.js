/**
 * generateMetadata.js — Generates NFT metadata JSON for a donation certificate.
 *
 * In production, the backend calls this before triggering recordDonation()
 * and uploads the JSON to IPFS (via Pinata or NFT.Storage).
 *
 * Usage (standalone test):
 *   node scripts/generateMetadata.js
 *
 * In backend integration:
 *   import { buildMetadata, uploadMetadataToPinata } from './generateMetadata.js'
 */

/**
 * buildMetadata — Constructs the ERC-721 metadata JSON object.
 *
 * @param {object} opts
 * @param {number}  opts.donationId   Off-chain donation ID
 * @param {string}  opts.bloodGroup   e.g. "O+"
 * @param {string}  opts.hospitalName e.g. "Apollo Hospitals Chennai"
 * @param {string}  opts.donorName    e.g. "Arun Kumar"
 * @param {string}  opts.donationDate ISO date string e.g. "2026-04-12"
 * @param {number}  opts.bdcEarned    e.g. 100
 * @param {string}  opts.imageURI     IPFS URI of the badge image
 * @returns {object} metadata JSON
 */
function buildMetadata({ donationId, bloodGroup, hospitalName, donorName, donationDate, bdcEarned, imageURI }) {
  return {
    name:        `BloodLink Donation Certificate #${donationId}`,
    description: `This soulbound NFT certifies that ${donorName} completed a verified ${bloodGroup} blood donation on the BloodLink platform. This certificate is non-transferable.`,
    image:       imageURI || "ipfs://QmDefaultBadgeImageHash/badge.png",
    external_url: `https://bloodlink.io/certificate/${donationId}`,
    attributes: [
      { trait_type: "Donation ID",    value: String(donationId) },
      { trait_type: "Blood Group",    value: bloodGroup },
      { trait_type: "Hospital",       value: hospitalName },
      { trait_type: "Donation Date",  value: donationDate },
      { trait_type: "BDC Earned",     value: String(bdcEarned) },
      { trait_type: "Certificate",    value: "Verified" },
    ],
  };
}

// ── Example: Generate sample metadata ────────────────────────────────────────
if (require.main === module) {
  const sample = buildMetadata({
    donationId:   42,
    bloodGroup:   "O+",
    hospitalName: "Apollo Hospitals Chennai",
    donorName:    "Arun Kumar",
    donationDate: "2026-04-12",
    bdcEarned:    100,
    imageURI:     "ipfs://QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/badge.png",
  });

  console.log("Sample NFT Metadata JSON:");
  console.log(JSON.stringify(sample, null, 2));
  console.log("\nUpload this JSON to IPFS and use the resulting URI in recordDonation().");
}

module.exports = { buildMetadata };

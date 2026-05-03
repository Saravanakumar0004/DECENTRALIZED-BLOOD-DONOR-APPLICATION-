const { expect }         = require("chai");
const { ethers }         = require("hardhat");
const { loadFixture }    = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue }       = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

// ── Helpers ───────────────────────────────────────────────────────────────────

const DONATION_REWARD = ethers.parseEther("100"); // 100 BDC

/**
 * Compute the same keccak256 hash the backend/frontend produces:
 *   keccak256( bloodBagId + donorWallet + donorConfirmedAt ISO string )
 */
function computeHash(bloodBagId, donorWallet, isoTimestamp) {
  const raw = `${bloodBagId}${donorWallet.toLowerCase()}${isoTimestamp}`;
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
}

const SAMPLE_NFT_URI   = "ipfs://QmXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/1.json";
const SAMPLE_BAG_ID    = "BAG-TN-2026-001";
const SAMPLE_TIMESTAMP = "2026-04-12T10:00:00.000Z";

// ── Shared fixture ────────────────────────────────────────────────────────────

async function deployFixture() {
  const [admin, operator, hospital, donor, donor2, stranger] = await ethers.getSigners();

  // Deploy BDCToken
  const BDCToken = await ethers.getContractFactory("BDCToken");
  const bdcToken = await BDCToken.deploy(admin.address);
  await bdcToken.waitForDeployment();

  // Deploy DonationCertificate
  const DonationCertificate = await ethers.getContractFactory("DonationCertificate");
  const nftCert = await DonationCertificate.deploy(admin.address);
  await nftCert.waitForDeployment();

  // Deploy BloodLinkRegistry
  const BloodLinkRegistry = await ethers.getContractFactory("BloodLinkRegistry");
  const registry = await BloodLinkRegistry.deploy(
    admin.address,
    await bdcToken.getAddress(),
    await nftCert.getAddress()
  );
  await registry.waitForDeployment();

  // Wire: set registry on both token contracts
  await bdcToken.connect(admin).setRegistry(await registry.getAddress());
  await nftCert.connect(admin).setRegistry(await registry.getAddress());

  // Grant OPERATOR_ROLE to operator wallet
  await registry.connect(admin).setOperator(operator.address);

  // Register hospital
  await registry.connect(admin).registerHospital(hospital.address, "Apollo Hospitals Chennai");

  return { admin, operator, hospital, donor, donor2, stranger, bdcToken, nftCert, registry };
}

// ─────────────────────────────────────────────────────────────────────────────
// BDCToken Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("BDCToken", function () {

  describe("Deployment", function () {
    it("should have correct name and symbol", async function () {
      const { bdcToken } = await loadFixture(deployFixture);
      expect(await bdcToken.name()).to.equal("Blood Donor Coin");
      expect(await bdcToken.symbol()).to.equal("BDC");
    });

    it("should have 18 decimals", async function () {
      const { bdcToken } = await loadFixture(deployFixture);
      expect(await bdcToken.decimals()).to.equal(18);
    });

    it("should set DONATION_REWARD to 100 BDC", async function () {
      const { bdcToken } = await loadFixture(deployFixture);
      expect(await bdcToken.DONATION_REWARD()).to.equal(DONATION_REWARD);
    });

    it("should start with zero total supply", async function () {
      const { bdcToken } = await loadFixture(deployFixture);
      expect(await bdcToken.totalSupply()).to.equal(0n);
    });

    it("should set registry address correctly", async function () {
      const { bdcToken, registry } = await loadFixture(deployFixture);
      expect(await bdcToken.registry()).to.equal(await registry.getAddress());
    });
  });

  describe("Access Control", function () {
    it("should reject mintReward from non-registry caller", async function () {
      const { bdcToken, stranger, donor } = await loadFixture(deployFixture);
      await expect(
        bdcToken.connect(stranger).mintReward(donor.address, 1)
      ).to.be.revertedWithCustomError(bdcToken, "OnlyRegistry");
    });

    it("should reject mintCustom from non-owner", async function () {
      const { bdcToken, stranger, donor } = await loadFixture(deployFixture);
      await expect(
        bdcToken.connect(stranger).mintCustom(donor.address, ethers.parseEther("50"))
      ).to.be.revertedWithCustomError(bdcToken, "OwnableUnauthorizedAccount");
    });

    it("should reject setRegistry from non-owner", async function () {
      const { bdcToken, stranger } = await loadFixture(deployFixture);
      await expect(
        bdcToken.connect(stranger).setRegistry(stranger.address)
      ).to.be.revertedWithCustomError(bdcToken, "OwnableUnauthorizedAccount");
    });

    it("should reject setRegistry with zero address", async function () {
      const { bdcToken, admin } = await loadFixture(deployFixture);
      await expect(
        bdcToken.connect(admin).setRegistry(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(bdcToken, "ZeroAddress");
    });
  });

  describe("Minting", function () {
    it("should mint exactly 100 BDC via registry recordDonation", async function () {
      const { bdcToken, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await bdcToken.balanceOf(donor.address)).to.equal(DONATION_REWARD);
    });

    it("should increase totalSupply by DONATION_REWARD after mint", async function () {
      const { bdcToken, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await bdcToken.totalSupply()).to.equal(DONATION_REWARD);
    });

    it("should allow owner to mint custom amount", async function () {
      const { bdcToken, admin, donor } = await loadFixture(deployFixture);
      const customAmount = ethers.parseEther("50");
      await bdcToken.connect(admin).mintCustom(donor.address, customAmount);
      expect(await bdcToken.balanceOf(donor.address)).to.equal(customAmount);
    });

    it("should emit DonationRewarded event on mintReward", async function () {
      const { bdcToken, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.emit(bdcToken, "DonationRewarded")
        .withArgs(donor.address, DONATION_REWARD, 1n);
    });
  });

  describe("Burning", function () {
    it("should allow holder to burn their own BDC", async function () {
      const { bdcToken, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      const burnAmount = ethers.parseEther("30");
      await bdcToken.connect(donor).burn(burnAmount);
      expect(await bdcToken.balanceOf(donor.address))
        .to.equal(DONATION_REWARD - burnAmount);
    });

    it("should reject burn from non-holder", async function () {
      const { bdcToken, stranger } = await loadFixture(deployFixture);
      await expect(
        bdcToken.connect(stranger).burn(ethers.parseEther("10"))
      ).to.be.reverted;
    });
  });

  describe("ERC-20 Standard", function () {
    it("should support transfer between holders", async function () {
      const { bdcToken, admin, donor, donor2 } = await loadFixture(deployFixture);
      await bdcToken.connect(admin).mintCustom(donor.address, ethers.parseEther("100"));
      await bdcToken.connect(donor).transfer(donor2.address, ethers.parseEther("40"));
      expect(await bdcToken.balanceOf(donor2.address)).to.equal(ethers.parseEther("40"));
    });

    it("should support approve and transferFrom", async function () {
      const { bdcToken, admin, donor, donor2 } = await loadFixture(deployFixture);
      await bdcToken.connect(admin).mintCustom(donor.address, ethers.parseEther("100"));
      await bdcToken.connect(donor).approve(donor2.address, ethers.parseEther("50"));
      await bdcToken.connect(donor2).transferFrom(
        donor.address, donor2.address, ethers.parseEther("50")
      );
      expect(await bdcToken.balanceOf(donor2.address)).to.equal(ethers.parseEther("50"));
    });

    it("balanceOfFormatted should return human-readable balance", async function () {
      const { bdcToken, admin, donor } = await loadFixture(deployFixture);
      await bdcToken.connect(admin).mintCustom(donor.address, ethers.parseEther("100"));
      expect(await bdcToken.balanceOfFormatted(donor.address)).to.equal(100n);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DonationCertificate Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("DonationCertificate", function () {

  describe("Deployment", function () {
    it("should have correct name and symbol", async function () {
      const { nftCert } = await loadFixture(deployFixture);
      expect(await nftCert.name()).to.equal("BloodLink Donation Certificate");
      expect(await nftCert.symbol()).to.equal("BLDC");
    });

    it("should start with totalMinted = 0", async function () {
      const { nftCert } = await loadFixture(deployFixture);
      expect(await nftCert.totalMinted()).to.equal(0n);
    });

    it("should set registry address correctly", async function () {
      const { nftCert, registry } = await loadFixture(deployFixture);
      expect(await nftCert.registry()).to.equal(await registry.getAddress());
    });
  });

  describe("Minting", function () {
    it("should mint NFT to donor on recordDonation", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await nftCert.balanceOf(donor.address)).to.equal(1n);
      expect(await nftCert.ownerOf(0)).to.equal(donor.address);
    });

    it("should store correct tokenURI", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await nftCert.tokenURI(0)).to.equal(SAMPLE_NFT_URI);
    });

    it("should increment tokenId for each mint", async function () {
      const { nftCert, registry, operator, donor, donor2, hospital } = await loadFixture(deployFixture);
      const hash1 = computeHash("BAG-001", donor.address,  SAMPLE_TIMESTAMP);
      const hash2 = computeHash("BAG-002", donor2.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address,  hospital.address, hash1, SAMPLE_NFT_URI
      );
      await registry.connect(operator).recordDonation(
        2, donor2.address, hospital.address, hash2, SAMPLE_NFT_URI
      );

      expect(await nftCert.totalMinted()).to.equal(2n);
      expect(await nftCert.ownerOf(0)).to.equal(donor.address);
      expect(await nftCert.ownerOf(1)).to.equal(donor2.address);
    });

    it("should store donationId ↔ tokenId mappings correctly", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        42, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await nftCert.tokenDonationId(0)).to.equal(42n);
      expect(await nftCert.donationTokenId(42)).to.equal(0n);
    });

    it("should reject minting from non-registry caller", async function () {
      const { nftCert, stranger, donor } = await loadFixture(deployFixture);
      await expect(
        nftCert.connect(stranger).mintCertificate(donor.address, SAMPLE_NFT_URI, 1)
      ).to.be.revertedWithCustomError(nftCert, "OnlyRegistry");
    });

    it("should reject duplicate donationId certificate", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      // Try to record same donationId again
      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "DonationAlreadyRecorded");
    });

    it("should emit CertificateMinted event", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.emit(nftCert, "CertificateMinted")
        .withArgs(donor.address, 0n, 1n, SAMPLE_NFT_URI);
    });
  });

  describe("Soulbound enforcement", function () {
    it("should revert on transfer attempt", async function () {
      const { nftCert, registry, operator, donor, donor2, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      await expect(
        nftCert.connect(donor).transferFrom(donor.address, donor2.address, 0)
      ).to.be.revertedWithCustomError(nftCert, "SoulboundToken");
    });

    it("should revert on safeTransferFrom attempt", async function () {
      const { nftCert, registry, operator, donor, donor2, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      await expect(
        nftCert.connect(donor)["safeTransferFrom(address,address,uint256)"](
          donor.address, donor2.address, 0
        )
      ).to.be.revertedWithCustomError(nftCert, "SoulboundToken");
    });

    it("should allow owner to burn their own certificate", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      await nftCert.connect(donor).burn(0);
      expect(await nftCert.balanceOf(donor.address)).to.equal(0n);
    });

    it("should not allow non-owner to burn a certificate", async function () {
      const { nftCert, registry, operator, donor, stranger, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      await expect(
        nftCert.connect(stranger).burn(0)
      ).to.be.revertedWithCustomError(nftCert, "ERC721InsufficientApproval");
    });
  });

  describe("View functions", function () {
    it("tokensOfDonor should return all token IDs", async function () {
      const { nftCert, registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const h1 = computeHash("BAG-001", donor.address, "2026-04-12T10:00:00.000Z");
      const h2 = computeHash("BAG-002", donor.address, "2026-04-13T10:00:00.000Z");

      await registry.connect(operator).recordDonation(1, donor.address, hospital.address, h1, SAMPLE_NFT_URI);
      await registry.connect(operator).recordDonation(2, donor.address, hospital.address, h2, SAMPLE_NFT_URI);

      const tokens = await nftCert.tokensOfDonor(donor.address);
      expect(tokens.length).to.equal(2);
      expect(tokens[0]).to.equal(0n);
      expect(tokens[1]).to.equal(1n);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BloodLinkRegistry Tests
// ─────────────────────────────────────────────────────────────────────────────

describe("BloodLinkRegistry", function () {

  describe("Deployment", function () {
    it("should set bdcToken and nftCertificate addresses", async function () {
      const { registry, bdcToken, nftCert } = await loadFixture(deployFixture);
      expect(await registry.bdcToken()).to.equal(await bdcToken.getAddress());
      expect(await registry.nftCertificate()).to.equal(await nftCert.getAddress());
    });

    it("should grant DEFAULT_ADMIN_ROLE to deployer", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      const ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(ADMIN_ROLE, admin.address)).to.be.true;
    });

    it("should grant OPERATOR_ROLE to operator", async function () {
      const { registry, operator } = await loadFixture(deployFixture);
      const OPERATOR_ROLE = await registry.OPERATOR_ROLE();
      expect(await registry.hasRole(OPERATOR_ROLE, operator.address)).to.be.true;
    });

    it("should start with zero counters", async function () {
      const { registry } = await loadFixture(deployFixture);
      expect(await registry.totalDonations()).to.equal(0n);
      expect(await registry.totalBDCIssued()).to.equal(0n);
      expect(await registry.totalNFTsMinted()).to.equal(0n);
    });
  });

  describe("recordDonation", function () {

    it("should record donation and emit DonationRecorded event", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.emit(registry, "DonationRecorded")
        .withArgs(1n, donor.address, hospital.address, hash, DONATION_REWARD, 0n, anyValue());
    });

    it("should store donation record correctly", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      const record = await registry.getDonation(1);
      expect(record.donationId).to.equal(1n);
      expect(record.donor).to.equal(donor.address);
      expect(record.hospital).to.equal(hospital.address);
      expect(record.donationHash).to.equal(hash);
      expect(record.bdcAwarded).to.equal(DONATION_REWARD);
      expect(record.exists).to.be.true;
    });

    it("should increment totalDonations, totalBDCIssued, totalNFTsMinted", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      expect(await registry.totalDonations()).to.equal(1n);
      expect(await registry.totalBDCIssued()).to.equal(DONATION_REWARD);
      expect(await registry.totalNFTsMinted()).to.equal(1n);
    });

    it("should add donationId to donor history", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        99, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      const history = await registry.getDonorHistory(donor.address);
      expect(history.length).to.equal(1);
      expect(history[0]).to.equal(99n);
    });

    it("should correctly count multiple donations by same donor", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const h1 = computeHash("BAG-001", donor.address, "2026-04-12T10:00:00.000Z");
      const h2 = computeHash("BAG-002", donor.address, "2026-04-13T10:00:00.000Z");
      const h3 = computeHash("BAG-003", donor.address, "2026-04-14T10:00:00.000Z");

      await registry.connect(operator).recordDonation(1, donor.address, hospital.address, h1, SAMPLE_NFT_URI);
      await registry.connect(operator).recordDonation(2, donor.address, hospital.address, h2, SAMPLE_NFT_URI);
      await registry.connect(operator).recordDonation(3, donor.address, hospital.address, h3, SAMPLE_NFT_URI);

      expect(await registry.getDonorDonationCount(donor.address)).to.equal(3n);
      expect(await registry.totalDonations()).to.equal(3n);
    });

    it("should revert on duplicate donationId", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "DonationAlreadyRecorded").withArgs(1n);
    });

    it("should revert with zero donor address", async function () {
      const { registry, operator, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, ethers.ZeroAddress, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, ethers.ZeroAddress, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "InvalidDonorAddress");
    });

    it("should revert with zero hospital address", async function () {
      const { registry, operator, donor } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, ethers.ZeroAddress, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "InvalidHospitalAddress");
    });

    it("should revert with empty donation hash", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, ethers.ZeroHash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "EmptyDonationHash");
    });

    it("should revert with empty NFT URI", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, ""
        )
      ).to.be.revertedWithCustomError(registry, "EmptyNFTUri");
    });

    it("should reject recordDonation from non-operator", async function () {
      const { registry, stranger, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(stranger).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should reject recordDonation when paused", async function () {
      const { registry, admin, operator, donor, hospital } = await loadFixture(deployFixture);
      await registry.connect(admin).pause();
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");
    });
  });

  describe("verifyDonation", function () {
    it("should return valid=true and correct timestamp for matching hash", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      const [valid, ts] = await registry.verifyDonation(1, hash);
      expect(valid).to.be.true;
      expect(ts).to.be.gt(0n);
    });

    it("should return valid=false for wrong hash", async function () {
      const { registry, operator, donor, hospital } = await loadFixture(deployFixture);
      const hash    = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);
      const badHash = computeHash("WRONG-BAG",   donor.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(
        1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
      );

      const [valid] = await registry.verifyDonation(1, badHash);
      expect(valid).to.be.false;
    });

    it("should return valid=false for non-existent donationId", async function () {
      const { registry } = await loadFixture(deployFixture);
      const [valid, ts] = await registry.verifyDonation(9999, ethers.ZeroHash);
      expect(valid).to.be.false;
      expect(ts).to.equal(0n);
    });
  });

  describe("getPlatformStats", function () {
    it("should return accurate platform stats after multiple donations", async function () {
      const { registry, operator, donor, donor2, hospital } = await loadFixture(deployFixture);
      const h1 = computeHash("BAG-001", donor.address,  SAMPLE_TIMESTAMP);
      const h2 = computeHash("BAG-002", donor2.address, SAMPLE_TIMESTAMP);

      await registry.connect(operator).recordDonation(1, donor.address,  hospital.address, h1, SAMPLE_NFT_URI);
      await registry.connect(operator).recordDonation(2, donor2.address, hospital.address, h2, SAMPLE_NFT_URI);

      const [total, bdcWei, nfts, bdcFormatted] = await registry.getPlatformStats();
      expect(total).to.equal(2n);
      expect(bdcWei).to.equal(DONATION_REWARD * 2n);
      expect(nfts).to.equal(2n);
      expect(bdcFormatted).to.equal(200n);
    });
  });

  describe("Hospital Management", function () {
    it("should register hospital and grant HOSPITAL_ROLE", async function () {
      const { registry, admin, donor2 } = await loadFixture(deployFixture);
      await registry.connect(admin).registerHospital(donor2.address, "MIOT Hospital");

      const HOSPITAL_ROLE = await registry.HOSPITAL_ROLE();
      expect(await registry.hasRole(HOSPITAL_ROLE, donor2.address)).to.be.true;

      const info = await registry.hospitals(donor2.address);
      expect(info.name).to.equal("MIOT Hospital");
      expect(info.active).to.be.true;
    });

    it("should revoke hospital and mark inactive", async function () {
      const { registry, admin, hospital } = await loadFixture(deployFixture);
      await registry.connect(admin).revokeHospital(hospital.address);

      const HOSPITAL_ROLE = await registry.HOSPITAL_ROLE();
      expect(await registry.hasRole(HOSPITAL_ROLE, hospital.address)).to.be.false;

      const info = await registry.hospitals(hospital.address);
      expect(info.active).to.be.false;
    });

    it("should reject registerHospital from non-admin", async function () {
      const { registry, stranger, donor } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).registerHospital(donor.address, "Fake Hospital")
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("should reject registerHospital with zero address", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      await expect(
        registry.connect(admin).registerHospital(ethers.ZeroAddress, "Zero Hospital")
      ).to.be.revertedWithCustomError(registry, "ZeroAddress");
    });
  });

  describe("Operator Management", function () {
    it("should grant operator role via setOperator", async function () {
      const { registry, admin, stranger } = await loadFixture(deployFixture);
      await registry.connect(admin).setOperator(stranger.address);

      const OPERATOR_ROLE = await registry.OPERATOR_ROLE();
      expect(await registry.hasRole(OPERATOR_ROLE, stranger.address)).to.be.true;
    });

    it("should revoke operator role via revokeOperator", async function () {
      const { registry, admin, operator } = await loadFixture(deployFixture);
      await registry.connect(admin).revokeOperator(operator.address);

      const OPERATOR_ROLE = await registry.OPERATOR_ROLE();
      expect(await registry.hasRole(OPERATOR_ROLE, operator.address)).to.be.false;
    });

    it("should reject setOperator from non-admin", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).setOperator(stranger.address)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Pausable", function () {
    it("should pause and unpause correctly", async function () {
      const { registry, admin } = await loadFixture(deployFixture);
      await registry.connect(admin).pause();
      expect(await registry.paused()).to.be.true;

      await registry.connect(admin).unpause();
      expect(await registry.paused()).to.be.false;
    });

    it("should allow recording after unpausing", async function () {
      const { registry, admin, operator, donor, hospital } = await loadFixture(deployFixture);
      await registry.connect(admin).pause();
      await registry.connect(admin).unpause();
      const hash = computeHash(SAMPLE_BAG_ID, donor.address, SAMPLE_TIMESTAMP);

      await expect(
        registry.connect(operator).recordDonation(
          1, donor.address, hospital.address, hash, SAMPLE_NFT_URI
        )
      ).to.emit(registry, "DonationRecorded");
    });

    it("should reject pause from non-admin", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(
        registry.connect(stranger).pause()
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });
  });
});


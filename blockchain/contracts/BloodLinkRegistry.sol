// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./BDCToken.sol";
import "./DonationCertificate.sol";

/**
 * @title BloodLinkRegistry
 * @author BloodLink - Team Web Breach
 * @notice Core registry contract for the BloodLink platform.
 *
 * Responsibilities:
 *  1. Record immutable proof of verified blood donations on-chain
 *  2. Mint BDC (ERC-20) reward tokens to donors
 *  3. Mint soulbound NFT donation certificates (ERC-721)
 *  4. Maintain on-chain stats: total donations, total BDC issued
 *  5. Provide public verification function for any external auditor
 *
 * Access Control Roles:
 *  - DEFAULT_ADMIN_ROLE  -> Contract deployer; can grant/revoke all roles
 *  - OPERATOR_ROLE       -> BloodLink backend server wallet; calls recordDonation()
 *  - HOSPITAL_ROLE       -> Verified hospital wallets
 *
 * Security:
 *  - ReentrancyGuard on recordDonation()
 *  - Pausable for emergency stop
 *  - Duplicate donationId rejected
 *  - Zero-address checks
 *  - Empty hash check
 *  - donationHash verified off-chain before calling (backend responsibility)
 *
 * Donation Flow:
 *  Backend calls recordDonation() after:
 *    1. Donor confirms    (off-chain)
 *    2. Hospital confirms (off-chain with bloodBagId)
 *    3. Frontend sends MetaMask tx -> this function
 *    4. Backend verifies keccak256 hash matches -> stores txHash in MongoDB
 */
contract BloodLinkRegistry is AccessControl, ReentrancyGuard, Pausable {

    // -- Roles ----------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant HOSPITAL_ROLE = keccak256("HOSPITAL_ROLE");

    // -- Structs --------------------------------------------------------------

    struct DonationRecord {
        uint256 donationId;      // Off-chain MongoDB donation _id
        address donor;           // Donor's wallet address
        address hospital;        // Hospital's wallet address
        bytes32 donationHash;    // keccak256(bloodBagId + donorWallet + timestamp)
        uint256 bdcAwarded;      // BDC minted (in wei, always DONATION_REWARD)
        uint256 nftTokenId;      // DonationCertificate token ID
        uint256 timestamp;       // block.timestamp at recording
        bool    exists;          // guard against uninitialized reads
    }

    struct HospitalInfo {
        string  name;
        bool    active;
        uint256 registeredAt;
        uint256 totalDonationsHandled;
    }

    // -- State ----------------------------------------------------------------

    BDCToken             public bdcToken;
    DonationCertificate  public nftCertificate;

    /// @notice donationId (off-chain) -> DonationRecord
    mapping(uint256 => DonationRecord) public donations;

    /// @notice donor wallet -> array of donationIds they completed
    mapping(address => uint256[]) public donorDonationIds;

    /// @notice hospital wallet -> HospitalInfo
    mapping(address => HospitalInfo) public hospitals;

    /// @notice Platform-wide counters
    uint256 public totalDonations;
    uint256 public totalBDCIssued;     // in wei
    uint256 public totalNFTsMinted;

    // -- Events ---------------------------------------------------------------

    event DonationRecorded(
        uint256 indexed donationId,
        address indexed donor,
        address indexed hospital,
        bytes32 donationHash,
        uint256 bdcAwarded,
        uint256 nftTokenId,
        uint256 timestamp
    );

    event HospitalRegistered(address indexed hospital, string name);
    event HospitalRevoked(address indexed hospital);
    event OperatorSet(address indexed operator);
    event OperatorRevoked(address indexed operator);
    event ContractPaused(address indexed by);
    event ContractUnpaused(address indexed by);

    // -- Errors ---------------------------------------------------------------

    error DonationAlreadyRecorded(uint256 donationId);
    error InvalidDonorAddress();
    error InvalidHospitalAddress();
    error EmptyDonationHash();
    error EmptyNFTUri();
    error HospitalNotActive(address hospital);
    error ZeroAddress();

    // -- Constructor ----------------------------------------------------------

    /**
     * @param admin         Deployer address - receives DEFAULT_ADMIN_ROLE + OPERATOR_ROLE
     * @param _bdcToken     Address of the deployed BDCToken contract
     * @param _nftCert      Address of the deployed DonationCertificate contract
     */
    constructor(
        address admin,
        address _bdcToken,
        address _nftCert
    ) {
        if (admin     == address(0)) revert ZeroAddress();
        if (_bdcToken == address(0)) revert ZeroAddress();
        if (_nftCert  == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE,      admin);

        bdcToken       = BDCToken(_bdcToken);
        nftCertificate = DonationCertificate(_nftCert);
    }

    // -- Core: Record Donation ------------------------------------------------

    /**
     * @notice Record a verified blood donation on-chain.
     *         Mints 100 BDC and a soulbound NFT certificate to the donor.
     *
     * @dev Called by the backend OPERATOR wallet after:
     *      - donorConfirmed = true
     *      - receiverConfirmed = true
     *      - bloodBagId is set
     *      - keccak256 hash verified server-side
     *
     * @param donationId   Off-chain MongoDB donation _id (as uint256)
     * @param donor        Donor's MetaMask wallet address
     * @param hospital     Hospital's registered wallet address
     * @param donationHash keccak256(bloodBagId + donorWallet + donorConfirmedAt ISO string)
     * @param nftTokenURI  IPFS URI for NFT metadata JSON
     */
    function recordDonation(
        uint256         donationId,
        address         donor,
        address         hospital,
        bytes32         donationHash,
        string calldata nftTokenURI
    )
        external
        onlyRole(OPERATOR_ROLE)
        nonReentrant
        whenNotPaused
    {
        // -- Guards -----------------------------------------------------------
        if (donations[donationId].exists)   revert DonationAlreadyRecorded(donationId);
        if (donor    == address(0))         revert InvalidDonorAddress();
        if (hospital == address(0))         revert InvalidHospitalAddress();
        if (donationHash == bytes32(0))     revert EmptyDonationHash();
        if (bytes(nftTokenURI).length == 0) revert EmptyNFTUri();

        // -- Mint BDC reward --------------------------------------------------
        bdcToken.mintReward(donor, donationId);
        uint256 bdcAmount = bdcToken.DONATION_REWARD();

        // -- Mint soulbound NFT certificate -----------------------------------
        uint256 nftTokenId = nftCertificate.mintCertificate(donor, nftTokenURI, donationId);

        // -- Store immutable on-chain record ----------------------------------
        donations[donationId] = DonationRecord({
            donationId:   donationId,
            donor:        donor,
            hospital:     hospital,
            donationHash: donationHash,
            bdcAwarded:   bdcAmount,
            nftTokenId:   nftTokenId,
            timestamp:    block.timestamp,
            exists:       true
        });

        donorDonationIds[donor].push(donationId);

        // -- Update counters --------------------------------------------------
        totalDonations++;
        totalBDCIssued  += bdcAmount;
        totalNFTsMinted++;

        // Update hospital counter if registered
        if (hospitals[hospital].active) {
            hospitals[hospital].totalDonationsHandled++;
        }

        emit DonationRecorded(
            donationId,
            donor,
            hospital,
            donationHash,
            bdcAmount,
            nftTokenId,
            block.timestamp
        );
    }

    // -- Verification ---------------------------------------------------------

    /**
     * @notice Public audit function: verify a donation hash matches the on-chain record.
     * @param donationId    Off-chain donation ID
     * @param hashToVerify  Hash to check against stored record
     * @return valid        True if donation exists and hash matches
     * @return timestamp    Block timestamp when donation was recorded
     */
    function verifyDonation(uint256 donationId, bytes32 hashToVerify)
        external
        view
        returns (bool valid, uint256 timestamp)
    {
        DonationRecord storage d = donations[donationId];
        if (!d.exists) return (false, 0);
        valid     = (d.donationHash == hashToVerify);
        timestamp = d.timestamp;
    }

    /**
     * @notice Get full donation record by ID.
     */
    function getDonation(uint256 donationId)
        external
        view
        returns (DonationRecord memory)
    {
        return donations[donationId];
    }

    /**
     * @notice Get all donationIds completed by a donor wallet.
     */
    function getDonorHistory(address donor)
        external
        view
        returns (uint256[] memory)
    {
        return donorDonationIds[donor];
    }

    /**
     * @notice Convenience: total number of donations by a donor.
     */
    function getDonorDonationCount(address donor) external view returns (uint256) {
        return donorDonationIds[donor].length;
    }

    /**
     * @notice Get platform-wide statistics.
     */
    function getPlatformStats()
        external
        view
        returns (
            uint256 _totalDonations,
            uint256 _totalBDCIssued,
            uint256 _totalNFTsMinted,
            uint256 _totalBDCIssuedFormatted
        )
    {
        _totalDonations          = totalDonations;
        _totalBDCIssued          = totalBDCIssued;
        _totalNFTsMinted         = totalNFTsMinted;
        _totalBDCIssuedFormatted = totalBDCIssued / 10 ** 18;
    }

    // -- Hospital Management --------------------------------------------------

    /**
     * @notice Register a hospital wallet. Grants HOSPITAL_ROLE.
     * @param hospital  Hospital wallet address
     * @param name      Hospital display name
     */
    function registerHospital(address hospital, string calldata name)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        if (hospital == address(0)) revert ZeroAddress();
        _grantRole(HOSPITAL_ROLE, hospital);
        hospitals[hospital] = HospitalInfo({
            name:                  name,
            active:                true,
            registeredAt:          block.timestamp,
            totalDonationsHandled: 0
        });
        emit HospitalRegistered(hospital, name);
    }

    /**
     * @notice Revoke a hospital. Removes HOSPITAL_ROLE and marks inactive.
     */
    function revokeHospital(address hospital)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        _revokeRole(HOSPITAL_ROLE, hospital);
        hospitals[hospital].active = false;
        emit HospitalRevoked(hospital);
    }

    // -- Operator Management --------------------------------------------------

    /**
     * @notice Grant OPERATOR_ROLE to a backend wallet.
     */
    function setOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (operator == address(0)) revert ZeroAddress();
        _grantRole(OPERATOR_ROLE, operator);
        emit OperatorSet(operator);
    }

    /**
     * @notice Revoke OPERATOR_ROLE from a wallet.
     */
    function revokeOperator(address operator) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(OPERATOR_ROLE, operator);
        emit OperatorRevoked(operator);
    }

    // -- Emergency Controls ---------------------------------------------------

    /**
     * @notice Pause all donation recording (emergency use only).
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
        emit ContractPaused(msg.sender);
    }

    /**
     * @notice Unpause donation recording.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
        emit ContractUnpaused(msg.sender);
    }
}

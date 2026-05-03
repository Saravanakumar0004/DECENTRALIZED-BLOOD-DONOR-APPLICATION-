// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DonationCertificate
 * @author BloodLink - Team Web Breach
 * @notice Soulbound (non-transferable) ERC-721 NFT minted per completed blood donation.
 *
 * Key design decisions:
 * - SOULBOUND: tokens cannot be transferred after minting (EIP-5192 pattern).
 *   Only owner can burn their own certificate.
 * - Each token's URI points to IPFS metadata (name, blood group, hospital, date, BDC earned).
 * - Token IDs are sequential, globally unique.
 * - Only the BloodLinkRegistry can mint.
 *
 * Metadata JSON format (stored on IPFS):
 * {
 *   "name": "BloodLink Donation Certificate #42",
 *   "description": "Verified blood donation on BloodLink",
 *   "image": "ipfs://Qm.../badge.png",
 *   "attributes": [
 *     { "trait_type": "Blood Group",   "value": "O+" },
 *     { "trait_type": "Hospital",      "value": "Apollo Hospitals Chennai" },
 *     { "trait_type": "Donation Date", "value": "2026-04-12" },
 *     { "trait_type": "BDC Earned",    "value": "100" },
 *     { "trait_type": "Donation ID",   "value": "42" }
 *   ]
 * }
 */
contract DonationCertificate is ERC721, ERC721URIStorage, ERC721Burnable, Ownable {

    // -- State ----------------------------------------------------------------

    /// @notice The registry contract - only minter allowed
    address public registry;

    /// @dev Sequential token ID counter (OZ v4 compatible)
    uint256 private _nextTokenId;

    /// @notice Maps tokenId -> donationId (off-chain reference)
    mapping(uint256 => uint256) public tokenDonationId;

    /// @notice Maps donationId -> tokenId (reverse lookup)
    mapping(uint256 => uint256) public donationTokenId;

    /// @notice Maps donor address -> list of their token IDs
    mapping(address => uint256[]) private _donorTokens;

    // -- Events ---------------------------------------------------------------

    event CertificateMinted(
        address indexed donor,
        uint256 indexed tokenId,
        uint256 indexed donationId,
        string  tokenURI
    );
    event CertificateBurned(address indexed donor, uint256 indexed tokenId);
    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);

    // -- Errors ---------------------------------------------------------------

    error OnlyRegistry(address caller, address registry_);
    error ZeroAddress();
    error SoulboundToken(uint256 tokenId);
    error DonationAlreadyCertified(uint256 donationId);

    // -- Modifiers ------------------------------------------------------------

    modifier onlyRegistry() {
        if (msg.sender != registry) revert OnlyRegistry(msg.sender, registry);
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor() ERC721("BloodLink Donation Certificate", "BLDC") {}

    // -- Admin ----------------------------------------------------------------

    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        address old = registry;
        registry = _registry;
        emit RegistrySet(old, _registry);
    }

    // -- Minting --------------------------------------------------------------

    /**
     * @notice Mint a soulbound donation certificate NFT.
     * @param donor      Donor's wallet address (receives the NFT)
     * @param tokenURI_  IPFS URI for the metadata JSON
     * @param donationId Off-chain MongoDB donation ID
     * @return tokenId   The newly minted token ID
     */
    function mintCertificate(
        address donor,
        string calldata tokenURI_,
        uint256 donationId
    ) external onlyRegistry returns (uint256 tokenId) {
        if (donor == address(0)) revert ZeroAddress();
        if (donationTokenId[donationId] != 0) revert DonationAlreadyCertified(donationId);

        tokenId = _nextTokenId++;
        _safeMint(donor, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        // Store bidirectional mappings
        tokenDonationId[tokenId]    = donationId;
        donationTokenId[donationId] = tokenId;
        _donorTokens[donor].push(tokenId);

        emit CertificateMinted(donor, tokenId, donationId, tokenURI_);
    }

    // -- Soulbound enforcement ------------------------------------------------

    /**
     * @dev Override _beforeTokenTransfer to block all transfers except mint/burn.
     *      In OZ v4, this hook fires before every transfer including mint and burn.
     *      from == address(0) means minting; to == address(0) means burning.
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 tokenId,
        uint256 batchSize
    ) internal override(ERC721) {
        bool isMinting = (from == address(0));
        bool isBurning = (to   == address(0));

        if (!isMinting && !isBurning) {
            revert SoulboundToken(tokenId);
        }

        if (isBurning) {
            emit CertificateBurned(from, tokenId);
        }

        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    // -- View Functions -------------------------------------------------------

    /**
     * @notice Get all token IDs owned by a donor.
     */
    function tokensOfDonor(address donor) external view returns (uint256[] memory) {
        return _donorTokens[donor];
    }

    /**
     * @notice Total number of certificates minted.
     */
    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // -- Required overrides ---------------------------------------------------

    function _burn(uint256 tokenId)
        internal
        override(ERC721, ERC721URIStorage)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
        public view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}

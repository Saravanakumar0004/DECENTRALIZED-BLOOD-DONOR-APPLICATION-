// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BDCToken
 * @author BloodLink - Team Web Breach
 * @notice Blood Donor Coin (BDC) - ERC-20 reward token issued to blood donors.
 *
 * Key design decisions:
 * - Only the BloodLinkRegistry contract can mint (set via setRegistry)
 * - Holders can burn their own tokens (ERC20Burnable)
 * - ERC20Permit allows gasless approvals (EIP-2612)
 * - Fixed DONATION_REWARD of 100 BDC per verified donation
 * - Total supply is uncapped but minting is tightly access-controlled
 *
 * Token economics:
 *   Symbol:   BDC
 *   Decimals: 18 (standard)
 *   Reward:   100 BDC per completed donation
 *   Use cases: Hospital discounts, gym memberships, medical store credits
 */
contract BDCToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {

    // -- State ----------------------------------------------------------------

    /// @notice The BloodLinkRegistry contract address - the only allowed minter
    address public registry;

    /// @notice Fixed BDC reward per verified donation (100 BDC with 18 decimals)
    uint256 public constant DONATION_REWARD = 100 * 10 ** 18;

    // -- Events ---------------------------------------------------------------

    event RegistrySet(address indexed oldRegistry, address indexed newRegistry);
    event DonationRewarded(address indexed donor, uint256 amount, uint256 indexed donationId);

    // -- Errors ---------------------------------------------------------------

    error OnlyRegistry(address caller, address registry_);
    error ZeroAddress();

    // -- Modifiers ------------------------------------------------------------

    modifier onlyRegistry() {
        if (msg.sender != registry) revert OnlyRegistry(msg.sender, registry);
        _;
    }

    // -- Constructor ----------------------------------------------------------

    constructor()
        ERC20("Blood Donor Coin", "BDC")
        ERC20Permit("Blood Donor Coin")
    {}

    // -- Admin Functions ------------------------------------------------------

    /**
     * @notice Set the registry contract that is allowed to mint BDC.
     * @param _registry Address of the deployed BloodLinkRegistry contract
     */
    function setRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        address old = registry;
        registry = _registry;
        emit RegistrySet(old, _registry);
    }

    // -- Minting --------------------------------------------------------------

    /**
     * @notice Mint DONATION_REWARD BDC tokens to a donor.
     * @dev Called exclusively by BloodLinkRegistry after dual-confirmation.
     * @param donor      The donor's wallet address
     * @param donationId The off-chain MongoDB donation ID (for event tracking)
     */
    function mintReward(address donor, uint256 donationId) external onlyRegistry {
        if (donor == address(0)) revert ZeroAddress();
        _mint(donor, DONATION_REWARD);
        emit DonationRewarded(donor, DONATION_REWARD, donationId);
    }

    /**
     * @notice Mint a custom amount - for admin adjustments only.
     * @dev Only owner can call this (used for dispute resolution / bonus).
     */
    function mintCustom(address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        require(amount > 0, "BDCToken: amount must be > 0");
        _mint(to, amount);
    }

    // -- View Helpers ---------------------------------------------------------

    /**
     * @notice Returns BDC balance in human-readable form (divided by 1e18).
     */
    function balanceOfFormatted(address account) external view returns (uint256) {
        return balanceOf(account) / 10 ** decimals();
    }
}

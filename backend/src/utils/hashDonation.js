import { ethers } from 'ethers';
import logger from './logger.js';

/**
 * computeDonationHash — recreates the keccak256 hash the frontend
 * computed before triggering the MetaMask transaction.
 *
 * Hash input: keccak256( bloodBagId + donorWalletAddress + donorConfirmedAt_ISO )
 *
 * @param {string} bloodBagId        — Physical blood bag identifier
 * @param {string} donorWallet       — Donor Ethereum address (lowercase)
 * @param {Date}   donorConfirmedAt  — Timestamp of donor confirmation
 * @returns {string} 0x-prefixed keccak256 hex hash
 */
export const computeDonationHash = (bloodBagId, donorWallet, donorConfirmedAt) => {
  const raw = `${bloodBagId}${donorWallet.toLowerCase()}${donorConfirmedAt.toISOString()}`;
  return ethers.keccak256(ethers.toUtf8Bytes(raw));
};

/**
 * verifyDonationHash — compares the submitted hash against the recomputed one.
 * Returns true if they match (donation is authentic).
 */
export const verifyDonationHash = (bloodBagId, donorWallet, donorConfirmedAt, submittedHash) => {
  try {
    const expected = computeDonationHash(bloodBagId, donorWallet, donorConfirmedAt);
    return expected.toLowerCase() === submittedHash.toLowerCase();
  } catch (err) {
    logger.error(`Hash verification error: ${err.message}`);
    return false;
  }
};

/**
 * isValidTxHash — checks basic Ethereum tx hash format.
 */
export const isValidTxHash = (hash) => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

/**
 * isValidBlockchainHash — checks basic keccak256 hash format.
 */
export const isValidBlockchainHash = (hash) => {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
};

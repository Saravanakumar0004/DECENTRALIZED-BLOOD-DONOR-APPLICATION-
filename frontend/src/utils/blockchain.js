import { ethers } from 'ethers'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const ETHERSCAN_BASE   = import.meta.env.VITE_ETHERSCAN_BASE || 'https://sepolia.etherscan.io/tx/'

// Minimal ABI — only the functions we call
const ABI = [
  'function recordDonation(uint256 donationId, address donor, address hospital, bytes32 donationHash, string nftTokenURI) external',
  'event DonationRecorded(uint256 indexed donationId, address indexed donor, address indexed hospital, bytes32 donationHash, uint256 bdcAwarded, uint256 nftTokenId, uint256 timestamp)',
]

export async function connectWallet() {
  if (!window.ethereum) throw new Error('MetaMask not installed. Please install MetaMask to continue.')
  const provider = new ethers.BrowserProvider(window.ethereum)
  await provider.send('eth_requestAccounts', [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  return { provider, signer, address }
}

export async function getWalletAddress() {
  if (!window.ethereum) return null
  const provider = new ethers.BrowserProvider(window.ethereum)
  const accounts = await provider.listAccounts()
  return accounts[0]?.address || null
}

export function computeDonationHash(bloodBagId, donorWallet, isoTimestamp) {
  const raw = `${bloodBagId}${donorWallet.toLowerCase()}${isoTimestamp}`
  return ethers.keccak256(ethers.toUtf8Bytes(raw))
}

export async function recordOnChain({ donationId, bloodBagId, donorAddress, hospitalAddress, donorConfirmedAt, nftTokenURI = 'ipfs://placeholder' }) {
  const { signer } = await connectWallet()

  if (!CONTRACT_ADDRESS || CONTRACT_ADDRESS === '0x_your_deployed_registry_address') {
    throw new Error('Contract address not configured. Set VITE_CONTRACT_ADDRESS in .env')
  }

  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer)

  const donationHash = computeDonationHash(
    bloodBagId,
    donorAddress,
    new Date(donorConfirmedAt).toISOString()
  )

  const idBig = BigInt(donationId.replace(/[^0-9]/g, '').slice(0, 15) || '1')

  const tx      = await contract.recordDonation(idBig, donorAddress, hospitalAddress, donationHash, nftTokenURI)
  const receipt = await tx.wait()

  return {
    txHash:         receipt.hash,
    blockchainHash: donationHash,
    etherscanUrl:   `${ETHERSCAN_BASE}${receipt.hash}`,
  }
}

export const truncateAddress = (addr) =>
  addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : ''

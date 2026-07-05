import { ethers } from 'ethers';

// Bamboochain / Binance Smart Chain RPC URL
// Fallback to public BSC node
const RPC_URL = process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/';
const BMC_CONTRACT_ADDRESS = '0x812d9709f0A53982606b823Ee61d5CA216F7F9c0';

// Minimal ERC20/BEP20 ABI to get balance
const minABI = [
  // balanceOf
  {
    "constant":true,
    "inputs":[{"name":"_owner","type":"address"}],
    "name":"balanceOf",
    "outputs":[{"name":"balance","type":"uint256"}],
    "type":"function"
  },
  // decimals
  {
    "constant":true,
    "inputs":[],
    "name":"decimals",
    "outputs":[{"name":"","type":"uint8"}],
    "type":"function"
  }
];

export const getBmcBalance = async (walletAddress: string): Promise<number> => {
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BMC_CONTRACT_ADDRESS, minABI, provider) as any;
    
    const balance = await contract.balanceOf(walletAddress);
    const decimals = await contract.decimals();
    
    // Convert to readable number (usually 18 decimals)
    const formattedBalance = ethers.formatUnits(balance, decimals);
    return parseFloat(formattedBalance);
  } catch (error) {
    console.error('Error fetching BMC balance:', error);
    return 0; // Fallback to 0 if fails
  }
};

export const checkTokenBalance = getBmcBalance;

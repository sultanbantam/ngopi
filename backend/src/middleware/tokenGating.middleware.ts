import { prisma } from '../utils/prisma';
import { checkTokenBalance } from '../utils/blockchain';

/**
 * Memeriksa apakah pengguna memiliki saldo BMC yang cukup untuk bergabung ke grup tertentu.
 */
export const checkTokenGate = async (userId: string, groupId: string): Promise<boolean> => {
  try {
    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group) return false;

    // Jika tidak ada batasan balance, izinkan langsung
    if (group.min_bmc_balance <= 0) return true;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    
    // Jika user tidak mendaftarkan wallet, tolak akses ke token-gated room
    if (!user || !user.wallet_address) return false;

    const balance = await checkTokenBalance(user.wallet_address);
    return balance >= group.min_bmc_balance;
  } catch (error) {
    console.error('Token gating error:', error);
    return false;
  }
};

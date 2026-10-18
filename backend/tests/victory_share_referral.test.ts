import assert from 'assert';
import { GaplehShareService } from '../src/games/gapleh/GaplehShareService';
import { PointsService } from '../src/services/points.service';

console.log('================================================================');
console.log('--- TEST FITUR: REFERRAL REWARD DARI SHARE KEMENANGAN SOSMED ---');
console.log('================================================================\n');

// 1. Validasi link share kemenangan menyertakan query param referral ?ref=username
console.log('Test 1: Memverifikasi query referral di tautan kemenangan');
const share = GaplehShareService.generateShareContent({
  winType: 'nutup_balak6',
  username: 'sultanbantam',
  points: 500,
});

assert(share.targetUrl.includes('ref=sultanbantam'), 'targetUrl harus memuat ref=sultanbantam');
assert(share.shareLinks.whatsapp.includes('ref%3Dsultanbantam') || share.shareLinks.whatsapp.includes('ref=sultanbantam'), 'WhatsApp link harus memuat parameter ref');
assert(share.shareLinks.twitter.includes('ref%3Dsultanbantam') || share.shareLinks.twitter.includes('ref=sultanbantam'), 'Twitter link harus memuat parameter ref');
assert(share.shareLinks.facebook.includes('ref%3Dsultanbantam') || share.shareLinks.facebook.includes('ref=sultanbantam'), 'Facebook link harus memuat parameter ref');
console.log(`  ✅ PASS: Target URL dengan referral: ${share.targetUrl}`);
console.log(`  ✅ PASS: WhatsApp Link: ${share.shareLinks.whatsapp.slice(0, 80)}...`);

// 2. Validasi reward poin referral (+50 Poin) ketika kawan bergabung
console.log('\nTest 2: Memverifikasi user pemenang menerima +50 Poin saat kawan join');
const pointsService = PointsService.getInstance();
const initialBalance = pointsService.getOrCreateUserPoints('user_pemenang_sultan').balance;
const result = pointsService.earnReferralReward('user_pemenang_sultan', 'user_kawan_baru_01');

assert.strictEqual(result.pointsAdded, 50, 'Reward referral harus tepat +50 poin');
assert.strictEqual(result.newBalance, initialBalance + 50, 'Saldo harus bertambah +50 poin');
console.log(`  ✅ PASS: Poin berhasil ditambahkan: +${result.pointsAdded} Poin (Saldo baru: ${result.newBalance})`);

// 3. Validasi riwayat transaksi tercatat sebagai referral_reward
const history = pointsService.getTransactions('user_pemenang_sultan');
const lastTx = history[0];
assert(lastTx, 'Harus ada riwayat transaksi');
assert.strictEqual(lastTx.type, 'referral_reward', 'Tipe transaksi harus referral_reward');
assert.strictEqual(lastTx.amount, 50, 'Jumlah transaksi harus 50');
console.log(`  ✅ PASS: Riwayat transaksi: "${lastTx.description}" (+${lastTx.amount} Poin)`);

console.log('\n================================================================');
console.log('🎉 SEMUA TEST REFERRAL SHARE KEMENANGAN 100% SUKSES!');
console.log('================================================================');

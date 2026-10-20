import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import QRCode from 'qrcode';
import { prisma } from '../utils/prisma';
import { getSocketIO } from '../sockets';
import { MerchantService } from './merchant.service';

const AGREEMENTS_FILE = path.join(__dirname, '../../uploads/merchant_agreements.json');
const QR_DIR = path.join(__dirname, '../../uploads/qrcodes');

export interface MerchantAgreementData {
  id: string;
  user_id: string;
  username: string;
  owner_name?: string;
  cafe_name: string;
  address: string;
  phone: string;
  commercial_model: 'model_a' | 'model_b';
  agreement_text: string;
  is_agreed: boolean;
  signed_at?: string | null;
  qr_token?: string | null;
  qr_image_url?: string | null;
  warung_group_id?: string | null;
  created_at: string;
}

export class PartnershipService {
  private static loadAgreements(): MerchantAgreementData[] {
    try {
      if (fs.existsSync(AGREEMENTS_FILE)) {
        const raw = fs.readFileSync(AGREEMENTS_FILE, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[PartnershipService] Failed to load JSON fallback:', e);
    }
    return [];
  }

  private static saveAgreements(list: MerchantAgreementData[]): void {
    try {
      const dir = path.dirname(AGREEMENTS_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(AGREEMENTS_FILE, JSON.stringify(list, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[PartnershipService] Failed to save JSON fallback:', e);
    }
  }

  public static generateMoUText(params: {
    username: string;
    owner_name: string;
    cafe_name: string;
    address: string;
    phone: string;
    commercial_model: 'model_a' | 'model_b';
  }): string {
    const commercialText =
      params.commercial_model === 'model_b'
        ? 'Model B (Bagi Hasil): Pihak Kedua mendapat potongan 5% dari setiap transaksi F&B yang dilakukan melalui fitur Order di Ngopi.'
        : 'Model A (Gratis/Trial): Tidak ada biaya. Ngopi mengambil data engagement untuk case study.';

    return `PERJANJIAN KERJA SAMA KEMITRAAN DIGITAL
NGOPI x ${params.cafe_name.toUpperCase()}

PIHAK PERTAMA:
Ngopi (dioperasikan oleh BaMbooChain)
Website: https://bamboochain.id

PIHAK KEDUA:
Username Ngopi: @${params.username}
Nama Pemilik: ${params.owner_name}
Nama Cafe: ${params.cafe_name}
Alamat: ${params.address}
No. Telepon/WA: ${params.phone}

PASAL 1: RUANG LINGKUP KERJA SAMA
1. Pihak Pertama menyediakan platform aplikasi digital "Ngopi" (berbasis web dan PWA) untuk mendukung operasional dan komunitas Pihak Kedua.
2. Pihak Kedua menyediakan lokasi fisik (Cafe) sebagai titik lokasi (Check-in Point) pengguna Ngopi.

PASAL 2: FITUR DAN LAYANAN
1. Check-in Digital & Loyalty: Pihak Pertama menyediakan QR Code unik khusus untuk Pihak Kedua. Setiap pengguna Ngopi yang melakukan scan (maks. 1x sehari) akan mendapatkan 50 Poin Ngopi.
2. Merchant Dashboard: Pihak Pertama memberikan akses eksklusif kepada Pihak Kedua untuk melihat statistik kunjungan dan mengirim siaran promo (Broadcast) ke pengguna.
3. Event Komunitas: Pihak Kedua dapat mengadakan turnamen (Gapleh/Catur) yang difasilitasi sistem matchmaking dan leaderboard dari Ngopi.

PASAL 3: HAK DAN KEWAJIBAN
1. Hak Pihak Pertama: Mendapatkan data statistik anonim untuk pengembangan aplikasi dan promosi bersama.
2. Kewajiban Pihak Pertama: Menjaga kerahasiaan data pelanggan sesuai UU PDP dan memastikan sistem berjalan tanpa gangguan (uptime minimal 99%).
3. Hak Pihak Kedua: Mendapatkan traffic tambahan, promosi gratis di aplikasi, dan alat loyalitas pelanggan.
4. Kewajiban Pihak Kedua: Menyediakan QR Code fisik di meja, menghormati reward (misal: penukaran Poin dengan Kopi), dan menjaga reputasi baik di komunitas Ngopi.

PASAL 4: KETENTUAN KOMERSIAL
${commercialText}

PASAL 5: JANGKA WAKTU & PENGAKHIRAN
1. Perjanjian ini berlaku selama 1 (satu) tahun sejak tanggal persetujuan digital dan diperpanjang secara otomatis.
2. Salah satu pihak dapat mengakhiri kerja sama dengan pemberitahuan tertulis (via fitur chat Ngopi atau email) minimal 30 hari sebelumnya.

PASAL 6: PERSETUJUAN DIGITAL
Dengan menekan tombol "Setuju & Tandatangani" pada pop-up verifikasi yang muncul di akun Ngopi Pihak Kedua, Pihak Kedua menyatakan telah membaca, memahami, dan menyetujui seluruh isi perjanjian ini. Tanda tangan digital ini memiliki kekuatan hukum yang sah.`;
  }

  public static async getAgreementByUserId(userId: string): Promise<MerchantAgreementData | null> {
    try {
      const dbRecord = await (prisma as any).merchantAgreement.findUnique({
        where: { user_id: userId },
      });
      if (dbRecord) {
        return {
          id: dbRecord.id,
          user_id: dbRecord.user_id,
          username: dbRecord.username,
          cafe_name: dbRecord.cafe_name,
          address: dbRecord.address,
          phone: dbRecord.phone,
          commercial_model: dbRecord.commercial_model || 'model_a',
          agreement_text: dbRecord.agreement_text,
          is_agreed: dbRecord.is_agreed,
          signed_at: dbRecord.signed_at ? dbRecord.signed_at.toISOString() : null,
          qr_token: dbRecord.qr_token,
          qr_image_url: dbRecord.qr_image_url,
          warung_group_id: dbRecord.warung_group_id,
          created_at: dbRecord.created_at.toISOString(),
        };
      }
    } catch {}

    const list = this.loadAgreements();
    return list.find((a) => a.user_id === userId) || null;
  }

  public static async submitAgreement(params: {
    userId: string;
    username: string;
    owner_name: string;
    cafe_name: string;
    address: string;
    phone: string;
    commercial_model?: 'model_a' | 'model_b';
  }): Promise<{ success: boolean; agreement: MerchantAgreementData }> {
    const { userId, username, owner_name, cafe_name, address, phone, commercial_model = 'model_a' } = params;

    const agreementText = this.generateMoUText({
      username,
      owner_name,
      cafe_name,
      address,
      phone,
      commercial_model,
    });

    const now = new Date();
    let agreement: MerchantAgreementData = {
      id: `agr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      user_id: userId,
      username,
      owner_name,
      cafe_name: cafe_name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      commercial_model,
      agreement_text: agreementText,
      is_agreed: false,
      signed_at: null,
      created_at: now.toISOString(),
    };

    // Save to Prisma
    try {
      const dbSaved = await (prisma as any).merchantAgreement.upsert({
        where: { user_id: userId },
        update: {
          username,
          cafe_name: agreement.cafe_name,
          address: agreement.address,
          phone: agreement.phone,
          commercial_model: agreement.commercial_model,
          agreement_text: agreementText,
        },
        create: {
          id: agreement.id,
          user_id: userId,
          username,
          cafe_name: agreement.cafe_name,
          address: agreement.address,
          phone: agreement.phone,
          commercial_model: agreement.commercial_model,
          agreement_text: agreementText,
          is_agreed: false,
        },
      });
      agreement.id = dbSaved.id;
    } catch (e) {
      console.warn('[PartnershipService] Prisma upsert error, falling back to JSON:', e);
    }

    // Save to JSON fallback
    const list = this.loadAgreements();
    const existingIdx = list.findIndex((a) => a.user_id === userId);
    if (existingIdx !== -1) {
      list[existingIdx] = { ...list[existingIdx], ...agreement };
    } else {
      list.unshift(agreement);
    }
    this.saveAgreements(list);

    // Emit real-time WebSocket verification pop-up to user's socket room
    const io = getSocketIO();
    if (io) {
      io.to(userId).emit('partnership:request_verification', {
        agreement_id: agreement.id,
        user_id: userId,
        username,
        cafe_name: agreement.cafe_name,
        address: agreement.address,
        phone: agreement.phone,
        commercial_model: agreement.commercial_model,
        summary: `Perjanjian Kemitraan Digital antara Ngopi dan ${agreement.cafe_name}. Scan QR Code di meja untuk 50 Poin Ngopi & akses Merchant Dashboard.`,
      });
    }

    return { success: true, agreement };
  }

  public static async verifyAndSignAgreement(userId: string): Promise<{
    success: boolean;
    agreement: MerchantAgreementData;
    qr_token: string;
    qr_image_url: string;
    warung_group_id?: string;
    message: string;
  }> {
    let existing = await this.getAgreementByUserId(userId);
    if (!existing) {
      throw new Error('Data pengajuan kemitraan tidak ditemukan. Silakan isi formulir terlebih dahulu.');
    }

    const now = new Date();
    const cleanCafe = existing.cafe_name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    const qrToken = `NGOPI_${cleanCafe}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    // 1. Ensure QR Code directory exists
    if (!fs.existsSync(QR_DIR)) {
      fs.mkdirSync(QR_DIR, { recursive: true });
    }
    const qrFileName = `qr_${qrToken}.png`;
    const qrFilePath = path.join(QR_DIR, qrFileName);

    // Generate QR Code image file (pointing to digital checkin)
    const checkinUrl = `https://ngopi.top/checkin?token=${qrToken}&cafe=${encodeURIComponent(existing.cafe_name)}`;
    await QRCode.toFile(qrFilePath, checkinUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      margin: 2,
      width: 600,
      color: {
        dark: '#2c1810',
        light: '#ffffff',
      },
    });

    const qrImageUrl = `https://api.ngopi.top/uploads/qrcodes/${qrFileName}`;

    // 2. Update user role in User table
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'merchant' },
      });
    } catch (e) {
      console.warn('[PartnershipService] User role update error:', e);
    }

    // 3. Create or update MerchantProfile
    try {
      await MerchantService.registerOrUpdateProfile(userId, {
        cafe_name: existing.cafe_name,
        address: existing.address,
        phone: existing.phone,
        qr_code_token: qrToken,
        is_verified: true,
        reward_points: 50,
      });
    } catch (e) {
      console.warn('[PartnershipService] MerchantProfile sync error:', e);
    }

    // 4. Create Warung Kopi digital public group
    let warungGroupId: string | undefined;
    try {
      const group = await prisma.group.create({
        data: {
          name: `Warung Kopi ${existing.cafe_name}`,
          description: `Ruang nongkrong & komunitas digital resmi ${existing.cafe_name}. Scan QR Code di meja cafe untuk klaim 50 Poin Ngopi!`,
          avatar_url: qrImageUrl,
          created_by: userId,
          theme: 'warkop_klasik',
          members: {
            create: {
              user_id: userId,
              role: 'admin',
              status: 'active',
            },
          },
        },
      });
      warungGroupId = group.id;

      // Send welcome message into the group
      await prisma.message.create({
        data: {
          room_id: group.id,
          sender_id: userId,
          content: `🎉 Selamat bergabung, ${existing.cafe_name}!\n\nPerjanjian Kerja Sama Kemitraan Digital Ngopi telah resmi disetujui dan ditandatangani.\n\n📍 Lokasi: ${existing.address}\n📱 Kontak: ${existing.phone}\n☕ QR Code Meja: ${qrImageUrl}\n\nPengunjung cafe yang melakukan scan QR Code di meja akan otomatis mendapatkan 50 Poin Ngopi. Anda dapat memantau kunjungan dan mengelola promo melalui Merchant Dashboard.`,
          type: 'text',
          attachment_url: qrImageUrl,
        },
      });
    } catch (e) {
      console.warn('[PartnershipService] Group creation error (non-fatal):', e);
    }

    // 5. Update agreement status in Prisma & JSON fallback
    existing.is_agreed = true;
    existing.signed_at = now.toISOString();
    existing.qr_token = qrToken;
    existing.qr_image_url = qrImageUrl;
    existing.warung_group_id = warungGroupId || null;

    try {
      await (prisma as any).merchantAgreement.update({
        where: { user_id: userId },
        data: {
          is_agreed: true,
          signed_at: now,
          qr_token: qrToken,
          qr_image_url: qrImageUrl,
          warung_group_id: warungGroupId,
        },
      });
    } catch (e) {
      console.warn('[PartnershipService] Prisma update error:', e);
    }

    const list = this.loadAgreements();
    const idx = list.findIndex((a) => a.user_id === userId);
    if (idx !== -1) {
      list[idx] = existing;
    } else {
      list.unshift(existing);
    }
    this.saveAgreements(list);

    // 6. Emit real-time verified event via WebSocket
    const io = getSocketIO();
    if (io) {
      io.to(userId).emit('partnership:verified', {
        user_id: userId,
        cafe_name: existing.cafe_name,
        qr_token: qrToken,
        qr_image_url: qrImageUrl,
        warung_group_id: warungGroupId,
        signed_at: existing.signed_at,
      });
    }

    return {
      success: true,
      agreement: existing,
      qr_token: qrToken,
      qr_image_url: qrImageUrl,
      warung_group_id: warungGroupId,
      message: `Selamat! Kerja sama kemitraan untuk "${existing.cafe_name}" telah disahkan secara digital. QR Code meja Anda telah aktif!`,
    };
  }
}

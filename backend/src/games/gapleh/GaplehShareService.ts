export interface ShareHookParams {
  winType: 'nutup_balak6' | 'nutup_balak0' | 'digapleh' | 'gapleh_biasa' | string;
  username: string;
  points: number;
  streakCount?: number;
  isFirstNutup?: boolean;
  hookTemplateId?: string;
  designTemplate?: 'neon_cyberpunk' | 'retro_warkop' | 'modern_minimalist' | 'cinematic_dramatic';
}

export interface ShareResult {
  caption: string;
  hooks: string[];
  hashtags: string[];
  shareLinks: {
    whatsapp: string;
    twitter: string;
    facebook: string;
  };
  designTemplate: string;
  targetUrl: string;
}

export const HOOK_TEMPLATES = {
  nutup_balak6: [
    'NUTUP PAKAI BALAK 6! 💀🔥 {username} baru aja bikin lawan nelangsa di Ngopi!',
    'BALAK 6! Gapleh dalam 3 menit! Siapa yang berani lawan aku? 😎 #NgopiGapleh',
    '5️⃣0️⃣0️⃣ POIN! Nutup pakai Balak 6 di Ngopi! Ini namanya gapleh kelas jagal 🐐',
    'GAK NYANGKA! Balak 6 nutup gapleh! Cobain di ngopi.top ☕🁫',
    'Sumpah, ini gapleh paling epic! Nutup pakai Balak 6, auto 500 poin! 🎯',
  ],
  nutup_balak0: [
    'BALAK 0! Nutup zero, 500 poin melayang! 🎯 Siapa lawan? #Ngopi',
    '0️⃣ BALAK 0! NUTUP! Momen paling mematikan di Gapleh Ngopi! ☕🔥',
    'NUTUP ZERO! Nih bukti kalau Ngopi itu bukan sekadar aplikasi chat! 😎',
    '500 POIN! Balak 0 nutup gapleh! Yang mau main, ngopi.top! 🁫',
    'Zero to hero! Balak 0 nutup gapleh! 💀🔥',
  ],
  digapleh: [
    'BUKAN GAPLEH BIASA! Ini DIGAPLEH! +75 poin! 🁫🔒',
    'DIGAPLEH! Buntu tapi menang! Cuma di Ngopi! ☕',
    'Semua masih punya kartu, tapi gak ada yang bisa jalan! DIGAPLEH! 🔒',
  ],
  streak: [
    'NUTUP TERUS! Streak {streak}x nutup di Ngopi! Aku GAPLEH JAGAL! 🐐',
    'Balak 6 + Balak 0 = mimpi buruk lawan! Streak {streak}x di Ngopi! 💀',
    '500 poin x{streak} = {total_points} poin! Aku raja gapleh Ngopi! 👑',
  ],
  first_time_nutup: [
    'PERTAMA KALI NUTUP BALAK 6! 1.500 POIN! 🎉 Ini momen bersejarah!',
    'Baru pertama kali main, langsung nutup balak 0! 1.500 poin! 🁫🔥',
  ],
  gapleh_biasa: [
    'GAPLEH TELAK! Kartu habis tak bersisa di warkop digital Ngopi! ☕🏆',
    'Menang Gapleh lagi di Ngopi! Yang mau ngopi sambil main kartu, merapat ke ngopi.top! 🁫✨',
    'Sensasi gapleh warkop ada di genggaman! Nongkrong seru cuma di ngopi.top ☕🁫',
  ],
};

export const DEFAULT_HASHTAGS = ['NgopiGapleh', 'GaplehIndonesia'];

export class GaplehShareService {
  public static getHooksForWinType(winType: string, streakCount = 0, isFirstNutup = false): string[] {
    const list: string[] = [];

    if (isFirstNutup) {
      list.push(...HOOK_TEMPLATES.first_time_nutup);
    }

    if (streakCount >= 2) {
      list.push(...HOOK_TEMPLATES.streak);
    }

    if (winType === 'nutup_balak6') {
      list.push(...HOOK_TEMPLATES.nutup_balak6);
    } else if (winType === 'nutup_balak0') {
      list.push(...HOOK_TEMPLATES.nutup_balak0);
    } else if (winType === 'digapleh') {
      list.push(...HOOK_TEMPLATES.digapleh);
    } else {
      list.push(...HOOK_TEMPLATES.gapleh_biasa);
    }

    return list.length > 0 ? list : HOOK_TEMPLATES.gapleh_biasa;
  }

  public static generateShareContent(params: ShareHookParams): ShareResult {
    const {
      winType,
      username,
      points,
      streakCount = 0,
      isFirstNutup = false,
      hookTemplateId,
      designTemplate = 'neon_cyberpunk',
    } = params;

    const availableHooks = this.getHooksForWinType(winType, streakCount, isFirstNutup);
    let selectedRaw = hookTemplateId || availableHooks[Math.floor(Math.random() * availableHooks.length)]!;

    // Interpolate placeholders
    const formattedUsername = username.startsWith('@') ? username : `@${username}`;
    let caption = selectedRaw
      .replace(/{username}/g, formattedUsername)
      .replace(/{streak}/g, String(Math.max(streakCount, 1)))
      .replace(/{total_points}/g, (points || 500).toLocaleString('id-ID'));

    if (!caption.includes(formattedUsername)) {
      caption = `${caption} — ${formattedUsername}`;
    }

    // Dynamic hashtags based on win type
    const hashtags = [...DEFAULT_HASHTAGS];
    if (winType === 'nutup_balak6') hashtags.push('NutupBalak6', 'GaplehJagal');
    if (winType === 'nutup_balak0') hashtags.push('NutupBalak0', 'BalakNol');
    if (winType === 'digapleh') hashtags.push('Digapleh', 'GaplehBuntu');
    if (streakCount >= 2) hashtags.push(`Streak${streakCount}x`);

    const cleanUsername = (username || '').replace(/^@/, '');
    const targetUrl = cleanUsername ? `https://ngopi.top?ref=${encodeURIComponent(cleanUsername)}` : 'https://ngopi.top';
    const hashtagsText = hashtags.map((h) => `#${h}`).join(' ');

    const shareLinks = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${caption}\n\n${hashtagsText}\nMain bareng di: ${targetUrl}`)}`,
      twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(caption)}&url=${encodeURIComponent(targetUrl)}&hashtags=${encodeURIComponent(hashtags.join(','))}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(targetUrl)}&quote=${encodeURIComponent(caption)}`,
    };

    return {
      caption,
      hooks: availableHooks.map((h) =>
        h
          .replace(/{username}/g, formattedUsername)
          .replace(/{streak}/g, String(Math.max(streakCount, 1)))
          .replace(/{total_points}/g, (points || 500).toLocaleString('id-ID'))
      ),
      hashtags,
      shareLinks,
      designTemplate,
      targetUrl,
    };
  }
}

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from './storage';
import { syncAndroidLanguageCode } from '../components/cekkes/nativeAndroidBridge';

export type AppLanguage = 'id' | 'en';
const LANG_KEY = 'ngopi_lang';
const LEGACY_LANG_KEY = 'ngopi_app_language';

interface LanguageContextValue {
  lang: AppLanguage;
  setLang: (next: AppLanguage) => void;
  toggleLang: () => void;
  t: (idText: string, enText: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'id',
  setLang: () => {},
  toggleLang: () => {},
  t: (idText) => idText,
});

// Comprehensive UI phrase dictionary for lossless ID <-> EN DOM translation across all ngopi.top pages
const ID_TO_EN_PHRASES: Array<[string, string]> = [
  // Header & Warkop
  ['Warung Kopi', 'Coffee Lounge'],
  ['MUSIK WARKOP', 'LOUNGE MUSIC'],
  ['Identitas Ngopi', 'Ngopi Identity'],
  ['Ombak Pantai', 'Ocean Waves'],
  ['Kafe Ramai', 'Busy Cafe'],
  ['Hutan Senja', 'Twilight Forest'],
  ['Jangkrik Malam', 'Night Crickets'],
  ['Api Unggun', 'Campfire'],
  ['Album Mixtape', 'Mixtape Album'],
  ['Check-in Cafe (+50)', 'Cafe Check-in (+50)'],
  ['Minta Tebakan', 'Ask Riddle'],
  ['Sapa Warung', 'Greet Lounge'],
  ['Ketik pesan di Warung Kopi...', 'Type a message in Coffee Lounge...'],
  ['Ketik pesan di Coffee Lounge...', 'Type a message in Coffee Lounge...'],
  ['Tips: Account Settings & Profil', 'Tips: Account Settings & Profile'],
  ['Menghubungkan', 'Connecting'],
  ['Anggota', 'Members'],
  ['anggota', 'members'],

  // Warkop Drawer & Navigation
  ['Kemitraan Cafe (MoU)', 'Cafe Partnership (MoU)'],
  ['Kemitraan Cafe', 'Cafe Partnership'],
  ['Merchant Dashboard (Bisnis)', 'Merchant Dashboard (Business)'],
  ['ceKKes (Cek Kesehatan Mandiri)', 'ceKKes (Self Health Check)'],
  ['Alih Bahasa', 'Live Translator'],
  ['Pusat Bantuan', 'Help Center'],
  ['Papan Peringkat', 'Leaderboard'],
  ['Pengaturan Akun', 'Account Settings'],
  ['Profil Saya', 'My Profile'],
  ['Privasi', 'Privacy'],
  ['Syarat & Ketentuan', 'Terms & Conditions'],
  ['Mode Malam', 'Night Mode'],
  ['Keluar', 'Sign Out'],
  ['Kembali', 'Back'],
  ['Tutup', 'Close'],
  ['Batal', 'Cancel'],
  ['Simpan', 'Save'],
  ['Kirim', 'Send'],
  ['Hapus', 'Delete'],
  ['Balas', 'Reply'],

  // Contacts & Auth
  ['Belum dibaca', 'Unread'],
  ['Favorit', 'Favorites'],
  ['Semua', 'All'],
  ['+ Buat Warkop Baru', '+ Create New Warkop'],
  ['Buat Warkop Baru', 'Create New Warkop'],
  ['Masuk ke Aplikasi', 'Sign In to App'],
  ['Daftar', 'Register'],
  ['Masuk', 'Sign In'],

  // NGOPINOMIC
  ['1. Identitas Ngopi', '1. Ngopi Identity'],
  ['2. Nomor & Email Ngopi', '2. Ngopi Number & Email'],
  ['3. Poin Ngopi', '3. Ngopi Points'],
  ['Check-in Harian (+10)', 'Daily Check-in (+10)'],
  ['Check-in Harian', 'Daily Check-in'],
  ['4. Komisi Saya', '4. My Commission'],
  ['Siap Dicairkan', 'Ready to Withdraw'],
  ['Menunggu Penyelesaian', 'Pending Settlement'],
  ['5. Manfaat BMC', '5. BMC Utility'],
  ['Status Gerbang: Mode Konfigurasi', 'Gateway Status: Configuration Mode'],
  ['6. Undang Teman & Kode Profil', '6. Invite Friends & Profile Code'],
  ['Salin Tautan Undang Teman', 'Copy Invite Link'],

  // Pi Network, Pustaka, & Transfer Poin
  ['π Top-up Pi', 'π Pi Pay'],
  ['Pembayaran Pi Network (Testnet)', 'Pi Network Payments (Testnet)'],
  ['Beli Poin Ngopi', 'Buy Ngopi Points'],
  ['Beli Identitas Ngopi', 'Buy Ngopi Identity'],
  ['Riwayat Pi', 'Pi History'],
  ['Kirim Poin', 'Send Points'],
  ['Transfer Poin Ngopi', 'Transfer Ngopi Points'],
  ['Ngopi Pustaka', 'Ngopi Library'],
  ['Perpustakaan Komunitas & Studio Penulis', 'Community Library & Writer Studio'],
  ['Perpustakaan', 'Library'],
  ['Studio Penulis', 'Writer Studio'],
  ['Mulai Menulis', 'Start Writing'],
  ['Terbitkan ke Perpustakaan', 'Publish to Library'],
  ['Kirim Tip', 'Send Tip'],
  ['Apresiasi Penulis dengan Poin Ngopi', 'Tip Author with Ngopi Points'],
  ['Belum ada karya di kategori ini', 'No works in this category yet'],
  ['Fiksi', 'Fiction'],
  ['Esai', 'Essay'],
  ['Puisi', 'Poetry'],
  ['Edukasi', 'Education'],
  ['Komunitas', 'Community'],
  ['Kode Anda:', 'Your Code:'],
  ['teman', 'friends'],
  ['Pakai', 'Apply'],
  ['Tanda Tangani MoU Digital', 'Sign Digital MoU'],
  ['Ekonomi Ngopi & BMC Token', 'Ngopi Economy & BMC Token'],
  ['Klaim Streak Harian', 'Claim Daily Streak'],
  ['Poin Ngopi', 'Ngopi Points'],
  ['Poin', 'Pts'],

  // Alih Bahasa
  ['Mulai Rekam', 'Start Recording'],
  ['Hentikan', 'Stop'],
  ['Jeda', 'Pause'],
  ['Lanjutkan', 'Resume'],
  ['Suara Wanita', 'Female Voice'],
  ['Suara Pria', 'Male Voice'],
  ['Mode Headset', 'Headset Mode'],
  ['Balasan Cerdas AI', 'AI Smart Replies'],
  ['Ketuk untuk berbicara', 'Tap to speak'],
  ['Sumber Suara', 'Voice Source'],
  ['Bahasa Target', 'Target Language'],
  ['Bersihkan', 'Clear'],
  ['Riwayat Terjemahan', 'Translation History'],
];

const originalTextMap = new WeakMap<Text, string>();
const originalPlaceholderMap = new WeakMap<Element, string>();

function translateStringIdToEn(raw: string): string {
  if (!raw || !raw.trim()) return raw;
  let out = raw;
  for (const [idPhrase, enPhrase] of ID_TO_EN_PHRASES) {
    if (idPhrase === 'Poin') {
      out = out.replace(/\bPoin\b/g, enPhrase);
    } else if (out.includes(idPhrase)) {
      out = out.split(idPhrase).join(enPhrase);
    }
  }
  return out;
}

function applyDomTranslation(lang: AppLanguage) {
  if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.body) return;

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'TEXTAREA') {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest('[data-no-i18n="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) {
    textNodes.push(n as Text);
  }

  for (const tNode of textNodes) {
    const cur = tNode.nodeValue || '';
    if (!cur.trim()) continue;
    if (lang === 'en') {
      if (!originalTextMap.has(tNode)) {
        originalTextMap.set(tNode, cur);
      }
      const orig = originalTextMap.get(tNode) || cur;
      const next = translateStringIdToEn(orig);
      if (next !== cur) {
        tNode.nodeValue = next;
      }
    } else if (originalTextMap.has(tNode)) {
      const orig = originalTextMap.get(tNode)!;
      if (cur !== orig) {
        tNode.nodeValue = orig;
      }
    }
  }

  // Translate input/textarea placeholders
  const inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
  inputs.forEach((el) => {
    const curPh = el.getAttribute('placeholder') || '';
    if (!curPh) return;
    if (lang === 'en') {
      if (!originalPlaceholderMap.has(el)) {
        originalPlaceholderMap.set(el, curPh);
      }
      const origPh = originalPlaceholderMap.get(el) || curPh;
      const nextPh = translateStringIdToEn(origPh);
      if (nextPh !== curPh) {
        el.setAttribute('placeholder', nextPh);
      }
    } else if (originalPlaceholderMap.has(el)) {
      const origPh = originalPlaceholderMap.get(el)!;
      if (curPh !== origPh) {
        el.setAttribute('placeholder', origPh);
      }
    }
  });
}

function readInitialLang(): AppLanguage {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.localStorage) {
        const v = window.localStorage.getItem(LANG_KEY) || window.localStorage.getItem(LEGACY_LANG_KEY);
        if (v === 'en' || v === 'id') return v;
      }
      const navLang = (
        window.navigator?.language ||
        (Array.isArray(window.navigator?.languages) ? window.navigator.languages[0] : '') ||
        ''
      ).toLowerCase();
      if (navLang && !navLang.startsWith('id') && !navLang.startsWith('ms')) {
        return 'en';
      }
    }
  } catch {
    // ignore
  }
  return 'id';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<AppLanguage>(readInitialLang);

  useEffect(() => {
    SecureStore.getItemAsync(LANG_KEY)
      .then((v) => {
        if (v === 'en' || v === 'id') setLangState(v);
      })
      .catch(() => {});
  }, []);

  // Apply global DOM translation + observe dynamic route/modal renders on Web
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !document.body) return;

    let rafId: number | null = null;
    const run = () => {
      rafId = null;
      applyDomTranslation(lang);
    };
    run();

    const observer = new MutationObserver(() => {
      if (lang !== 'en') return;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(run);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [lang]);

  const setLang = useCallback((next: AppLanguage) => {
    setLangState(next);
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(LANG_KEY, next);
      }
    } catch {
      // ignore
    }
    SecureStore.setItemAsync(LANG_KEY, next).catch(() => {});
    syncAndroidLanguageCode(next).catch(() => {});
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'id' ? 'en' : 'id');
  }, [lang, setLang]);

  const t = useCallback(
    (idText: string, enText: string) => (lang === 'en' ? enText : idText),
    [lang]
  );

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

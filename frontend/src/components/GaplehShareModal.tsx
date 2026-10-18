import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
  Alert,
  Share as RNShare,
  Linking,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { coffee } from '../theme/coffee';
import axios from 'axios';

const API_URL = 'https://api.ngopi.top/api';

export type DesignTemplateType = 'neon_cyberpunk' | 'retro_warkop' | 'modern_minimalist' | 'cinematic_dramatic';

export interface GaplehShareData {
  winType: 'nutup_balak6' | 'nutup_balak0' | 'digapleh' | 'gapleh_biasa' | string;
  username: string;
  pointsEarned: number;
  streakCount?: number;
  isFirstNutup?: boolean;
  totalPoints?: number;
}

interface GaplehShareModalProps {
  visible: boolean;
  onClose: () => void;
  data: GaplehShareData;
}

const TEMPLATE_OPTIONS: Array<{ id: DesignTemplateType; label: string; icon: string }> = [
  { id: 'neon_cyberpunk', label: 'Cyberpunk', icon: 'flash' },
  { id: 'retro_warkop', label: 'Retro Warkop', icon: 'cafe' },
  { id: 'modern_minimalist', label: 'Modern', icon: 'apps' },
  { id: 'cinematic_dramatic', label: 'Cinematic', icon: 'film' },
];

export default function GaplehShareModal({ visible, onClose, data }: GaplehShareModalProps) {
  const [currentTemplate, setCurrentTemplate] = useState<DesignTemplateType>('retro_warkop');
  const [caption, setCaption] = useState<string>('');
  const [hooksList, setHooksList] = useState<string[]>([]);
  const [hookIndex, setHookIndex] = useState<number>(0);
  const [hashtags, setHashtags] = useState<string[]>(['NgopiGapleh', 'GaplehIndonesia']);
  const [shareLinks, setShareLinks] = useState<{ whatsapp: string; twitter: string; facebook: string }>({
    whatsapp: '',
    twitter: '',
    facebook: '',
  });
  const [copySuccess, setCopySuccess] = useState(false);

  // Fetch or generate share hooks
  useEffect(() => {
    if (!visible) return;

    const fetchShareContent = async () => {
      try {
        const res = await axios.post(`${API_URL}/gapleh/share`, {
          win_type: data.winType,
          username: data.username,
          points: data.pointsEarned,
          streak: data.streakCount || 0,
          is_first_nutup: data.isFirstNutup || false,
          design_template: currentTemplate,
        });

        if (res.data?.success) {
          setCaption(res.data.caption || '');
          setHooksList(res.data.hooks || [res.data.caption]);
          setHashtags(res.data.hashtags || ['NgopiGapleh', 'GaplehIndonesia']);
          setShareLinks(res.data.share_links || { whatsapp: '', twitter: '', facebook: '' });
          setHookIndex(0);
        }
      } catch (err) {
        // Local fallback if offline
        const fallbackCaption = data.winType === 'nutup_balak6'
          ? `NUTUP PAKAI BALAK 6! 💀🔥 @${data.username} baru aja bikin lawan nelangsa di Ngopi!`
          : data.winType === 'nutup_balak0'
          ? `0️⃣ BALAK 0! NUTUP! Momen paling mematikan di Gapleh Ngopi! ☕🔥`
          : data.winType === 'digapleh'
          ? `BUKAN GAPLEH BIASA! Ini DIGAPLEH! +75 poin! 🁫🔒`
          : `GAPLEH TELAK! Kartu habis tak bersisa di warkop digital Ngopi! ☕🏆`;
        setCaption(fallbackCaption);
        setHooksList([fallbackCaption]);
      }
    };

    fetchShareContent();
  }, [visible, data.winType, data.username, data.pointsEarned, data.streakCount, data.isFirstNutup, currentTemplate]);

  // Cycle next hook
  const handleCycleHook = () => {
    if (hooksList.length <= 1) return;
    const nextIdx = (hookIndex + 1) % hooksList.length;
    setHookIndex(nextIdx);
    setCaption(hooksList[nextIdx]!);
  };

  // Copy caption
  const handleCopyCaption = async () => {
    const cleanUser = (data.username || '').replace(/^@/, '');
    const targetUrl = cleanUser ? `https://ngopi.top?ref=${encodeURIComponent(cleanUser)}` : 'https://ngopi.top';
    const fullText = `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}\nMain di: ${targetUrl}`;
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(fullText);
      }
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      if (Platform.OS !== 'web') {
        Alert.alert('Berhasil', 'Caption & link referral kemenangan berhasil disalin!');
      }
    } catch (err) {
      Alert.alert('Info', fullText);
    }
  };

  // Open Social Deep Links
  const handleShareSocial = async (platform: 'whatsapp' | 'twitter' | 'facebook' | 'native') => {
    const cleanUser = (data.username || '').replace(/^@/, '');
    const targetUrl = cleanUser ? `https://ngopi.top?ref=${encodeURIComponent(cleanUser)}` : 'https://ngopi.top';
    const fullText = `${caption}\n\n${hashtags.map((h) => `#${h}`).join(' ')}\n${targetUrl}`;

    if (platform === 'native') {
      try {
        if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).share) {
          await (navigator as any).share({
            title: 'Kemenangan Gapleh di Ngopi',
            text: caption,
            url: targetUrl,
          });
          return;
        }
        await RNShare.share({
          message: fullText,
          url: targetUrl,
          title: 'Kemenangan Gapleh di Ngopi',
        });
      } catch (err) {
        handleCopyCaption();
      }
      return;
    }

    const deepLinkUrl = shareLinks[platform];
    if (deepLinkUrl) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.open(deepLinkUrl, '_blank');
      } else {
        const canOpen = await Linking.canOpenURL(deepLinkUrl);
        if (canOpen) {
          await Linking.openURL(deepLinkUrl);
        } else {
          handleCopyCaption();
        }
      }
    } else {
      handleCopyCaption();
    }
  };

  // Styling properties per design template
  const getTemplateStyles = () => {
    switch (currentTemplate) {
      case 'neon_cyberpunk':
        return {
          cardBg: '#090d16',
          borderColor: '#06b6d4',
          borderWidth: 2,
          headerColor: '#f43f5e',
          accentColor: '#06b6d4',
          subColor: '#94a3b8',
          badgeBg: '#1e1b4b',
          tileBg: '#0f172a',
          tileDotColor: '#38bdf8',
          titleBadgeText: 'CYBER GAPLEH ⚡',
        };
      case 'retro_warkop':
        return {
          cardBg: '#21130b',
          borderColor: '#d4a373',
          borderWidth: 2,
          headerColor: '#f59e0b',
          accentColor: '#d4a373',
          subColor: '#d6c7b2',
          badgeBg: '#381e11',
          tileBg: '#fef3c7',
          tileDotColor: '#451a03',
          titleBadgeText: 'WARKOP NGOPI.TOP ☕',
        };
      case 'modern_minimalist':
        return {
          cardBg: '#18181b',
          borderColor: '#e4e4e7',
          borderWidth: 1.5,
          headerColor: '#ffffff',
          accentColor: '#a1a1aa',
          subColor: '#d4d4d8',
          badgeBg: '#27272a',
          tileBg: '#fafafa',
          tileDotColor: '#09090b',
          titleBadgeText: 'GAPLEH INDONESIA 🁫',
        };
      case 'cinematic_dramatic':
      default:
        return {
          cardBg: '#050505',
          borderColor: '#eab308',
          borderWidth: 2,
          headerColor: '#fde047',
          accentColor: '#ca8a04',
          subColor: '#fef08a',
          badgeBg: '#1c1917',
          tileBg: '#1c1917',
          tileDotColor: '#fbbf24',
          titleBadgeText: 'MAESTRO CHAMPION 👑',
        };
    }
  };

  const tStyles = getTemplateStyles();

  // Header Title & Emoji per Win Type
  const getWinTypeDetails = () => {
    if (data.winType === 'nutup_balak6') {
      return {
        title: 'NUTUP BALAK 6!',
        emoji: '💀🔥',
        pointsText: data.isFirstNutup ? '+1.500 POIN' : '+500 POIN',
        leftCard: [6, 6],
        rightCard: [6, 6],
        badge: 'NUTUP SAKTI',
      };
    }
    if (data.winType === 'nutup_balak0') {
      return {
        title: 'NUTUP BALAK 0!',
        emoji: '🎯✨',
        pointsText: data.isFirstNutup ? '+1.500 POIN' : '+500 POIN',
        leftCard: [0, 0],
        rightCard: [0, 0],
        badge: 'NUTUP ZERO',
      };
    }
    if (data.winType === 'digapleh') {
      return {
        title: 'DIGAPLEH!',
        emoji: '🔒☕',
        pointsText: '+75 POIN',
        leftCard: [1, 2],
        rightCard: [2, 3],
        badge: 'BUNTU TAPI MENANG',
      };
    }
    return {
      title: 'GAPLEH TELAK!',
      emoji: '🏆✨',
      pointsText: `+${data.pointsEarned || 50} POIN`,
      leftCard: [4, 5],
      rightCard: [5, 6],
      badge: 'JUARA WARKOP',
    };
  };

  const winDetails = getWinTypeDetails();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header Bar */}
          <View style={styles.topBar}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 20 }}>🔥</Text>
              <Text style={styles.topBarTitle}>Bagikan Kemenangan Sosmed</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={coffee.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 16 }}>
            {/* Theme Selector Tabs */}
            <View style={styles.themeSelectorRow}>
              {TEMPLATE_OPTIONS.map((opt) => {
                const isActive = currentTemplate === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    style={[styles.themePill, isActive && styles.themePillActive]}
                    onPress={() => setCurrentTemplate(opt.id)}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={13}
                      color={isActive ? coffee.buttonText : coffee.secondary}
                    />
                    <Text style={[styles.themePillText, isActive && styles.themePillTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 9:16 Vertical Share Card Preview */}
            <View style={styles.cardWrapper}>
              <View
                style={[
                  styles.shareCard916,
                  {
                    backgroundColor: tStyles.cardBg,
                    borderColor: tStyles.borderColor,
                    borderWidth: tStyles.borderWidth,
                  },
                ]}
              >
                {/* Top Badge */}
                <View style={[styles.cardBrandBadge, { backgroundColor: tStyles.badgeBg }]}>
                  <Text style={[styles.cardBrandText, { color: tStyles.accentColor }]}>
                    {tStyles.titleBadgeText}
                  </Text>
                </View>

                {/* Big Victory Header */}
                <View style={{ alignItems: 'center', marginTop: 12 }}>
                  <Text style={{ fontSize: 36, marginBottom: 4 }}>{winDetails.emoji}</Text>
                  <Text style={[styles.cardMainHeading, { color: tStyles.headerColor }]}>
                    {winDetails.title}
                  </Text>
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 20, marginTop: 4 }}>
                    <Text style={{ color: tStyles.subColor, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>
                      {winDetails.badge}
                    </Text>
                  </View>
                </View>

                {/* Visual Domino Tiles */}
                <View style={styles.tilesVisualContainer}>
                  <View style={[styles.dominoDisplay, { backgroundColor: tStyles.tileBg, borderColor: tStyles.accentColor }]}>
                    <Text style={[styles.dominoValue, { color: tStyles.tileDotColor }]}>
                      {winDetails.leftCard[0]} • {winDetails.leftCard[1]}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, color: tStyles.subColor, fontWeight: 'bold' }}>⚡</Text>
                  <View style={[styles.dominoDisplay, { backgroundColor: tStyles.tileBg, borderColor: tStyles.accentColor }]}>
                    <Text style={[styles.dominoValue, { color: tStyles.tileDotColor }]}>
                      {winDetails.rightCard[0]} • {winDetails.rightCard[1]}
                    </Text>
                  </View>
                </View>

                {/* Player & Stats Section */}
                <View style={[styles.cardStatsBox, { backgroundColor: tStyles.badgeBg }]}>
                  <Text style={[styles.cardUsername, { color: tStyles.headerColor }]} numberOfLines={1}>
                    @{data.username || 'Ngopikawan'}
                  </Text>
                  <Text style={[styles.cardPointsText, { color: tStyles.accentColor }]}>
                    {winDetails.pointsText}
                  </Text>
                  <View style={styles.statsRow}>
                    <Text style={[styles.statsItemText, { color: tStyles.subColor }]}>
                      Streak: {Math.max(data.streakCount || 0, 1)}x 🔥
                    </Text>
                    <Text style={[styles.statsDivider, { color: tStyles.subColor }]}>|</Text>
                    <Text style={[styles.statsItemText, { color: tStyles.subColor }]}>
                      Total Poin: {(data.totalPoints || data.pointsEarned || 500).toLocaleString('id-ID')}
                    </Text>
                  </View>
                </View>

                {/* Watermark Footer */}
                <View style={styles.cardFooter}>
                  <Text style={[styles.cardFooterBrand, { color: tStyles.accentColor }]}>
                    ngopi.top ☕
                  </Text>
                  <Text style={[styles.cardFooterTag, { color: tStyles.subColor }]}>
                    Warkop Digital & Gapleh Online Indonesia
                  </Text>
                  <Text style={[styles.cardHashtags, { color: tStyles.accentColor }]}>
                    {hashtags.map((h) => `#${h}`).join(' ')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Hook Caption Box & Regenerate Button */}
            <View style={styles.captionBoxContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.captionLabel}>Hook / Caption Viral</Text>
                {hooksList.length > 1 && (
                  <TouchableOpacity style={styles.cycleHookBtn} onPress={handleCycleHook}>
                    <Ionicons name="refresh" size={12} color={coffee.accent} />
                    <Text style={styles.cycleHookText}>
                      Ganti Hook ({hookIndex + 1}/{hooksList.length})
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.captionDisplayBox}>
                <Text style={styles.captionText}>{caption}</Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, copySuccess && styles.copyBtnSuccess]}
                onPress={handleCopyCaption}
              >
                <Ionicons
                  name={copySuccess ? 'checkmark-circle' : 'copy-outline'}
                  size={15}
                  color={copySuccess ? '#10b981' : coffee.buttonText}
                />
                <Text style={[styles.copyBtnText, copySuccess && { color: '#10b981' }]}>
                  {copySuccess ? 'Tersalin ke Clipboard!' : 'Salin Caption & Link'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Referral Reward Info Banner */}
            <View
              style={{
                backgroundColor: 'rgba(234, 88, 12, 0.12)',
                borderColor: 'rgba(234, 88, 12, 0.4)',
                borderWidth: 1,
                borderRadius: 8,
                padding: 10,
                marginTop: 10,
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 18 }}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fb923c', fontSize: 11, fontWeight: '800' }}>
                  Bonus Referral Kemenangan (+50 Poin)
                </Text>
                <Text style={{ color: coffee.secondary, fontSize: 10, marginTop: 1 }}>
                  Setiap kawan yang bergabung melalui link kemenangan Anda akan memberi Anda +50 Poin Warkop!
                </Text>
              </View>
            </View>

            {/* Social Share Buttons (WhatsApp, X, Facebook, Native) */}
            <View style={styles.shareButtonsGrid}>
              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#25D366' }]}
                onPress={() => handleShareSocial('whatsapp')}
              >
                <MaterialCommunityIcons name="whatsapp" size={18} color="#FFF" />
                <Text style={styles.socialBtnText}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#000000', borderColor: '#333', borderWidth: 1 }]}
                onPress={() => handleShareSocial('twitter')}
              >
                <Text style={{ color: '#FFF', fontWeight: '900', fontSize: 16 }}>𝕏</Text>
                <Text style={styles.socialBtnText}>Post ke X</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: '#1877F2' }]}
                onPress={() => handleShareSocial('facebook')}
              >
                <MaterialCommunityIcons name="facebook" size={18} color="#FFF" />
                <Text style={styles.socialBtnText}>Facebook</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.socialShareBtn, { backgroundColor: coffee.accent }]}
                onPress={() => handleShareSocial('native')}
              >
                <Ionicons name="share-social-outline" size={16} color={coffee.buttonText} />
                <Text style={[styles.socialBtnText, { color: coffee.buttonText }]}>Bagikan</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '92%',
    backgroundColor: '#18110b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    padding: 16,
    overflow: 'hidden',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  topBarTitle: {
    color: coffee.text,
    fontSize: 15,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 4,
  },
  themeSelectorRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
    justifyContent: 'center',
  },
  themePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#251a13',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  themePillActive: {
    backgroundColor: coffee.accent,
    borderColor: coffee.accent,
  },
  themePillText: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  themePillTextActive: {
    color: coffee.buttonText,
  },
  cardWrapper: {
    alignItems: 'center',
    marginVertical: 4,
  },
  shareCard916: {
    width: 250,
    height: 380,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  cardBrandBadge: {
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 12,
  },
  cardBrandText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardMainHeading: {
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  tilesVisualContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 8,
  },
  dominoDisplay: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  dominoValue: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  cardStatsBox: {
    width: '100%',
    padding: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  cardUsername: {
    fontSize: 13,
    fontWeight: '800',
  },
  cardPointsText: {
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  statsItemText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statsDivider: {
    fontSize: 10,
  },
  cardFooter: {
    alignItems: 'center',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 6,
  },
  cardFooterBrand: {
    fontSize: 11,
    fontWeight: '900',
  },
  cardFooterTag: {
    fontSize: 8,
    marginTop: 1,
  },
  cardHashtags: {
    fontSize: 9,
    fontWeight: '800',
    marginTop: 3,
  },
  captionBoxContainer: {
    marginTop: 14,
    backgroundColor: '#231810',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: coffee.border,
  },
  captionLabel: {
    color: coffee.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  cycleHookBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cycleHookText: {
    color: coffee.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  captionDisplayBox: {
    backgroundColor: '#170f0a',
    padding: 10,
    borderRadius: 6,
    marginBottom: 8,
  },
  captionText: {
    color: coffee.text,
    fontSize: 12,
    lineHeight: 17,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: coffee.accent,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 6,
  },
  copyBtnSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderWidth: 1,
    borderColor: '#10b981',
  },
  copyBtnText: {
    color: coffee.buttonText,
    fontSize: 12,
    fontWeight: '800',
  },
  shareButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  socialShareBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  socialBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Image, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { coffee } from '../theme/coffee';
import { globalAudioPlayer, GlobalAudioState } from '../utils/globalAudioPlayer';

export const GlobalAudioBar: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 768;
  const isChatPage = pathname === '/chat' || pathname.includes('/chat/');
  const [audioState, setAudioState] = useState<GlobalAudioState>(() => globalAudioPlayer.getState());
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const unsubscribe = globalAudioPlayer.subscribe((state) => {
      setAudioState(state);
    });
    return unsubscribe;
  }, []);

  // Do not show the floating bar if user is currently on the warkop page,
  // since JukeboxWidget is already visible and interactive on warkop page.
  const isWarkopPage = pathname === '/warkop' || pathname === '/(main)/warkop' || pathname.endsWith('/warkop');

  if (!audioState.track || isWarkopPage) {
    return null;
  }

  const { track, isPlaying, progress, isLoading } = audioState;
  const isRadio = track.is_radio || track.added_by === 'Radio Warkop' || track.id?.startsWith('radio-');

  const handleTogglePlay = (e: any) => {
    e?.stopPropagation?.();
    globalAudioPlayer.togglePlay();
  };

  const handleStop = (e: any) => {
    e?.stopPropagation?.();
    globalAudioPlayer.stop();
  };

  const handleGoToWarkop = () => {
    router.push('/(main)/warkop' as any);
  };

  const [positionOverride, setPositionOverride] = useState<'top' | 'bottom' | null>(null);

  // On mobile phone in chat screen or games screen, position bar under top header so it never covers cards or typing area
  const isGamePage = pathname.includes('/games');
  const defaultDockAtTop = !isLargeScreen && (isChatPage || isGamePage);
  const dockAtTop = positionOverride ? positionOverride === 'top' : defaultDockAtTop;

  const handleTogglePosition = (e: any) => {
    e?.stopPropagation?.();
    setPositionOverride(dockAtTop ? 'bottom' : 'top');
  };

  if (isMinimized) {
    return (
      <View style={[styles.container, dockAtTop ? styles.containerTop : styles.containerBottom, styles.minimizedContainer]}>
        <TouchableOpacity
          style={styles.minimizedRow}
          activeOpacity={0.88}
          onPress={() => setIsMinimized(false)}
        >
          <Text style={styles.iconEmojiMini}>{isRadio ? '📻' : '☕'}</Text>
          <Text style={styles.minimizedTitle} numberOfLines={1}>
            {track.title}
          </Text>
          <TouchableOpacity
            style={styles.miniControlBtn}
            onPress={handleTogglePlay}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={14} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniControlBtn}
            onPress={handleTogglePosition}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            accessibilityLabel={dockAtTop ? 'Pindah ke Bawah' : 'Pindah ke Atas'}
          >
            <Ionicons name={dockAtTop ? 'arrow-down' : 'arrow-up'} size={14} color={coffee.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniControlBtn}
            onPress={() => setIsMinimized(false)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="chevron-up" size={14} color={coffee.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.miniControlBtn}
            onPress={handleStop}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="close" size={14} color={coffee.secondary} />
          </TouchableOpacity>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, dockAtTop ? styles.containerTop : styles.containerBottom]}>
      {/* Mini Progress Bar on top edge */}
      {!isRadio && (
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      )}

      <TouchableOpacity
        style={styles.innerRow}
        activeOpacity={0.88}
        onPress={handleGoToWarkop}
      >
        {/* Artwork / Icon */}
        <View style={styles.artContainer}>
          {track.thumbnail ? (
            <Image source={{ uri: track.thumbnail }} style={styles.thumbnail} />
          ) : (
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>{isRadio ? '📻' : '☕'}</Text>
            </View>
          )}
          {isPlaying && (
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={styles.titleText} numberOfLines={1}>
              {track.title}
            </Text>
            {isRadio && <Text style={styles.liveBadge}>LIVE</Text>}
          </View>
          <Text style={styles.artistText} numberOfLines={1}>
            {track.artist || 'Warung Kopi'} • <Text style={styles.warkopLink}>Buka Warkop ☕</Text>
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsRow}>
          <TouchableOpacity
            style={styles.playBtn}
            onPress={handleTogglePlay}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {isLoading ? (
              <Ionicons name="reload" size={18} color={coffee.accent} />
            ) : (
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={18}
                color={coffee.accent}
              />
            )}
          </TouchableOpacity>

          {/* Toggle Top/Bottom Docking position */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleTogglePosition}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={dockAtTop ? 'Pindah ke Bawah' : 'Pindah ke Atas'}
          >
            <Ionicons name={dockAtTop ? 'arrow-down' : 'arrow-up'} size={16} color={coffee.accent} />
          </TouchableOpacity>

          {/* Minimize / Collapse Button to never block screen */}
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={(e) => {
              e?.stopPropagation?.();
              setIsMinimized(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Kecilkan Bar Musik"
          >
            <Ionicons name="chevron-down" size={17} color={coffee.secondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleStop}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Hentikan Musik"
          >
            <Ionicons name="close" size={17} color={coffee.secondary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: Platform.OS === 'web' ? '-50%' : 0 }],
    alignSelf: Platform.OS === 'web' ? 'auto' : 'center',
    width: '94%',
    maxWidth: 480,
    backgroundColor: 'rgba(28, 22, 18, 0.96)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: coffee.border,
    zIndex: 99999,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    backdropFilter: 'blur(10px)',
  } as any,
  containerBottom: {
    bottom: Platform.OS === 'web' ? 18 : 28,
  },
  containerTop: {
    top: Platform.OS === 'web' ? 58 : 68,
  },
  minimizedContainer: {
    borderRadius: 20,
    maxWidth: 320,
  },
  minimizedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  iconEmojiMini: {
    fontSize: 14,
  },
  minimizedTitle: {
    flex: 1,
    color: coffee.text,
    fontSize: 12,
    fontWeight: '700',
  },
  miniControlBtn: {
    padding: 3,
  },
  progressBarBg: {
    width: '100%',
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: coffee.accent,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  artContainer: {
    position: 'relative',
    width: 42,
    height: 42,
  },
  thumbnail: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: coffee.surface,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: coffee.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: coffee.border,
  },
  iconEmoji: {
    fontSize: 20,
  },
  liveIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(28, 22, 18, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#10B981',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    color: coffee.text,
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  artistText: {
    color: coffee.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  warkopLink: {
    color: coffee.accent,
    fontWeight: '600',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

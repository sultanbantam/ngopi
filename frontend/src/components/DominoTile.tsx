import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

interface DominoTileProps {
  card: [number, number]; // [top, bottom] or [left, right]
  horizontal?: boolean;
  size?: 'small' | 'medium' | 'large';
  highlight?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export const DominoTile: React.FC<DominoTileProps> = ({
  card,
  horizontal = false,
  size = 'medium',
  highlight = false,
  disabled = false,
  onPress,
}) => {
  const [val1, val2] = card;

  const scale = size === 'small' ? 0.65 : size === 'large' ? 1.25 : 1;
  const width = horizontal ? 64 * scale : 34 * scale;
  const height = horizontal ? 34 * scale : 64 * scale;
  const halfSize = 30 * scale;

  const renderDots = (value: number) => {
    // Return dots positioned in a 3x3 grid
    const dotPositions: Record<number, number[]> = {
      0: [],
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8],
    };

    const activeIndices = new Set(dotPositions[value] || []);
    const isRed = value === 1 || value === 4 || (val1 === val2 && value > 0);
    const dotColor = isRed ? '#D32F2F' : '#1A1A1A';
    const dotSize = Math.max(3, 5.5 * scale);

    return (
      <View style={[styles.halfFace, { width: halfSize, height: halfSize }]}>
        <View style={styles.grid3x3}>
          {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
            <View key={idx} style={styles.gridCell}>
              {activeIndices.has(idx) ? (
                <View
                  style={[
                    styles.dot,
                    {
                      width: dotSize,
                      height: dotSize,
                      borderRadius: dotSize / 2,
                      backgroundColor: dotColor,
                    },
                  ]}
                />
              ) : null}
            </View>
          ))}
        </View>
      </View>
    );
  };

  const content = (
    <View
      style={[
        styles.tileContainer,
        { width, height },
        horizontal ? styles.tileHorizontal : styles.tileVertical,
        highlight && styles.tileHighlighted,
        disabled && styles.tileDisabled,
      ]}
    >
      {renderDots(val1)}
      <View style={horizontal ? styles.dividerVertical : styles.dividerHorizontal} />
      {renderDots(val2)}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.wrapper, highlight && styles.wrapperHighlighted]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
};

const styles = StyleSheet.create({
  wrapper: {
    margin: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapperHighlighted: {
    transform: [{ translateY: -4 }],
  },
  tileContainer: {
    backgroundColor: '#FAF7EE', // Ivory/cream bone domino color
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#D4C5A9',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  tileVertical: {
    flexDirection: 'column',
  },
  tileHorizontal: {
    flexDirection: 'row',
  },
  tileHighlighted: {
    borderColor: '#D4A373', // Warm gold
    borderWidth: 2.5,
    backgroundColor: '#FFFDF7',
    shadowColor: '#D4A373',
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  tileDisabled: {
    opacity: 0.45,
  },
  halfFace: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid3x3: {
    width: '84%',
    height: '84%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCell: {
    width: '33.33%',
    height: '33.33%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0.5 },
    shadowOpacity: 0.3,
    shadowRadius: 0.5,
  },
  dividerHorizontal: {
    width: '85%',
    height: 1.5,
    backgroundColor: '#8C7853',
    marginVertical: 1,
  },
  dividerVertical: {
    height: '85%',
    width: 1.5,
    backgroundColor: '#8C7853',
    marginHorizontal: 1,
  },
});

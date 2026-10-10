import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { coffee } from '../theme/coffee';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onPress: () => void;
  };
  secondaryAction?: {
    label: string;
    onPress: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '☕',
  title,
  description,
  primaryAction,
  secondaryAction,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      
      <View style={styles.actionContainer}>
        {primaryAction && (
          <TouchableOpacity style={styles.primaryButton} onPress={primaryAction.onPress} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
          </TouchableOpacity>
        )}
        {secondaryAction && (
          <TouchableOpacity style={styles.secondaryButton} onPress={secondaryAction.onPress} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>{secondaryAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginVertical: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: coffee.surface,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: coffee.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  icon: {
    fontSize: 38,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: coffee.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: coffee.muted,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 20,
  },
  actionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    width: '100%',
  },
  primaryButton: {
    backgroundColor: coffee.button,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.accentWash,
    alignItems: 'center',
    minWidth: 130,
  },
  primaryButtonText: {
    color: coffee.buttonText,
    fontWeight: '600',
    fontSize: 14,
  },
  secondaryButton: {
    backgroundColor: coffee.surface,
    paddingVertical: 11,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    minWidth: 130,
  },
  secondaryButtonText: {
    color: coffee.secondary,
    fontWeight: '600',
    fontSize: 14,
  },
});

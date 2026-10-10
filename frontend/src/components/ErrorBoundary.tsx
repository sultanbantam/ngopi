import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { coffee } from '../theme/coffee';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`ErrorBoundary caught error in [${this.props.name || 'Component'}]:`, error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <View style={styles.container}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={styles.title}>Komponen sedang dimuat ulang</Text>
          <Text style={styles.subtitle}>{this.state.error?.message || 'Terjadi kesalahan kecil'}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryText}>Coba Lagi</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: coffee.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: coffee.border,
    alignItems: 'center',
    marginVertical: 4,
  },
  emoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  title: {
    color: coffee.text,
    fontSize: 13,
    fontWeight: '700',
  },
  subtitle: {
    color: coffee.muted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: coffee.button,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryText: {
    color: coffee.buttonText,
    fontSize: 11,
    fontWeight: '700',
  },
});

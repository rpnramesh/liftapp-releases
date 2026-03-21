// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Global Error Boundary
//
// Wraps the entire app so unhandled React render errors don't crash the app.
// Per TS-011 Non-Functional Requirements:
//   "All API errors must be caught. Show user-friendly messages.
//    Use a global error boundary."
// ─────────────────────────────────────────────────────────────────────────────

import React, { Component, ErrorInfo } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LIFT_TEAL } from '../../constants/trainer.constants';

interface Props {
  children: React.ReactNode;
  /** Optional: callback to report error to Sentry / Crashlytics */
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  showDetails: boolean;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });

    // Report to crash tracking
    if (this.props.onError) {
      this.props.onError(error, info);
    }

    // Example with Sentry:
    // Sentry.captureException(error, { extra: { componentStack: info.componentStack } });

    // Example with Firebase Crashlytics:
    // crashlytics().recordError(error);
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      componentStack: null,
      showDetails: false,
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          Lift encountered an unexpected error. Please try again — your data is safe.
        </Text>

        <TouchableOpacity style={styles.primaryBtn} onPress={this.reset}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </TouchableOpacity>

        {/* Dev-only error details */}
        {__DEV__ && this.state.error && (
          <View style={styles.devSection}>
            <TouchableOpacity
              onPress={() => this.setState(prev => ({ showDetails: !prev.showDetails }))}
            >
              <Text style={styles.devToggle}>
                {this.state.showDetails ? '▼' : '▶'} Error Details (dev only)
              </Text>
            </TouchableOpacity>
            {this.state.showDetails && (
              <ScrollView style={styles.devScroll} nestedScrollEnabled>
                <Text style={styles.devError}>{this.state.error.toString()}</Text>
                {this.state.componentStack && (
                  <Text style={styles.devStack}>{this.state.componentStack}</Text>
                )}
              </ScrollView>
            )}
          </View>
        )}
      </View>
    );
  }
}

// ─── API Error Toast ──────────────────────────────────────────────────────────
/**
 * Lightweight inline error display for API-level failures
 * (use this instead of Alert for non-critical errors).
 */

interface ApiErrorBannerProps {
  error: string | null;
  onDismiss?: () => void;
}

export const ApiErrorBanner: React.FC<ApiErrorBannerProps> = ({ error, onDismiss }) => {
  if (!error) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorBannerText}>{error}</Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.errorBannerDismiss}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ─── useErrorBoundary hook ────────────────────────────────────────────────────
/**
 * Utility hook to imperatively trigger the error boundary from async code.
 * Usage inside a functional component:
 *
 *   const throwError = useErrorBoundary();
 *   try { ... } catch (e) { throwError(e); }
 */
import { useCallback, useState } from 'react';

export function useErrorBoundary(): (error: unknown) => void {
  const [, setError] = useState<unknown>(null);
  return useCallback((error: unknown) => {
    setError(() => { throw error; });
  }, []);
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  emoji: { fontSize: 52, marginBottom: 8 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 8,
  },
  primaryBtn: {
    backgroundColor: LIFT_TEAL,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  devSection: {
    width: '100%',
    marginTop: 24,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 12,
  },
  devToggle: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  devScroll: { maxHeight: 200 },
  devError: {
    fontSize: 11,
    color: '#DC2626',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  devStack: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: 12,
    gap: 8,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  errorBannerText: { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },
  errorBannerDismiss: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
});

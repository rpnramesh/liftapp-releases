// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Common Components (Member App Style)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Image,
    Text,
    TextInput, TextInputProps,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle
} from 'react-native';
import { IconSymbol } from '../../components/ui/icon-symbol';
import { C, GS, R, S, T } from '../../constants/theme';

// ─── SkeletonLoader ───────────────────────────────────────────────────────────

export const SkeletonLoader: React.FC<{
  width?: number | string; height?: number; borderRadius?: number; style?: ViewStyle;
}> = ({ width = '100%', height = 16, borderRadius = R.sm, style }) => {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.4, duration: 750, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View style={[{ width: width as number, height, borderRadius, backgroundColor: C.border, opacity }, style]} />
  );
};

export const SkeletonCard: React.FC = () => (
  <View style={[GS.card, { flexDirection: 'row', alignItems: 'center', gap: S.md, marginBottom: S.sm }]}>
    <SkeletonLoader width={48} height={48} borderRadius={24} />
    <View style={{ flex: 1, gap: S.sm }}>
      <SkeletonLoader height={14} width="60%" />
      <SkeletonLoader height={12} width="40%" />
    </View>
  </View>
);

// ─── EmptyState ───────────────────────────────────────────────────────────────


export const EmptyState: React.FC<{
  icon?: React.ReactNode; emoji?: string; title: string; subtitle?: string; ctaLabel?: string; onCTA?: () => void;
}> = ({ icon, emoji = '📭', title, subtitle, ctaLabel, onCTA }) => (
  <View style={GS.emptyContainer}>
    {icon ? (
      <View style={{ marginBottom: S.sm }}>{icon}</View>
    ) : (
      <Text style={{ fontSize: 48, marginBottom: S.sm }}>{emoji}</Text>
    )}
    <Text style={[T.h3, { textAlign: 'center' }]}>{title}</Text>
    {subtitle && <Text style={[T.body, { color: C.mid, textAlign: 'center', lineHeight: 20 }]}>{subtitle}</Text>}
    {ctaLabel && onCTA && (
      <TouchableOpacity style={[GS.btnPrimary, { paddingHorizontal: S.xxl, marginTop: S.sm }]} onPress={onCTA} activeOpacity={0.85}>
        <Text style={{ color: C.white, fontWeight: '600', fontSize: 15 }}>{ctaLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

// ─── StatusBadge ─────────────────────────────────────────────────────────────

export const StatusBadge: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <View style={{ backgroundColor: color + '20', paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.full, alignSelf: 'flex-start' }}>
    <Text style={{ fontSize: 11, fontWeight: '600', color, letterSpacing: 0.2 }}>{label}</Text>
  </View>
);

// ─── Avatar ───────────────────────────────────────────────────────────────────

export const Avatar: React.FC<{
  uri: string | null; name: string; size?: number; showOnline?: boolean;
}> = ({ uri, name, size = 40, showOnline = false }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />
      ) : (
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primaryBg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: C.primaryMid }}>
          <Text style={{ color: C.primary, fontWeight: '700', fontSize: size * 0.36 }}>{initials}</Text>
        </View>
      )}
      {showOnline && (
        <View style={{ position: 'absolute', bottom: 0, right: 0, width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14, backgroundColor: C.green, borderWidth: 2, borderColor: C.white }} />
      )}
    </View>
  );
};

// ─── Banners ──────────────────────────────────────────────────────────────────

export const OfflineBanner: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <View style={GS.warningBanner}>
      <Text style={{ color: '#92400E', fontSize: 13, fontWeight: '500' }}>⚠ No Internet — client data may be outdated</Text>
    </View>
  ) : null;

export const StaleBanner: React.FC<{ visible: boolean }> = ({ visible }) =>
  visible ? (
    <View style={GS.warningBanner}>
      <Text style={{ color: '#92400E', fontSize: 12 }}>Data may be outdated. Pull to refresh.</Text>
    </View>
  ) : null;

// ─── LiveBadge ────────────────────────────────────────────────────────────────

export const LiveBadge: React.FC = () => {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.5, duration: 600, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.red, paddingHorizontal: S.sm, paddingVertical: 4, borderRadius: R.full }}>
      <Animated.View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.white, transform: [{ scale: pulse }] }} />
      <Text style={{ color: C.white, fontSize: 10, fontWeight: '700', letterSpacing: 1 }}>LIVE</Text>
    </View>
  );
};

// ─── RiskFlagBadge ────────────────────────────────────────────────────────────

export const RiskFlagBadge: React.FC = () => (
  <View style={{ backgroundColor: C.redBg, paddingHorizontal: S.sm, paddingVertical: 3, borderRadius: R.full }}>
    <Text style={{ color: C.red, fontSize: 11, fontWeight: '600' }}>⚠ At Risk</Text>
  </View>
);

// ─── PrimaryButton ────────────────────────────────────────────────────────────

export const PrimaryButton: React.FC<{
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
  variant?: 'filled' | 'outlined' | 'ghost'; style?: ViewStyle;
}> = ({ label, onPress, disabled = false, loading = false, variant = 'filled', style }) => {
  const base = variant === 'outlined' ? GS.btnOutline : variant === 'ghost' ? GS.btnGhost : GS.btnPrimary;
  const textColor = variant === 'filled' ? C.white : C.primary;
  return (
    <TouchableOpacity style={[base, disabled && { opacity: 0.5 }, style]} onPress={onPress} disabled={disabled || loading} activeOpacity={0.85}>
      {loading
        ? <ActivityIndicator color={textColor} size="small" />
        : <Text style={{ color: textColor, fontWeight: '600', fontSize: 15 }}>{label}</Text>}
    </TouchableOpacity>
  );
};

// ─── InputField ───────────────────────────────────────────────────────────────

export const InputField: React.FC<TextInputProps & {
  label?: string; error?: string; containerStyle?: ViewStyle;
}> = ({ label, error, containerStyle, ...props }) => (
  <View style={[{ marginBottom: S.md }, containerStyle]}>
    {label && <Text style={[T.label, { marginBottom: S.xs + 2 }]}>{label}</Text>}
    <TextInput
      style={[GS.input, error ? GS.inputError : {}, props.multiline && { height: 90, textAlignVertical: 'top', paddingTop: S.md }]}
      placeholderTextColor={C.light}
      {...props}
    />
    {error ? <Text style={{ fontSize: 12, color: C.red, marginTop: S.xs }}>{error}</Text> : null}
  </View>
);

// ─── ScreenHeader ─────────────────────────────────────────────────────────────

export const ScreenHeader: React.FC<{
  title: string; onBack?: () => void; rightLabel?: string; onRight?: () => void; rightColor?: string;
}> = ({ title, onBack, rightLabel, onRight, rightColor }) => (
  <View style={GS.header}>
    {onBack
      ? <TouchableOpacity onPress={onBack} style={{ marginRight: S.md, minWidth: 44, minHeight: 44, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconSymbol name="chevron.left" size={16} color={C.primary} />
            <Text style={GS.backText}>Back</Text>
          </View>
        </TouchableOpacity>
      : <View style={{ width: S.xxl }} />}
    <Text style={[T.h3, { flex: 1 }]}>{title}</Text>
    {rightLabel && onRight
      ? <TouchableOpacity onPress={onRight} style={{ minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: rightColor ?? C.primary }}>{rightLabel}</Text>
        </TouchableOpacity>
      : <View style={{ width: S.xxl }} />}
  </View>
);

// ─── Card ─────────────────────────────────────────────────────────────────────

export const Card: React.FC<{ children: React.ReactNode; style?: ViewStyle; onPress?: () => void }> = ({ children, style, onPress }) =>
  onPress
    ? <TouchableOpacity style={[GS.card, style]} onPress={onPress} activeOpacity={0.88}>{children}</TouchableOpacity>
    : <View style={[GS.card, style]}>{children}</View>;

// ─── Chip ─────────────────────────────────────────────────────────────────────

export const Chip: React.FC<{ label: string; active?: boolean; onPress?: () => void; color?: string }> = ({ label, active = false, onPress, color }) => {
  const activeColor = color ?? C.primary;
  return (
    <TouchableOpacity
      style={{ paddingHorizontal: S.md, paddingVertical: S.xs + 2, borderRadius: R.full, borderWidth: 1, borderColor: active ? activeColor : C.border, backgroundColor: active ? activeColor : C.card }}
      onPress={onPress} activeOpacity={0.8}
    >
      <Text style={{ fontSize: 12, color: active ? C.white : C.mid, fontWeight: active ? '600' : '400' }}>{label}</Text>
    </TouchableOpacity>
  );
};

// ─── InfoRow ──────────────────────────────────────────────────────────────────

export const InfoRow: React.FC<{ label: string; value: string; last?: boolean }> = ({ label, value, last = false }) => (
  <View style={[GS.rowBetween, { paddingVertical: S.sm + 2 }, !last && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
    <Text style={[T.small, { color: C.mid }]}>{label}</Text>
    <Text style={[T.body, { fontWeight: '500', maxWidth: '60%', textAlign: 'right' }]}>{value}</Text>
  </View>
);

// ─── StatTile ─────────────────────────────────────────────────────────────────

export const StatTile: React.FC<{ label: string; value: string | number; color?: string; icon?: string }> = ({ label, value, color, icon }) => (
  <View style={[GS.card, { flex: 1, alignItems: 'center', paddingVertical: S.lg }]}>
    {icon && <Text style={{ fontSize: 20, marginBottom: S.xs }}>{icon}</Text>}
    <Text style={{ fontSize: 22, fontWeight: '700', color: color ?? C.dark }}>{value}</Text>
    <Text style={[T.tiny, { textAlign: 'center', marginTop: 3 }]}>{label}</Text>
  </View>
);

// ─── SectionTitle ─────────────────────────────────────────────────────────────

export const SectionTitle: React.FC<{ title: string; style?: TextStyle }> = ({ title, style }) => (
  <Text style={[GS.sectionHeader, style]}>{title.toUpperCase()}</Text>
);

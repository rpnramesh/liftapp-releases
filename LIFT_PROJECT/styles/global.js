// ─────────────────────────────────────────────────────────────────────────────
// LIFT Member App — Global styles
// Built on constants/theme.js — matches web's vertical rhythm & typography.
// ─────────────────────────────────────────────────────────────────────────────

import { StyleSheet } from 'react-native';
import theme from '../constants/theme';
import C from '../constants/colors';

const { spacing, radius, shadow, typography, border } = theme;

const g = StyleSheet.create({
  // Screen containers
  screen: {
    flex: 1,
    backgroundColor: C.bg,
    paddingHorizontal: spacing.pageX,
    paddingTop: spacing.pageY,
  },
  screenNoPad: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Headings
  pageTitle: {
    ...typography.h1,
    marginBottom: spacing.section,
    marginTop: spacing[1],
  },
  sectionTitle: {
    ...typography.h3,
    marginBottom: spacing[3],
    marginTop: spacing[5],
  },
  // Upper-case section label ("ACTIVE PLAN") matches web .text-label
  sec: {
    ...typography.label,
    marginTop: spacing[5],
    marginBottom: spacing[2.5],
  },

  // Card primitive — matches web `.card` (radius-lg, border, subtle shadow)
  card: {
    backgroundColor: C.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: border.default,
    padding: spacing.card,
    ...shadow.card,
  },
  cardRaised: {
    backgroundColor: C.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: border.default,
    padding: spacing.card,
    ...shadow.raised,
  },
  // Read-only info block (sunken) — `.info-card`
  infoCard: {
    backgroundColor: C.sunken,
    borderRadius: radius.xl,
    padding: spacing.cardSm,
  },
  // Brand-tinted card — `.info-card-brand`
  accentCard: {
    backgroundColor: theme.brand[50],
    borderWidth: 1,
    borderColor: theme.brand[100],
    borderRadius: radius.xl,
    padding: spacing.card,
  },
  // Surface with border — `.surface-card`
  surfaceCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: border.default,
    borderRadius: radius.xl,
  },

  // Rhythm helpers
  row: { flexDirection: 'row', alignItems: 'center' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stack: { gap: spacing.stack },

  // Divider
  divider: {
    height: 1,
    backgroundColor: border.subtle,
  },

  // Text presets (spread these into Text style prop)
  textDisplay:  typography.display,
  textH1:       typography.h1,
  textH2:       typography.h2,
  textH3:       typography.h3,
  textTitle:    typography.title,
  textSubtitle: typography.subtitle,
  textBody:     typography.body,
  textBodySm:   typography.bodySm,
  textLabel:    typography.label,
  textCaption:  typography.caption,
  textMetric:   typography.metric,
  textMetricSm: typography.metricSm,
});

export default g;

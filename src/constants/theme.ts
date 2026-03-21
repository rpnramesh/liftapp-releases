// ─────────────────────────────────────────────────────────────────────────────
// Lift Trainer App — Theme
// Mirrors the Member app's exact design system.
// Only difference: primary is TEAL (#0E7490) instead of Member app BLUE (#1A56DB)
// ─────────────────────────────────────────────────────────────────────────────

// ─── Colors (matching Member app palette) ────────────────────────────────────

export const C = {
  // Brand — Trainer uses teal, Member uses blue
  primary:   '#0E7490',   // Trainer teal  (Member: #1A56DB)
  primaryBg: '#F0FDFA',   // Teal wash     (Member: #EFF6FF)
  primaryMid:'#CFFAFE',   // Teal light    (Member: #DBEAFE)

  // Backgrounds
  bg:        '#F8FAFF',   // Same as Member app
  card:      '#FFFFFF',   // Same as Member app
  border:    '#E5E7EB',   // Same as Member app

  // Text
  dark:      '#111827',   // Same as Member app
  mid:       '#6B7280',   // Same as Member app
  light:     '#9CA3AF',   // Same as Member app

  // Status — identical to Member app
  green:     '#10B981',
  greenBg:   '#D1FAE5',
  amber:     '#F59E0B',
  amberBg:   '#FEF3C7',
  red:       '#EF4444',
  redBg:     '#FEE2E2',

  // Extras
  white:     '#FFFFFF',
  black:     '#000000',
} as const;

// ─── Typography (matching Member app sizes) ───────────────────────────────────

export const T = {
  h1:    { fontSize: 24, fontWeight: '700' as const, color: C.dark },
  h2:    { fontSize: 20, fontWeight: '700' as const, color: C.dark },
  h3:    { fontSize: 17, fontWeight: '600' as const, color: C.dark },
  h4:    { fontSize: 15, fontWeight: '600' as const, color: C.dark },
  body:  { fontSize: 14, fontWeight: '400' as const, color: C.dark },
  small: { fontSize: 12, fontWeight: '400' as const, color: C.mid  },
  tiny:  { fontSize: 11, fontWeight: '400' as const, color: C.light },
  label: { fontSize: 13, fontWeight: '600' as const, color: C.dark },
  link:  { fontSize: 14, fontWeight: '500' as const, color: C.primary },
} as const;

// ─── Spacing (matching Member app rhythm) ─────────────────────────────────────

export const S = {
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  20,
  xxl: 24,
  xxxl:32,
} as const;

// ─── Border radius (matching Member app) ─────────────────────────────────────

export const R = {
  sm:   6,
  md:   10,
  lg:   12,
  xl:   16,
  full: 999,
} as const;

// ─── Shadows (matching Member app card shadows) ───────────────────────────────

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
} as const;

// ─── Reusable style blocks (matching Member app patterns) ─────────────────────

export const GS = {
  // Screen container
  screen: {
    flex: 1,
    backgroundColor: C.bg,
  },

  // Card
  card: {
    backgroundColor: C.card,
    borderRadius: R.lg,
    padding: S.lg,
    ...shadows.card,
  },

  // Row with space-between
  rowBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },

  // Row aligned center
  rowCenter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },

  // Section header inside screen
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: C.mid,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: S.sm,
    marginTop: S.lg,
    paddingHorizontal: S.lg,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: S.md,
  },

  // Input field
  input: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.md,
    paddingVertical: S.md,
    fontSize: 15,
    color: C.dark,
    minHeight: 44,
  },

  // Input error state
  inputError: {
    borderColor: C.red,
  },

  // Primary button
  btnPrimary: {
    backgroundColor: C.primary,
    borderRadius: R.md,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
  },

  // Outlined button
  btnOutline: {
    backgroundColor: C.card,
    borderWidth: 1.5,
    borderColor: C.primary,
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
  },

  // Ghost / secondary button
  btnGhost: {
    backgroundColor: C.primaryBg,
    borderRadius: R.md,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
  },

  // Screen header (matches Member app header style)
  header: {
    backgroundColor: C.card,
    paddingHorizontal: S.lg,
    paddingTop: 52,
    paddingBottom: S.lg,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },

  // Back button text
  backText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: C.primary,
  },

  // Tab row (like the All / Gym / Freelance tabs)
  tabRow: {
    flexDirection: 'row' as const,
    backgroundColor: '#F3F4F6',
    borderRadius: R.md,
    padding: 4,
    margin: S.lg,
    marginBottom: S.sm,
  },

  tabItem: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: R.sm,
    alignItems: 'center' as const,
  },

  tabItemActive: {
    backgroundColor: C.card,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  tabText: {
    fontSize: 12,
    color: C.mid,
  },

  tabTextActive: {
    fontSize: 12,
    color: C.primary,
    fontWeight: '600' as const,
  },

  // Empty state container
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: S.xxxl,
    gap: S.md,
  },

  // Offline/stale banner
  warningBanner: {
    backgroundColor: C.amberBg,
    padding: S.sm + 2,
    alignItems: 'center' as const,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },

  // Bottom nav bar style
  tabBar: {
    height: 62,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
} as const;

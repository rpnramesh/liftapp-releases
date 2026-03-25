// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'expand_less',
  'chevron.down': 'expand_more',
  // Common app icons
  'figure.strengthtraining.traditional': 'fitness_center',
  'number': 'format_list_numbered',
  'timer': 'timer',
  'bolt.fill': 'flash_on',
    'camera': 'photo_camera',
    'scalemass': 'scale',
    'play': 'play_arrow',
    'dumbbell': 'fitness_center',
    'location': 'location_on',
    'shield': 'security',
    'mic': 'mic',
    'record': 'fiber_manual_record',
    'play.fill': 'play_arrow',
    'pause.fill': 'pause',
    'star.fill': 'star',
    'flame.fill': 'whatshot',
    'clipboard': 'content_paste',
    'bell.fill': 'notifications',
    'camera.fill': 'photo_camera',
    'camera.slash': 'videocam_off',
    'bubble.left': 'chat_bubble',
    'person.2.fill': 'people',
    'trash': 'delete',
    'magnifyingglass': 'search',
    'pin': 'push_pin',
    'pin.fill': 'push_pin',
    'checkmark': 'check',
    'square': 'check_box_outline_blank',
    'bed': 'hotel',
    'hotel': 'hotel',
    // Additional mappings used across the app
    'pencil': 'edit',
    'xmark': 'close',
    'exclamationmark.triangle.fill': 'warning',
    'lock.fill': 'lock',
    'calendar': 'calendar_today',
    'share': 'share',
    'copy': 'file_copy',
} as unknown as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}

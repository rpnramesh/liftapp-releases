import React from 'react';
import { KeyboardAvoidingView, Platform, ViewStyle } from 'react-native';
import { GS } from '../../constants/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle | any;
};

export default function KeyboardSafeView({ children, style }: Props) {
  const offset = (GS.header && (GS.header as any).paddingTop) || 52;
  return (
    <KeyboardAvoidingView style={style ?? { flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={offset}>
      {children}
    </KeyboardAvoidingView>
  );
}

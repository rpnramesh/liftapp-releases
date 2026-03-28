#!/usr/bin/env python3
"""Convert trainer's PhoneAuthWebView.tsx to member app's PhoneAuthWebView.js"""

src = '/Users/admin/lift-trainer-app/src/components/common/PhoneAuthWebView.tsx'
dst = '/Users/admin/lift-member-app/shared/components/PhoneAuthWebView.js'

with open(src) as f:
    content = f.read()

# Replace theme import with hardcoded color
content = content.replace("import { C } from '../../constants/theme';", "const PRIMARY = '#1A56DB';")
content = content.replace('C.primary', 'PRIMARY')

# Remove TS WebViewMessageEvent import
content = content.replace(
    "import { WebView, WebViewMessageEvent } from 'react-native-webview';",
    "import { WebView } from 'react-native-webview';"
)

# Process line by line
lines = content.split('\n')
new_lines = []
skip_interface = False

for line in lines:
    # Skip export interface block
    if 'export interface' in line:
        skip_interface = True
        continue
    if skip_interface:
        if line.strip() == '}':
            skip_interface = False
        continue

    # Skip __DEV__ lines
    if '__DEV__' in line:
        continue

    # Remove TypeScript type annotations
    line = line.replace('<PhoneAuthHandle>', '')
    line = line.replace('<WebView>', '')
    line = line.replace(': WebViewMessageEvent', '')
    line = line.replace(': string', '')
    line = line.replace('<string>', '')
    line = line.replace('<ReturnType<typeof setTimeout> | null>', '')

    new_lines.append(line)

content = '\n'.join(new_lines)

# Fix header comment
content = content.replace('// Lift \u2014 Phone Auth', '// Lift Member App \u2014 Phone Auth')

with open(dst, 'w') as f:
    f.write(content)

print(f'Written {len(new_lines)} lines to {dst}')

# LIFT Member App v1.8.5 - Build Instructions

## 📱 Building the APK Locally

Due to EAS service issues, here are instructions to build the APK locally or use alternative methods.

## Option 1: Using EAS Build (Recommended)
```bash
cd /Users/admin/lift-member-app

# Build with preview profile (APK format)
eas build --platform android --profile preview

# Or with production profile
eas build --platform android --profile production --non-interactive
```

**Status:** Monitor at https://expo.dev/accounts/rpn.ramesh/projects/lift-member-app/builds

## Option 2: Local Development Build

### Prerequisites:
- Node.js & npm
- Expo CLI: `npm install -g expo-cli`
- Android SDK (for APK generation)

### Steps:
```bash
# Install dependencies
cd /Users/admin/lift-member-app
npm install

# Build for Android
expo build:android --type apk

# Or using Expo Go for testing
npx expo start
# Then open on device or emulator with Expo Go app
```

## Option 3: Download Pre-built APK

Earlier successful build available:
- **Build ID:** `cf439e44-a238-415f-955b-5aca6efcc656`
- **Download:** https://expo.dev/artifacts/eas/rArJZgGD3HAJRDV6fZ1svd.apk
- **Note:** This is v1.0.0 - needs version update

## Code Changes Included

The following features are included in this build:

✅ **Rest Day Marking**
- Mark any day as rest day
- Toggle rest days back to workout days
- Persistent local storage

✅ **Workout Postponement**
- Intelligent day selection
- Automatic rest day skipping
- User confirmation for rest day assignments

✅ **Smart Scheduling**
- Respects both trainer and user rest days
- Clear user feedback
- AsyncStorage persistence

## Version Information

- **Version:** 1.8.5
- **Build Date:** April 15, 2026
- **Commit:** f1a9a32
- **Features:** Rest day marking + Workout postponement

## Git Commits

```
f1a9a32 - feat: add rest day marking and workout postponement features
e4b9024 - chore: bump version to 1.8.5 for APK release
76b0a59 - docs: add comprehensive release notes for v1.8.5
```

## Release Notes

See `RELEASE_NOTES.md` for complete feature documentation.

## File Structure

```
/Users/admin/lift-member-app/
├── App.js                          # Main app component
├── app.json                         # Expo config
├── eas.json                         # EAS build config
├── LIFT_PROJECT/
│   ├── screens/
│   │   └── WorkoutsScreen.js       # Updated with rest day features
│   ├── components/
│   │   └── ExerciseCard.js         # Exercise logging
│   └── constants/
│       └── storageKeys.js          # Storage key definitions
└── RELEASE_NOTES.md                # Feature documentation
```

## Installation

Once APK is built:

```bash
# Using ADB
adb install lift-member-app-v1.8.5.apk

# Manual installation
# Transfer APK to Android device and open to install
```

## Testing Checklist

- [ ] Mark a day as rest day
- [ ] Toggle rest day back to workout
- [ ] Postpone a workout
- [ ] Handle rest day encounter during postponement
- [ ] Verify changes persist after restart
- [ ] Check day names display correctly

## Troubleshooting

### Build Fails
- Clear cache: `rm -rf node_modules && npm install`
- Clear Expo cache: `expo logout && expo login`
- Check Node version: `node -v` (should be 16+)

### APK Installation Fails
- Uninstall older version first
- Ensure device has Android 5.0+
- Check storage space available

### App Crashes
- Check app.json is valid: `cat app.json | jq .`
- Review error logs
- Try Expo Go first for testing

## Support

For issues or questions:
1. Check GitHub: https://github.com/rpnramesh/liftapp-releases
2. Review RELEASE_NOTES.md
3. Check build logs at EAS dashboard

## Next Steps

1. **Build the APK** using one of the options above
2. **Test the features** using the checklist
3. **Install on device** for production use
4. **Report feedback** via GitHub issues

---

**Build Config:** eas.json (preview profile for APK)  
**Version Source:** Remote (app.json)  
**Distribution:** Internal (for testing)  
**Status:** Ready to build

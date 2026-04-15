# LIFT Member App - v1.8.5 Release Notes

## 🎯 Overview
This release introduces intelligent workout scheduling features that allow members to take more control over their training schedule while respecting rest days.

## ✨ New Features

### 1. **Mark Days as Rest Days**
- Long-press any day card in the week view to access day options
- Toggle any workout day to mark it as a rest day
- Toggle rest days back to workout days
- Preferences are saved locally and persist across app sessions

**How to Use:**
1. Open the Workouts tab
2. Long-press on any day card
3. Select "Mark as Rest Day" or "Mark as Workout Day"
4. Changes are saved automatically

### 2. **Intelligent Workout Postponement**
- Postpone a workout to the next available day with one tap
- System automatically skips rest days while finding the next available slot
- Respects both trainer-assigned and user-marked rest days

**How to Use:**
1. Open the Workouts tab
2. Long-press on a workout day (non-rest day)
3. Select "Postpone Workout"
4. Follow the prompts if rest days are encountered

### 3. **Smart Rest Day Handling**
When postponing a workout and encountering a rest day:
- System asks if you want to assign the workout to that rest day
- **Option 1:** "Assign to [Day Name]" - Use that rest day for the workout
- **Option 2:** "Skip to Next Day" - Continue looking for another available day
- **Option 3:** "Cancel" - Abort the postponement

**Benefits:**
- Flexibility: Use rest days for critical workouts if needed
- Intelligent: Automatically finds the next available slot
- Smart: Preserves rest day structure while respecting your needs

## 🔄 How Rest Days Work

### Rest Day Types:
1. **Trainer-Assigned Rest Days** - Set by your trainer in the plan
2. **User-Marked Rest Days** - Days you personally mark as rest days

### Both Types Are Respected:
- Visible in the week view with a "Rest" label
- Shown with amber/gold highlighting
- Excluded from postponement searches unless you choose to use them

### Moving Workouts:
- Current day → becomes a rest day
- Destination day → becomes a workout day
- Predefined rest day structure → preserved

## 📊 Technical Details

### Data Storage:
- **Local Storage (AsyncStorage):** Rest day preferences saved on device
- **Persistent:** Data survives app restarts
- **Sync-Ready:** Compatible with Firestore backend when available

### Performance:
- Lightweight: Minimal impact on app performance
- Instant Updates: Changes apply immediately
- Optimized: Only necessary state updates

## 🐛 Bug Fixes
- Fixed rest day detection in workout scheduling
- Improved alert messaging for better UX
- Enhanced day selection logic

## ⚙️ Technical Changes
- Added `restDays` storage key for persistent preferences
- Updated `WorkoutsScreen` with long-press menu handling
- Implemented `postponeWorkout()` with rest day intelligence
- Enhanced `handlePostpone()` to consider local rest day overrides
- Improved day cycling logic for postponement

## 📱 Platform Support
- ✅ Android (APK)
- ✅ iOS (via TestFlight)
- ✅ Expo Go (for testing)

## 🔐 Security & Privacy
- No data transmitted to external servers (local storage only)
- All preferences stored on device
- Compatible with existing Firestore security

## 📝 Notes for Testers

### Testing Checklist:
- [ ] Mark a workout day as rest day
- [ ] Toggle a rest day back to workout day
- [ ] Postpone a workout to next available day
- [ ] Postpone and accept assignment to a rest day
- [ ] Postpone and skip multiple rest days
- [ ] Verify changes persist after app restart
- [ ] Test with multiple consecutive rest days

### Known Limitations:
- Changes are local to the device (trainer updates will override)
- Web version doesn't have this feature yet
- Requires app version 1.8.5 or higher

## 🚀 Installation & Download

### For Android:
1. Download the APK file from the release assets
2. Install using: `adb install lift-member-app.apk`
3. Or install manually on your Android device

### For iOS:
- Available on TestFlight
- Check your TestFlight app for the latest version

## 💬 Feedback & Support
Please report any issues or provide feedback in the GitHub issues section.

## 🙏 Credits
Feature implemented and tested with modern React Native best practices and Expo framework.

---

**Release Date:** April 15, 2026  
**Version:** 1.8.5  
**Build Number:** TBD  
**Platform:** Android (APK), iOS (IPA)  


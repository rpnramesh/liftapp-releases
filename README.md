# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

## CI releases (EAS)

This repository includes a GitHub Actions workflow that builds Android APKs using EAS and uploads them to a GitHub Release when a tag matching `testv.*` is pushed.

Required GitHub secrets (set in repository Settings → Secrets):

- `EXPO_TOKEN` — Expo/EAS token (used to authenticate EAS builds).
- `GITHUB_TOKEN` — provided automatically in Actions; used for release creation and uploads.
- Optional signing secrets (provide to have the workflow sign artifacts):
   - `ANDROID_KEYSTORE_BASE64` — base64-encoded keystore file (no newlines).
   - `KEYSTORE_PASSWORD` — keystore password.
   - `KEY_ALIAS` — keystore alias.
   - `KEY_PASSWORD` — key password (if different).

How to trigger a release:

1. Create and push a tag that matches `testv.*`, for example:

```bash
git tag testv.03
git push origin testv.03
```

2. The workflow `EAS Android Release` will run, perform an EAS build, download the generated APK, optionally sign it with the provided keystore, verify the signature, and upload the APK to a GitHub Release with the same tag.

Local fallback:

- `scripts/ci_build_and_release.sh` is provided as a Gradle-based fallback if you need to build and sign locally or without EAS. It requires a local Android SDK, JDK 17, and access to a keystore.

Notes:

- Keep your keystore and passwords secret. Do not commit keystores or `local.properties` to the repository.
- If you want me to also add a small badge or action status, tell me which release tag you want as the badge target.

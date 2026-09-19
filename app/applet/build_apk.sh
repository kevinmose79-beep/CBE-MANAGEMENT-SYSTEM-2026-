#!/bin/bash
set -e

echo "=== Starting APK Build Process ==="
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

if [ ! -f /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager ]; then
  echo "Installing Android SDK command-line tools..."
  mkdir -p /opt/android-sdk/cmdline-tools
  cd /opt/android-sdk/cmdline-tools
  wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
  unzip -q cmdline-tools.zip
  mv cmdline-tools latest
  rm cmdline-tools.zip
  cd /app/applet
fi

export ANDROID_HOME=/opt/android-sdk
export PATH=$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH

echo "Accepting Android SDK licenses and installing packages..."
yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools" >/dev/null || true

echo "Building web frontend..."
npm run build

echo "Syncing Capacitor Android project..."
npx cap sync android

echo "Compiling Android APK with Gradle..."
cd /app/applet/android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

echo "Copying output APK to root and public directories..."
cd /app/applet
mkdir -p public/downloads
find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} app-debug.apk \;
find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} public/downloads/app-debug.apk \;
find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} dist/app-debug.apk \; 2>/dev/null || true

echo "=== APK Build Succeeded ==="
ls -lh app-debug.apk public/downloads/app-debug.apk

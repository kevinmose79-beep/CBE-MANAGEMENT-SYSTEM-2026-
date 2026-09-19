#!/bin/bash
set -e

echo "=== 1. Installing OpenJDK 21 ==="
DEBIAN_FRONTEND=noninteractive apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-21-jdk ca-certificates-java wget unzip

echo "=== 2. Fixing Java configuration and SSL certificates ==="
find /etc/java-21-openjdk/ -name "*.dpkg-new" -exec sh -c 'for f; do mv "$f" "${f%.dpkg-new}"; done' sh {} + || true
ln -sf /usr/lib/jvm/java-21-openjdk-amd64 /usr/lib/jvm/default-java || true
update-alternatives --install /usr/bin/java java /usr/lib/jvm/java-21-openjdk-amd64/bin/java 2000 || true
update-alternatives --set java /usr/lib/jvm/java-21-openjdk-amd64/bin/java || true
/var/lib/dpkg/info/ca-certificates-java.postinst configure || true

export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH=$JAVA_HOME/bin:$PATH

java -version

echo "=== 3. Setting up Android SDK ==="
if [ ! -d "/opt/android-sdk/cmdline-tools/latest" ]; then
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

yes | sdkmanager --licenses >/dev/null || true
sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools" >/dev/null || true

echo "=== 4. Building web assets and syncing Capacitor ==="
cd /app/applet
npm run build
npx cap sync android

echo "=== 5. Building Android APK with Gradle ==="
cd /app/applet/android
chmod +x gradlew
./gradlew assembleDebug --no-daemon

echo "=== 6. Copying APK output ==="
cd /app/applet
mkdir -p public/downloads
find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} app-debug.apk \;
find android/app/build/outputs/apk/ -name "*.apk" -exec cp {} public/downloads/app-debug.apk \;

echo "=== APK BUILD COMPLETE ==="
ls -lh app-debug.apk public/downloads/app-debug.apk

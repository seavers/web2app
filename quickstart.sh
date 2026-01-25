#!/bin/bash

# Web2App Quickstart Script

COMMAND=$1

function show_help {
    echo "Usage: ./quickstart.sh [dev|app|prod]"
    echo ""
    echo "  dev   - Install dependencies and start local development server (with hot-reload)."
    echo "  app   - Build the Android Template APK (requires Gradle/Android SDK)."
    echo "  prod  - (Default) Bundle self-contained production server into ./dist."
    echo "  setup - Install system dependencies (Java, Android SDK, Apktool) - Ubuntu/Debian only."
    echo ""
}

if [ -z "$COMMAND" ]; then
    COMMAND="prod"
fi

# Try to load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set Node Version
nvm use 24 || echo "nvm not found or version 24 not installed, continuing with current node..."

if [ "$COMMAND" == "dev" ]; then

    echo ">>> Setting up Development Environment..."
    pnpm install
    echo ">>> Starting Server (Dev Mode)..."
    pnpm run dev

elif [ "$COMMAND" == "app" ]; then
    echo ">>> Building Android Template..."
    
    # Check for Android SDK
    if [ -z "$ANDROID_HOME" ]; then
        echo "WARNING: ANDROID_HOME is not set. Build might fail if SDK is not found."
    fi

    cd android-template
    
    # Use Wrapper if exists, else try global gradle
    if [ -f "./gradlew" ]; then
        chmod +x ./gradlew
        BUILD_CMD="./gradlew"
    else
        echo "Gradle wrapper not found, attempting to use global 'gradle' command..."
        BUILD_CMD="gradle"
    fi
    
    # Build Debug APK for template (easiest to build without signing config)
    $BUILD_CMD assembleDebug
    
    if [ $? -eq 0 ]; then
        echo ">>> Build Successful. Copying template..."
        # Path might vary depending on gradle version, usually:
        # app/build/outputs/apk/debug/app-debug.apk
        if [ -f "app/build/outputs/apk/debug/app-debug.apk" ]; then
            cp app/build/outputs/apk/debug/app-debug.apk ../template.apk
            echo ">>> 'template.apk' created in project root."
        else
            echo "ERROR: Could not locate built APK at app/build/outputs/apk/debug/app-debug.apk"
        fi
    else
        echo "ERROR: Gradle build failed."
        exit 1
    fi
    
    cd ..

elif [ "$COMMAND" == "prod" ]; then
    echo ">>> Building Production Release to ./dist..."
    
    # Clean dist
    rm -rf dist
    mkdir -p dist/server

    # Install dependencies (ensure esbuild is available)
    pnpm install

    # Bundle Server with esbuild
    echo ">>> Bundling server..."
    # We bundle to dist/server/index.js to manage relative paths (../public, ../template.apk) correctly
    ./node_modules/.bin/esbuild server/index.js --bundle --platform=node --outfile=dist/server/index.js

    # Copy Static Assets
    cp -r public dist/
    
    # Copy Assets (Template & Keystore) - Place in root of dist (matches ../template.apk from dist/server/)
    if [ -f "template.apk" ]; then
        cp template.apk dist/
    else
        echo "WARNING: template.apk not found. Production build might fail to generate apps."
    fi

    if [ -f "web2app.keystore" ]; then
        cp web2app.keystore dist/
    else
        echo "WARNING: web2app.keystore not found."
    fi

    echo ">>> Production build ready in ./dist"
    echo ">>> To run: cd dist && node server/index.js"

elif [ "$COMMAND" == "setup" ]; then
    echo ">>> Installing System Dependencies (Ubuntu/Debian)..."
    
    # Check if running as root
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root (sudo ./quickstart.sh setup)"
        exit 1
    fi

    # 1. Update & Install Basic Tools
    apt-get update
    apt-get install -y openjdk-17-jdk git unzip curl wget

    # 2. Install Apktool
    echo ">>> Installing Apktool..."
    wget https://raw.githubusercontent.com/iBotPeaches/Apktool/master/scripts/linux/apktool -O /usr/local/bin/apktool
    wget https://bitbucket.org/iBotPeaches/apktool/downloads/apktool_2.9.3.jar -O /usr/local/bin/apktool.jar
    chmod +x /usr/local/bin/apktool
    chmod +x /usr/local/bin/apktool.jar

    # 3. Install Android SDK Command Line Tools
    echo ">>> Installing Android SDK..."
    export ANDROID_HOME=/opt/android-sdk
    mkdir -p $ANDROID_HOME/cmdline-tools
    
    # Download Command Line Tools (latest as of now)
    wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
    unzip cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools
    mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
    rm cmdline-tools.zip

    # Accept Licenses & Install Build Tools
    yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;34.0.0" "platform-tools"

    # 4. Set Environment Variables
    echo ">>> Configuring Environment Variables..."
    
    # Add to .bashrc if not exists
    if ! grep -q "ANDROID_HOME" ~/.bashrc; then
        echo '' >> ~/.bashrc
        echo '# Android SDK' >> ~/.bashrc
        echo 'export ANDROID_HOME=/opt/android-sdk' >> ~/.bashrc
        echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
    fi

    echo ">>> Setup Complete!"
    echo "Please run 'source ~/.bashrc' to apply environment changes."
    echo "You can verify installation with: apktool -version && sdkmanager --version"

else
    show_help
    exit 1
fi

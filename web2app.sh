#!/bin/bash

# Web2App Quickstart Script

COMMAND=$1

function show_help {
    echo "Usage: ./web2app.sh [dev|build-apk|build|prod|setup-prod|setup-dev|setup-mac]"
    echo ""
    echo "  dev        - Install dependencies and start local development server (with hot-reload)."
    echo "  build-apk  - Build the Android Template APK (requires Gradle/Android SDK)."
    echo "  build      - Bundle self-contained production server into ./dist."
    echo "  prod       - Deploy/Restart app on server (Checks env, installs tools, starts via PM2)."
    echo "  setup-prod - Install JS runtime + Apktool + Signing tools (Minimal)."
    echo "  setup-dev  - Install Full Android SDK (for building templates)."
    echo "  setup-mac  - Install development tools on macOS (via Homebrew)."
    echo ""
}

if [ -z "$COMMAND" ]; then
    show_help
    exit 0
fi

# Try to load nvm if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Set Node Version (try 24, fallback silently)
if command -v nvm &> /dev/null; then
    nvm use 24 > /dev/null 2>&1 || true
fi

function build_dist {
    echo ">>> Building Production Release to ./dist..."
    
    # Clean dist
    rm -rf dist
    mkdir -p dist/server

    # Install dependencies (ensure esbuild is available)
    pnpm install

    # Bundle Server with esbuild
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

    if [ -f "config.json" ]; then
        cp config.json dist/
        echo ">>> Copied config.json."
    fi
    
    # Copy quickstart script (web2app.sh) for easy server execution
    cp web2app.sh dist/
    chmod +x dist/web2app.sh

    echo ">>> Production build ready in ./dist"
}

if [ "$COMMAND" == "dev" ]; then

    echo ">>> Setting up Development Environment..."
    pnpm install
    echo ">>> Starting Server (Dev Mode)..."
    pnpm run dev

elif [ "$COMMAND" == "build-apk" ]; then
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

elif [ "$COMMAND" == "build" ]; then
    build_dist

elif [ "$COMMAND" == "prod" ]; then
    # Server Deployment / Restart Script
    echo ">>> Starting Production Deployment..."

    # 1. Check and Install APK Tools
    echo ">>> Checking APK Tools..."
    MISSING_TOOLS=0
    if ! command -v apktool &> /dev/null; then MISSING_TOOLS=1; fi
    if ! command -v apksigner &> /dev/null; then MISSING_TOOLS=1; fi
    if ! command -v zipalign &> /dev/null; then MISSING_TOOLS=1; fi

    if [ $MISSING_TOOLS -eq 1 ]; then
        echo ">>> Missing required tools (apktool/apksigner/zipalign)."
        echo ">>> Attempting auto-setup (requires sudo/root)..."
        ./web2app.sh setup-prod
    else
        echo ">>> APK Tools are ready."
    fi

    # 2. Check and Install PM2
    if ! command -v pm2 &> /dev/null; then
        echo ">>> Installing PM2 globally..."
        npm install -g pm2
    fi

    # 3. Start/Restart Application
    # 4. Start/Restart Application
    echo ">>> Managing Process with PM2..."
    
    # Determine Entry Point
    APP_ENTRY=""
    if [ -f "server/index.js" ]; then
        # We are likely inside the 'dist' folder (deployed content) or dev root
        APP_ENTRY="server/index.js"
    elif [ -f "dist/server/index.js" ]; then
        # We are in project root and dist exists
        APP_ENTRY="dist/server/index.js"
    else
        echo "WARNING: Could not find server/index.js or dist/server/index.js."
        echo "If you are in the project root, run './web2app.sh build' first."
    fi

    if [ ! -z "$APP_ENTRY" ]; then
        # Check if process exists and restart, else start
        if pm2 list | grep -q "web2app"; then
            echo ">>> Reloading web2app..."
            pm2 reload web2app
        else
            echo ">>> Starting web2app ($APP_ENTRY)..."
            pm2 start "$APP_ENTRY" --name web2app
        fi
        
        pm2 save
        echo ">>> Deployment Complete. Application is running."
        echo ">>> Monitor with: pm2 monit"
    fi

elif [ "$COMMAND" == "setup-prod" ]; then
    echo ">>> Installing Production Dependencies (Ubuntu/Debian)..."
    
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root (sudo ./web2app.sh setup-prod)"
        exit 1
    fi

    # 1. Install Java, Git, Unzip
    apt-get update
    apt-get install -y openjdk-17-jdk git unzip curl wget

    # 2. Install Signing Tools (apksigner, zipalign) and Apktool
    # Note: Apktool in apt might be older, but usually sufficient.
    apt-get install -y apksigner zipalign apktool

    echo ">>> Production Setup Complete!"
    echo "Verify with: apktool -version && apksigner --version"

elif [ "$COMMAND" == "setup-dev" ]; then
    echo ">>> Installing Development Dependencies (Full Android SDK)..."
    
    if [ "$EUID" -ne 0 ]; then
        echo "Please run as root (sudo ./web2app.sh setup-dev)"
        exit 1
    fi

    # 1. Base tools from prod (incl. apktool)
    apt-get update
    apt-get install -y openjdk-17-jdk git unzip curl wget apktool
    
    # 2. Install Android SDK Command Line Tools
    echo ">>> Installing Android SDK..."
    export ANDROID_HOME=/opt/android-sdk
    mkdir -p $ANDROID_HOME/cmdline-tools
    
    if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
        wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
        unzip cmdline-tools.zip -d $ANDROID_HOME/cmdline-tools
        mv $ANDROID_HOME/cmdline-tools/cmdline-tools $ANDROID_HOME/cmdline-tools/latest
        rm cmdline-tools.zip
    fi

    # 3. Install Build Tools & Platforms (Needed for compiling templates)
    yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
    $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;34.0.0" "platform-tools" "platforms;android-33"

    # 4. Env Vars
    if ! grep -q "ANDROID_HOME" ~/.bashrc; then
        echo '' >> ~/.bashrc
        echo 'export ANDROID_HOME=/opt/android-sdk' >> ~/.bashrc
        echo 'export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools' >> ~/.bashrc
    fi

    echo ">>> Dev Setup Complete!"
    echo "Please run 'source ~/.bashrc'"

elif [ "$COMMAND" == "setup-mac" ]; then
    echo ">>> Installing Development Tools on macOS (via Homebrew)..."

    if ! command -v brew &> /dev/null; then
        echo "Error: Homebrew is not installed."
        exit 1
    fi

    # 1. Install Java
    echo ">>> Installing OpenJDK 17..."
    brew install openjdk@17

    # 2. Install Apktool
    echo ">>> Installing Apktool..."
    brew install apktool

    # 3. Install Android SDK Tools (usually via Cask or cmdline-tools)
    echo ">>> Installing Android Command Line Tools..."
    brew install --cask android-commandlinetools

    echo ">>> macOS Setup Complete!"
    echo "Note: You may need to link openjdk: sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk"
    echo "Make sure ANDROID_HOME is set in your shell profile."
    echo "Typical path: export ANDROID_HOME=/usr/local/share/android-commandlinetools (Intel) or /opt/homebrew/share/android-commandlinetools (Apple Silicon)"

else
    show_help
    exit 1
fi

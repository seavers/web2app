#!/bin/bash

# Web2App Quickstart Script

COMMAND=$1

function show_help {
    echo "Usage: ./quickstart.sh [dev|app|prod]"
    echo ""
    echo "  dev   - Install dependencies and start local development server (with hot-reload)."
    echo "  app   - Build the Android Template APK (requires Gradle/Android SDK)."
    echo "  prod  - (Default) Build production-ready code into ./dist directory."
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
    mkdir -p dist

    # Install dependencies
    pnpm install

    # Copy Source Code
    cp -r server dist/
    cp -r public dist/
    cp package.json dist/

    # Copy Assets (Template & Keystore)
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

    # Install Production Dependencies in dist
    cd dist
    echo ">>> Installing dependencies in ./dist..."
    pnpm install --prod
    
    echo ">>> Production build ready in ./dist"
    echo ">>> To run: cd dist && node server/index.js"

else
    show_help
    exit 1
fi

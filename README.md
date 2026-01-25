# Web2App Generator

A service to generate Android Apps (APKs) that wrap a specific Website URL.

## Prerequisites

1.  **Node.js** (v24+) - Managed via `nvm`.
2.  **pnpm**: Package manager.
2.  **Java** (JDK 17 recommended)
3.  **Apktool**: Must be in your system PATH (`apktool`).
4.  **Android SDK** (for building the template).

## Quick Start (web2app.sh)

We provide a `web2app.sh` script to manage the lifecycle of the project.

### 1. Build the Template (First Time)
Before generating apps, you must build the base Android Template.
```bash
./web2app.sh build-apk
```
*   This compiles the project in `android-template/` and places `template.apk` in the root.
*   **Requirements**: You need Gradle or Android SDK configured (use `./web2app.sh setup-dev` to install).

### 2. Run Development Server
To run the server locally with hot-reloading:
```bash
./web2app.sh dev
```
*   Access the UI at: http://localhost:3001

### 3. Production Deployment

**Step A: Build Production Bundle**
Compiles the Node.js server and assets into a standalone `dist/` directory.
```bash
./web2app.sh build
```

**Step B: Start Production Server**
Starts or reloads the application using PM2. This command ensures dependencies are installed and manages the process.
```bash
./web2app.sh prod
```

### 4. Environment Setup (Optional)

We provide helper commands to set up dependencies for different environments:

*   **Production Server (Linux)**: Installs Java, Apktool, Signing tools.
    ```bash
    sudo ./web2app.sh setup-prod
    ```
*   **Development (Linux)**: Installs full Android SDK for building templates.
    ```bash
    sudo ./web2app.sh setup-dev-linux
    ```
*   **Development (macOS)**: Installs tools via Homebrew.
    ```bash
    ./web2app.sh setup-dev-macosx
    ```

## Configuration

*   **config.json**: Manage runtime configurations like `port` and `appIdBase`.
*   **Keystore**: Place your signing key as `web2app.keystore` in the root directory.
*   **Environment**: `PORT` environment variable can override `config.json`.

## Documentation

*   [API Documentation & JS Bridge](API.md)

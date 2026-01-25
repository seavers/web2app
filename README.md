# Web2App Generator

A service to generate Android Apps (APKs) that wrap a specific Website URL.

## Prerequisites

1.  **Node.js** (v24+) - Managed via `nvm`.
2.  **pnpm**: Package manager.
2.  **Java** (JDK 11+ recommended)
3.  **Apktool**: Must be in your system PATH (`apktool`).
4.  **Android SDK** (for building the template).

## Quick Start

We provide a `quickstart.sh` script to manage the project.

### 1. Build the Template
Before generating apps, you must build the base Android Template.
```bash
./quickstart.sh app
```
*   This compiles the project in `android-template/` and places `template.apk` in the root.
*   **Requirements**: You need Gradle or Android SDK configured.

### 2. Run Development Server
To run the server with hot-reloading:
```bash
./quickstart.sh dev
```
*   Access the UI at: http://localhost:3001

### 3. Run Production Server
To run in production mode:
```bash
./quickstart.sh prod
# OR simply
./quickstart.sh
```

## Configuration

*   **Keystore**: Place your signing key as `my-release-key.keystore` in the root directory.
    *   Update `server/generator.js` if you use different passwords/aliases.
*   **Port**: Set `PORT` environment variable to change the link port (default 3001).

## Documentation

*   [API Documentation & JS Bridge](API_DOCS.md)

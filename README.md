# Web2App 生成器

一个用于生成包装特定网站 URL 的 Android 应用 (APK) 的服务。

## 前置条件

1.  **Node.js** (v24+) - 通过 `nvm` 管理。
2.  **pnpm**: 包管理器。
3.  **Java** (推荐 JDK 17)
4.  **Apktool**: 必须在系统 PATH 中 (`apktool`)。
5.  **Android SDK** (用于构建模板)。

## 快速开始 (web2app.sh)

我们提供了一个 `web2app.sh` 脚本来管理项目的生命周期。

### 1. 构建模板 (首次运行)
在生成应用之前，必须先构建基础的 Android 模板。
```bash
./web2app.sh build-apk
```
*   这会编译 `android-template/` 中的项目并将 `template.apk` 放置在根目录下。
*   **要求**: 需要配置有 Gradle 或 Android SDK（可以使用 `./web2app.sh setup-dev` 进行安装）。

### 2. 运行开发服务器
在本地运行并启用热重载：
```bash
./web2app.sh dev
```
*   访问界面: http://localhost:3001

### 3. 生产环境部署

**步骤 A: 构建生产版本**
将 Node.js 服务器和静态资源编译到独立的 `dist/` 目录中。
```bash
./web2app.sh build
```

**步骤 B: 启动生产服务器**
使用 PM2 启动或重载应用。此命令将确保安装了依赖并管理进程。
```bash
./web2app.sh prod
```

### 4. 环境配置 (可选)

我们提供了一些辅助命令来为不同环境配置依赖项：

*   **生产服务器 (Linux)**: 安装 Java、Apktool、签名工具。
    ```bash
    sudo ./web2app.sh setup-prod
    ```
*   **开发环境 (Linux)**: 安装完整的 Android SDK 用于构建模板。
    ```bash
    sudo ./web2app.sh setup-dev-linux
    ```
*   **开发环境 (macOS)**: 通过 Homebrew 安装工具。
    ```bash
    ./web2app.sh setup-dev-macosx
    ```

## 配置项

*   **config.json**: 管理诸如 `port` 和 `appIdBase` 之类的运行时配置。
*   **Keystore**: 将签名密钥作为 `web2app.keystore` 放置在根目录中。
*   **环境变量**: `PORT` 环境变量可以覆盖 `config.json` 的设置。

## 文档

*   [API 及 JS 桥接能力文档](API.md)
*   [Android 原生能力接入指南](ANDROID_CAPABILITIES.md)

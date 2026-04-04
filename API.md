# Web2App API 文档

## 1. JavaScript 桥接 (App 原生能力)

生成的 Android 应用内置了一个名为 `Web2App` 的 JavaScript 桥接，允许网页与 Android 设备文件系统等进行交互。

> **注意**: 这些方法仅在网页加载到生成的 Android 应用内部时可用。在调用之前，请检查它们是否存在。您也可以参考 [Android原生能力接入指南](ANDROID_CAPABILITIES.md) 了解更多与原生交互的功能（如文件上传、下载等）。

### 检查是否可用
```javascript
if (window.Web2App) {
    // App 原生能力可用
}
```

### 方法

#### `readFile(filename)`
从应用程序的外部文件私有目录读取文件。

*   **参数**:
    *   `filename` (String): 要读取的文件名 (相对于应用的外部存储根目录)。
*   **返回值**: 
    *   (String): 读取成功则返回文件内容。
    *   (null): 如果文件不存在或发生错误返回 null。
*   **示例**:
```javascript
const content = window.Web2App.readFile('my_data.txt');
if (content) {
    console.log('文件内容:', content);
}
```

#### `writeFile(filename, content)`
将文本内容写入应用程序的外部私有目录中的文件。

*   **参数**:
    *   `filename` (String): 要写入的文件名。
    *   `content` (String): 要写入的字符串内容。
*   **返回值**:
    *   (boolean): 成功时为 `true`，否则为 `false`。
*   **示例**:
```javascript
const success = window.Web2App.writeFile('my_data.txt', 'Hello World');
if (success) {
    console.log('文件保存成功');
}
```

---

## 2. Server 端 API

后端服务器提供以下接口用于应用生成。

### 生成 App
**接口**: `POST /api/generate`

根据配置的 URL 等参数触发生成一个 APK。

*   **请求体** (`application/json`):
    ```json
    {
        "url": "https://example.com"
    }
    ```
*   **响应**:
    *   **成功 (200)**:
        ```json
        {
            "success": true,
            "downloadUrl": "/download/GenApp_1234.apk",
            "filename": "GenApp_1234.apk"
        }
        ```
    *   **失败 (400/500)**:
        ```json
        {
            "error": "错误信息",
            "details": "堆栈跟踪或详细信息"
        }
        ```

### 下载 App
**接口**: `GET /download/:filename`

下载已生成的 APK。

*   **参数**:
    *   `filename`: 生成 API 返回的文件名。

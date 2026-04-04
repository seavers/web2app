# Android 原生能力接入指南

生成的 Android 应用（Web2App）内部已经预埋并支持了多种常见的原生能力交互支持。您可以直接在前端（H5）项目中通过 Web 标准语法，或者利用我们提供的桥接直接实现与 Android 原生系统的交互。

## 1. 上传文件、图片与打开本地文件

您无需调用特殊的 Android 端方法，直接使用网页标准 HTML 的 `<input type="file">` 标签即可呼出 Android 原生系统的文件、图片以及各类媒体选择器。

### 选择一般文件
```html
<!-- 允许用户浏览和选中设备上的文件 -->
<input type="file" id="fileUpload" />
```

### 选取图片或拍照
如果需要专门选择图片或直接拉起图库选图操作，请通过 `accept` 属性明确限制为图片类型：
```html
<!-- 直接呼出图片选择器 -->
<input type="file" accept="image/*" id="imageUpload" />
```

### 支持多选
只需在原生标签上添加 `multiple` 属性，Android 选择器自然会支持多文件勾选能力。
```html
<!-- 允许选中多张图片或多个文件 -->
<input type="file" accept="image/*" multiple id="multipleImageUpload" />
```

## 2. 文件下载能力 (Download)

在 Web2App 内，普通文件或者特定链接的下载将被 WebView 原生监听拦截，转而调用 Android 系统自带的下载管理器（DownloadManager），以原生方式处理并发下载并通知进度。

**触发方式**：
无论是通过标准的 `<a>` 标签使用 `download` 属性，还是通过 JavaScript 修改 `window.location.href`，只要请求的资源被识别为文件（或带有 `Content-Disposition: attachment` 标识），App 就会全自动启动系统的后台下载进程，并在系统通知栏中给出下载进度与完成通知。

### 示例代码
```html
<!-- 使用常规超链接方式触发下载 -->
<a href="https://example.com/some-file.pdf" download>点击我下载 PDF</a>

<!-- 或使用 JavaScript 控制链接跳转触发下载 -->
<button onclick="downloadFile()">脚本点击下载</button>
<script>
function downloadFile() {
    window.location.href = "https://example.com/some-file.pdf";
}
</script>
```

## 3. 本地通知发送能力 (Local Notifications)

App 默认在加载页面的生命周期内 Polyfill (垫片支持) 并且直接注入了针对底层 Android System Notification 的网页标准接口。这意味着您无需繁琐处理，而是能像对待普通电脑版浏览器上一样使用 [Web Notification API](https://developer.mozilla.org/zh-CN/docs/Web/API/Notification)！您发出的消息会无缝转交给 Android 原生的消息管理器弹出通知。

### 示例代码
```javascript
// 先检查全局环境是否支持该标准，然后在我们的 Web2App 中即可畅享该原生 API
if ("Notification" in window) {
    // 请求权限：Web2App 中会默认直接 mock 返回 'granted' (默认拥有能力)
    Notification.requestPermission().then(function (permission) {
        if (permission === "granted") {
            // 参数1：通知标题；参数2：配置对象中的 body 字段为具体通知内容
            new Notification("重要消息提醒", {
                body: "您有一条新的账单等待查收！"
            });
        }
    });
}
```

## 4. 本地读写应用文件 (App 内专属存储)

利用由 WebView 向全局直接挂载的全局变量 `window.Web2App`，可以在您的 JS 业务代码内以同步、直接调用的手段向 Android app 外置文件系统写缓存或持久化数据。

### 写入文本配置至设备
```javascript
if (window.Web2App) {
    // 参数1为相对其私有目录的具体文件名，参数2为具体的字符串内容
    const isSuccess = window.Web2App.writeFile('user_preferences.json', '{"theme": "dark"}');
    if (isSuccess) {
         console.log('配置保存至本地存储成！');
    }
}
```

### 读取已存在的文件配置
```javascript
if (window.Web2App) {
    // 传递确切的文件名称以进行同步检索读取
    const content = window.Web2App.readFile('user_preferences.json');
    if (content) {
         console.log('读取到持久化存储的数据：', content);
    }
}
```

---
*注：由于系统安全策略的升级，本地通知等强视觉干扰能力在 Android 13 (API Level 33) 及更新版本的系统上，首屏载入时会自发的向用户请求批准 `POST_NOTIFICATIONS` 权限。请确保对因拒绝权限引发的无效通知有兜底准备。*

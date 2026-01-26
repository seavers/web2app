# Web2App API Documentation

## 1. JavaScript Bridge (App Capability)

The generated Android App includes a JavaScript Bridge named `Web2App` that allows the web page to interact with the Android device file system.

> **Note**: These methods are only available when the page is loaded inside the generated Android App. You should check for their existence before calling them.

### Check Availability
```javascript
if (window.Web2App) {
    // App capabilities available
}
```

### Methods

#### `readFile(filename)`
Reads a file from the app's external files directory.

*   **Parameters**:
    *   `filename` (String): The name of the file to read (relative to app's external storage root).
*   **Returns**: 
    *   (String): File content if successful.
    *   (null): If file does not exist or error occurs.
*   **Example**:
```javascript
const content = window.Web2App.readFile('my_data.txt');
if (content) {
    console.log('File content:', content);
}
```

#### `writeFile(filename, content)`
Writes text content to a file in the app's external files directory.

*   **Parameters**:
    *   `filename` (String): The name of the file to write.
    *   `content` (String): The string content to write.
*   **Returns**:
    *   (boolean): `true` if successful, `false` otherwise.
*   **Example**:
```javascript
const success = window.Web2App.writeFile('my_data.txt', 'Hello World');
if (success) {
    console.log('File saved successfully');
}
```

---

## 2. Server API

The backend server exposes the following endpoints for app generation.

### Generate App
**Endpoint**: `POST /api/generate`

Triggers the generation of an APK from a URL.

*   **Request Body** (`application/json`):
    ```json
    {
        "url": "https://example.com"
    }
    ```
*   **Response**:
    *   **Success (200)**:
        ```json
        {
            "success": true,
            "downloadUrl": "/download/GenApp_1234.apk",
            "filename": "GenApp_1234.apk"
        }
        ```
    *   **Error (400/500)**:
        ```json
        {
            "error": "Error message",
            "details": "Stack trace or details"
        }
        ```

### Download App
**Endpoint**: `GET /download/:filename`

Downloads a generated APK.

*   **Parameters**:
    *   `filename`: The filename returned by the generate API.

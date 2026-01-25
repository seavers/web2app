document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const urlInput = document.getElementById('urlInput');
    const appNameGroup = document.getElementById('appNameGroup');
    const appNameInput = document.getElementById('appNameInput');
    const appIconPreview = document.getElementById('appIconPreview');
    const statusDiv = document.getElementById('status');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    let fetchMetaTimeout;

    // Listen for URL input changes to fetch metadata
    urlInput.addEventListener('input', () => {
        const url = urlInput.value.trim();

        // Hide name group if URL is cleared
        if (!url) {
            appNameGroup.style.display = 'none';
            appIconPreview.style.display = 'none';
            return;
        }

        if (isValidUrl(url)) {
            // Debounce fetch
            clearTimeout(fetchMetaTimeout);
            fetchMetaTimeout = setTimeout(() => fetchSmartTitle(url), 500);
        }
    });

    async function fetchSmartTitle(url) {
        // Show field with placeholder
        appNameGroup.style.display = 'block';
        appNameInput.placeholder = '正在获取推荐标题...';

        try {
            const response = await fetch('/api/meta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await response.json();

            if (data.title) {
                // Only fill if user hasn't manually edited it yet (heuristic)
                // or simply overwrite for now as it's a suggestion
                appNameInput.value = data.title;
            }

            if (data.icon) {
                appIconPreview.src = data.icon;
                appIconPreview.style.display = 'block';
            } else {
                appIconPreview.style.display = 'none';
            }
        } catch (e) {
            console.error('Meta fetch failed', e);
            appNameInput.placeholder = '请输入 App 名称';
        }
    }

    generateBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        const appName = appNameInput.value.trim();

        if (!url) {
            showStatus('请输入有效的网址', 'error');
            return;
        }

        if (!isValidUrl(url)) {
            showStatus('请输入完整的 URL (例如: https://baidu.com)', 'error');
            return;
        }

        if (!appName) {
            showStatus('请输入 App 名称', 'error');
            appNameInput.focus();
            return;
        }

        // Reset UI
        resultDiv.innerHTML = '';
        generateBtn.disabled = true;
        loadingDiv.style.display = 'block';
        showStatus('正在生成您的 App... 请稍候片刻。', 'info');

        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ url, appName })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '生成失败');
            }

            // Success
            loadingDiv.style.display = 'none';
            showStatus('App 生成成功!', 'success');

            const downloadLink = document.createElement('a');
            downloadLink.href = data.downloadUrl;
            downloadLink.className = 'download-link';
            downloadLink.textContent = `下载 ${data.filename}`;
            resultDiv.appendChild(downloadLink);

        } catch (error) {
            console.error(error);
            loadingDiv.style.display = 'none';
            showStatus(`错误: ${error.message}`, 'error');
        } finally {
            generateBtn.disabled = false;
        }
    });

    function showStatus(msg, type) {
        statusDiv.textContent = msg;
        statusDiv.style.color = type === 'error' ? '#e74c3c' : (type === 'success' ? '#27ae60' : '#7f8c8d');
    }

    function isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }
});

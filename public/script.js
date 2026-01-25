document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const urlInput = document.getElementById('urlInput');
    const statusDiv = document.getElementById('status');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    generateBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showStatus('请输入有效的网址', 'error');
            return;
        }

        if (!isValidUrl(url)) {
            showStatus('请输入完整的 URL (例如: https://baidu.com)', 'error');
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
                body: JSON.stringify({ url })
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

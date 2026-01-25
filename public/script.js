document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generateBtn');
    const urlInput = document.getElementById('urlInput');
    const statusDiv = document.getElementById('status');
    const loadingDiv = document.getElementById('loading');
    const resultDiv = document.getElementById('result');

    generateBtn.addEventListener('click', async () => {
        const url = urlInput.value.trim();
        if (!url) {
            showStatus('Please enter a valid URL', 'error');
            return;
        }

        if (!isValidUrl(url)) {
            showStatus('Please enter a valid absolute URL (e.g. https://google.com)', 'error');
            return;
        }

        // Reset UI
        resultDiv.innerHTML = '';
        generateBtn.disabled = true;
        loadingDiv.style.display = 'block';
        showStatus('Generating your App... This may take a minute.', 'info');

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
                throw new Error(data.error || 'Generation failed');
            }

            // Success
            loadingDiv.style.display = 'none';
            showStatus('App Generated Successfully!', 'success');

            const downloadLink = document.createElement('a');
            downloadLink.href = data.downloadUrl;
            downloadLink.className = 'download-link';
            downloadLink.textContent = `Download ${data.filename}`;
            resultDiv.appendChild(downloadLink);

        } catch (error) {
            console.error(error);
            loadingDiv.style.display = 'none';
            showStatus(`Error: ${error.message}`, 'error');
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

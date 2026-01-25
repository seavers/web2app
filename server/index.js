const express = require('express');
const cors = require('cors');
const path = require('path');
const { generateApk } = require('./generator');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/download', express.static(path.join(__dirname, '../releases')));

app.post('/api/generate', async (req, res) => {
    const { url } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const filename = await generateApk(url);
        res.json({
            success: true,
            downloadUrl: `/download/${filename}`,
            filename
        });
    } catch (error) {
        console.error("Generation failed:", error);
        res.status(500).json({ error: 'Generation failed', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

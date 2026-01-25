const express = require('express');
const cors = require('cors');
const path = require('path');
const { generateApk, extractMeta } = require('./generator');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/download', express.static(path.join(__dirname, '../releases')));
app.use('/uploaded-icons', express.static(path.join(__dirname, '../images')));

// Configure Multer for uploads
const multer = require('multer');
const fs = require('fs-extra');
const UPLOADS_DIR = path.join(__dirname, '../images');
fs.ensureDirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, UPLOADS_DIR);
    },
    filename: function (req, file, cb) {
        // Keep original extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, 'icon-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

app.post('/api/upload-icon', upload.single('iconFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    // Return the URL to access this file
    const fileUrl = `${req.protocol}://${req.get('host')}/uploaded-icons/${req.file.filename}`;
    res.json({ url: fileUrl });
});

app.post('/api/meta', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    try {
        const meta = await extractMeta(url);
        res.json(meta);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch metadata' });
    }
});

app.post('/api/generate', async (req, res) => {
    const { url, appName, iconUrl } = req.body;
    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        const filename = await generateApk(url, appName, iconUrl);
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

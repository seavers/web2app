const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const Jimp = require('jimp');

const MIPMAP_SIZES = {
    'mipmap-mdpi': 48,
    'mipmap-hdpi': 72,
    'mipmap-xhdpi': 96,
    'mipmap-xxhdpi': 144,
    'mipmap-xxxhdpi': 192
};

async function downloadIcon(url, destPath) {
    const writer = fs.createWriteStream(destPath);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function startProcessingIcon(sourceIconPath, resDir) {
    try {
        const image = await Jimp.read(sourceIconPath);

        for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
            const destDir = path.join(resDir, folder);
            await fs.ensureDir(destDir);

            await image
                .clone()
                .resize(size, size)
                .writeAsync(path.join(destDir, 'ic_launcher.png'));

            // Also creating round icon (simple circle crop or just reuse square for now to keep it simple, 
            // ideally we'd apply a mask but just resizing and saving as different name is a good start)
            await image
                .clone()
                .resize(size, size)
                .circle()
                .writeAsync(path.join(destDir, 'ic_launcher_round.png'));
        }
    } catch (err) {
        console.error('Error processing icons:', err);
        throw err;
    }
}

module.exports = {
    downloadIcon,
    startProcessingIcon
};

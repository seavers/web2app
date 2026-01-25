const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

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
        responseType: 'stream',
        validateStatus: (status) => status >= 200 && status < 300
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
}

async function startProcessingIcon(sourceIconPath, resDir) {
    try {
        // Sharp can handle many formats including SVG, PNG, JPEG, TIFF, GIF, WEBP.
        // ICO support depends on the platform libvips, but usually it works or we can try to force format.
        // If the file has a wrong extension, sharp usually detects via magic numbers.

        const image = sharp(sourceIconPath);

        // Ensure we can read it.
        const metadata = await image.metadata();
        console.log(`Processing icon: ${sourceIconPath} (Format: ${metadata.format})`);

        for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
            const destDir = path.join(resDir, folder);
            await fs.ensureDir(destDir);

            // Square icon
            await image
                .clone()
                .resize(size, size)
                .toFile(path.join(destDir, 'ic_launcher.png'));

            // Round icon
            // Create a circle mask
            const circle = Buffer.from(
                `<svg><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" /></svg>`
            );

            await image
                .clone()
                .resize(size, size)
                .composite([{
                    input: circle,
                    blend: 'dest-in'
                }])
                .toFile(path.join(destDir, 'ic_launcher_round.png'));
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

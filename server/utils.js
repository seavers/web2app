const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');


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
        const { Jimp } = await import("jimp");
        const image = await Jimp.read(sourceIconPath);

        console.log(`Processing icon: ${sourceIconPath} (MIME: ${image.mime})`);

        for (const [folder, size] of Object.entries(MIPMAP_SIZES)) {
            const destDir = path.join(resDir, folder);
            await fs.ensureDir(destDir);

            // Square Icon
            const squareIcon = image.clone();
            squareIcon.resize({ w: size, h: size });
            await squareIcon.write(path.join(destDir, 'ic_launcher.png'));

            // Round Icon
            // Create a circle mask
            const roundIcon = image.clone();
            roundIcon.resize({ w: size, h: size });

            // Create a mask instance
            const mask = new Jimp({ width: size, height: size, color: 0x00000000 });

            // Draw a white circle on the mask
            // Scan through all pixels of the mask
            const center = size / 2;
            const radius = size / 2;
            mask.scan(0, 0, size, size, (x, y, idx) => {
                const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
                if (dist <= radius) {
                    mask.bitmap.data[idx + 0] = 255; // R
                    mask.bitmap.data[idx + 1] = 255; // G
                    mask.bitmap.data[idx + 2] = 255; // B
                    mask.bitmap.data[idx + 3] = 255; // Alpha
                }
            });

            // Mask the image
            roundIcon.mask(mask);

            await roundIcon.write(path.join(destDir, 'ic_launcher_round.png'));
        }
    } catch (err) {
        console.error('Error processing icons (Jimp):', err);
        throw err;
    }
}

module.exports = {
    downloadIcon,
    startProcessingIcon
};

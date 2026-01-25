const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { downloadIcon, startProcessingIcon } = require('./utils');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, '../temp');
const RELEASES_DIR = path.join(__dirname, '../releases');
const TEMPLATE_APK = path.join(__dirname, '../template.apk');
const KEYSTORE_PATH = path.join(__dirname, '../web2app.keystore'); // User must provide this
// Default values for keystore - in a real app these should be configurable
const KEY_ALIAS = 'my-key-alias';
const KEY_PASS = 'password';
const STORE_PASS = 'password';

async function extractMeta(url) {
    try {
        const res = await axios.get(url);
        const dom = new JSDOM(res.data);
        const title = dom.window.document.querySelector('title')?.textContent || 'My App';

        let icon = '';
        const iconRel = dom.window.document.querySelector('link[rel*="icon"]');
        if (iconRel) {
            icon = iconRel.href;
            if (!icon.startsWith('http')) {
                const urlObj = new URL(url);
                icon = new URL(icon, urlObj.origin).toString();
            }
        } else {
            const urlObj = new URL(url);
            icon = `${urlObj.origin}/favicon.ico`;
        }

        return { title, icon };
    } catch (e) {
        console.error('Error fetching meta:', e);
        return { title: 'Generated App', icon: '' };
    }
}

function runCommand(cmd, cwd) {
    return new Promise((resolve, reject) => {
        exec(cmd, { cwd }, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error executing ${cmd}:`, stderr);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function generateApk(targetUrl) {
    const jobId = uuidv4();
    const workDir = path.join(TEMP_DIR, jobId);

    // 1. Prepare Workspace
    await fs.ensureDir(workDir);

    // 2. Extract Metadata (Title, Icon)
    const { title, icon } = await extractMeta(targetUrl);
    console.log(`Generating app for: ${targetUrl}, Title: ${title}, Icon: ${icon}`);

    // 3. Decompile Template
    if (!fs.existsSync(TEMPLATE_APK)) {
        throw new Error("template.apk not found in root directory!");
    }

    // apktool d template.apk -o <workDir>/decoded -f
    const decodedDir = path.join(workDir, 'decoded');
    await runCommand(`apktool d "${TEMPLATE_APK}" -o "${decodedDir}" -f`, workDir);

    // 4. Update Resources
    // Updating strings.xml
    const stringsPath = path.join(decodedDir, 'res/values/strings.xml');
    let stringsXml = await fs.readFile(stringsPath, 'utf-8');

    // Simple regex replacement for demonstration. In production, XML parsing is safer.
    // Assuming standard format from our template
    stringsXml = stringsXml.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${title}</string>`);
    stringsXml = stringsXml.replace(/<string name="start_url">.*?<\/string>/, `<string name="start_url">${targetUrl}</string>`);

    await fs.writeFile(stringsPath, stringsXml);

    // 5. Update Icon
    if (icon) {
        try {
            const iconPath = path.join(workDir, 'icon.png');
            await downloadIcon(icon, iconPath);
            await startProcessingIcon(iconPath, path.join(decodedDir, 'res'));
        } catch (e) {
            console.error("Failed to process icon, using default.", e);
        }
    }

    // 6. Build APK
    // apktool b decoded -o output.apk
    const unsignedApk = path.join(workDir, 'unsigned.apk');
    await runCommand(`apktool b "${decodedDir}" -o "${unsignedApk}"`, workDir);

    // 7. Sign APK
    const finalApkName = `${title.replace(/[^a-z0-9]/gi, '_')}_${jobId.substring(0, 8)}.apk`;
    const finalApkPath = path.join(RELEASES_DIR, finalApkName);
    await fs.ensureDir(RELEASES_DIR);

    // Using debug keystore or provided keystore? Requires jarsigner or apksigner.
    // Assuming apksigner is available. And we need a keystore.
    // If no keystore exists, we can generate a debug one or fail. 
    // For this task, let's assume 'my-release-key.keystore' exists as per plan instructions.

    if (!fs.existsSync(KEYSTORE_PATH)) {
        // Fallback: Just move the unsigned APK if we can't sign it? No, Android won't install it.
        // We'll throw an error or try to generate a key.
        // For simplicity: Throw error.
        throw new Error("Keystore not found. Please provide 'my-release-key.keystore'");
    }

    // Sign with apksigner
    // Command: apksigner sign --ks my-release-key.keystore --ks-pass pass:password --key-pass pass:password --out release.apk unsigned.apk
    // Note: apksigner might require the APK to be zipaligned first if using v1 signing only, but modern apktool builds might need alignment.
    // Actually, apktool builds valid zips, but zipalign is recommended before signing.

    // Let's assume zipalign is in path too.
    const alignedApk = path.join(workDir, 'aligned.apk');
    try {
        await runCommand(`zipalign -p -f -v 4 "${unsignedApk}" "${alignedApk}"`, workDir);
    } catch (e) {
        console.warn("zipalign failed or not found, attempting to sign unaligned apk.");
        await fs.copy(unsignedApk, alignedApk);
    }

    await runCommand(`apksigner sign --ks "${KEYSTORE_PATH}" --ks-pass pass:${STORE_PASS} --key-pass pass:${KEY_PASS} --out "${finalApkPath}" "${alignedApk}"`, workDir);

    // Cleanup
    // await fs.remove(workDir); // Keep for debug for now

    return finalApkName;
}

module.exports = { generateApk };

const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { v4: uuidv4 } = require('uuid');
const { downloadIcon, startProcessingIcon } = require('./utils');
const cheerio = require('cheerio'); // Use Cheerio instead of JSDOM for better bundling support
const axios = require('axios');

const TEMP_DIR = path.join(__dirname, '../temp');
const RELEASES_DIR = path.join(__dirname, '../releases');
const TEMPLATE_APK = path.join(__dirname, '../template.apk');
const KEYSTORE_PATH = path.join(__dirname, '../web2app.keystore'); // User must provide this
// Default values for keystore - in a real app these should be configurable
const KEY_ALIAS = 'my-key-alias';
const KEY_PASS = 'password';
const STORE_PASS = 'password';

const getSmartTitle = (fullTitle, url) => {
    // Generate fallback from domain
    let domainFallback = 'My App';
    if (url) {
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname.replace(/^www\./, '');
            const domainPart = hostname.split('.')[0];
            if (domainPart) {
                domainFallback = domainPart.charAt(0).toUpperCase() + domainPart.slice(1);
            }
        } catch (e) { /* ignore */ }
    }

    if (!fullTitle) return domainFallback;

    // Stop words to exclude
    const stopWords = ['home', 'homepage', 'index', 'welcome', 'main', 'page', 'archive', 'category', 'tag', 'default', 'untitled'];

    // Separators to split by: hyphen, pipe, underscore, colon (en/cn), dash (en/em)
    const parts = fullTitle.split(/[-|_:：|–—]/).map(p => p.trim()).filter(p => p.length > 0);

    if (parts.length === 0) return domainFallback;

    // Strategy:
    // 1. Look for the longest part that is NOT just a stop word.
    // 2. OR if all are stop words, just take the first part.
    // 3. Prefer parts at the ends (often Brand Name).

    let bestPart = parts[0];

    // Usually the Brand is at the end "Article Title - Brand Name" or at start "Brand Name - Slogan"
    // Let's try to pick the shortest relevant part for "App Name" (usually Brand), 
    // OR the most descriptive part if it's a specific page.

    // For App Name, shorter is usually better but must be meaningful.
    // Let's filter out stop words first.
    const relevantParts = parts.filter(p => !stopWords.includes(p.toLowerCase()));

    if (relevantParts.length > 0) {
        // Heuristic: If there are multiple parts, the one with 2-15 chars is likely a good Brand Name.
        const brandLike = relevantParts.find(p => p.length >= 2 && p.length <= 15);
        if (brandLike) {
            bestPart = brandLike;
        } else {
            // Otherwise take the first relevant part
            bestPart = relevantParts[0];
        }
    } else {
        // If all parts were stop words, checking if we should fallback to domain or keep first part
        // Often "Home" is not a good app name.
        if (stopWords.includes(bestPart.toLowerCase())) {
            return domainFallback;
        }
    }

    return bestPart;
};

async function extractMeta(url) {
    const maxRetries = 2;
    let attempts = 0;
    let html = '';
    let finalUrl = url;

    while (attempts <= maxRetries) {
        attempts++;
        try {
            console.log(`[Meta] Fetching ${url} (Attempt ${attempts}/${maxRetries + 1})...`);

            const res = await axios.get(url, {
                timeout: 15000,
                maxRedirects: 5,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
                },
                validateStatus: null // Don't throw on status code, handle manually
            });

            console.log(`[Meta] ${url} -> Status: ${res.status}, Body Size: ${res.data ? res.data.length : 0}`);

            if (res.status >= 200 && res.status < 400) {
                html = res.data;
                // Update finalUrl in case of redirect (if axios provides it, mostly logical)
                if (res.request && res.request.res && res.request.res.responseUrl) {
                    finalUrl = res.request.res.responseUrl;
                }
                break;
            } else {
                console.warn(`[Meta] Failed with status ${res.status}`);
                if (attempts > maxRetries) break;
            }
        } catch (e) {
            console.error(`[Meta] Error during fetch: ${e.message}`);
            if (attempts > maxRetries) break;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1500));
    }

    console.log(`[Meta] Final Effective URL: ${finalUrl}`);

    // Default return structure
    const getDefaults = () => {
        const smartTitle = getSmartTitle('', url);
        // Try to guess favicon location if we failed to fetch page
        const u = new URL(finalUrl || url);
        const icon = `${u.origin}/favicon.ico`;
        return { title: smartTitle, icon, fullTitle: '' };
    };

    if (!html) {
        console.log('[Meta] Could not retrieve content, using defaults.');
        return getDefaults();
    }

    try {
        const $ = cheerio.load(html);
        const fullTitle = $('title').text() || '';
        console.log(`[Meta] Extracted Title: "${fullTitle}"`);

        const smartTitle = getSmartTitle(fullTitle, url);

        let icon = '';
        // Try multiple icon sources in order
        const iconRel =
            $('link[rel="apple-touch-icon"]').attr('href') ||
            $('link[rel="icon"]').attr('href') ||
            $('link[rel="shortcut icon"]').attr('href');

        if (iconRel) {
            icon = iconRel;
            if (!icon.startsWith('http')) {
                icon = new URL(icon, finalUrl).toString();
            }
        } else {
            const urlObj = new URL(finalUrl);
            icon = `${urlObj.origin}/favicon.ico`;
        }

        console.log(`[Meta] Final - Title: "${smartTitle}", Icon: "${icon}"`);
        return { title: smartTitle, icon, fullTitle };
    } catch (e) {
        console.error('[Meta] Parsing error:', e);
        return getDefaults();
    }
}

const findAndroidTool = (toolName) => {
    let androidHome = process.env.ANDROID_HOME;

    // Fix: If ANDROID_HOME points to a subdirectory (like platforms/android-36), define proper SDK root
    if (androidHome && (androidHome.includes('/platforms/') || androidHome.endsWith('/platforms'))) {
        // Attempt to move up two levels if it looks like .../sdk/platforms/android-36
        // Or one level if .../sdk/platforms
        // Safest strategy: Look for 'build-tools' relative to standard SDK structure variants
        // or just clean up the path string.

        // Assumption: User path is .../sdk/platforms/android-36
        // We need .../sdk
        if (androidHome.endsWith('/platforms/android-36')) {
            androidHome = path.dirname(path.dirname(androidHome));
        } else if (path.basename(path.dirname(androidHome)) === 'platforms') {
            androidHome = path.dirname(path.dirname(androidHome));
        }
    }

    // Try to find in ANDROID_HOME first
    if (androidHome) {
        let buildToolsDir = path.join(androidHome, 'build-tools');

        // Fallback: Check if user actually pointed closely to root but maybe slightly off, 
        // or ensure we really have the root. 
        if (!fs.existsSync(buildToolsDir)) {
            // Maybe ANDROID_HOME was .../sdk/platforms/android-36 and our slice logic failed or was different
            // Let's try to look "up" the tree until we find build-tools or hit root
            let currentDir = androidHome;
            for (let i = 0; i < 3; i++) { // Try going up 3 levels max
                if (fs.existsSync(path.join(currentDir, 'build-tools'))) {
                    buildToolsDir = path.join(currentDir, 'build-tools');
                    break;
                }
                currentDir = path.dirname(currentDir);
            }
        }

        if (fs.existsSync(buildToolsDir)) {
            const versions = fs.readdirSync(buildToolsDir).sort().reverse();
            if (versions.length > 0) {
                const toolPath = path.join(buildToolsDir, versions[0], toolName);
                if (fs.existsSync(toolPath)) return toolPath;
            }
        }
    }
    // Fallback to system path (assumes toolName is in PATH)
    return toolName;
};

const KEYSTORES_DIR = path.join(__dirname, '../keystores');

function runCommand(cmd, cwd) {
    // Basic substitution to ensure we use absolute paths if available/needed
    // ... (existing logic)
    let finalCmd = cmd;
    if (cmd.startsWith('apksigner')) {
        finalCmd = cmd.replace('apksigner', `"${findAndroidTool('apksigner')}"`);
    } else if (cmd.startsWith('zipalign')) {
        finalCmd = cmd.replace('zipalign', `"${findAndroidTool('zipalign')}"`);
    }
    // We don't need to replace keytool usually, as it's in JAVA_HOME/bin or PATH

    return new Promise((resolve, reject) => {
        exec(finalCmd, { cwd, env: process.env }, (error, stdout, stderr) => { // Inherit env
            if (error) {
                console.error(`Error executing ${finalCmd}:`, stderr);
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function getOrCreateKeystore(hostname) {
    await fs.ensureDir(KEYSTORES_DIR);
    const sanitizedHostname = hostname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const keystorePath = path.join(KEYSTORES_DIR, `${sanitizedHostname}.keystore`);

    if (fs.existsSync(keystorePath)) {
        return keystorePath;
    }

    console.log(`Generating new keystore for ${hostname}...`);
    // Generate new keystore
    // keytool -genkeypair -v -keystore <path> -alias <alias> -keyalg RSA -keysize 2048 -validity 10000 -storepass <pass> -keypass <pass> -dname "CN=<hostname>, OU=Web2App, O=Web2App, L=Internet, ST=Internet, C=WW"
    const dname = `CN=${hostname}, OU=Web2App, O=Web2App, L=Internet, ST=Internet, C=WW`;
    const cmd = `keytool -genkeypair -v -keystore "${keystorePath}" -alias "${KEY_ALIAS}" -keyalg RSA -keysize 2048 -validity 10000 -storepass "${STORE_PASS}" -keypass "${KEY_PASS}" -dname "${dname}"`;

    await runCommand(cmd, KEYSTORES_DIR);
    return keystorePath;
}

async function generateApk(targetUrl, customAppName, customIconUrl) {
    const jobId = uuidv4();
    const workDir = path.join(TEMP_DIR, jobId);

    // 1. Prepare Workspace (Copy Source Template)
    const ANDROID_TEMPLATE = path.join(__dirname, '../android-template');
    await fs.ensureDir(workDir);
    await fs.copy(ANDROID_TEMPLATE, workDir);

    // 2. Extract Metadata & Prepare Config
    const meta = await extractMeta(targetUrl);
    const title = customAppName || meta.title;
    const icon = customIconUrl || meta.icon; // Priority: custom > meta

    console.log(`Generating app for: ${targetUrl}, Title: ${title}, Icon: ${icon}`);

    // 3. Configure Package Name (Application ID)
    const BASE_PACKAGE_PREFIX = process.env.APP_ID_BASE || 'online.dahai.web2app';
    const urlObjForPkg = new URL(targetUrl);
    let pkgSuffix = urlObjForPkg.hostname.replace(/[^a-zA-Z0-9]/g, '_');
    if (/^\d/.test(pkgSuffix)) pkgSuffix = 'app_' + pkgSuffix;
    const newPackageName = `${BASE_PACKAGE_PREFIX}.${pkgSuffix}`;

    console.log(`[Config] New Package Name: ${newPackageName}`);

    // Update build.gradle
    const buildGradlePath = path.join(workDir, 'app/build.gradle');
    let buildGradleContent = await fs.readFile(buildGradlePath, 'utf-8');
    buildGradleContent = buildGradleContent.replace(/applicationId "com.example.web2app"/, `applicationId "${newPackageName}"`);
    await fs.writeFile(buildGradlePath, buildGradleContent);

    // 4. Update Resources (strings.xml)
    const stringsPath = path.join(workDir, 'app/src/main/res/values/strings.xml');
    let stringsXml = await fs.readFile(stringsPath, 'utf-8');
    stringsXml = stringsXml.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${title}</string>`);
    stringsXml = stringsXml.replace(/<string name="start_url">.*?<\/string>/, `<string name="start_url">${targetUrl}</string>`);
    await fs.writeFile(stringsPath, stringsXml);

    // 5. Update Icon
    if (icon) {
        try {
            const iconPath = path.join(workDir, 'icon.png');
            await downloadIcon(icon, iconPath);
            await startProcessingIcon(iconPath, path.join(workDir, 'app/src/main/res'));
        } catch (e) {
            console.error("Failed to process icon, using default.", e);
        }
    }

    // 6. Build APK using Gradle
    console.log('[Build] Starting Gradle Build...');
    await runCommand('chmod +x gradlew', workDir);

    // Use assembleRelease. 
    // Note: Since we don't have a signing config in gradle, it typically produces `app-release-unsigned.apk`.
    try {
        await runCommand('./gradlew app:assembleRelease', workDir);
    } catch (e) {
        console.error('Gradle build failed:', e);
        throw new Error('Gradle build failed. Check logs.');
    }

    const apkOutputDir = path.join(workDir, 'app/build/outputs/apk/release');
    let unsignedApkName = 'app-release-unsigned.apk';
    // Fallback search for apk if name differs
    if (!fs.existsSync(path.join(apkOutputDir, unsignedApkName))) {
        const files = await fs.readdir(apkOutputDir);
        const apkFile = files.find(f => f.endsWith('.apk'));
        if (apkFile) unsignedApkName = apkFile;
        else throw new Error('Gradle build finished but APK not found.');
    }

    const unsignedApk = path.join(apkOutputDir, unsignedApkName);

    // 7. Sign APK
    // Naming convention: Domain_Path_JobId
    const urlObj = new URL(targetUrl);
    let namePart = urlObj.hostname.replace('www.', '').replace(/\./g, '_');
    if (urlObj.pathname && urlObj.pathname !== '/') {
        namePart += urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
    }
    // Remove duplicate underscores and cleanup
    namePart = namePart.replace(/_+/g, '_').replace(/^_|_$/g, '');

    // Suffix: yyyyMMddHHmmss
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
        (now.getMonth() + 1).toString().padStart(2, '0') +
        now.getDate().toString().padStart(2, '0') +
        now.getHours().toString().padStart(2, '0') +
        now.getMinutes().toString().padStart(2, '0') +
        now.getSeconds().toString().padStart(2, '0');

    const finalApkName = `${namePart}_${timestamp}.apk`;
    const finalApkPath = path.join(RELEASES_DIR, finalApkName);
    await fs.ensureDir(RELEASES_DIR);

    // Using dynamic keystore based on hostname
    const hostname = urlObj.hostname;
    let currentKeystorePath;
    try {
        currentKeystorePath = await getOrCreateKeystore(hostname);
    } catch (e) {
        console.error("Failed to generate/retrieve keystore:", e);
        throw new Error("Keystore generation failed.");
    }

    if (!fs.existsSync(currentKeystorePath)) {
        throw new Error("Keystore not found after generation attempt.");
    }

    // Zipalign (Recommended before signing)
    const alignedApk = path.join(workDir, 'aligned.apk');
    try {
        await runCommand(`zipalign -p -f -v 4 "${unsignedApk}" "${alignedApk}"`, workDir);
    } catch (e) {
        console.warn("zipalign failed or not found, attempting to sign unaligned apk.");
        await fs.copy(unsignedApk, alignedApk);
    }

    // Sign with apksigner
    await runCommand(`apksigner sign --ks "${currentKeystorePath}" --ks-pass pass:${STORE_PASS} --key-pass pass:${KEY_PASS} --out "${finalApkPath}" "${alignedApk}"`, workDir);

    // Remove the .idsig file generated by apksigner
    const idsigPath = `${finalApkPath}.idsig`;
    if (fs.existsSync(idsigPath)) {
        await fs.remove(idsigPath);
    }

    // Generate Log
    const stats = await fs.stat(finalApkPath);
    const sizeInMb = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`[Build] Success! APK: releases/${finalApkName} (${sizeInMb} MB)`);

    // Cleanup (optional, maybe keep for debug)
    // await fs.remove(workDir);

    return finalApkName;
}

module.exports = { generateApk, extractMeta };
const title = customAppName || meta.title;

// Priority: customIconUrl > meta.icon
const icon = customIconUrl || meta.icon;

console.log(`Generating app for: ${targetUrl}, Title: ${title}, Icon: ${icon}`);

// 3. Decompile Template
if (!fs.existsSync(TEMPLATE_APK)) {
    throw new Error("template.apk not found in root directory!");
}

// apktool d template.apk -o <workDir>/decoded -f
const decodedDir = path.join(workDir, 'decoded');
await runCommand(`apktool d "${TEMPLATE_APK}" -o "${decodedDir}" -f`, workDir);

// 3.5 Update Package Name (Application ID) to be unique
// Configuration for base package
const BASE_PACKAGE_PREFIX = process.env.APP_ID_BASE || 'online.dahai.web2app';

// Derive distinct suffix from hostname
// e.g. www.12306.cn -> www_12306_cn
const urlObjForPkg = new URL(targetUrl);
let pkgSuffix = urlObjForPkg.hostname.replace(/[^a-zA-Z0-9]/g, '_');
// Package parts cannot start with number (though suffix might be fine if prefix ends with dot, but safer to prefix if needed)
if (/^\d/.test(pkgSuffix)) {
    pkgSuffix = 'app_' + pkgSuffix;
}
const newPackageName = `${BASE_PACKAGE_PREFIX}.${pkgSuffix}`;

const manifestPath = path.join(decodedDir, 'AndroidManifest.xml');
let manifestContent = await fs.readFile(manifestPath, 'utf-8');

// Regex to find old package name
const packageMatch = manifestContent.match(/package="([^"]+)"/);
if (packageMatch && packageMatch[1]) {
    const oldPackage = packageMatch[1];
    console.log(`[Manifest] Replacing old package '${oldPackage}' with '${newPackageName}'`);

    // CRITICAL FIX: The Activity Class Name MUST NOT change because we are not moving the Smali code.
    // It must remain pointing to "com.example.web2app.MainActivity".
    // However, we MUST change the package name and provider authorities to avoid conflicts.

    // 1. Protect the Activity Name
    // We know the activity is fully qualified as com.example.web2app.MainActivity in our template
    const activityClass = `${oldPackage}.MainActivity`;
    const placeholder = "___ACTIVITY_CLASS_PLACEHOLDER___";

    // Replace exact class name occurances with placeholder
    // Note: Global replace
    manifestContent = manifestContent.split(activityClass).join(placeholder);

    // 2. Globally replace the old package name with the new one
    // This updates 'package="..."', 'android:authorities="..."', and permissions
    manifestContent = manifestContent.split(oldPackage).join(newPackageName);

    // 3. Restore the Activity Name
    manifestContent = manifestContent.split(placeholder).join(activityClass);

} else {
    console.warn("[Manifest] Could not find package name to replace!");
}

await fs.writeFile(manifestPath, manifestContent);
console.log(`[Manifest] Updated package name to: ${newPackageName} (preserved Activity class)`);

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
// Naming convention: Domain_Path_JobId
// e.g. dahai_online_blog_archive_12345678.apk
// Reuse urlObjForPkg or create new one
const urlObj = new URL(targetUrl);
let namePart = urlObj.hostname.replace('www.', '').replace(/\./g, '_');
if (urlObj.pathname && urlObj.pathname !== '/') {
    namePart += urlObj.pathname.replace(/[^a-zA-Z0-9]/g, '_');
}
// Remove duplicate underscores and cleanup
namePart = namePart.replace(/_+/g, '_').replace(/^_|_$/g, '');

// Suffix: yyyyMMddHHmmss
const now = new Date();
const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0');

// const finalApkName = `${title.replace(/[^a-z0-9]/gi, '_')}_${jobId.substring(0,8)}.apk`;
const finalApkName = `${namePart}_${timestamp}.apk`;
const finalApkPath = path.join(RELEASES_DIR, finalApkName);
await fs.ensureDir(RELEASES_DIR);

// Using dynamic keystore based on hostname
const hostname = urlObj.hostname;
let currentKeystorePath;
try {
    currentKeystorePath = await getOrCreateKeystore(hostname);
} catch (e) {
    console.error("Failed to generate/retrieve keystore:", e);
    throw new Error("Keystore generation failed.");
}

if (!fs.existsSync(currentKeystorePath)) {
    throw new Error("Keystore not found after generation attempt.");
}

// Sign with apksigner
// ...

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

await runCommand(`apksigner sign --ks "${currentKeystorePath}" --ks-pass pass:${STORE_PASS} --key-pass pass:${KEY_PASS} --out "${finalApkPath}" "${alignedApk}"`, workDir);

// Remove the .idsig file generated by apksigner (v4 signing)
const idsigPath = `${finalApkPath}.idsig`;
if (fs.existsSync(idsigPath)) {
    await fs.remove(idsigPath);
}

// Cleanup
// await fs.remove(workDir); // Keep for debug for now

// Generate Log
const stats = await fs.stat(finalApkPath);
const sizeInMb = (stats.size / 1024 / 1024).toFixed(2);
console.log(`[Build] Success! APK: releases/${finalApkName} (${sizeInMb} MB)`);

return finalApkName;
}

module.exports = { generateApk, extractMeta };

/**
 * Package creation script
 * Creates a zip file of the project excluding node_modules
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const zipPath = path.join(projectRoot, 'client-data-aggregator.zip');

console.log('Creating package...');
console.log(`Project root: ${projectRoot}`);
console.log(`Output: ${zipPath}`);

// Remove existing zip if it exists
if (fs.existsSync(zipPath)) {
    fs.removeSync(zipPath);
    console.log('Removed existing zip file');
}

// Create zip using PowerShell on Windows
try {
    // Files to include (exclude node_modules, .env, outputs)
    const command = `Compress-Archive -Path src,scripts,tests,config,data/test_urls.json,package.json,package-lock.json,jest.config.js,README.md,.gitignore -DestinationPath client-data-aggregator.zip -Force`;

    execSync(command, {
        cwd: projectRoot,
        shell: 'powershell.exe',
        stdio: 'inherit'
    });

    console.log(`\n✓ Package created successfully: ${zipPath}`);

    // Get file size
    const stats = fs.statSync(zipPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  Size: ${sizeMB} MB`);

} catch (error) {
    console.error('Error creating package:', error.message);
    process.exit(1);
}

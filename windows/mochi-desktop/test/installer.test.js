const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('recovery override expands after upstream definitions and before old uninstall calls', () => {
  // This depends on the pinned builder template's hook order. Fail on upgrades
  // that would silently reinstate the old uninstaller or skip app termination.
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.devDependencies['electron-builder'], '26.15.3');
  assert.equal(pkg.build.nsis.include, 'build/installer.nsh');
  const template = read('node_modules/app-builder-lib/templates/nsis/installer.nsi');
  assert.ok(template.indexOf('!include "installUtil.nsh"') < template.indexOf('!include "installSection.nsh"'));
  const section = read('node_modules/app-builder-lib/templates/nsis/installSection.nsh');
  assert.ok(section.indexOf('!insertmacro CHECK_APP_RUNNING') < section.indexOf('!insertmacro uninstallOldVersion'));
  assert.ok(section.indexOf('!insertmacro uninstallOldVersion') < section.indexOf('!insertmacro installApplicationFiles'));
  assert.match(read('build/installer.nsh'), /!ifndef BUILD_UNINSTALLER\s+!include "\$\{BUILD_RESOURCES_DIR\}\/recovery-upgrade\.nsh"/);
});

test('recovery upgrade cannot run old uninstallers or delete app data', () => {
  const code = read('build/recovery-upgrade.nsh').split('\n').filter(line => !line.trim().startsWith('#')).join('\n');
  assert.match(code, /!macroundef uninstallOldVersion/);
  assert.match(code, /!macro uninstallOldVersion ROOT_KEY/);
  assert.doesNotMatch(code, /\b(?:ExecWait|Exec|Delete|RMDir|DeleteRegKey|Call)\b/);
  assert.match(code, /ClearErrors\s+StrCpy \$R0 0/);
  assert.equal(JSON.parse(read('package.json')).build.nsis.deleteAppDataOnUninstall, false);
  assert.match(read('main.js'), /app\.setPath\('userData',\s*path\.join\(app\.getPath\('appData'\),\s*'mochi-desktop'\)\)/);
});

test('recovery refuses changing an existing installation directory or scope', () => {
  const code = read('build/recovery-upgrade.nsh');
  assert.match(code, /ReadRegStr \$R1 \$\{ROOT_KEY\} "\$\{INSTALL_REGISTRY_KEY\}" InstallLocation/);
  assert.match(code, /GetFullPathName \$R1 "\$R1"/);
  assert.match(code, /GetFullPathName \$R0 "\$INSTDIR"/);
  assert.match(code, /\$\{If\} \$R1 != \$R0[\s\S]*SetErrorLevel 2\s+Quit/);
});

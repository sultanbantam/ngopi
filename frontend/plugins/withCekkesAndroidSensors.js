const fs = require('fs');
const path = require('path');
const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('@expo/config-plugins');

const PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_HEALTH',
  'android.permission.HIGH_SAMPLING_RATE_SENSORS',
  'android.permission.PACKAGE_USAGE_STATS',
];

function withCekkesAndroidSensors(config) {
  // 1. Add permissions & ForegroundService declaration to AndroidManifest.xml
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest.$['xmlns:tools']) {
      manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }
    if (!Array.isArray(manifest['uses-permission'])) {
      manifest['uses-permission'] = [];
    }

    for (const perm of PERMISSIONS) {
      const exists = manifest['uses-permission'].some(
        (p) => p.$ && p.$['android:name'] === perm
      );
      if (!exists) {
        const entry = { $: { 'android:name': perm } };
        if (perm === 'android.permission.PACKAGE_USAGE_STATS') {
          entry.$['tools:ignore'] = 'ProtectedPermissions';
        }
        manifest['uses-permission'].push(entry);
      }
    }

    const app = manifest.application && manifest.application[0];
    if (app) {
      if (!Array.isArray(app.service)) {
        app.service = [];
      }
      const serviceName = 'top.ngopi.app.cekkes.CekkesForegroundService';
      const hasService = app.service.some(
        (s) => s.$ && s.$['android:name'] === serviceName
      );
      if (!hasService) {
        app.service.push({
          $: {
            'android:name': serviceName,
            'android:exported': 'false',
            'android:foregroundServiceType': 'health',
          },
        });
      }
    }

    return cfg;
  });

  // 2. Copy Kotlin native files into android/app/src/main/java/top/ngopi/app/cekkes/
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      const srcDir = path.join(__dirname, 'android-cekkes');
      const destDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        'top',
        'ngopi',
        'app',
        'cekkes'
      );
      fs.mkdirSync(destDir, { recursive: true });
      for (const file of [
        'CekkesForegroundService.kt',
        'CekkesBackgroundModule.kt',
        'CekkesBackgroundPackage.kt',
      ]) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, file));
      }
      return cfg;
    },
  ]);

  // 3. Register CekkesBackgroundPackage in MainApplication.kt
  config = withMainApplication(config, (cfg) => {
    let contents = cfg.modResults.contents;
    if (!contents.includes('top.ngopi.app.cekkes.CekkesBackgroundPackage')) {
      contents = contents.replace(
        /import\s+expo\.modules\.ApplicationLifecycleDispatcher/,
        'import top.ngopi.app.cekkes.CekkesBackgroundPackage\nimport expo.modules.ApplicationLifecycleDispatcher'
      );
    }
    if (!contents.includes('add(CekkesBackgroundPackage())')) {
      contents = contents.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        'PackageList(this).packages.apply {\n              add(CekkesBackgroundPackage())'
      );
    }
    cfg.modResults.contents = contents;
    return cfg;
  });

  return config;
}

module.exports = withCekkesAndroidSensors;

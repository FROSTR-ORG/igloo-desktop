const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  
  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;

  console.log('Starting notarization process...');
  console.log('App path:', `${appOutDir}/${appName}.app`);
  
  // Check environment variables
  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;
  
  console.log('Environment check:');
  console.log('APPLE_ID:', appleId ? 'SET' : 'NOT SET');
  console.log('APPLE_APP_SPECIFIC_PASSWORD:', applePassword ? 'SET' : 'NOT SET');
  console.log('APPLE_TEAM_ID:', teamId ? 'SET' : 'NOT SET');
  
  if (!appleId || !applePassword || !teamId) {
    console.warn('Skipping notarization: Required environment variables not set');
    return;
  }

  return await notarize({
    appBundleId: context.packager.appInfo.id,
    appPath: `${appOutDir}/${appName}.app`,
    appleId: appleId,
    appleIdPassword: applePassword,
    teamId: teamId,
  });
}; 
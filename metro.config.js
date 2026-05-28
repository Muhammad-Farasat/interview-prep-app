const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Needed for Clerk
config.resolver.unstable_enablePackageExports = true;

// Needed for Supabase Realtime
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'ws' || moduleName === 'stream') {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;  
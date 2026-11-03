const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Ensure 'react-native' package.json field is prioritised so libraries
    // like react-native-camera-kit resolve to their TypeScript src/ files
    // (needed for New Architecture / Fabric codegen component registration).
    resolverMainFields: ['react-native', 'browser', 'main'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

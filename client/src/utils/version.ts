/**
 * Version Management System
 * Tracks application version and provides cache management functionality
 */

const CURRENT_VERSION = 48;
const VERSION_KEY = 'app_version';
const CACHE_KEYS = [
  'inbound_calls_cache',
  'filter_options_cache',
  'user_preferences',
  'table_state',
  'import_history'
];

export interface VersionInfo {
  version: number;
  timestamp: number;
  buildId: string;
}

/**
 * Get current application version
 */
export const getCurrentVersion = (): number => {
  return CURRENT_VERSION;
};

/**
 * Get version info with timestamp and build ID
 */
export const getVersionInfo = (): VersionInfo => {
  return {
    version: CURRENT_VERSION,
    timestamp: Date.now(),
    buildId: `build-${CURRENT_VERSION}-${Date.now().toString(36)}`
  };
};

/**
 * Check if version has changed since last visit
 */
export const hasVersionChanged = (): boolean => {
  const storedVersion = localStorage.getItem(VERSION_KEY);
  if (!storedVersion) {
    return true;
  }
  
  try {
    const versionInfo = JSON.parse(storedVersion) as VersionInfo;
    return versionInfo.version !== CURRENT_VERSION;
  } catch {
    return true;
  }
};

/**
 * Update stored version info
 */
export const updateStoredVersion = (): void => {
  const versionInfo = getVersionInfo();
  localStorage.setItem(VERSION_KEY, JSON.stringify(versionInfo));
};

/**
 * Clear all application cache
 */
export const clearAllCache = (): Promise<void> => {
  return new Promise((resolve) => {
    // Clear localStorage cache
    CACHE_KEYS.forEach(key => {
      localStorage.removeItem(key);
    });
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear any browser cache if possible
    if ('caches' in window) {
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        console.log('[CACHE] All caches cleared successfully');
        resolve();
      }).catch(() => {
        console.log('[CACHE] Cache clearing completed with some limitations');
        resolve();
      });
    } else {
      console.log('[CACHE] Browser cache API not available, cleared localStorage and sessionStorage');
      resolve();
    }
  });
};

/**
 * Get cache size information
 */
export const getCacheInfo = (): { keys: string[], totalSize: number } => {
  const cacheKeys: string[] = [];
  let totalSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      cacheKeys.push(key);
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += new Blob([value]).size;
      }
    }
  }
  
  return { keys: cacheKeys, totalSize };
};

/**
 * Initialize version system on app start
 */
export const initializeVersionSystem = (): void => {
  if (hasVersionChanged()) {
    console.log(`[VERSION] Version updated to ${CURRENT_VERSION}`);
    updateStoredVersion();
    
    // Optionally clear cache on version change
    // clearAllCache();
  } else {
    console.log(`[VERSION] Current version ${CURRENT_VERSION} is up to date`);
  }
};

/**
 * Increment version (for development/testing)
 */
export const incrementVersion = (): number => {
  // This would typically be handled by build process
  // For demo purposes, we'll simulate version increment
  const newVersion = CURRENT_VERSION + 1;
  console.log(`[VERSION] Simulating version increment to ${newVersion}`);
  return newVersion;
};
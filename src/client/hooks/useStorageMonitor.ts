import { useState, useCallback } from 'react';

import { storageService } from '../services/StorageService';

export interface StorageMonitorReturn {
  storageSize: number; // in bytes
  storageSizeFormatted: string;
  isNearLimit: boolean;
  cleanupOldData: (daysToKeep: number) => void;
  refreshStorageInfo: () => void;
}

// Typical localStorage limit is 5-10MB
const STORAGE_LIMIT = 5 * 1024 * 1024; // 5MB
const WARNING_THRESHOLD = 0.8; // Warn at 80% usage

export function useStorageMonitor(): StorageMonitorReturn {
  const [storageSize, setStorageSize] = useState(() => storageService.getStorageSize());
  const [isNearLimit, setIsNearLimit] = useState(
    () => storageService.getStorageSize() > STORAGE_LIMIT * WARNING_THRESHOLD
  );

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const refreshStorageInfo = useCallback(() => {
    const size = storageService.getStorageSize();
    setStorageSize(size);
    setIsNearLimit(size > STORAGE_LIMIT * WARNING_THRESHOLD);
  }, []);

  const cleanupOldData = useCallback(
    (daysToKeep: number) => {
      storageService.cleanupOldData(daysToKeep);
      refreshStorageInfo();
    },
    [refreshStorageInfo]
  );

  return {
    storageSize,
    storageSizeFormatted: formatBytes(storageSize),
    isNearLimit,
    cleanupOldData,
    refreshStorageInfo,
  };
}

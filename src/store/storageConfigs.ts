import { create } from 'zustand';
import { fetchStorageConfigs } from '@/api/configs';
import type { StorageConfig } from '@/types';

interface StorageConfigsState {
  storageConfigs: StorageConfig[];
  isLoading: boolean;
  // Actions
  loadStorageConfigs: () => Promise<void>;
  refreshStorageConfigs: () => Promise<void>;
}

export const useStorageConfigsStore = create<StorageConfigsState>()((set) => ({
  storageConfigs: [],
  isLoading: false,

  loadStorageConfigs: async () => {
    set({ isLoading: true });
    try {
      const configs = await fetchStorageConfigs();
      const configArray = Array.isArray(configs) ? configs : [];
      const filteredConfigs = configArray.filter(config => config.category === 'storage' && config.is_enabled);
      set({ storageConfigs: filteredConfigs });
    } catch (error) {
      console.error('Failed to load storage configs:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  refreshStorageConfigs: async () => {
    try {
      const configs = await fetchStorageConfigs();
      const configArray = Array.isArray(configs) ? configs : [];
      const filteredConfigs = configArray.filter(config => config.category === 'storage' && config.is_enabled);
      set({ storageConfigs: filteredConfigs });
    } catch (error) {
      console.error('Failed to refresh storage configs:', error);
    }
  },
}));

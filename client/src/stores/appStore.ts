import { create } from 'zustand';
import type { HealthStatus } from '../types';
import { healthApi } from '../services/api';

interface AppStore {
  health: HealthStatus | null;
  healthLoading: boolean;
  sidebarCollapsed: boolean;

  fetchHealth: () => Promise<void>;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  health: null,
  healthLoading: false,
  sidebarCollapsed: false,

  fetchHealth: async () => {
    set({ healthLoading: true });
    const res = await healthApi.get();
    if (res.success && res.data) {
      set({ health: res.data as HealthStatus, healthLoading: false });
    } else {
      set({ healthLoading: false });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

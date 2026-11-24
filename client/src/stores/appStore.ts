import { create } from 'zustand';
import type { HealthStatus } from '../types';
import { healthApi } from '../services/api';

interface AppStore {
  health: HealthStatus | null;
  healthLoading: boolean;
  /** True once at least one health probe has finished (success or failure). */
  healthChecked: boolean;
  sidebarCollapsed: boolean;

  fetchHealth: () => Promise<void>;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  health: null,
  healthLoading: false,
  healthChecked: false,
  sidebarCollapsed: false,

  fetchHealth: async () => {
    set({ healthLoading: true });
    const res = await healthApi.get();
    if (res.success && res.data) {
      set({ health: res.data as HealthStatus, healthLoading: false, healthChecked: true });
    } else {
      // Clear stale data so the UI never reports "Online" for a dead API.
      set({ health: null, healthLoading: false, healthChecked: true });
    }
  },

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}));

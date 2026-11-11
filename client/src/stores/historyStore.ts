import { create } from 'zustand';
import type { Job } from '../types';
import { jobsApi } from '../services/api';

export type JobFilter = 'all' | 'succeeded' | 'failed' | 'running' | 'cancelled' | 'queued';

interface HistoryStore {
  jobs: Job[];
  loading: boolean;
  error: string | null;
  filter: JobFilter;
  search: string;
  selectedId: string | null;
  fetchJobs: () => Promise<void>;
  setFilter: (filter: JobFilter) => void;
  setSearch: (search: string) => void;
  selectJob: (id: string | null) => void;
}

export const useHistoryStore = create<HistoryStore>((set) => ({
  jobs: [],
  loading: false,
  error: null,
  filter: 'all',
  search: '',
  selectedId: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });
    const res = await jobsApi.list(100);
    if (res.success && res.data) {
      set({ jobs: res.data, loading: false });
    } else {
      set({
        loading: false,
        error: res.error?.message ?? 'Failed to load execution history',
        jobs: [],
      });
    }
  },

  setFilter: (filter) => set({ filter }),
  setSearch: (search) => set({ search }),
  selectJob: (id) => set({ selectedId: id }),
}));

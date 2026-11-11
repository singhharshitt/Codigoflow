import { create } from 'zustand';
import type { Repository } from '../types';
import { repositoriesApi } from '../services/api';

interface RepoStore {
  repositories: Repository[];
  selectedId: string | null;
  loading: boolean;
  error: string | null;

  fetchRepositories: () => Promise<void>;
  selectRepository: (id: string | null) => void;
  addRepository: (path: string, name?: string, description?: string) => Promise<void>;
  removeRepository: (id: string) => Promise<void>;
}

export const useRepoStore = create<RepoStore>((set, get) => ({
  repositories: [],
  selectedId: null,
  loading: false,
  error: null,

  fetchRepositories: async () => {
    set({ loading: true, error: null });
    const res = await repositoriesApi.list();
    if (res.success && res.data) {
      const repos = res.data as Repository[];
      set({ repositories: repos, loading: false });
      // Auto-select first if none selected
      if (!get().selectedId && repos.length > 0) {
        set({ selectedId: repos[0].id });
      }
    } else {
      set({ loading: false, error: res.error?.message ?? 'Failed to load repositories' });
    }
  },

  selectRepository: (id) => set({ selectedId: id }),

  addRepository: async (path, name, description) => {
    set({ loading: true, error: null });
    const res = await repositoriesApi.register({ path, name, description });
    if (res.success && res.data) {
      const repo = res.data as Repository;
      set((state) => ({
        repositories: [repo, ...state.repositories.filter((r) => r.id !== repo.id)],
        selectedId: repo.id,
        loading: false,
      }));
    } else {
      set({ loading: false, error: res.error?.message ?? 'Failed to register repository' });
      throw new Error(res.error?.message ?? 'Failed to register repository');
    }
  },

  removeRepository: async (id) => {
    const res = await repositoriesApi.remove(id);
    if (res.success) {
      set((state) => ({
        repositories: state.repositories.filter((r) => r.id !== id),
        selectedId: state.selectedId === id ? null : state.selectedId,
      }));
    }
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CopilotMode = 'chat' | 'commit' | 'error' | 'docker';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
  mode?: CopilotMode;
}

interface AIStore {
  messages: ChatMessage[];
  mode: CopilotMode;
  setMode: (mode: CopilotMode) => void;
  addMessage: (msg: Omit<ChatMessage, 'id' | 'createdAt'> & { id?: string }) => void;
  clear: () => void;
}

export const useAIStore = create<AIStore>()(
  persist(
    (set) => ({
      messages: [],
      mode: 'chat',
      setMode: (mode) => set({ mode }),
      addMessage: (msg) =>
        set((s) => ({
          messages: [
            ...s.messages,
            {
              id: msg.id ?? crypto.randomUUID(),
              createdAt: Date.now(),
              role: msg.role,
              content: msg.content,
              mode: msg.mode,
            },
          ],
        })),
      clear: () => set({ messages: [] }),
    }),
    { name: 'cf-ai-chat', partialize: (s) => ({ messages: s.messages.slice(-40), mode: s.mode }) },
  ),
);

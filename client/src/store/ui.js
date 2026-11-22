import { create } from 'zustand';

export const useUI = create((set) => ({
  sidebarOpen: false, // mobile drawer
  openEntity: null, // expanded entity in the sidebar
  toast: null,
  setSidebar: (v) => set({ sidebarOpen: v }),
  toggleEntity: (code) => set((s) => ({ openEntity: s.openEntity === code ? null : code })),
  setOpenEntity: (code) => set({ openEntity: code }),
  notify: (message, kind = 'success') => {
    set({ toast: { message, kind, id: Date.now() } });
    setTimeout(() => set((s) => (s.toast && Date.now() - s.toast.id >= 3500 ? { toast: null } : s)), 3600);
  },
}));

import { createSlice, nanoid } from '@reduxjs/toolkit';

const initialState = {
  toasts: [],
  sidebarOpen: false,
  unreadNotifications: 0,
  commandOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    pushToast: {
      reducer: (state, action) => {
        state.toasts.push(action.payload);
      },
      prepare: (payload) => ({
        payload: {
          id: nanoid(),
          type: payload.type || 'success',
          message: payload.message,
          title: payload.title,
        },
      }),
    },
    dismissToast: (state, action) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebar: (state, action) => {
      state.sidebarOpen = action.payload;
    },
    setUnreadNotifications: (state, action) => {
      state.unreadNotifications = action.payload;
    },
  },
});

export const { pushToast, dismissToast, toggleSidebar, setSidebar, setUnreadNotifications } = uiSlice.actions;
export const toast = (message, type = 'success', title) => pushToast({ message, type, title });
export default uiSlice.reducer;

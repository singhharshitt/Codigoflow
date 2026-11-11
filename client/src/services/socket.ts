import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

/** Lazy Socket.IO client for live logs / job events. */
export function getSocket(): Socket {
  if (!socket) {
    const base =
      import.meta.env.VITE_API_BASE_URL?.replace(/\/api\/?$/, '') ||
      window.location.origin;
    socket = io(base, {
      path: '/socket.io',
      autoConnect: false,
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
}

export function connectSocket() {
  const s = getSocket();
  if (!s.connected) s.connect();
  return s;
}

export function disconnectSocket() {
  socket?.disconnect();
}

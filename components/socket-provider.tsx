"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io({
      path: "/api/socketio",
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    s.on("connect", () => {
      console.log(`[Socket.IO Client] Connected with ID: ${s.id}`);
      setSocket(s);
    });

    s.on("disconnect", (reason) => {
      console.log(`[Socket.IO Client] Disconnected: ${reason}`);
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

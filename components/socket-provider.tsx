"use client";

import { useEffect, createContext, useContext } from "react";
import { io, Socket } from "socket.io-client";

const SocketContext = createContext<Socket | null>(null);

let socketInstance: Socket | null = null;

export function SocketProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!socketInstance) {
      socketInstance = io({
        path: "/api/socketio",
      });

      socketInstance.on("connect", () => {
        console.log(`[Socket.IO Client] Connected with ID: ${socketInstance?.id}`);
      });
    }

    return () => {
      // Keep alive during navigation in SPA
    };
  }, []);

  return (
    <SocketContext.Provider value={socketInstance}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}

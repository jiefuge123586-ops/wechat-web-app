import { createContext, useState, useContext, useEffect } from 'react';
import io from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Use window.location.hostname to support network access if needed, default to localhost
      // Assuming server runs on port 5001 as per configuration
      const newSocket = io(`http://${window.location.hostname}:5001`);
      setSocket(newSocket);
      // identify to server for personal notifications
      newSocket.emit('identify', user._id);

      return () => newSocket.close();
    } else {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    }
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};

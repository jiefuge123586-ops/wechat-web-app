import { createContext, useState, useContext, useEffect } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import axios from 'axios';
import { useLocation } from 'react-router-dom';

const NotificationContext = createContext();

export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket();
  const { user, token } = useAuth();
  const location = useLocation();

  const [unreadMessages, setUnreadMessages] = useState({}); // { roomId: count }
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);

  // Initial Fetch
  useEffect(() => {
    if (token) {
      fetchFriendRequests();
      if (user) {
        (async () => {
          try {
            const res = await axios.get('/api/chats/unread', { headers: { 'auth-token': token } });
            setUnreadMessages(res.data || {});
          } catch (e) {}
        })();
      }
    }
  }, [token, user]);

  // Socket Listeners
  useEffect(() => {
    if (!socket || !user) return;

    // Listen for new messages
    const handleReceiveMessage = (data) => {
      // Check if user is currently in that room
      const pathParts = location.pathname.split('/');
      const inChat = pathParts[1] === 'chat';
      const currentId = pathParts[3];
      const currentType = pathParts[2];
      
      let currentRoomId = null;
      if (inChat && currentId) {
        if (currentType === 'group') {
           currentRoomId = currentId;
        } else if (currentType === 'dm') {
           // Reconstruct roomId logic: [userId, friendId].sort().join('_')
           const potentialRoomId = [user._id, currentId].sort().join('_');
           currentRoomId = potentialRoomId;
        }
      }

      // If not in the room where message came from, increment unread
      if (data.room !== currentRoomId) {
        setUnreadMessages(prev => ({
          ...prev,
          [data.room]: (prev[data.room] || 0) + 1
        }));
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_notification', handleReceiveMessage);

    // Friend request incoming
    const handleFriendRequest = () => {
      setFriendRequestsCount(prev => prev + 1);
    };
    socket.on('friend_request', handleFriendRequest);

    // Friend request accepted (for requests I sent)
    const handleFriendAccepted = () => {
      // does not change incoming friendRequestsCount; chat list will refresh separately
    };
    socket.on('friend_request_accepted', handleFriendAccepted);
    const handleFriendRequestUpdate = (data) => {
      // pending count reduces when request is processed
      setFriendRequestsCount(prev => Math.max(0, prev - 1));
    };
    socket.on('friend_request_update', handleFriendRequestUpdate);

    // Group events
    const handleGroupInvite = (data) => {
      const roomId = data.groupId;
      setUnreadMessages(prev => ({
        ...prev,
        [roomId]: (prev[roomId] || 0) + 1
      }));
    };
    const handleGroupRemoved = () => {
      // nothing for now; chat list will refresh separately
    };
    socket.on('group_invite', handleGroupInvite);
    socket.on('group_removed', handleGroupRemoved);
    
    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_notification', handleReceiveMessage);
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('group_invite', handleGroupInvite);
      socket.off('group_removed', handleGroupRemoved);
      socket.off('friend_request_update', handleFriendRequestUpdate);
    };
  }, [socket, location.pathname, user]);

  const fetchFriendRequests = async () => {
    try {
      const res = await axios.get('/api/friends/requests', { headers: { 'auth-token': token } });
      setFriendRequestsCount(res.data.length);
    } catch (err) {
      console.error(err);
    }
  };

  const clearUnread = (roomId) => {
    axios.post(`/api/chats/read/${roomId}`, {}, { headers: { 'auth-token': token } }).catch(() => {});
    setUnreadMessages(prev => {
      const newCounts = { ...prev };
      delete newCounts[roomId];
      return newCounts;
    });
  };

  const clearFriendRequests = () => {
    setFriendRequestsCount(0);
  };

  // Helper to get total unread count
  const totalUnread = Object.values(unreadMessages).reduce((a, b) => a + b, 0);

  return (
    <NotificationContext.Provider value={{ 
      unreadMessages, 
      friendRequestsCount, 
      clearUnread, 
      clearFriendRequests,
      totalUnread,
      fetchFriendRequests
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

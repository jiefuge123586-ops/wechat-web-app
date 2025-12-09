import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { useSocket } from '../context/SocketContext';

export default function ChatList() {
  const { token, user } = useAuth();
  const { unreadMessages, friendRequestsCount } = useNotification();
  const { socket } = useSocket();
  const [chats, setChats] = useState([]);

  useEffect(() => {
    fetchChats();
  }, [token]);

  // Listen for new messages to update the last message snippet instantly
  useEffect(() => {
    if (!socket) return;
    
    const handleReceiveMessage = (data) => {
      setChats(prevChats => {
        // Find if chat exists
        const chatIndex = prevChats.findIndex(c => {
          if (c.type === 'group') return c.id === data.room;
          // For DM, reconstruct roomId and compare equality
          if (!user) return false;
          const roomId = [user._id, c.id].sort().join('_');
          return data.room === roomId;
        });

        if (chatIndex > -1) {
          const updatedChat = {
            ...prevChats[chatIndex],
            lastMessage: data.type === 'image' ? '[图片]' : data.content,
            rawTime: new Date(data.timestamp),
            time: data.timestamp
          };
          const newChats = [...prevChats];
          newChats.splice(chatIndex, 1);
          newChats.unshift(updatedChat);
          return newChats;
        } else {
          // New chat potentially, for now just fetch all again to be safe and simple
          fetchChats(); 
          return prevChats;
        }
      });
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_notification', handleReceiveMessage);

    // When friend request is accepted, refresh chat list to show new DM
    const handleFriendAccepted = () => {
      fetchChats();
    };
    socket.on('friend_request_accepted', handleFriendAccepted);

    const handleProfileUpdated = () => { fetchChats(); };
    socket.on('user_profile_updated', handleProfileUpdated);

    // Group events: invite and removed should refresh chat list
    const handleGroupInvite = () => { fetchChats(); };
    const handleGroupRemoved = () => { fetchChats(); };
    socket.on('group_invite', handleGroupInvite);
    socket.on('group_removed', handleGroupRemoved);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_notification', handleReceiveMessage);
      socket.off('friend_request_accepted', handleFriendAccepted);
      socket.off('user_profile_updated', handleProfileUpdated);
      socket.off('group_invite', handleGroupInvite);
      socket.off('group_removed', handleGroupRemoved);
    };
  }, [socket]);

  const fetchChats = async () => {
    try {
      const res = await axios.get('/api/chats', { headers: { 'auth-token': token } });
      setChats(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const getUnreadCount = (chat) => {
    // Determine roomId for lookup
    let roomId = chat.id;
    if (chat.type === 'dm') {
      if (!user) return 0;
      roomId = [user._id, chat.id].sort().join('_');
    }
    return unreadMessages[roomId] || 0;
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = timeStr instanceof Date ? timeStr : new Date(timeStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col">
      <header className="bg-gray-100 p-4 border-b border-gray-200 flex items-center">
        <h1 className="text-lg font-bold mr-2">微信</h1>
        {friendRequestsCount > 0 && (
          <span className="ml-1 inline-flex items-center justify-center text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white border-2 border-white">
            {friendRequestsCount > 99 ? '99+' : friendRequestsCount}
          </span>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 && (
          <p className="text-center text-gray-500 mt-10 text-sm">暂无聊天，去通讯录发起聊天吧</p>
        )}
        {chats.map(chat => {
          const unread = getUnreadCount(chat);
          const isTokenAvatar = typeof chat.avatar === 'string' && chat.avatar.startsWith('avatar:');
          const colorClass = isTokenAvatar ? (
            chat.avatar === 'avatar:blue' ? 'bg-blue-500' : chat.avatar === 'avatar:green' ? 'bg-green-500' : chat.avatar === 'avatar:purple' ? 'bg-purple-500' : chat.avatar === 'avatar:red' ? 'bg-red-500' : 'bg-orange-500'
          ) : (chat.type === 'group' ? 'bg-purple-500' : 'bg-blue-500');
          return (
            <Link to={`/chat/${chat.type}/${chat.id}`} key={chat.id} className="flex items-center p-4 bg-white border-b border-gray-100 hover:bg-gray-50 relative">
              <div className="relative mr-3">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xl ${colorClass}`}>
                  {!isTokenAvatar && chat.avatar ? <img src={chat.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : chat.name[0].toUpperCase()}
                </div>
                {unread > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center border-2 border-white">
                    {unread > 99 ? '99+' : unread}
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-gray-800 truncate">{chat.name}</h3>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{formatTime(chat.rawTime || chat.time)}</span>
                </div>
                <p className="text-sm text-gray-500 truncate">{chat.lastMessage}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

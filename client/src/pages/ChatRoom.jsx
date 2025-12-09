import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ArrowLeft, Send, Image as ImageIcon, Smile } from 'lucide-react';

export default function ChatRoom() {
  const { type, id } = useParams();
  const navigate = useNavigate();
  const { socket } = useSocket();
  const { user, token } = useAuth();
  const { clearUnread } = useNotification();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [imageData, setImageData] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [chatInfo, setChatInfo] = useState({ name: '加载中...' });
  const [groupInfo, setGroupInfo] = useState(null);
  const [showManage, setShowManage] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [editName, setEditName] = useState('');
  const [editNotice, setEditNotice] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const messagesEndRef = useRef(null);
  
  // Calculate Room ID
  const getRoomId = () => {
    if (type === 'group') return id;
    if (type === 'dm') return [user._id, id].sort().join('_');
    return id; // Fallback
  };

  const roomId = getRoomId();

  useEffect(() => {
    fetchChatInfo();
  }, [type, id]);

  useEffect(() => {
    if (!socket) return;

    // Clear unread on join
    clearUnread(roomId);

    socket.emit('join_room', roomId);

    socket.on('receive_message', (data) => {
      setMessages((prev) => [...prev, data]);
    });

    return () => {
      socket.off('receive_message');
    };
  }, [socket, roomId]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const config = { headers: { 'auth-token': token } };
        const res = await axios.get(`/api/chats/history/${roomId}`, config);
        setMessages(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    if (roomId && token) {
      fetchMessages();
    }
  }, [roomId, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onPickImage = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImageData(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const emojis = ['😀','😄','😁','😂','😊','😉','😍','😘','😜','🤔','😎','😢','😡','👍','👎','🙏','🎉','❤️','🔥','💯'];
  const insertEmoji = (em) => {
    setInputValue((prev) => prev + em);
  };

  const fetchChatInfo = async () => {
    try {
      const config = { headers: { 'auth-token': token } };
      if (type === 'group') {
        const res = await axios.get(`/api/groups/${id}`, config);
        setChatInfo({ name: res.data.name });
        setGroupInfo(res.data);
        setEditName(res.data.name || '');
        setEditNotice(res.data.notice || '');
        setEditAvatar(res.data.avatar || '');
      } else if (type === 'dm') {
        const res = await axios.get(`/api/users/${id}`, config);
        setChatInfo({ name: res.data.nickname || res.data.username });
      } else {
        // Mock data fallback
        setChatInfo({ name: `Chat ${id}` });
      }
    } catch (err) {
      console.error(err);
      setChatInfo({ name: '未知聊天' });
    }
  };

  const ownerId = groupInfo ? ((groupInfo.owner && groupInfo.owner._id) || groupInfo.owner) : null;
  const adminIds = groupInfo ? (groupInfo.admins || []).map(a => (a && a._id) ? a._id : a) : [];
  const isOwner = !!ownerId && ownerId === user._id;
  const isAdmin = adminIds.includes(user._id);
  const canManage = isOwner || isAdmin;

  const searchUsers = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;
    try {
      const res = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`, { headers: { 'auth-token': token } });
      setSearchResults(res.data);
    } catch (err) { console.error(err); }
  };

  const addMember = async (memberId) => {
    try {
      await axios.post(`/api/groups/${id}/members`, { newMembers: [memberId] }, { headers: { 'auth-token': token } });
      fetchChatInfo();
    } catch (err) { console.error(err); }
  };

  const removeMember = async (memberId) => {
    try {
      await axios.delete(`/api/groups/${id}/members/${memberId}`, { headers: { 'auth-token': token } });
      fetchChatInfo();
    } catch (err) { console.error(err); }
  };

  const setAdmin = async (memberId) => {
    try {
      await axios.post(`/api/groups/${id}/admins`, { memberId }, { headers: { 'auth-token': token } });
      fetchChatInfo();
    } catch (err) { console.error(err); }
  };

  const unsetAdmin = async (memberId) => {
    try {
      await axios.delete(`/api/groups/${id}/admins/${memberId}`, { headers: { 'auth-token': token } });
      fetchChatInfo();
    } catch (err) { console.error(err); }
  };

  const saveGroupInfo = async () => {
    try {
      await axios.put(`/api/groups/${id}`, { name: editName, notice: editNotice, avatar: editAvatar }, { headers: { 'auth-token': token } });
      fetchChatInfo();
    } catch (err) { console.error(err); }
  };

  const leaveGroup = async () => {
    try {
      await axios.delete(`/api/groups/${id}/leave`, { headers: { 'auth-token': token } });
      navigate(-1);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!socket) return;
    const handleGroupRemoved = (data) => {
      if (type === 'group' && data.groupId === id) {
        navigate(-1);
      }
    };
    socket.on('group_removed', handleGroupRemoved);
    return () => {
      socket.off('group_removed', handleGroupRemoved);
    };
  }, [socket, type, id]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!socket) return;
    const now = new Date().toISOString();
    if (imageData) {
      const messageData = {
        room: roomId,
        sender: user.username,
        senderId: user._id,
        content: imageData,
        type: 'image',
        timestamp: now,
      };
      socket.emit('send_message', messageData);
      setImageData(null);
      return;
    }
    if (inputValue.trim()) {
      const messageData = {
        room: roomId,
        sender: user.username,
        senderId: user._id,
        content: inputValue,
        type: 'text',
        timestamp: now,
      };
      socket.emit('send_message', messageData);
      setInputValue('');
    }
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const date = new Date(timeStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const [profileUser, setProfileUser] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [isFriend, setIsFriend] = useState(false);

  const openUserProfile = async (userId) => {
    if (!userId) return;
    try {
      const config = { headers: { 'auth-token': token } };
      const res = await axios.get(`/api/users/${userId}`, config);
      setProfileUser(res.data);
      // check friendship
      const friendsRes = await axios.get('/api/friends', config);
      const friendIds = (friendsRes.data || []).map(f => f._id);
      setIsFriend(friendIds.includes(userId));
      setShowProfile(true);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-gray-100 p-3 border-b border-gray-200 flex items-center sticky top-0 z-10">
        <button onClick={() => navigate(-1)} className="mr-3 p-1 hover:bg-gray-200 rounded-full">
          <ArrowLeft size={24} />
        </button>
        <h1 className="font-bold text-lg truncate flex-1">{chatInfo.name}</h1>
        {type === 'group' && (
          <button className="text-sm bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600" onClick={() => setShowManage(!showManage)}>群信息</button>
        )}
      </div>
      {type === 'group' && groupInfo && (
        <div className="bg-[#FFF] border-b border-gray-200 px-4 py-2 text-xs text-gray-600">
          <div>成员：{(groupInfo.members||[]).length}</div>
          {groupInfo.notice && <div className="mt-1">公告：{groupInfo.notice}</div>}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, index) => {
          if (msg.type === 'system') {
            return (
              <div key={index} className="flex justify-center my-2">
                <span className="bg-gray-200 text-gray-500 text-xs px-2 py-1 rounded-full">
                  {msg.content}
                </span>
              </div>
            );
          }

          const isMe = msg.sender === user.username;
          return (
            <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              {!isMe && (
                (() => {
                  const token = typeof msg.senderAvatar === 'string' && msg.senderAvatar.startsWith('avatar:');
                  const colorClass = token ? (msg.senderAvatar==='avatar:green'?'bg-green-500':msg.senderAvatar==='avatar:purple'?'bg-purple-500':msg.senderAvatar==='avatar:red'?'bg-red-500':msg.senderAvatar==='avatar:orange'?'bg-orange-500':'bg-blue-500') : 'bg-blue-500';
                  return (
                    <button onClick={() => openUserProfile(msg.senderId)} className={`w-9 h-9 ${colorClass} rounded-lg flex items-center justify-center text-white text-sm mr-2 flex-shrink-0 overflow-hidden`}>
                      {!token && msg.senderAvatar ? (
                        <img src={msg.senderAvatar} alt="avatar" className="w-full h-full" />
                      ) : (
                        (msg.sender?.[0] || '?').toUpperCase()
                      )}
                    </button>
                  );
                })()
              )}
              <div className={`max-w-[70%]`}>
                {!isMe && type === 'group' && (
                  <p className="text-xs text-gray-500 mb-1 ml-1">{msg.senderNickname || msg.sender}</p>
                )}
                <div className={`p-3 rounded-lg relative ${isMe ? 'bg-[#95EC69] text-black' : 'bg-white text-black'}`}>
                  {msg.type === 'image' ? (
                    <img src={msg.content} alt="image" className="max-w-full rounded" />
                  ) : (
                    <p className="break-words text-sm leading-relaxed">{msg.content}</p>
                  )}
                </div>
                <p className={`text-[10px] mt-1 ${isMe ? 'text-right' : 'text-left'} text-gray-400`}>
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-3 bg-[#F7F7F7] border-t border-gray-200 flex items-center gap-2">
        <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="p-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">
          <Smile size={18} />
        </button>
        {showEmoji && (
          <div className="absolute bottom-16 left-3 right-3 bg-white border rounded shadow p-2 grid grid-cols-10 gap-1 z-30">
            {emojis.map((em) => (
              <button key={em} type="button" onClick={() => insertEmoji(em)} className="text-xl leading-none">
                {em}
              </button>
            ))}
          </div>
        )}
        <label className="p-2 bg-gray-200 text-gray-700 rounded cursor-pointer hover:bg-gray-300 flex items-center">
          <ImageIcon size={18} />
          <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
        </label>
        {imageData && (
          <span className="text-xs text-gray-500">已选择图片</span>
        )}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="发送消息..."
          className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:border-green-500 mr-2 bg-white"
        />
        <button type="submit" className={`p-2 rounded-md ${(inputValue.trim() || imageData) ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`} disabled={!(inputValue.trim() || imageData)}>
          <Send size={20} />
        </button>
      </form>
      {type === 'group' && showManage && groupInfo && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-[500px] rounded-lg shadow-lg flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center p-4 border-b">
              <div className="font-bold text-lg">群信息</div>
              <button onClick={() => setShowManage(false)} className="text-gray-500 hover:text-gray-700 text-2xl">&times;</button>
            </div>
            
            <div className="p-4 overflow-y-auto">
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-sm text-gray-500">群资料</h3>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">群名称</label>
                    <input value={editName} onChange={(e)=>setEditName(e.target.value)} className="w-full p-2 border rounded"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">群公告</label>
                    <input value={editNotice} onChange={(e)=>setEditNotice(e.target.value)} className="w-full p-2 border rounded"/>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">默认头像</label>
                    <div className="flex gap-2 mt-1">
                      {['avatar:blue','avatar:green','avatar:purple','avatar:red','avatar:orange'].map(opt => (
                        <button key={opt} type="button" onClick={() => setEditAvatar(opt)}
                          className={`w-7 h-7 rounded ${
                            opt==='avatar:blue' ? 'bg-blue-500' : opt==='avatar:green' ? 'bg-green-500' : opt==='avatar:purple' ? 'bg-purple-500' : opt==='avatar:red' ? 'bg-red-500' : 'bg-orange-500'
                          } ${editAvatar===opt ? 'ring-2 ring-green-500' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                  {(canManage) && (
                    <div>
                      <button onClick={saveGroupInfo} className="px-3 py-1 bg-green-500 text-white rounded text-sm">保存</button>
                    </div>
                  )}
                  {!isOwner && (
                    <div>
                      <button onClick={leaveGroup} className="px-3 py-1 bg-red-500 text-white rounded text-sm">退群</button>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-6">
                <h3 className="font-semibold mb-2 text-sm text-gray-500">添加成员</h3>
                <form onSubmit={searchUsers} className="flex gap-2">
                  <input 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    placeholder="输入用户名搜索" 
                    className="flex-1 p-2 border rounded focus:border-green-500 focus:outline-none"
                  />
                  <button type="submit" className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600">搜索</button>
                </form>
                {searchResults.length > 0 && (
                  <div className="mt-2 border rounded max-h-40 overflow-y-auto">
                    {searchResults.map(u => (
                      <div key={u._id} className="flex justify-between items-center p-2 hover:bg-gray-50 border-b last:border-0">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs mr-2">
                            {u.username[0].toUpperCase()}
                          </div>
                          <span>{u.nickname || u.username}</span>
                        </div>
                        <button onClick={() => { addMember(u._id); setSearchResults([]); setSearchQuery(''); }} className="text-sm text-green-600 font-medium hover:underline">
                          添加
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2 text-sm text-gray-500">成员列表 ({groupInfo.members.length})</h3>
                <div className="space-y-2">
                  {(groupInfo.members || []).map(m => {
                    const mId = m._id || m;
                    const mName = m.username || m.nickname || m; // handle if not populated fully
                    const isMAdmin = adminIds.includes(mId);
                    const isMOwner = mId === ownerId;
                    
                    return (
                      <div key={mId} className="flex justify-between items-center p-2 bg-gray-50 rounded hover:bg-gray-100">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs mr-2">
                            {typeof mName === 'string' ? mName[0].toUpperCase() : '?'}
                          </div>
                          <div>
                            <div className="font-medium text-sm">{mName}</div>
                            <div className="flex gap-1">
                              {isMOwner && <span className="text-[10px] bg-yellow-100 text-yellow-600 px-1 rounded">群主</span>}
                              {isMAdmin && !isMOwner && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 rounded">管理员</span>}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex gap-2 text-sm">
                          {isOwner && !isMAdmin && (
                            <button onClick={() => setAdmin(mId)} className="text-blue-600 hover:underline">设为管理</button>
                          )}
                          {isOwner && isMAdmin && !isMOwner && (
                            <button onClick={() => unsetAdmin(mId)} className="text-orange-600 hover:underline">撤销管理</button>
                          )}
                          {canManage && mId !== ownerId && (!isMAdmin || isOwner) && (
                            <button onClick={() => removeMember(mId)} className="text-red-600 hover:underline">移除</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showProfile && profileUser && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-[380px] rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="font-bold">用户信息</div>
              <button onClick={() => setShowProfile(false)} className="text-gray-500">关闭</button>
            </div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 ${typeof profileUser.avatar==='string' && profileUser.avatar.startsWith('avatar:') ? (
                profileUser.avatar==='avatar:green'?'bg-green-500':profileUser.avatar==='avatar:purple'?'bg-purple-500':profileUser.avatar==='avatar:red'?'bg-red-500':profileUser.avatar==='avatar:orange'?'bg-orange-500':'bg-blue-500'
              ) : 'bg-blue-500'} rounded-lg flex items-center justify-center text-white text-xl overflow-hidden`}>
                {profileUser.avatar && !profileUser.avatar.startsWith('avatar:') ? (
                  <img src={profileUser.avatar} alt="avatar" className="w-full h-full" />
                ) : (
                  (profileUser.username?.[0] || '?').toUpperCase()
                )}
              </div>
              <div>
                <div className="font-semibold">{profileUser.nickname || profileUser.username}</div>
                <div className="text-xs text-gray-500">ID: {profileUser.username}</div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {isFriend ? (
                <button className="px-3 py-1 bg-gray-200 text-gray-700 rounded" onClick={() => setShowProfile(false)}>已是好友</button>
              ) : (
                <button className="px-3 py-1 bg-green-500 text-white rounded" onClick={async ()=>{
                  try { await axios.post('/api/friends/request',{ toUserId: profileUser._id, remark: 'Hello' }, { headers: { 'auth-token': token } }); setShowProfile(false); }
                  catch(e){ console.error(e); }
                }}>添加好友</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

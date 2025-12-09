import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { UserPlus, Users, User } from 'lucide-react';

import { useNotification } from '../context/NotificationContext';

export default function Contacts() {
  const { token } = useAuth();
  const { friendRequestsCount, clearFriendRequests } = useNotification();
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activeTab, setActiveTab] = useState('friends');
  const [showProfile, setShowProfile] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState('');
  const [uploadAvatar, setUploadAvatar] = useState('');

  useEffect(() => {
    // Clear friend requests notification when entering contacts
    // Requirement says "Click into Contacts, friend request hint should disappear"
    // Since this component is mounted when clicking contacts, we do it here.
    // Ideally it should be when clicking "New Friends", but requirement says "Click into Contacts"
    // Let's stick to "New Friends" entry point for clearing because user might just want to see list.
    // Wait, user said: "点击进入通讯录后，好友请求提示应自动消失"
    // So yes, clear it here.
    clearFriendRequests();
  }, []);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      const config = { headers: { 'auth-token': token } };
      if (activeTab === 'friends') {
        const res = await axios.get('/api/friends', config);
        setFriends(res.data);
      } else if (activeTab === 'groups') {
        const res = await axios.get('/api/groups', config);
        setGroups(res.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-gray-100 p-4 border-b border-gray-200 flex justify-between items-center">
        <h1 className="text-lg font-bold">通讯录</h1>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowProfile(true)} className="text-sm text-gray-600 hover:text-gray-800">设置头像</button>
          <Link to="/contacts/new" className="text-green-600">
          <UserPlus size={24} />
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex bg-white border-b">
        <button 
          className={`flex-1 p-3 text-sm font-medium ${activeTab === 'friends' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('friends')}
        >
          好友
        </button>
        <button 
          className={`flex-1 p-3 text-sm font-medium ${activeTab === 'groups' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
          onClick={() => setActiveTab('groups')}
        >
          群组
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'friends' ? (
          <div>
            <Link to="/contacts/new" className="flex items-center p-3 bg-white border-b hover:bg-gray-50 relative">
              <div className="relative mr-3">
                <div className="w-10 h-10 bg-orange-400 rounded-lg flex items-center justify-center text-white">
                  <UserPlus size={20} />
                </div>
                 {friendRequestsCount > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center border-2 border-white">
                    {friendRequestsCount}
                  </div>
                )}
              </div>
              <span className="font-medium">新的朋友</span>
            </Link>
            
            {friends.length === 0 && (
              <p className="text-center text-gray-500 mt-10">暂无好友</p>
            )}

            {friends.map(friend => (
              <Link to={`/chat/dm/${friend._id}`} key={friend._id} className="flex items-center p-3 bg-white border-b hover:bg-gray-50">
                {(() => { const isToken = typeof friend.avatar==='string' && friend.avatar.startsWith('avatar:'); const colorClass = isToken ? (friend.avatar==='avatar:green'?'bg-green-500':friend.avatar==='avatar:purple'?'bg-purple-500':friend.avatar==='avatar:red'?'bg-red-500':friend.avatar==='avatar:orange'?'bg-orange-500':'bg-blue-500') : 'bg-blue-500';
                return (
                <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center text-white text-lg mr-3`}>
                  {!isToken && friend.avatar ? <img src={friend.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : friend.username[0].toUpperCase()}
                </div>
                ); })()}
                <div>
                  <div className="font-medium">{friend.nickname || friend.username}</div>
                  {friend.bio && <div className="text-xs text-gray-400">{friend.bio}</div>}
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div>
             <Link to="/groups/new" className="flex items-center p-3 bg-white border-b hover:bg-gray-50">
              <div className="w-10 h-10 bg-green-400 rounded-lg flex items-center justify-center text-white mr-3">
                <Users size={20} />
              </div>
              <span className="font-medium">新建群聊</span>
            </Link>

            {groups.length === 0 && (
              <p className="text-center text-gray-500 mt-10">暂无群组</p>
            )}

            {groups.map(group => (
              <Link to={`/chat/group/${group._id}`} key={group._id} className="flex items-center p-3 bg-white border-b hover:bg-gray-50">
                 <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
                  {group.avatar ? <img src={group.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : group.name[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{group.name}</div>
                  <div className="text-xs text-gray-400">{group.members.length} 人</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      {showProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white w-[90%] max-w-[420px] rounded-lg shadow-lg p-4">
            <div className="flex justify-between items-center mb-3">
              <div className="font-bold">设置头像</div>
              <button onClick={() => setShowProfile(false)} className="text-gray-500">关闭</button>
            </div>
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">选择默认头像</div>
              <div className="flex gap-2">
                {['avatar:blue','avatar:green','avatar:purple','avatar:red','avatar:orange'].map(opt => (
                  <button key={opt} type="button" onClick={() => setAvatarChoice(opt)}
                    className={`w-8 h-8 rounded ${
                      opt==='avatar:blue' ? 'bg-blue-500' : opt==='avatar:green' ? 'bg-green-500' : opt==='avatar:purple' ? 'bg-purple-500' : opt==='avatar:red' ? 'bg-red-500' : 'bg-orange-500'
                    } ${avatarChoice===opt ? 'ring-2 ring-green-500' : ''}`}
                  />
                ))}
              </div>
            </div>
            <div className="mb-3">
              <div className="text-xs text-gray-500 mb-1">或上传图片</div>
              <input type="file" accept="image/*" onChange={(e)=>{
                const f=e.target.files&&e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=()=>{ setUploadAvatar(r.result); }; r.readAsDataURL(f);
              }} />
              {uploadAvatar && <div className="mt-2 text-xs text-gray-500">已选择图片</div>}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={()=>setShowProfile(false)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded">取消</button>
              <button onClick={async ()=>{
                try { const avatar = uploadAvatar || avatarChoice; await axios.put('/api/users/profile', { avatar }, { headers: { 'auth-token': token } }); setShowProfile(false); }
                catch(e){ console.error(e); }
              }} className="px-3 py-1 bg-green-500 text-white rounded">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

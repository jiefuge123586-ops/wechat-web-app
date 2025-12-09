import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Users, Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewGroup() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [notice, setNotice] = useState('');
  const [avatarChoice, setAvatarChoice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchFriends();
  }, []);

  const fetchFriends = async () => {
    try {
      const res = await axios.get('/api/friends', { headers: { 'auth-token': token } });
      setFriends(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMember = (id) => {
    if (selectedMembers.includes(id)) {
      setSelectedMembers(selectedMembers.filter(mid => mid !== id));
    } else {
      setSelectedMembers([...selectedMembers, id]);
    }
  };

  const createGroup = async () => {
    if (!groupName) {
      setError('请输入群名称');
      return;
    }
    if (selectedMembers.length < 1) { // Logic says >=2 people, 1 friend + me = 2
      setError('请至少选择一位好友');
      return;
    }

    try {
      await axios.post('/api/groups', {
        name: groupName,
        notice,
        avatar: avatarChoice,
        members: selectedMembers
      }, { headers: { 'auth-token': token } });
      
      navigate('/contacts'); // Redirect back to contacts
    } catch (err) {
      setError('创建失败');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-gray-100 p-4 border-b border-gray-200 flex items-center justify-between sticky top-0">
        <div className="flex items-center">
          <button onClick={() => navigate('/contacts')} className="mr-3">
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold">发起群聊</h1>
        </div>
        <button 
          onClick={createGroup}
          className={`px-4 py-1 rounded text-white text-sm ${groupName && selectedMembers.length > 0 ? 'bg-green-500' : 'bg-green-200'}`}
          disabled={!groupName || selectedMembers.length === 0}
        >
          完成 ({selectedMembers.length})
        </button>
      </header>

      {error && <div className="bg-red-100 text-red-700 p-2 text-center text-sm">{error}</div>}

      <div className="p-4 bg-white mb-2">
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">群名称</label>
          <input
            type="text"
            className="w-full border-b border-gray-300 focus:border-green-500 outline-none py-1"
            placeholder="填写群名称 (2-20字)"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            maxLength={20}
          />
        </div>
        <div>
           <label className="block text-sm font-medium text-gray-700 mb-1">群公告 (选填)</label>
           <input
            type="text"
            className="w-full border-b border-gray-300 focus:border-green-500 outline-none py-1"
            placeholder="发布群公告"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
          />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">默认头像 (可选)</label>
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
      </div>

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="p-2 text-xs text-gray-500 bg-gray-50">选择联系人</div>
        {friends.map(friend => (
          <div 
            key={friend._id} 
            className="flex items-center p-3 border-b cursor-pointer hover:bg-gray-50"
            onClick={() => toggleMember(friend._id)}
          >
            <div className={`w-5 h-5 rounded-full border mr-3 flex items-center justify-center ${selectedMembers.includes(friend._id) ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
              {selectedMembers.includes(friend._id) && <div className="w-2 h-2 bg-white rounded-full"></div>}
            </div>
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
              {friend.avatar ? <img src={friend.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : friend.username[0].toUpperCase()}
            </div>
            <div className="font-medium">{friend.nickname || friend.username}</div>
          </div>
        ))}
        {friends.length === 0 && <p className="text-center text-gray-400 mt-10">暂无好友可选</p>}
      </div>
    </div>
  );
}

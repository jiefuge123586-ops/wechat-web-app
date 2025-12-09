import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Search, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function NewFriends() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const res = await axios.get('/api/friends/requests', { headers: { 'auth-token': token } });
      setRequests(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) { setMessage('请输入搜索内容'); setTimeout(() => setMessage(''), 2000); return; }
    try {
      const res = await axios.get(`/api/users/search?q=${encodeURIComponent(q)}`, { headers: { 'auth-token': token } });
      setSearchResults(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendRequest = async (userId) => {
    try {
      await axios.post('/api/friends/request', { toUserId: userId, remark: 'Hello' }, { headers: { 'auth-token': token } });
      setMessage('请求已发送');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage(err.response?.data?.message || '发送失败');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRequest = async (id, status) => {
    try {
      await axios.put(`/api/friends/request/${id}`, { status }, { headers: { 'auth-token': token } });
      fetchRequests();
      setMessage(status === 'accepted' ? '已接受好友请求' : '已拒绝好友请求');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <header className="bg-gray-100 p-4 border-b border-gray-200 flex items-center sticky top-0">
        <button onClick={() => navigate('/contacts')} className="mr-3">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">新的朋友</h1>
      </header>

      {message && (
        <div className="bg-green-100 text-green-700 p-2 text-center text-sm">{message}</div>
      )}

      {/* Search */}
      <div className="p-4 bg-white border-b">
        <form onSubmit={handleSearch} className="flex items-center bg-gray-100 rounded-lg px-3 py-2 gap-2">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="微信号/手机号/昵称"
            className="bg-transparent flex-1 outline-none text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit" className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">搜索</button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mb-4 bg-white border-b">
            <div className="p-2 text-xs text-gray-500 bg-gray-50">搜索结果</div>
            {searchResults.map(user => (
              <div key={user._id} className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
                     {user.avatar ? <img src={user.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : user.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{user.nickname || user.username}</div>
                    <div className="text-xs text-gray-400">ID: {user.username}</div>
                  </div>
                </div>
                <button 
                  onClick={() => sendRequest(user._id)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  添加
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Friend Requests */}
        <div className="bg-white">
          <div className="p-2 text-xs text-gray-500 bg-gray-50">好友通知</div>
          {requests.length === 0 && <p className="text-center text-gray-400 p-4 text-sm">暂无新通知</p>}
          {requests.map(req => (
            <div key={req._id} className="flex items-center justify-between p-3 border-b">
               <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg mr-3">
                     {req.from.avatar ? <img src={req.from.avatar} alt="avatar" className="w-full h-full rounded-lg"/> : req.from.username[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">{req.from.nickname || req.from.username}</div>
                    <div className="text-xs text-gray-400">{req.remark || '请求添加你为好友'}</div>
                  </div>
                </div>
              <div className="flex space-x-2">
                <button 
                  onClick={() => handleRequest(req._id, 'accepted')}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                >
                  接受
                </button>
                <button 
                   onClick={() => handleRequest(req._id, 'rejected')}
                   className="bg-gray-200 text-gray-600 px-3 py-1 rounded text-sm hover:bg-gray-300"
                >
                  拒绝
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

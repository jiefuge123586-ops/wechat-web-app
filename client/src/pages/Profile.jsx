import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Upload, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, token, login } = useAuth(); // We might need to refresh user data in context
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    nickname: '',
    bio: '',
    avatar: ''
  });
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`/api/users/${user._id}`, { headers: { 'auth-token': token } });
      setFormData({
        nickname: res.data.nickname || '',
        bio: res.data.bio || '',
        avatar: res.data.avatar || ''
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.put('/api/users/profile', formData, { headers: { 'auth-token': token } });
      setMessage('资料更新成功');
      setIsEditing(false);
      setTimeout(() => setMessage(''), 3000);
      // Ideally update global auth context here
    } catch (err) {
      setMessage('更新失败');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-white mt-4 p-4 flex items-center cursor-pointer" onClick={() => setIsEditing(!isEditing)}>
        <div className="w-16 h-16 bg-gray-300 rounded-lg mr-4 overflow-hidden relative">
          {formData.avatar ? (
            <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <Upload size={24} />
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">{formData.nickname || user?.username}</h2>
            <Edit size={16} className="text-gray-400" />
          </div>
          <p className="text-gray-500 text-sm">微信号: {user?.username}</p>
        </div>
      </div>

      {message && <div className="p-2 text-center text-green-600 text-sm">{message}</div>}

      {isEditing && (
        <form onSubmit={handleSubmit} className="bg-white mt-4 p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">头像链接</label>
            <input
              type="text"
              name="avatar"
              value={formData.avatar}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              placeholder="https://example.com/avatar.png"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">昵称</label>
            <input
              type="text"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">个人简介</label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleChange}
              maxLength={50}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              rows="3"
            />
            <p className="text-xs text-gray-500 text-right">{formData.bio.length}/50</p>
          </div>
          <div className="flex space-x-4">
            <button type="submit" className="flex-1 bg-green-500 text-white py-2 rounded-md hover:bg-green-600">
              保存
            </button>
            <button type="button" onClick={() => setIsEditing(false)} className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-md hover:bg-gray-300">
              取消
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 px-4">
        <button 
          onClick={logout}
          className="w-full bg-white text-red-500 font-semibold py-3 rounded-lg shadow-sm hover:bg-gray-50"
        >
          退出登录
        </button>
      </div>
    </div>
  );
}

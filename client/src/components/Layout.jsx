import { Outlet, Link, useLocation } from 'react-router-dom';
import { MessageSquare, Users, User } from 'lucide-react';
import { useNotification } from '../context/NotificationContext';

export default function Layout() {
  const location = useLocation();
  const { totalUnread, friendRequestsCount } = useNotification();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <div className="flex-1 overflow-hidden">
        <Outlet />
      </div>
      
      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 flex justify-around py-2">
        <Link to="/" className={`flex flex-col items-center relative ${isActive('/') ? 'text-green-600' : 'text-gray-500'}`}>
          <div className="relative">
            <MessageSquare size={24} />
            {totalUnread > 0 && (
              <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </div>
            )}
          </div>
          <span className="text-xs mt-1">微信</span>
        </Link>
        <Link to="/contacts" className={`flex flex-col items-center relative ${isActive('/contacts') ? 'text-green-600' : 'text-gray-500'}`}>
           <div className="relative">
            <Users size={24} />
            {friendRequestsCount > 0 && (
              <div className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[16px] flex items-center justify-center">
                {friendRequestsCount}
              </div>
            )}
          </div>
          <span className="text-xs mt-1">通讯录</span>
        </Link>
        <Link to="/me" className={`flex flex-col items-center ${isActive('/me') ? 'text-green-600' : 'text-gray-500'}`}>
          <User size={24} />
          <span className="text-xs mt-1">我</span>
        </Link>
      </nav>
    </div>
  );
}

import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { NotificationProvider } from './context/NotificationContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import ChatList from './pages/ChatList';
import ChatRoom from './pages/ChatRoom';
import Contacts from './pages/Contacts';
import Profile from './pages/Profile';

import NewFriends from './pages/NewFriends';
import NewGroup from './pages/NewGroup';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  return children;
};

export default function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <NotificationProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<ChatList />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="me" element={<Profile />} />
          </Route>

          <Route path="/contacts/new" element={
            <ProtectedRoute>
              <NewFriends />
            </ProtectedRoute>
          } />

          <Route path="/groups/new" element={
            <ProtectedRoute>
              <NewGroup />
            </ProtectedRoute>
          } />

          <Route path="/chat/:type/:id" element={
            <ProtectedRoute>
              <ChatRoom />
            </ProtectedRoute>
          } />
        </Routes>
        </NotificationProvider>
      </SocketProvider>
    </AuthProvider>
  );
}

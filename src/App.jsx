import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Game from './pages/Game';
import Profile from './pages/Profile';
import Auth from './pages/Auth';
import SharedGame from './pages/SharedGame';
import { useAuth } from './context/AuthContext';

export default function App() {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-2xl font-bold text-gradient">Cardle</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play/daily" element={<Game mode="daily" />} />
          <Route path="/play/practice" element={<Game mode="practice" />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route path="/share/:code" element={<SharedGame />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}

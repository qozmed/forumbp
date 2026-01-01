import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ForumProvider, useForum } from './context/ForumContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import Header from './components/Layout/Header';
import Particles from './components/UI/Particles';
import Home from './pages/Home';
import ThreadView from './pages/ThreadView';
import ForumView from './pages/ForumView';
import Activity from './pages/Activity';
import SettingsPage from './pages/Settings';
import SearchPage from './pages/Search';
import AdminPanel from './pages/AdminPanel';
import UserProfile from './pages/UserProfile';
import ActivityTracker from './components/Layout/ActivityTracker';
import { AlertTriangle, Home as HomeIcon } from 'lucide-react';

// Simple Error Boundary Component
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
           <AlertTriangle className="w-20 h-20 text-red-600 mb-6" />
           <h1 className="text-3xl font-bold mb-4">Что-то пошло не так</h1>
           <p className="text-gray-400 mb-8 max-w-md">
             Произошла ошибка при отрисовке интерфейса. Попробуйте обновить страницу.
           </p>
           <button 
             onClick={() => window.location.href = '/'} 
             className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded font-bold hover:bg-gray-200"
           >
             <HomeIcon className="w-5 h-5" /> На главную
           </button>
           <div className="mt-8 p-4 bg-gray-900 rounded text-left text-xs font-mono text-red-400 w-full max-w-2xl overflow-auto">
              {this.state.error?.toString()}
           </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Component for Admin
const AdminRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { currentUser, hasPermission, isReady } = useForum();
  
  if (!isReady) return null; // Wait for auth check

  if (!currentUser || !hasPermission(currentUser, 'canViewAdminPanel')) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  return (
    <Router>
        <ActivityTracker />
        <div className="min-h-screen flex flex-col relative text-gray-200">
          <Particles />
          <Header />
          <main className="flex-1 relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route 
                path="/admin" 
                element={
                  <AdminRoute>
                    <AdminPanel />
                  </AdminRoute>
                } 
              />
              <Route path="/forum/:id" element={<ForumView />} />
              <Route path="/thread/:id" element={<ThreadView />} />
              <Route path="/user/:id" element={<UserProfile />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          
          <footer className="bg-gray-900 border-t border-gray-800 py-8 relative z-10 mt-12">
             <div className="container mx-auto px-4 text-center">
                <div className="mb-4 flex justify-center gap-6 text-sm text-gray-400">
                   <a href="#" className="hover:text-cyan-400">{t('footer.terms')}</a>
                   <a href="#" className="hover:text-cyan-400">{t('footer.privacy')}</a>
                   <a href="#" className="hover:text-cyan-400">{t('footer.help')}</a>
                   <a href="#" className="hover:text-cyan-400">{t('footer.home')}</a>
                </div>
                <p className="text-xs text-gray-600">
                   {t('footer.copyright')}
                </p>
             </div>
          </footer>
        </div>
      </Router>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <ForumProvider>
          <AppContent />
        </ForumProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;

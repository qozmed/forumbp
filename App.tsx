import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ForumProvider } from './context/ForumContext';
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

const AppContent: React.FC = () => {
  const { t } = useLanguage();
  return (
    <Router>
        <div className="min-h-screen flex flex-col relative text-gray-200">
          <Particles />
          <Header />
          <main className="flex-1 relative z-10">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/activity" element={<Activity />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<AdminPanel />} />
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
    <LanguageProvider>
      <ForumProvider>
        <AppContent />
      </ForumProvider>
    </LanguageProvider>
  );
};

export default App;

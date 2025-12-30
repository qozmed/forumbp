import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogIn, Bell, Globe, Settings, Shield, LogOut, CheckCheck } from 'lucide-react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import AuthModal from '../Auth/AuthModal';

// ==========================================
// НАСТРОЙКА ЛОГОТИПА / LOGO CONFIGURATION
// ==========================================
// ВНИМАНИЕ: НЕ ИСПОЛЬЗУЙТЕ ОБРАТНЫЕ СЛЕШИ "\" В ПУТИ!
// Windows путь "C:\Users\..." сломает код из-за спецсимволов.
//
// 1. Используйте прямую ссылку на картинку (Imgur, Discord, и т.д.):
//    const LOGO_IMAGE_URL = 'https://i.imgur.com/ваш_логотип.png';
//
// 2. Если оставить пустым (''), будет показан красивый текстовый логотип.
const LOGO_IMAGE_URL = 'https://i.ibb.co/1t5BJ7QD/logofullb.png'; 
// ==========================================

const Header: React.FC = () => {
  const { currentUser, logout, markNotificationsRead, userRole, hasPermission } = useForum();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // State to track if image failed to load
  const [imgError, setImgError] = useState(false);

  const isActive = (path: string) => location.pathname === path 
    ? 'text-white border-b-2 border-white bg-white/5' 
    : 'text-gray-400 hover:text-white hover:bg-white/5';

  const toggleLanguage = () => {
    setLanguage(language === 'ru' ? 'en' : 'ru');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if(searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
      setShowSearch(false);
    }
  };

  const openAuth = (view: 'login' | 'register') => {
    setAuthView(view);
    setAuthOpen(true);
  };

  const unreadCount = currentUser?.notifications.filter(n => !n.isRead).length || 0;

  const handleNotificationClick = (link?: string) => {
    markNotificationsRead();
    setShowNotifMenu(false);
    if (link) navigate(link);
  };

  return (
    <>
      <header className="sticky top-0 z-50 glass-header shadow-md shadow-black transition-all duration-300">
        {/* Reverted height to standard h-16 */}
        <div className="container mx-auto px-4 h-16 flex items-center justify-between transition-all duration-300">
          {/* Logo */}
          <div className="flex items-center gap-4 h-full py-1">
            <Link to="/" className="flex items-center gap-3 group h-full">
              {LOGO_IMAGE_URL && !imgError ? (
                // Image Logo Version: Maximized height within header (h-full/max-h-14)
                // Added scale hover effect for "increasing" feel
                <img 
                  src={LOGO_IMAGE_URL} 
                  alt="Project Logo" 
                  className="h-full max-h-[50px] md:max-h-[56px] w-auto object-contain hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                  onError={() => setImgError(true)} 
                />
              ) : (
                // Default CSS/Text Logo Version (Fallback)
                <div className="flex items-center gap-3 transform transition-transform origin-left group-hover:scale-105">
                  <div className="relative w-9 h-9 md:w-10 md:h-10">
                     <div className="relative w-full h-full bg-black rounded border border-white/20 flex items-center justify-center shadow-lg group-hover:border-white transition-colors">
                        <span className="font-display font-black text-white text-lg md:text-xl">B</span>
                     </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="font-display font-bold text-lg md:text-xl tracking-wider text-white leading-tight">
                      BLACK<span className="text-gray-400 group-hover:text-white transition-colors">PROJECT</span>
                    </span>
                    <span className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-600 font-bold">Role Play</span>
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center h-full gap-1">
            <Link to="/" className={`h-full flex items-center px-5 font-medium text-sm tracking-wide transition-all ${isActive('/')}`}>
              {t('nav.forums')}
            </Link>
            <Link to="/activity" className={`h-full flex items-center px-5 font-medium text-sm tracking-wide transition-all ${isActive('/activity')}`}>
              {t('nav.whatsNew')}
            </Link>
          </nav>

          {/* User Tools */}
          <div className="flex items-center gap-5">
            {/* Lang Switch */}
            <button onClick={toggleLanguage} className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white uppercase transition-colors">
              <Globe className="w-3.5 h-3.5" />
              {language}
            </button>

            <div className="h-6 w-px bg-white/10"></div>

            {/* Search */}
            <div className="relative">
              {showSearch ? (
                <form onSubmit={handleSearch} className="absolute right-0 top-1/2 -translate-y-1/2 w-64 origin-right animate-in fade-in slide-in-from-right-4">
                   <input 
                    autoFocus
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => !searchQuery && setShowSearch(false)}
                    className="w-full bg-black border border-white/20 rounded py-1.5 px-4 text-sm text-white focus:outline-none focus:border-white transition-colors"
                    placeholder={t('general.searchPlaceholder')}
                   />
                </form>
              ) : (
                <button onClick={() => setShowSearch(true)} className="text-gray-400 hover:text-white transition-colors" title={t('general.search')}>
                  <Search className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {currentUser ? (
               <div className="flex items-center gap-4">
                  {/* Notifications */}
                  <div className="relative">
                    <button 
                      onClick={() => { setShowNotifMenu(!showNotifMenu); setShowUserMenu(false); }}
                      className="text-gray-400 hover:text-white relative p-1.5 hover:bg-white/5 rounded transition-colors"
                    >
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-white rounded-full animate-pulse shadow-sm"></span>}
                    </button>
                    {showNotifMenu && (
                       <div className="absolute right-0 mt-4 w-80 bg-[#111] border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                          <div className="p-3 bg-[#0a0a0a] border-b border-[#333] font-bold text-sm text-white flex justify-between items-center">
                            <span>{t('notifications.title')}</span>
                            {unreadCount > 0 && (
                              <button 
                                onClick={() => markNotificationsRead()} 
                                className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                              >
                                <CheckCheck className="w-3 h-3" /> {t('notifications.markRead')}
                              </button>
                            )}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                             {currentUser.notifications.length === 0 ? (
                               <div className="p-6 text-center text-gray-600 text-sm">{t('notifications.empty')}</div>
                             ) : (
                               currentUser.notifications.slice(0, 10).map(n => (
                                 <div 
                                   key={n.id} 
                                   onClick={() => handleNotificationClick(n.link)}
                                   className={`p-3 border-b border-[#222] hover:bg-[#222] text-sm cursor-pointer transition-colors ${!n.isRead ? 'bg-[#1a1a1a] border-l-2 border-l-white' : ''}`}
                                 >
                                   <div className="text-gray-300">{n.message}</div>
                                   <div className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                                 </div>
                               ))
                             )}
                          </div>
                       </div>
                    )}
                  </div>

                  {/* User Menu */}
                  <div className="relative">
                    <div 
                      className="flex items-center gap-3 cursor-pointer group" 
                      onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifMenu(false); }}
                    >
                      <img 
                        src={currentUser.avatarUrl} 
                        alt="Avatar" 
                        className="w-8 h-8 rounded bg-[#222] border border-[#444] group-hover:border-white transition-colors object-cover"
                      />
                    </div>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-4 w-56 bg-[#111] border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="px-4 py-3 border-b border-[#333] bg-[#0a0a0a]">
                           <div className="font-bold text-white truncate">{currentUser.username}</div>
                           <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{userRole?.name || 'Member'}</div>
                        </div>
                        <div className="p-1">
                          <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-[#222] hover:text-white rounded transition-colors" onClick={() => setShowUserMenu(false)}>
                            <Settings className="w-4 h-4" /> {t('settings.title')}
                          </Link>
                          {hasPermission(currentUser, 'canViewAdminPanel') && (
                            <Link to="/admin" className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-[#222] hover:text-white rounded transition-colors" onClick={() => setShowUserMenu(false)}>
                              <Shield className="w-4 h-4 text-white" /> {t('admin.title')}
                            </Link>
                          )}
                          <div className="border-t border-[#333] my-1"></div>
                          <button onClick={logout} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-red-900/20 hover:text-red-400 rounded transition-colors text-left">
                            <LogOut className="w-4 h-4" /> {t('auth.logout')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
               </div>
            ) : (
              <div className="flex items-center gap-3">
                <button onClick={() => openAuth('login')} className="flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  <LogIn className="w-4 h-4" />
                  {t('auth.login')}
                </button>
                <button onClick={() => openAuth('register')} className="btn-primary px-5 py-2 text-sm rounded transition-transform transform hover:scale-105">
                  {t('auth.register')}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setAuthOpen(false)} initialView={authView} />
    </>
  );
};

export default Header;
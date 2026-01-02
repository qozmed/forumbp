import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, LogIn, Bell, Globe, Settings, Shield, LogOut, CheckCheck, Menu, X, Trash2 } from 'lucide-react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import AuthModal from '../Auth/AuthModal';

// ==========================================
// НАСТРОЙКА ЛОГОТИПА / LOGO CONFIGURATION
// ==========================================
const LOGO_IMAGE_URL = 'https://i.ibb.co/VWmCjBm2/logofullb.png'; 
// ==========================================

const Header: React.FC = () => {
  const { currentUser, logout, markNotificationsRead, clearNotifications, deleteNotification, userRole, hasPermission } = useForum();
  const { language, setLanguage, t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // NEW: Mobile Menu State
  const [searchQuery, setSearchQuery] = useState('');
  
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
      setSearchQuery('');
    }
  };

  const openAuth = (view: 'login' | 'register') => {
    setAuthView(view);
    setAuthOpen(true);
    setMobileMenuOpen(false);
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
        <div className="container mx-auto px-4 h-14 md:h-16 flex items-center justify-between transition-all duration-300">
          
          {/* Left Side: Mobile Menu & Logo */}
          <div className="flex items-center gap-3 h-full py-1">
            {/* Mobile Menu Toggle */}
            <button 
              className="md:hidden text-gray-400 hover:text-white p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <Link to="/" className="flex items-center gap-3 group h-full">
              {LOGO_IMAGE_URL && !imgError ? (
                <img 
                  src={LOGO_IMAGE_URL} 
                  alt="Project Logo" 
                  className="h-8 md:h-full md:max-h-[50px] w-auto object-contain hover:scale-105 transition-transform duration-300 drop-shadow-lg"
                  onError={() => setImgError(true)} 
                />
              ) : (
                <div className="flex items-center gap-3 transform transition-transform origin-left group-hover:scale-105">
                  <div className="relative w-8 h-8 md:w-10 md:h-10">
                     <div className="relative w-full h-full bg-black rounded border border-white/20 flex items-center justify-center shadow-lg group-hover:border-white transition-colors">
                        <span className="font-display font-black text-white text-lg md:text-xl">B</span>
                     </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="font-display font-bold text-base md:text-xl tracking-wider text-white leading-tight">
                      BLACK<span className="text-gray-400 group-hover:text-white transition-colors">PROJECT</span>
                    </span>
                  </div>
                </div>
              )}
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center h-full gap-1 absolute left-1/2 -translate-x-1/2">
            <Link to="/" className={`h-full flex items-center px-5 font-medium text-sm tracking-wide transition-all ${isActive('/')}`}>
              {t('nav.forums')}
            </Link>
            <Link to="/activity" className={`h-full flex items-center px-5 font-medium text-sm tracking-wide transition-all ${isActive('/activity')}`}>
              {t('nav.whatsNew')}
            </Link>
          </nav>

          {/* User Tools */}
          <div className="flex items-center gap-1 md:gap-5">
            {/* Lang Switch (Desktop) */}
            <button onClick={toggleLanguage} className="hidden md:flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-white uppercase transition-colors">
              <Globe className="w-3.5 h-3.5" />
              {language}
            </button>

            <div className="hidden md:block h-6 w-px bg-white/10"></div>

            {/* Search */}
            <div className="relative">
              {showSearch ? (
                <form onSubmit={handleSearch} className="absolute right-0 top-1/2 -translate-y-1/2 w-[calc(100vw-100px)] md:w-64 origin-right animate-in fade-in slide-in-from-right-4 z-50">
                   <div className="flex items-center gap-2 bg-black border border-white/20 rounded px-2">
                     <input 
                      autoFocus
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onBlur={() => !searchQuery && setShowSearch(false)}
                      className="w-full bg-transparent py-1.5 px-2 text-sm text-white focus:outline-none"
                      placeholder={t('general.searchPlaceholder')}
                     />
                     <button type="button" onClick={() => setShowSearch(false)} className="text-gray-500 flex-shrink-0"><X className="w-4 h-4"/></button>
                   </div>
                </form>
              ) : (
                <button onClick={() => setShowSearch(true)} className="text-gray-400 hover:text-white transition-colors p-1.5 flex-shrink-0" title={t('general.search')}>
                  <Search className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              )}
            </div>
            
            {currentUser ? (
               <div className="flex items-center gap-1 md:gap-4">
                  {/* Notifications */}
                  <div className="relative">
                    <button 
                      onClick={() => { setShowNotifMenu(!showNotifMenu); setShowUserMenu(false); }}
                      className="text-gray-400 hover:text-white relative p-1.5 hover:bg-white/5 rounded transition-colors flex-shrink-0"
                    >
                      <Bell className="w-4 h-4 md:w-5 md:h-5" />
                      {unreadCount > 0 && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-white rounded-full animate-pulse shadow-sm"></span>}
                    </button>
                    {showNotifMenu && (
                       <div className="absolute right-0 mt-2 md:mt-4 w-[calc(100vw-20px)] md:w-72 lg:w-80 bg-[#111] border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 z-50 max-w-[320px] md:max-w-none">
                          <div className="p-3 bg-[#0a0a0a] border-b border-[#333] font-bold text-sm text-white flex justify-between items-center">
                            <span>{t('notifications.title')}</span>
                            <div className="flex gap-2">
                               {unreadCount > 0 && (
                                 <button 
                                   onClick={() => markNotificationsRead()} 
                                   className="text-xs text-gray-400 hover:text-white p-1 rounded hover:bg-[#222]"
                                   title={t('notifications.markRead')}
                                 >
                                   <CheckCheck className="w-4 h-4" />
                                 </button>
                               )}
                               {currentUser.notifications.length > 0 && (
                                 <button 
                                   onClick={() => clearNotifications()} 
                                   className="text-xs text-red-400 hover:text-red-300 p-1 rounded hover:bg-red-900/20"
                                   title={t('notifications.deleteAll')}
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               )}
                            </div>
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                             {currentUser.notifications.length === 0 ? (
                               <div className="p-6 text-center text-gray-600 text-sm">{t('notifications.empty')}</div>
                             ) : (
                               currentUser.notifications.slice(0, 10).map(n => (
                                 <div 
                                   key={n.id} 
                                   className={`group relative p-3 border-b border-[#222] hover:bg-[#222] text-sm transition-colors ${!n.isRead ? 'bg-[#1a1a1a] border-l-2 border-l-white' : ''}`}
                                 >
                                   <div onClick={() => handleNotificationClick(n.link)} className="cursor-pointer pr-4">
                                      <div className="text-gray-300 line-clamp-2">{n.message}</div>
                                      <div className="text-xs text-gray-600 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                                   </div>
                                   <button 
                                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                      className="absolute top-2 right-2 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                   >
                                      <X className="w-3 h-3" />
                                   </button>
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
                      className="flex items-center gap-2 md:gap-3 cursor-pointer group" 
                      onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifMenu(false); }}
                    >
                      <img 
                        src={currentUser.avatarUrl} 
                        alt="Avatar" 
                        className="w-7 h-7 md:w-8 md:h-8 rounded bg-[#222] border border-[#444] group-hover:border-white transition-colors object-cover flex-shrink-0"
                      />
                    </div>

                    {showUserMenu && (
                      <div className="absolute right-0 mt-2 md:mt-4 w-56 bg-[#111] border border-[#333] shadow-2xl rounded-lg overflow-hidden animate-in fade-in slide-in-from-top-2 z-50">
                        <div className="px-4 py-3 border-b border-[#333] bg-[#0a0a0a]">
                           <div className="font-bold text-white truncate">{currentUser.username}</div>
                           <div className="text-xs text-gray-500 uppercase tracking-wider mt-0.5">{userRole?.name || 'Member'}</div>
                        </div>
                        <div className="p-1">
                          <Link to={`/user/${currentUser.id}`} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:bg-[#222] hover:text-white rounded transition-colors" onClick={() => setShowUserMenu(false)}>
                            <div className="w-4 h-4 rounded-full bg-gray-600 flex items-center justify-center text-[10px]">U</div> {t('nav.profile')}
                          </Link>
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
              <div className="flex items-center gap-2 md:gap-3">
                <button onClick={() => openAuth('login')} className="hidden md:flex items-center gap-2 text-sm font-medium text-gray-400 hover:text-white transition-colors">
                  <LogIn className="w-4 h-4" />
                  {t('auth.login')}
                </button>
                <button onClick={() => openAuth('login')} className="md:hidden p-2 text-gray-400 hover:text-white"><LogIn className="w-5 h-5" /></button>
                <button onClick={() => openAuth('register')} className="btn-primary px-3 md:px-5 py-1.5 md:py-2 text-xs md:text-sm rounded transition-transform transform hover:scale-105 whitespace-nowrap">
                  {t('auth.register')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-[#0a0a0a] border-b border-[#333] animate-in fade-in slide-in-from-top-2 z-40">
             <div className="flex flex-col p-4 gap-2">
                <Link to="/" onClick={() => setMobileMenuOpen(false)} className={`p-3 rounded ${isActive('/') === 'text-white border-b-2 border-white bg-white/5' ? 'bg-[#222] text-white' : 'text-gray-400'}`}>
                   {t('nav.forums')}
                </Link>
                <Link to="/activity" onClick={() => setMobileMenuOpen(false)} className={`p-3 rounded ${isActive('/activity') === 'text-white border-b-2 border-white bg-white/5' ? 'bg-[#222] text-white' : 'text-gray-400'}`}>
                   {t('nav.whatsNew')}
                </Link>
                <button onClick={toggleLanguage} className="p-3 text-left text-gray-400 flex items-center gap-2">
                   <Globe className="w-4 h-4" /> {language.toUpperCase()}
                </button>
             </div>
          </div>
        )}
      </header>

      <AuthModal isOpen={isAuthOpen} onClose={() => setAuthOpen(false)} initialView={authView} />
    </>
  );
};

export default Header;
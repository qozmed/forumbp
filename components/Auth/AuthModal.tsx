import React, { useState, useEffect } from 'react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import { X, User, Lock, Mail } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialView?: 'login' | 'register';
}

const AuthModal: React.FC<Props> = ({ isOpen, onClose, initialView = 'login' }) => {
  const [isRegistering, setIsRegistering] = useState(initialView === 'register');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  const { login, register } = useForum();
  const { t } = useLanguage();

  // Reset state when opening or switching view mode from props
  useEffect(() => {
    if (isOpen) {
      setIsRegistering(initialView === 'register');
      setError('');
    }
  }, [isOpen, initialView]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username || !password || (isRegistering && !email)) {
      setError(t('auth.error.required'));
      return;
    }

    try {
      if (isRegistering) {
        await register(username, email, password);
      } else {
        await login(username, password);
      }
      onClose();
      // Reset fields on successful close
      setUsername('');
      setEmail('');
      setPassword('');
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#333] w-full max-w-md rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-4 bg-[#0a0a0a] border-b border-[#333] flex justify-between items-center">
          <h2 className="text-xl font-bold text-white">
            {isRegistering ? t('auth.createAccount') : t('auth.welcome')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/20 border border-red-800 rounded text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400">{t('auth.username')}</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-5 h-5 text-gray-600" />
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded py-2.5 pl-10 pr-4 text-white focus:border-white focus:outline-none transition-all"
                placeholder={t('auth.placeholder.username')}
              />
            </div>
          </div>

          {isRegistering && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-400">{t('auth.email')}</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-5 h-5 text-gray-600" />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-[#333] rounded py-2.5 pl-10 pr-4 text-white focus:border-white focus:outline-none transition-all"
                  placeholder={t('auth.placeholder.email')}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400">{t('auth.password')}</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-5 h-5 text-gray-600" />
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded py-2.5 pl-10 pr-4 text-white focus:border-white focus:outline-none transition-all"
                placeholder={t('auth.placeholder.password')}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="w-full py-3 bg-white text-black font-bold rounded shadow hover:bg-gray-200 transition-all transform hover:scale-[1.01]"
          >
            {isRegistering ? t('auth.register') : t('auth.login')}
          </button>

          <div className="text-center pt-2">
            <span className="text-sm text-gray-500">
              {isRegistering ? t('auth.alreadyHave') : t('auth.noAccount')}
            </span>
            <button 
              type="button"
              onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
              className="ml-2 text-sm font-bold text-white hover:underline"
            >
              {isRegistering ? t('auth.login') : t('auth.register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthModal;
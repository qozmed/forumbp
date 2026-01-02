import React, { useState } from 'react';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Settings, Save, PenTool, Mail, Lock, User, Tag, Clock, Shield, Smartphone, Send } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import ImageUpload from '../components/UI/ImageUpload';

const SettingsPage: React.FC = () => {
  const { currentUser, updateUser, hasPermission, getTelegramLink, isOfflineMode } = useForum();
  const { t } = useLanguage();
  
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser?.bannerUrl || '');
  const [signature, setSignature] = useState(currentUser?.signature || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  
  const [username, setUsername] = useState(currentUser?.username || '');
  const [customTitle, setCustomTitle] = useState(currentUser?.customTitle || '');
  
  const [tgLink, setTgLink] = useState('');
  const [tgLoading, setTgLoading] = useState(false);

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <div className="p-8 text-center text-white">{t('auth.login')}</div>;

  const DAYS_COOLDOWN = 12;
  const lastChange = new Date(currentUser.lastUsernameChange || 0);
  const diffTime = Math.abs(Date.now() - lastChange.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  const canChangeUsernameByTime = !currentUser.lastUsernameChange || diffDays >= DAYS_COOLDOWN;
  const daysLeft = DAYS_COOLDOWN - diffDays;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (username !== currentUser.username) {
        if (!hasPermission(currentUser, 'canChangeUsername')) {
            setError(t('settings.noPermissionUsername'));
            return;
        }
        if (!canChangeUsernameByTime) {
            setError(`Вы не можете менять никнейм. Осталось дней: ${daysLeft > 0 ? daysLeft : 0}`);
            return;
        }
    }

    await updateUser({
      ...currentUser,
      avatarUrl,
      bannerUrl,
      signature,
      email,
      username: (hasPermission(currentUser, 'canChangeUsername') && canChangeUsernameByTime) ? username : currentUser.username,
      customTitle: hasPermission(currentUser, 'canChangeCustomTitle') ? customTitle : currentUser.customTitle,
      lastUsernameChange: (username !== currentUser.username) ? new Date().toISOString() : currentUser.lastUsernameChange
    });
    setSuccess(true);
    setPassword(''); 
    setTimeout(() => setSuccess(false), 3000);
  };

  const handleGenerateLink = async () => {
      setTgLoading(true);
      try {
          const link = await getTelegramLink(currentUser.id);
          setTgLink(link);
      } catch (e) {
          alert("Error generating link. Are you online?");
      } finally {
          setTgLoading(false);
      }
  };

  const toggle2FA = async () => {
      await updateUser({ ...currentUser, twoFactorEnabled: !currentUser.twoFactorEnabled });
  };

  return (
    <div className="container mx-auto px-4 py-8 flex flex-col lg:flex-row gap-8">
      <div className="flex-1">
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden shadow-lg p-6">
           <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
             <Settings className="w-6 h-6 text-cyan-400" />
             {t('settings.title')}
           </h1>

           {success && (
             <div className="mb-4 p-3 bg-green-500/20 border border-green-500 rounded text-green-200">
               {t('settings.success')}
             </div>
           )}
           
           {error && (
             <div className="mb-4 p-3 bg-red-900/20 border border-red-800 rounded text-red-200">
               {error}
             </div>
           )}

           <form onSubmit={handleSave} className="space-y-6">
             
             {/* Account Info */}
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-400 flex items-center gap-2 justify-between">
                   <span className="flex items-center gap-2"><User className="w-4 h-4" /> {t('auth.username')}</span>
                   {!canChangeUsernameByTime && (
                       <span className="text-[10px] text-red-400 flex items-center gap-1">
                           <Clock className="w-3 h-3" /> Кулдаун: {daysLeft} дн.
                       </span>
                   )}
                 </label>
                 <input 
                   type="text" 
                   value={username}
                   onChange={(e) => setUsername(e.target.value)}
                   disabled={!hasPermission(currentUser, 'canChangeUsername') || !canChangeUsernameByTime}
                   className="w-full bg-gray-900 border border-gray-700 rounded p-2.5 text-white focus:border-cyan-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                   title={!canChangeUsernameByTime ? `Осталось ${daysLeft} дней до смены` : ''}
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                   <Tag className="w-4 h-4" /> {t('settings.customTitle')}
                 </label>
                 <input 
                   type="text" 
                   value={customTitle}
                   onChange={(e) => setCustomTitle(e.target.value)}
                   disabled={!hasPermission(currentUser, 'canChangeCustomTitle')}
                   placeholder={t('settings.customTitlePlaceholder')}
                   className="w-full bg-gray-900 border border-gray-700 rounded p-2.5 text-white focus:border-cyan-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                 />
               </div>

               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                   <Mail className="w-4 h-4" /> {t('auth.email')}
                 </label>
                 <input 
                   type="email" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full bg-gray-900 border border-gray-700 rounded p-2.5 text-white focus:border-cyan-500 outline-none"
                 />
               </div>
               <div className="space-y-2">
                 <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                   <Lock className="w-4 h-4" /> {t('settings.newPassword')}
                 </label>
                 <input 
                   type="password" 
                   value={password}
                   onChange={(e) => setPassword(e.target.value)}
                   placeholder={t('settings.leaveBlank')}
                   className="w-full bg-gray-900 border border-gray-700 rounded p-2.5 text-white focus:border-cyan-500 outline-none"
                 />
               </div>
             </div>

             <div className="border-t border-gray-700 my-2"></div>

             {/* SECURITY & TELEGRAM */}
             <div className="bg-[#111] p-4 rounded border border-[#333]">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Shield className="w-5 h-5 text-green-500" /> Безопасность и Telegram</h3>
                
                {isOfflineMode ? (
                    <div className="text-yellow-500 text-sm italic">Telegram функции недоступны в оффлайн режиме.</div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div>
                                <div className="text-sm text-gray-300 font-bold flex items-center gap-2">
                                    <Send className="w-4 h-4 text-blue-400" /> 
                                    Статус Telegram: {currentUser.telegramId ? <span className="text-green-400">Привязан</span> : <span className="text-red-400">Не привязан</span>}
                                </div>
                                {!currentUser.telegramId && <p className="text-xs text-gray-500 mt-1">Привяжите аккаунт для получения уведомлений и 2FA.</p>}
                            </div>
                            
                            {!currentUser.telegramId ? (
                                <div className="flex flex-col gap-2 w-full md:w-auto">
                                    <button 
                                        type="button" 
                                        onClick={handleGenerateLink} 
                                        disabled={tgLoading}
                                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded font-bold transition-colors disabled:opacity-50"
                                    >
                                        {tgLoading ? 'Генерация...' : 'Получить ссылку привязки'}
                                    </button>
                                    {tgLink && (
                                        <div className="bg-[#000] p-2 rounded border border-[#333] text-center">
                                            <a href={tgLink} target="_blank" className="text-blue-400 underline text-sm break-all">{tgLink}</a>
                                            <p className="text-[10px] text-gray-500 mt-1">Нажмите на ссылку и запустите бота (/start)</p>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-xs text-gray-500 font-mono">ID: {currentUser.telegramId}</div>
                            )}
                        </div>

                        {currentUser.telegramId && (
                            <div className="flex items-center justify-between pt-4 border-t border-[#222]">
                                <div>
                                    <div className="text-sm font-bold text-gray-300 flex items-center gap-2">
                                        <Smartphone className="w-4 h-4 text-purple-400" />
                                        Двухфакторная аутентификация (2FA)
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Требовать код из Telegram при входе.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={currentUser.twoFactorEnabled} onChange={toggle2FA} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                </label>
                            </div>
                        )}
                    </div>
                )}
             </div>

             <div className="border-t border-gray-700 my-2"></div>

             {/* Visuals - Direct Uploads */}
             {hasPermission(currentUser, 'canUploadAvatar') ? (
                <ImageUpload 
                    label={t('settings.avatar')}
                    currentImage={avatarUrl}
                    onImageChange={setAvatarUrl}
                    maxWidth={300}
                />
             ) : (
                <div className="opacity-50 pointer-events-none grayscale">
                    <p className="text-xs text-red-400 mb-1">{t('settings.noPermissionAvatar')}</p>
                    <ImageUpload 
                        label={t('settings.avatar')}
                        currentImage={avatarUrl}
                        onImageChange={() => {}}
                    />
                </div>
             )}

             {hasPermission(currentUser, 'canUploadBanner') ? (
                 <ImageUpload 
                    label={t('settings.banner')}
                    currentImage={bannerUrl}
                    onImageChange={setBannerUrl}
                    maxWidth={1200}
                 />
             ) : (
                <div className="opacity-50 pointer-events-none grayscale">
                    <p className="text-xs text-red-400 mb-1">{t('settings.noPermissionBanner')}</p>
                    <ImageUpload 
                        label={t('settings.banner')}
                        currentImage={bannerUrl}
                        onImageChange={() => {}}
                    />
                </div>
             )}

             {hasPermission(currentUser, 'canUseSignature') ? (
                 <div className="space-y-2">
                   <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
                     <PenTool className="w-4 h-4" /> {t('settings.signature')}
                   </label>
                   <textarea 
                     value={signature}
                     onChange={(e) => setSignature(e.target.value)}
                     className="w-full h-32 bg-gray-900 border border-gray-700 rounded p-2.5 text-white focus:border-cyan-500 outline-none font-mono text-sm"
                   />
                   <p className="text-xs text-gray-500">{t('settings.signatureHelp')}</p>
                 </div>
             ) : (
                 <div className="p-4 bg-gray-900/50 border border-gray-700 rounded text-gray-500 text-sm">
                    {t('settings.permissions')} required.
                 </div>
             )}

             <div className="pt-4 border-t border-gray-700">
               <button type="submit" className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded shadow-lg shadow-cyan-500/20 transition-all">
                 <Save className="w-4 h-4" /> {t('settings.save')}
               </button>
             </div>
           </form>
        </div>
      </div>
      <div className="hidden lg:block lg:w-80">
        <Sidebar />
      </div>
    </div>
  );
};

export default SettingsPage;
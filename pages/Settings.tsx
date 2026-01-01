import React, { useState } from 'react';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Settings, Save, PenTool, Mail, Lock, User, Tag, Clock } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import ImageUpload from '../components/UI/ImageUpload';

const SettingsPage: React.FC = () => {
  const { currentUser, updateUser, hasPermission } = useForum();
  const { t } = useLanguage();
  
  const [avatarUrl, setAvatarUrl] = useState(currentUser?.avatarUrl || '');
  const [bannerUrl, setBannerUrl] = useState(currentUser?.bannerUrl || '');
  const [signature, setSignature] = useState(currentUser?.signature || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [password, setPassword] = useState('');
  
  // New Fields controlled by permissions
  const [username, setUsername] = useState(currentUser?.username || '');
  const [customTitle, setCustomTitle] = useState(currentUser?.customTitle || '');
  
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!currentUser) return <div className="p-8 text-center text-white">{t('auth.login')}</div>;

  // COOLDOWN LOGIC
  const DAYS_COOLDOWN = 12;
  const lastChange = new Date(currentUser.lastUsernameChange || 0);
  const diffTime = Math.abs(Date.now() - lastChange.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  // If lastChange is 0 (never changed) -> diffDays is huge -> canChange is true
  // If changed yesterday -> diffDays is 1 -> canChange is false (needs >= 12)
  const canChangeUsernameByTime = !currentUser.lastUsernameChange || diffDays >= DAYS_COOLDOWN;
  const daysLeft = DAYS_COOLDOWN - diffDays;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate Username change if applicable
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
      // Update cooldown timestamp ONLY if username changed
      lastUsernameChange: (username !== currentUser.username) ? new Date().toISOString() : currentUser.lastUsernameChange
    });
    setSuccess(true);
    setPassword(''); 
    setTimeout(() => setSuccess(false), 3000);
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
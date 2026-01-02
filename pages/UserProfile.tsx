import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { formatDate, timeAgo } from '../utils/date';
import { parseBBCodeToHtml } from '../utils/bbCodeParser';
import { MessageSquare, Trophy, Calendar, User, Clock, Hash, Ban, Lock, Activity, Loader2 } from 'lucide-react';
import PrefixBadge from '../components/UI/PrefixBadge';
import RoleBadge from '../components/UI/RoleBadge';
import { User as UserType } from '../types';

const UserProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getUser, getPostsByUser, getThread, getUserRoles, currentUser, banUser, hasPermission, loadUser } = useForum();
  const { t, language } = useLanguage();

  const [localUser, setLocalUser] = useState<UserType | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // FETCH USER IF NOT IN CONTEXT
  useEffect(() => {
    if (!id) return;
    
    // Check if user is already in global state
    const cached = getUser(id);
    if (cached) {
        setLocalUser(cached);
        setLoading(false);
        return;
    }

    // Not found? Load explicitly
    setLoading(true);
    loadUser(id).then(u => {
        if (u) setLocalUser(u);
        setLoading(false);
    });
  }, [id, getUser, loadUser]);

  // ACCESS CHECK: Guests cannot view profiles
  if (!currentUser) {
     return (
        <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
           <div className="bg-[#1a1a1a] p-8 rounded-lg border border-[#333] text-center max-w-md mx-4">
              <Lock className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-white mb-2">{t('user.loginRequired')}</h2>
              <p className="text-gray-400 mb-6">{t('user.loginRequiredMsg')}</p>
           </div>
        </div>
     );
  }

  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center py-32 text-white animate-fade-in">
           <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
           <p className="text-gray-400">Загрузка профиля...</p>
        </div>
     );
  }
  
  if (!localUser) {
    return <div className="text-center text-white py-20">User not found</div>;
  }

  const user = localUser;
  const roles = getUserRoles(user);
  const userPosts = getPostsByUser(user.id);
  const recentPosts = userPosts.slice(0, 10); // Show last 10 posts

  const canBan = hasPermission(currentUser, 'canBanUsers');

  // Activity Status Logic
  const isOnline = user.lastActiveAt && (Date.now() - new Date(user.lastActiveAt).getTime() < 5 * 60 * 1000); // 5 mins threshold
  const statusText = isOnline ? (user.currentActivity?.text || 'В сети') : 'Не в сети';
  const statusLink = user.currentActivity?.link;

  return (
    <div className="container mx-auto px-4 py-4 md:py-8 animate-fade-in">
      {/* Cover / Header */}
      <div className="relative mb-6">
         {/* Banner */}
         <div className="h-32 md:h-64 w-full rounded-t-xl overflow-hidden bg-[#111] relative">
            {user.bannerUrl ? (
               <img src={user.bannerUrl} className="w-full h-full object-cover opacity-60" alt="" />
            ) : (
               <div className="w-full h-full bg-gradient-to-r from-[#111] to-[#222]"></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#000] to-transparent"></div>
         </div>

         {/* Profile Bar */}
         <div className="bg-[#0d0d0d] border border-[#222] border-t-0 rounded-b-xl px-4 md:px-6 pb-6 pt-0 shadow-lg relative flex flex-col md:flex-row items-start md:items-end gap-4 md:gap-6">
            
            {/* Avatar - Negative margin to overlap banner */}
            <div className="-mt-12 md:-mt-20 relative self-start">
               <img 
                 src={user.avatarUrl} 
                 className={`w-24 h-24 md:w-40 md:h-40 rounded-xl bg-[#000] border-4 border-[#0d0d0d] shadow-2xl object-cover ${user.isBanned ? 'grayscale' : ''}`} 
                 alt={user.username} 
               />
               {!user.isBanned && (
                  <div 
                     className={`absolute bottom-1 right-1 md:bottom-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full border-2 border-[#0d0d0d] shadow-lg ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} 
                     title={isOnline ? 'Online' : 'Offline'}
                  ></div>
               )}
            </div>

            <div className="flex-1 min-w-0 pt-0 md:pt-2 w-full">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                     <h1 className="text-2xl md:text-3xl font-bold font-display text-white mb-1 flex flex-wrap items-center gap-2 md:gap-3">
                        {user.username}
                        <div className="flex gap-2">
                           {roles.map(r => <RoleBadge key={r.id} role={r} />)}
                        </div>
                        {user.isBanned && (
                           <span className="bg-red-900 text-red-200 border border-red-800 text-[10px] uppercase px-2 py-0.5 rounded tracking-wider font-mono flex items-center gap-1">
                             <Ban className="w-3 h-3" /> {t('user.bannedStatus')}
                           </span>
                        )}
                     </h1>
                     <p className="text-gray-500 text-sm">{user.customTitle || (roles[0] ? roles[0].name : t('user.member'))}</p>
                     
                     {/* ACTIVITY STATUS */}
                     {!user.isBanned && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                           <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                           {isOnline && statusLink ? (
                              <Link to={statusLink} className="text-gray-400 hover:text-white hover:underline transition-colors flex items-center gap-1">
                                 {statusText}
                              </Link>
                           ) : (
                              <span className="text-gray-500">{statusText}</span>
                           )}
                        </div>
                     )}
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center w-full md:w-auto">
                     {/* Quick Stats Grid - Responsive */}
                     <div className="flex w-full sm:w-auto justify-between sm:justify-start gap-4 md:gap-8 text-center bg-[#111] p-3 rounded border border-[#222]">
                        <div className="flex-1 sm:flex-none">
                           <div className="text-lg font-bold text-white font-mono">{user.messages}</div>
                           <div className="text-[10px] uppercase text-gray-500 tracking-wider">{t('user.messages')}</div>
                        </div>
                        <div className="w-px bg-[#333]"></div>
                        <div className="flex-1 sm:flex-none">
                           <div className="text-lg font-bold text-white font-mono">{user.reactions}</div>
                           <div className="text-[10px] uppercase text-gray-500 tracking-wider">{t('user.reactions')}</div>
                        </div>
                        <div className="w-px bg-[#333]"></div>
                        <div className="flex-1 sm:flex-none">
                           <div className="text-lg font-bold text-white font-mono">{user.points}</div>
                           <div className="text-[10px] uppercase text-gray-500 tracking-wider">{t('user.points')}</div>
                        </div>
                     </div>

                     {canBan && !roles[0]?.isSystem && user.id !== currentUser.id && (
                        <button 
                          onClick={() => banUser(user.id, !user.isBanned)}
                          className={`w-full sm:w-auto px-4 py-2 rounded font-bold text-sm shadow-lg ${user.isBanned ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-red-600 hover:bg-red-500 text-white'}`}
                        >
                           {user.isBanned ? t('user.unban') : t('user.ban')}
                        </button>
                     )}
                  </div>
               </div>
            </div>
         </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
         {/* Left Column: Info & Signature */}
         <div className="w-full lg:w-80 flex flex-col gap-6 order-2 lg:order-1">
            <div className="glass-panel rounded p-5 bg-[#0d0d0d]">
               <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" /> {t('user.about')} {user.username}
               </h3>
               <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center py-2 border-b border-[#222]">
                     <span className="text-gray-500 flex items-center gap-2"><Calendar className="w-3.5 h-3.5" /> {t('user.joined')}</span>
                     <span className="text-gray-300">{formatDate(user.joinedAt, language, false)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#222]">
                     <span className="text-gray-500 flex items-center gap-2"><Activity className="w-3.5 h-3.5" /> Активность</span>
                     <span className="text-gray-300">{user.lastActiveAt ? timeAgo(user.lastActiveAt, language) : '-'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-[#222]">
                     <span className="text-gray-500 flex items-center gap-2"><Hash className="w-3.5 h-3.5" /> ID</span>
                     <span className="text-gray-300 font-mono">#{user.id}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                     <span className="text-gray-500 flex items-center gap-2"><Trophy className="w-3.5 h-3.5" /> {t('user.rank')}</span>
                     <span className="text-white">{roles[0]?.name}</span>
                  </div>
               </div>
            </div>

            {user.signature && (
               <div className="glass-panel rounded p-5 bg-[#0d0d0d]">
                  <h3 className="font-bold text-white uppercase tracking-wider text-xs mb-4 flex items-center gap-2">
                     <MessageSquare className="w-4 h-4" /> {t('user.signature')}
                  </h3>
                  <div 
                     className="text-sm text-gray-400 italic leading-relaxed overflow-hidden" 
                     dangerouslySetInnerHTML={{ __html: parseBBCodeToHtml(user.signature) }} 
                  />
               </div>
            )}
         </div>

         {/* Right Column: Recent Activity */}
         <div className="flex-1 min-w-0 order-1 lg:order-2">
            <div className="glass-panel rounded overflow-hidden bg-[#0d0d0d]">
               <div className="px-6 py-4 border-b border-[#222] bg-[#1a1a1a]">
                  <h3 className="font-bold text-white flex items-center gap-2">
                     <Clock className="w-5 h-5 text-gray-400" /> {t('user.recentPosts')}
                  </h3>
               </div>
               
               {recentPosts.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 italic">{t('user.noPosts')}</div>
               ) : (
                  <div className="divide-y divide-[#222]">
                     {recentPosts.map(post => {
                        const thread = getThread(post.threadId);
                        if (!thread) return null;
                        
                        return (
                           <div key={post.id} className="p-4 md:p-5 hover:bg-[#161616] transition-colors">
                              <div className="flex flex-col gap-2">
                                 <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <PrefixBadge prefixId={thread.prefixId} />
                                    <Link to={`/thread/${thread.id}#post-${post.id}`} className="font-bold text-gray-300 hover:text-white transition-colors">
                                       {thread.title}
                                    </Link>
                                    <span className="text-xs text-gray-600 ml-auto">{formatDate(post.createdAt, language)}</span>
                                 </div>
                                 <div className="text-sm text-gray-400 line-clamp-2 bg-[#111] p-3 rounded border border-[#222]">
                                    {post.content.replace(/\[.*?\]/g, '')}
                                 </div>
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default UserProfile;

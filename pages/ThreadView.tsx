import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, ChevronRight, Lock, Share2, Pin, Check, Pencil, Trash2, Loader2, AlertCircle, RefreshCcw } from 'lucide-react';
import PostItem from '../components/Forum/PostItem';
import PrefixBadge from '../components/UI/PrefixBadge';
import Sidebar from '../components/Layout/Sidebar';
import BBCodeEditor from '../components/UI/BBCodeEditor';
import { Thread, Post } from '../types';

const ThreadView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getForum, getUser, currentUser, replyToThread, updateThread, deleteThread, hasPermission, toggleThreadLock, toggleThreadPin, prefixes, loadPostsForThread, loadThread } = useForum();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  // Local State for Robust Data Fetching
  const [localThread, setLocalThread] = useState<Thread | null>(null);
  const [localPosts, setLocalPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [replyContent, setReplyContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  // Edit Header State
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrefix, setEditPrefix] = useState('');

  const fetchThreadData = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    
    try {
        const [fetchedThread, fetchedPosts] = await Promise.all([
            loadThread(id),
            loadPostsForThread(id)
        ]);

        if (fetchedThread) {
            setLocalThread(fetchedThread);
            setLocalPosts(fetchedPosts.sort((a, b) => a.number - b.number));
        } else {
            setError('Thread not found');
        }
    } catch (e) {
        console.error(e);
        setError('Failed to load thread');
    } finally {
        setLoading(false);
    }
  };

  // Trigger fetch on ID change (navigation)
  useEffect(() => {
    fetchThreadData();
  }, [id]);

  // Loading State
  if (loading) {
     return (
        <div className="flex flex-col items-center justify-center py-32 text-white animate-fade-in">
           <Loader2 className="w-12 h-12 animate-spin text-cyan-500 mb-4" />
           <p className="text-gray-400">Загрузка темы...</p>
        </div>
     );
  }

  // Error/Not Found State
  if (error || !localThread) {
    return (
       <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">{error || 'Тема не найдена'}</h2>
          <p className="text-gray-500 mb-6">Возможно, она была удалена или вы перешли по неверной ссылке.</p>
          <div className="flex gap-4">
             <Link to="/" className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold transition-colors">
                На главную
             </Link>
             <button onClick={fetchThreadData} className="px-6 py-2 bg-cyan-900/50 hover:bg-cyan-900 text-cyan-400 rounded font-bold transition-colors flex items-center gap-2">
                <RefreshCcw className="w-4 h-4" /> Повторить
             </button>
          </div>
       </div>
    );
  }

  const forum = getForum(localThread.forumId);
  const author = getUser(localThread.authorId);

  const handleReply = async () => {
     if (!replyContent.trim()) return;
     try {
        await replyToThread(localThread.id, replyContent);
        setReplyContent('');
        // Refresh posts after reply
        const newPosts = await loadPostsForThread(localThread.id);
        setLocalPosts(newPosts.sort((a, b) => a.number - b.number));
     } catch (e) {
        alert("Ошибка при отправке ответа");
     }
  };

  const handleShare = () => {
     navigator.clipboard.writeText(window.location.href);
     setIsCopied(true);
     setTimeout(() => setIsCopied(false), 2000);
  };

  const canReply = currentUser && hasPermission(currentUser, 'canReply');
  const isAuthor = currentUser && currentUser.id === localThread.authorId;
  
  const canLock = currentUser && (
      hasPermission(currentUser, 'canLockThreads') || 
      (isAuthor && hasPermission(currentUser, 'canCloseOwnThreads'))
  );
  
  const canPin = currentUser && hasPermission(currentUser, 'canPinThreads');

  const canDelete = currentUser && (
    hasPermission(currentUser, 'canDeleteAnyThread') ||
    (isAuthor && hasPermission(currentUser, 'canDeleteOwnThreads'))
  );

  const handleDeleteThread = async () => {
     if(window.confirm(t('admin.confirmDelete'))) {
        try {
           await deleteThread(localThread.id);
           if (forum) navigate(`/forum/${forum.id}`);
           else navigate('/');
        } catch(e) {
           console.error(e);
           alert(t('alert.deleteFail'));
        }
     }
  };

  const canEditHeader = currentUser && (
     (isAuthor && hasPermission(currentUser, 'canEditOwnThreads')) ||
     hasPermission(currentUser, 'canEditAnyThread')
  );

  const startHeaderEdit = () => {
     setEditTitle(localThread.title);
     setEditPrefix(localThread.prefixId || '');
     setIsEditingHeader(true);
  };

  const saveHeaderEdit = async () => {
     if (editTitle.trim()) {
        await updateThread(localThread.id, { 
           title: editTitle, 
           prefixId: editPrefix || undefined 
        });
        setLocalThread({ ...localThread, title: editTitle, prefixId: editPrefix || undefined });
        setIsEditingHeader(false);
     }
  };

  return (
    <div className="container mx-auto px-4 py-8 animate-fade-in">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm text-gray-500 mb-4 md:mb-6 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
        <Link to="/" className="hover:text-white flex-shrink-0"><Home className="w-3 h-3 md:w-4 md:h-4" /></Link>
        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
        <Link to="/" className="hover:text-white flex-shrink-0">{t('nav.forums')}</Link>
        <ChevronRight className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
        {forum && (
          <>
             <Link to={`/forum/${forum.id}`} className="hover:text-white cursor-pointer truncate max-w-[120px] md:max-w-none">{forum.name}</Link>
             <ChevronRight className="w-3 h-3 md:w-4 md:h-4 flex-shrink-0" />
          </>
        )}
        <span className="text-gray-300 truncate">{localThread.title}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
         <div className="flex-1 min-w-0">
            {/* Thread Header */}
            <div className="mb-8">
               {isEditingHeader ? (
                  <div className="mb-4 bg-[#111] p-4 rounded border border-[#333] space-y-3 animate-fade-in">
                     <div className="flex flex-col md:flex-row gap-2">
                        <select 
                           value={editPrefix} 
                           onChange={(e) => setEditPrefix(e.target.value)}
                           className="bg-[#222] border border-[#444] text-white rounded px-2 py-2 text-sm outline-none focus:border-white"
                        >
                           <option value="">{t('thread.noPrefix')}</option>
                           {prefixes.map(p => <option key={p.id} value={p.id}>{p.text}</option>)}
                        </select>
                        <input 
                           type="text" 
                           value={editTitle} 
                           onChange={(e) => setEditTitle(e.target.value)}
                           className="flex-1 bg-[#222] border border-[#444] text-white rounded px-3 py-2 text-lg font-bold outline-none focus:border-white"
                        />
                     </div>
                     <div className="flex gap-2 justify-end">
                        <button onClick={() => setIsEditingHeader(false)} className="px-3 py-1.5 rounded text-sm bg-gray-800 text-gray-300 hover:text-white hover:bg-gray-700">{t('general.cancel')}</button>
                        <button onClick={saveHeaderEdit} className="px-3 py-1.5 rounded text-sm bg-white text-black font-bold hover:bg-gray-200">{t('general.save')}</button>
                     </div>
                  </div>
               ) : (
                  <h1 className="text-xl md:text-2xl lg:text-4xl font-bold font-display text-white mb-3 flex flex-wrap items-center gap-2 md:gap-3 break-words">
                     {localThread.isPinned && <Pin className="w-5 h-5 md:w-6 md:h-6 text-green-400 fill-green-400 flex-shrink-0" />}
                     <PrefixBadge prefixId={localThread.prefixId} />
                     <span className="break-words">{localThread.title}</span>
                     {canEditHeader && (
                        <button onClick={startHeaderEdit} className="text-gray-600 hover:text-white transition-colors ml-2 flex-shrink-0" title="Edit Thread Title">
                           <Pencil className="w-4 h-4 md:w-5 md:h-5" />
                        </button>
                     )}
                  </h1>
               )}

               <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-gray-500 bg-[#111] p-2 md:p-3 rounded border border-[#333]">
                  <div className="flex items-center gap-2 flex-shrink-0">
                     <Link to={author ? `/user/${author.id}` : '#'}>
                        <img src={author?.avatarUrl || 'https://ui-avatars.com/api/?name=?&background=333&color=fff'} className="w-4 h-4 md:w-5 md:h-5 rounded bg-[#222]" alt="" />
                     </Link>
                     <Link to={author ? `/user/${author.id}` : '#'} className="text-gray-300 font-bold hover:text-white transition-colors truncate max-w-[100px] md:max-w-none">
                        {author?.username || 'Unknown'}
                     </Link>
                  </div>
                  <span className="hidden md:inline">&bull;</span>
                  <span className="text-[10px] md:text-xs">{new Date(localThread.createdAt).toLocaleString()}</span>
                  <div className="ml-auto flex items-center gap-1 md:gap-2 flex-shrink-0">
                     {localThread.isLocked && (
                        <span className="flex items-center gap-1 text-red-400 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/40 whitespace-nowrap">
                           <Lock className="w-3 h-3" /> <span className="hidden md:inline">{t('thread.locked')}</span>
                        </span>
                     )}
                     <button 
                       onClick={handleShare}
                       className="flex items-center gap-1 hover:text-white transition-colors text-gray-400"
                     >
                        {isCopied ? <Check className="w-3 h-3 text-green-500" /> : <Share2 className="w-3 h-3" />}
                        {isCopied ? t('alert.copyCode') : t('thread.share')}
                     </button>
                  </div>
               </div>
               
               {/* Moderation Tools */}
               {(canLock || canPin || canDelete) && (
                 <div className="mt-2 flex flex-wrap gap-2">
                    {canLock && (
                      <button 
                        onClick={() => { toggleThreadLock(localThread.id); setLocalThread(p => p ? ({...p, isLocked: !p.isLocked}) : null) }}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                      >
                         <Lock className="w-3 h-3" /> {localThread.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                    )}
                    {canPin && (
                      <button 
                        onClick={() => { toggleThreadPin(localThread.id); setLocalThread(p => p ? ({...p, isPinned: !p.isPinned}) : null) }}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                      >
                         <Pin className="w-3 h-3" /> {localThread.isPinned ? 'Unpin' : 'Pin'}
                      </button>
                    )}
                    {canDelete && (
                       <button 
                          onClick={handleDeleteThread}
                          className="text-xs flex items-center gap-1 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 rounded border border-red-900/40 transition-colors"
                       >
                          <Trash2 className="w-3 h-3" /> {t('general.delete')}
                       </button>
                    )}
                 </div>
               )}
            </div>

            {/* Locked Notice */}
            {localThread.isLocked && (
               <div className="mb-6 p-4 bg-red-900/10 border border-red-800 rounded flex items-center gap-3 text-sm text-red-200">
                  <div className="w-8 h-8 rounded bg-red-900/20 flex items-center justify-center text-red-500 shrink-0">
                     <Lock className="w-4 h-4" />
                  </div>
                  <span>{t('thread.lockedMsg')}</span>
               </div>
            )}

            {/* Posts */}
            <div className="space-y-4 md:space-y-6">
               {localPosts.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 italic">Нет сообщений.</div>
               ) : (
                  localPosts.map(post => (
                     <PostItem key={post.id} post={post} />
                  ))
               )}
            </div>

            {/* Quick Reply */}
            {(!localThread.isLocked || canLock) && canReply ? (
               <div className="mt-8 glass-panel rounded p-4 md:p-6 bg-[#0d0d0d]">
                  <h3 className="text-lg font-bold font-display text-white mb-4">{t('thread.writeReply')}</h3>
                  <div className="flex gap-4">
                     <img src={currentUser.avatarUrl} className="hidden md:block w-10 h-10 rounded bg-[#222]" alt="" />
                     <div className="flex-1">
                        <BBCodeEditor 
                           value={replyContent}
                           onChange={setReplyContent}
                           className="min-h-[120px]"
                           placeholder={t('thread.writeReply')}
                        />
                        <div className="mt-3 flex justify-end">
                           <button 
                             onClick={handleReply}
                             className="px-6 py-2.5 bg-white text-black font-bold rounded shadow hover:bg-gray-200 transition-all transform hover:scale-[1.01]"
                           >
                              {t('thread.postReply')}
                           </button>
                        </div>
                     </div>
                  </div>
               </div>
            ) : (
               !localThread.isLocked && (
                  <div className="mt-8 p-8 text-center bg-[#111] rounded border border-[#333] text-gray-500">
                     {t('thread.loginToReply')}
                  </div>
               )
            )}
         </div>

         {/* Right Sidebar */}
         <div className="hidden lg:block lg:w-80">
             <Sidebar />
         </div>
      </div>
    </div>
  );
};

export default ThreadView;
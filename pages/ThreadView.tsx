import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, ChevronRight, Lock, Share2, Pin, Check, Pencil, Trash2, Loader2 } from 'lucide-react';
import PostItem from '../components/Forum/PostItem';
import PrefixBadge from '../components/UI/PrefixBadge';
import Sidebar from '../components/Layout/Sidebar';
import BBCodeEditor from '../components/UI/BBCodeEditor';

const ThreadView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getThread, getPostsByThread, getForum, getUser, currentUser, replyToThread, updateThread, deleteThread, hasPermission, toggleThreadLock, toggleThreadPin, prefixes, loadPostsForThread, loadThread } = useForum();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [replyContent, setReplyContent] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit Header State
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrefix, setEditPrefix] = useState('');

  const thread = id ? getThread(id) : undefined;

  // Load Thread and Posts
  useEffect(() => {
    if (id) {
       setLoading(true);
       const promises = [loadPostsForThread(id)];
       // If thread isn't in cache (e.g. deep link or not in recent list), load it
       if (!thread) {
           promises.push(loadThread(id));
       }
       Promise.all(promises).then(() => setLoading(false));
    }
  }, [id, thread ? 'exists' : 'missing']); // Dependency hack to trigger if thread becomes available
  
  if (!thread) {
    if (loading) {
       return (
          <div className="flex flex-col items-center justify-center py-20 text-white">
             <Loader2 className="w-10 h-10 animate-spin text-cyan-500 mb-4" />
             <p>Загрузка темы...</p>
          </div>
       );
    }
    return <div className="text-center text-white py-20">Thread not found</div>;
  }

  const posts = getPostsByThread(thread.id);
  const forum = getForum(thread.forumId);
  const author = getUser(thread.authorId);

  const handleReply = () => {
     if (!replyContent.trim()) return;
     replyToThread(thread.id, replyContent);
     setReplyContent('');
  };

  const handleShare = () => {
     navigator.clipboard.writeText(window.location.href);
     setIsCopied(true);
     setTimeout(() => setIsCopied(false), 2000);
  };

  const canReply = currentUser && hasPermission(currentUser, 'canReply');
  const isAuthor = currentUser && currentUser.id === thread.authorId;
  
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
           await deleteThread(thread.id);
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
     setEditTitle(thread.title);
     setEditPrefix(thread.prefixId || '');
     setIsEditingHeader(true);
  };

  const saveHeaderEdit = async () => {
     if (editTitle.trim()) {
        await updateThread(thread.id, { 
           title: editTitle, 
           prefixId: editPrefix || undefined 
        });
        setIsEditingHeader(false);
     }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6 overflow-x-auto whitespace-nowrap pb-2">
        <Link to="/" className="hover:text-white"><Home className="w-4 h-4" /></Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/" className="hover:text-white">{t('nav.forums')}</Link>
        <ChevronRight className="w-4 h-4" />
        {forum && (
          <>
             <Link to={`/forum/${forum.id}`} className="hover:text-white cursor-pointer">{forum.name}</Link>
             <ChevronRight className="w-4 h-4" />
          </>
        )}
        <span className="text-gray-300">{thread.title}</span>
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
                  <h1 className="text-2xl md:text-4xl font-bold font-display text-white mb-3 flex flex-wrap items-center gap-2 md:gap-3">
                     {thread.isPinned && <Pin className="w-6 h-6 text-green-400 fill-green-400" />}
                     <PrefixBadge prefixId={thread.prefixId} />
                     {thread.title}
                     {canEditHeader && (
                        <button onClick={startHeaderEdit} className="text-gray-600 hover:text-white transition-colors ml-2" title="Edit Thread Title">
                           <Pencil className="w-5 h-5" />
                        </button>
                     )}
                  </h1>
               )}

               <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-gray-500 bg-[#111] p-3 rounded border border-[#333]">
                  <div className="flex items-center gap-2">
                     <Link to={author ? `/user/${author.id}` : '#'}>
                        <img src={author?.avatarUrl} className="w-5 h-5 rounded bg-[#222]" alt="" />
                     </Link>
                     <Link to={author ? `/user/${author.id}` : '#'} className="text-gray-300 font-bold hover:text-white transition-colors">
                        {author?.username}
                     </Link>
                  </div>
                  <span>&bull;</span>
                  <span>{new Date(thread.createdAt).toLocaleString()}</span>
                  <div className="ml-auto flex items-center gap-2">
                     {thread.isLocked && (
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
                        onClick={() => toggleThreadLock(thread.id)}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                      >
                         <Lock className="w-3 h-3" /> {thread.isLocked ? 'Unlock' : 'Lock'}
                      </button>
                    )}
                    {canPin && (
                      <button 
                        onClick={() => toggleThreadPin(thread.id)}
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors"
                      >
                         <Pin className="w-3 h-3" /> {thread.isPinned ? 'Unpin' : 'Pin'}
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
            {thread.isLocked && (
               <div className="mb-6 p-4 bg-red-900/10 border border-red-800 rounded flex items-center gap-3 text-sm text-red-200">
                  <div className="w-8 h-8 rounded bg-red-900/20 flex items-center justify-center text-red-500 shrink-0">
                     <Lock className="w-4 h-4" />
                  </div>
                  <span>{t('thread.lockedMsg')}</span>
               </div>
            )}

            {/* Posts */}
            <div className="space-y-4 md:space-y-6">
               {loading ? (
                  <div className="flex flex-col items-center justify-center p-12">
                     <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-4" />
                     <span className="text-gray-500 text-sm">Загрузка сообщений...</span>
                  </div>
               ) : posts.length === 0 ? (
                  <div className="p-12 text-center text-gray-500 italic">Нет сообщений.</div>
               ) : (
                  posts.map(post => (
                     <PostItem key={post.id} post={post} />
                  ))
               )}
            </div>

            {/* Quick Reply */}
            {(!thread.isLocked || canLock) && canReply ? (
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
               !thread.isLocked && (
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
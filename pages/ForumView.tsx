import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Home, ChevronRight, Plus, Lock, Pin, Loader2, AlertTriangle } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import PrefixBadge from '../components/UI/PrefixBadge';
import CreateThreadModal from '../components/Forum/CreateThreadModal';
import ForumRow from '../components/Forum/ForumRow';
import Pagination from '../components/UI/Pagination';
import { timeAgo } from '../utils/date';

const ForumView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getForum, getSubForums, threads, users, currentUser, hasPermission, loadThreadsForForum } = useForum();
  const { t, language } = useLanguage();
  const [isCreateOpen, setCreateOpen] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(false); // Local loading state
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const forum = id ? getForum(id) : undefined;

  // Lazy Load threads when ID changes
  useEffect(() => {
    if (id) {
        setLoadingThreads(true);
        loadThreadsForForum(id).finally(() => setLoadingThreads(false));
    }
  }, [id]);
  
  // Context guarantees Forums are loaded. If forum is undefined here, it truly doesn't exist.
  if (!forum) {
    return (
       <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <AlertTriangle className="w-12 h-12 text-gray-600 mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Форум не найден</h2>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300 underline">Вернуться на главную</Link>
       </div>
    );
  }

  // Get Sub-forums
  const subForums = getSubForums(forum.id);

  // Filter threads and Pagination logic
  const forumThreads = threads
    .filter(t => t.forumId === forum.id)
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      if ((a.order || 0) !== (b.order || 0)) {
         return (a.order || 0) - (b.order || 0);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const totalPages = Math.ceil(forumThreads.length / itemsPerPage);
  const currentThreads = forumThreads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const canManageForums = hasPermission(currentUser, 'canManageForums');
  const canCreateThread = hasPermission(currentUser, 'canCreateThread') && (!forum.isClosed || canManageForums);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link to="/" className="hover:text-white"><Home className="w-4 h-4" /></Link>
        <ChevronRight className="w-4 h-4" />
        <Link to="/" className="hover:text-white">{t('nav.forums')}</Link>
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-300">{forum.name}</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
           
           <div className="flex justify-between items-center mb-6">
             <div className="flex items-center gap-3">
               <h1 className="text-3xl font-bold font-display text-white">{forum.name}</h1>
               {forum.isClosed && (
                 <span className="px-2 py-1 rounded bg-red-900/30 border border-red-800 text-red-200 text-xs font-bold flex items-center gap-1">
                   <Lock className="w-3 h-3" /> CLOSED
                 </span>
               )}
             </div>
             {canCreateThread ? (
               <button 
                 onClick={() => setCreateOpen(true)}
                 className="flex items-center gap-2 px-5 py-2 bg-white text-black hover:bg-gray-200 font-bold rounded shadow transition-all"
               >
                 <Plus className="w-4 h-4" /> {t('thread.create')}
               </button>
             ) : (
                forum.isClosed && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] text-gray-500 border border-[#333] rounded cursor-not-allowed">
                     <Lock className="w-4 h-4" /> Forum Locked
                  </div>
                )
             )}
           </div>

           {/* SUB-FORUMS SECTION */}
           {subForums.length > 0 && (
              <div className="mb-8 animate-fade-in">
                 <div className="bg-[#1a1a1a] border border-[#333] rounded overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#333] flex items-center gap-2">
                       <span className="text-xs text-gray-200 uppercase font-bold tracking-wider">{t('forum.subforums')}</span>
                    </div>
                    <div>
                       {subForums.map(sf => (
                          <ForumRow key={sf.id} forum={sf} />
                       ))}
                    </div>
                 </div>
              </div>
           )}

           <div className="glass-panel rounded overflow-hidden animate-fade-in bg-[#0d0d0d] min-h-[200px]">
              <div className="px-5 py-4 bg-[#1a1a1a] border-b border-[#333] flex justify-between text-xs text-gray-400 uppercase font-bold tracking-wider">
                 <span>{t('forum.threads')}</span>
                 <div className="hidden md:flex gap-16 mr-8">
                    <span className="w-16 text-center">{t('sidebar.stats')}</span>
                    <span className="w-32">{t('forum.lastPost')}</span>
                 </div>
              </div>

              {loadingThreads && forumThreads.length === 0 ? (
                 <div className="flex flex-col items-center justify-center p-20 animate-fade-in">
                    <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mb-4" />
                    <span className="text-gray-500 text-sm">Загрузка тем...</span>
                 </div>
              ) : forumThreads.length === 0 ? (
                <div className="p-12 text-center text-gray-600 italic">
                   {t('forum.empty')}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-[#222]">
                     {currentThreads.map(thread => {
                       const author = users[thread.authorId];
                       const lastPoster = thread.lastPost ? users[thread.lastPost.authorId] : null;
                       const hasNewActivity = thread.lastPost && (Date.now() - new Date(thread.lastPost.createdAt).getTime() < 24 * 60 * 60 * 1000);

                       return (
                         <div key={thread.id} className={`p-4 flex items-center gap-5 hover:bg-[#161616] transition-colors ${thread.isPinned ? 'bg-[#1a1a1a]/50 border-l-2 border-l-green-500' : ''}`}>
                            <div className="flex-shrink-0 relative">
                               <img 
                                 src={author?.avatarUrl || 'https://ui-avatars.com/api/?name=?&background=333&color=fff'} 
                                 className={`w-10 h-10 rounded bg-[#222] ${hasNewActivity ? '' : 'opacity-60'}`} 
                                 alt="" 
                               />
                               {hasNewActivity && (
                                 <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded border border-black shadow"></div>
                               )}
                            </div>
                            <div className="flex-1 min-w-0">
                               <div className="flex items-center gap-2">
                                 {/* Pin/Lock Icons */}
                                 {thread.isPinned && <Pin className="w-3.5 h-3.5 text-green-400 fill-green-400 rotate-45" />}
                                 {thread.isLocked && <Lock className="w-3.5 h-3.5 text-red-500" />}
                                 
                                 <Link to={`/thread/${thread.id}`} className={`text-base font-bold font-display transition-colors truncate ${hasNewActivity ? 'text-white hover:text-gray-300' : 'text-gray-400 hover:text-gray-200'}`}>
                                    <PrefixBadge prefixId={thread.prefixId} />
                                    {thread.title}
                                 </Link>
                               </div>
                               <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                                  {t('forum.startedBy')} <span className="text-gray-400 font-medium">{author?.username || 'Unknown'}</span> &bull; {timeAgo(thread.createdAt, language)}
                               </div>
                            </div>

                            <div className="hidden md:flex flex-col w-24 text-center">
                               <span className={`text-sm font-mono ${hasNewActivity ? 'text-gray-200' : 'text-gray-600'}`}>{thread.replyCount}</span>
                               <span className="text-[10px] text-gray-600 uppercase tracking-wider">{t('forum.replies')}</span>
                            </div>

                            <div className="hidden md:block w-48 text-right text-xs">
                               {thread.lastPost ? (
                                 <>
                                   <div className={`mb-0.5 ${hasNewActivity ? 'text-gray-300' : 'text-gray-600'}`}>{timeAgo(thread.lastPost.createdAt, language)}</div>
                                   <div className="text-gray-500">{t('forum.by')} <span className={`font-medium ${hasNewActivity ? 'text-white' : 'text-gray-500'}`}>{lastPoster?.username || 'Unknown'}</span></div>
                                 </>
                               ) : (
                                 <span>-</span>
                               )}
                            </div>
                         </div>
                       );
                     })}
                  </div>
                  
                  {/* Pagination Control */}
                  <div className="p-4 border-t border-[#333]">
                     <Pagination 
                        currentPage={currentPage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                     />
                  </div>
                </>
              )}
           </div>
        </div>

        <div className="hidden lg:block lg:w-80">
          <Sidebar />
        </div>
      </div>

      <CreateThreadModal forumId={forum.id} isOpen={isCreateOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
};

export default ForumView;
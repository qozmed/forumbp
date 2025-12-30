import React from 'react';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Link } from 'react-router-dom';
import { Clock, MessageSquare, Hash } from 'lucide-react';
import Sidebar from '../components/Layout/Sidebar';
import PrefixBadge from '../components/UI/PrefixBadge';
import { timeAgo } from '../utils/date';

const Activity: React.FC = () => {
  const { threads, users, forums } = useForum();
  const { t, language } = useLanguage();

  // Sort threads by creation date (newest first)
  const sortedThreads = [...threads].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3 font-display">
          <Clock className="w-8 h-8 text-white" />
          {t('activity.title')}
        </h1>
        <p className="text-gray-400">{t('activity.subtitle')}</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 min-w-0">
          <div className="glass-panel rounded overflow-hidden animate-fade-in bg-[#0d0d0d]">
            {sortedThreads.length === 0 ? (
              <div className="p-16 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-[#1a1a1a] rounded-full flex items-center justify-center mb-6">
                  <Clock className="w-10 h-10 text-gray-600" />
                </div>
                <p className="text-gray-500 text-lg">{t('activity.empty')}</p>
              </div>
            ) : (
              <div className="divide-y divide-[#222]">
                {sortedThreads.map(thread => {
                  const author = users[thread.authorId];
                  const forum = forums.find(f => f.id === thread.forumId);

                  return (
                    <div key={thread.id} className="p-5 hover:bg-[#161616] transition-colors group">
                      <div className="flex gap-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0 pt-1">
                          <Link to={`/user/${thread.authorId}`}>
                             <img 
                               src={author?.avatarUrl} 
                               className="w-11 h-11 rounded bg-[#222] transition-all hover:scale-110" 
                               alt="" 
                             />
                          </Link>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <Link 
                              to={`/thread/${thread.id}`} 
                              className="text-lg font-bold font-display text-gray-300 hover:text-white transition-colors line-clamp-1"
                            >
                              <PrefixBadge prefixId={thread.prefixId} />
                              {thread.title}
                            </Link>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-2 text-sm text-gray-500">
                            <Link to={`/user/${thread.authorId}`} className="text-gray-400 font-medium hover:text-white transition-colors">
                               {author?.username}
                            </Link>
                            <span>&bull;</span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {timeAgo(thread.createdAt, language)}
                            </span>
                          </div>
                          
                          {forum && (
                            <div className="mt-3 flex items-center text-xs text-gray-500">
                              <span>{t('activity.postedIn')}</span>
                              <Link 
                                to={`/forum/${forum.id}`} 
                                className="ml-2 flex items-center gap-1.5 text-gray-400 hover:text-white transition-colors bg-[#1a1a1a] px-2.5 py-1 rounded border border-[#333]"
                              >
                                <Hash className="w-3 h-3" />
                                {forum.name}
                              </Link>
                            </div>
                          )}
                        </div>

                        {/* Stats (Desktop) */}
                        <div className="hidden sm:flex flex-col items-end justify-center gap-1 min-w-[80px] text-right pl-6 border-l border-[#222] ml-2">
                           <div className="text-lg font-mono font-medium text-gray-300 flex items-center gap-2">
                              {thread.replyCount}
                              <MessageSquare className="w-4 h-4 text-gray-600" />
                           </div>
                           <div className="text-[10px] uppercase tracking-wider text-gray-600">{t('forum.replies')}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block lg:w-80">
          <Sidebar />
        </div>
      </div>
    </div>
  );
};

export default Activity;
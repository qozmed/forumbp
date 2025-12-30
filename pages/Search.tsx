
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForum } from '../context/ForumContext';
import { useLanguage } from '../context/LanguageContext';
import { Search as SearchIcon } from 'lucide-react';
import PrefixBadge from '../components/UI/PrefixBadge';
import { Thread, Post } from '../types';

const SearchPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const { search, users } = useForum();
  const { t } = useLanguage();
  const [results, setResults] = useState<{ threads: Thread[], posts: Post[] }>({ threads: [], posts: [] });

  useEffect(() => {
    if (query) {
      setResults(search(query));
    }
  }, [query]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
        <SearchIcon className="w-8 h-8 text-cyan-400" />
        {t('general.searchResults')}: "{query}"
      </h1>

      <div className="space-y-6">
        {/* Threads */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 font-bold text-sm uppercase text-gray-300">
            {t('forum.threads')} ({results.threads.length})
          </div>
          {results.threads.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm italic">{t('general.noResults')}</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {results.threads.map(thread => (
                <div key={thread.id} className="p-4 flex gap-4 hover:bg-gray-750 transition-colors">
                   <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                         <PrefixBadge prefixId={thread.prefixId} />
                         <Link to={`/thread/${thread.id}`} className="font-bold text-gray-200 hover:text-cyan-400 text-lg">
                            {thread.title}
                         </Link>
                      </div>
                      <div className="text-xs text-gray-500">
                         {t('forum.startedBy')} <Link to={`/user/${thread.authorId}`} className="hover:text-white transition-colors">{users[thread.authorId]?.username}</Link>
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Posts */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-4 py-3 bg-gray-750 border-b border-gray-700 font-bold text-sm uppercase text-gray-300">
            {t('forum.messages')} ({results.posts.length})
          </div>
           {results.posts.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm italic">{t('general.noResults')}</div>
          ) : (
            <div className="divide-y divide-gray-700">
              {results.posts.map(post => (
                <div key={post.id} className="p-4 flex gap-4 hover:bg-gray-750 transition-colors">
                   <div className="flex-1">
                      <Link to={`/thread/${post.threadId}`} className="block text-sm text-gray-300 hover:text-white mb-1 line-clamp-2">
                         "{post.content.replace(/\[.*?\]/g, '')}"
                      </Link>
                      <div className="text-xs text-gray-500">
                         {t('forum.by')} <Link to={`/user/${post.authorId}`} className="hover:text-white transition-colors">{users[post.authorId]?.username}</Link> &bull; #{post.number}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
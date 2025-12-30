import React from 'react';
import { Category } from '../../types';
import { useForum } from '../../context/ForumContext';
import ForumRow from './ForumRow';

interface Props {
  category: Category;
}

const CategoryBlock: React.FC<Props> = ({ category }) => {
  const { getForumsByCategory } = useForum();
  const forums = getForumsByCategory(category.id);

  if (forums.length === 0) return null;

  return (
    <div className="mb-8 animate-fade-in">
      <div className="glass-panel rounded overflow-hidden bg-[#0d0d0d]">
        {/* Header - Solid Dark */}
        <div className="px-6 py-3 border-b border-[#333] bg-[#1a1a1a]">
          <div className="relative flex items-center justify-between">
            <h2 className="text-base font-bold font-display text-white uppercase tracking-widest flex items-center gap-3">
              <span className="w-1 h-4 bg-white rounded-sm inline-block"></span>
              {category.title}
            </h2>
          </div>
        </div>
        
        {/* Forums List */}
        <div className="bg-[#0d0d0d]">
          {forums.map(forum => (
            <ForumRow key={forum.id} forum={forum} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryBlock;
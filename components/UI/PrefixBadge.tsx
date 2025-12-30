import React from 'react';
import { useForum } from '../../context/ForumContext';

interface Props {
  prefixId?: string;
}

const PrefixBadge: React.FC<Props> = ({ prefixId }) => {
  const { prefixes } = useForum();
  
  if (!prefixId) return null;

  const prefix = prefixes.find(p => p.id === prefixId);
  if (!prefix) return null;

  // Check if it's a HEX color (starts with #)
  if (prefix.color.startsWith('#')) {
    return (
      <span 
        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mr-2 border border-white/20 shadow-sm"
        style={{ 
          backgroundColor: prefix.color, 
          color: '#fff', // Assume white text for now, or calculate contrast
          textShadow: '0 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        {prefix.text}
      </span>
    );
  }

  // Fallback to legacy predefined classes
  let colorClass = 'bg-[#333] text-gray-300 border border-[#444]';
  switch (prefix.color) {
    case 'green': colorClass = 'bg-[#064e3b] text-green-200 border border-green-900'; break;
    case 'red': colorClass = 'bg-[#7f1d1d] text-red-200 border border-red-900'; break;
    case 'orange': colorClass = 'bg-[#7c2d12] text-orange-200 border border-orange-900'; break;
    case 'blue': colorClass = 'bg-[#1e3a8a] text-blue-200 border border-blue-900'; break;
    case 'yellow': colorClass = 'bg-[#713f12] text-yellow-200 border border-yellow-900'; break;
    case 'cyan': colorClass = 'bg-[#222] text-white border border-gray-500'; break;
    case 'purple': colorClass = 'bg-[#581c87] text-purple-200 border border-purple-900'; break;
    case 'gray': default: colorClass = 'bg-[#262626] text-gray-400 border border-[#404040]'; break;
  }

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide mr-2 ${colorClass}`}>
      {prefix.text}
    </span>
  );
};

export default PrefixBadge;
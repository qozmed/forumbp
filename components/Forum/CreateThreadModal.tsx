import React, { useState } from 'react';
import { useForum } from '../../context/ForumContext';
import { useLanguage } from '../../context/LanguageContext';
import { X, PenTool } from 'lucide-react';
import BBCodeEditor from '../UI/BBCodeEditor';

interface Props {
  forumId: string;
  isOpen: boolean;
  onClose: () => void;
}

const CreateThreadModal: React.FC<Props> = ({ forumId, isOpen, onClose }) => {
  const { createThread, prefixes } = useForum();
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [prefixId, setPrefixId] = useState<string>('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    createThread(forumId, title, content, prefixId || undefined);
    setTitle('');
    setContent('');
    setPrefixId('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-[#333] w-full max-w-2xl rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-4 bg-[#0a0a0a] border-b border-[#333] flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <PenTool className="w-5 h-5 text-white" /> {t('thread.modalTitle')}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1 space-y-1">
              <label className="text-sm font-medium text-gray-400">{t('thread.prefix')}</label>
              <select 
                value={prefixId}
                onChange={(e) => setPrefixId(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-white focus:border-white focus:outline-none"
              >
                <option value="">{t('thread.prefix')}</option>
                {prefixes.map(p => (
                  <option key={p.id} value={p.id}>{p.text}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="text-sm font-medium text-gray-400">{t('thread.formTitle')}</label>
              <input 
                type="text" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#333] rounded p-2.5 text-white focus:border-white focus:outline-none"
                placeholder=""
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-400">{t('thread.formContent')}</label>
            <BBCodeEditor 
              value={content}
              onChange={setContent}
              className="min-h-[200px]"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button 
              type="submit" 
              className="px-6 py-2 bg-white text-black font-bold rounded shadow hover:bg-gray-200 transition-all"
            >
              {t('thread.submit')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateThreadModal;
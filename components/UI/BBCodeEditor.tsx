import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Code, Link, Image, Quote, Type, Palette, Undo, Redo } from 'lucide-react';
import { bbcodeToEditorHtml, htmlToBBCode } from '../../utils/bbCodeParser';
import { useLanguage } from '../../context/LanguageContext';

interface Props {
  value: string; // The BBCode value from parent
  onChange: (val: string) => void;
  className?: string;
  placeholder?: string;
}

const BBCodeEditor: React.FC<Props> = ({ value, onChange, className, placeholder }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const isInitialMount = useRef(true);
  const { t } = useLanguage();

  useEffect(() => {
    if (isInitialMount.current) {
      const initialHtml = bbcodeToEditorHtml(value);
      if (editorRef.current) {
        editorRef.current.innerHTML = initialHtml;
      }
      isInitialMount.current = false;
    } else if (value === '') {
      if (editorRef.current && editorRef.current.innerText.trim() !== '') {
         editorRef.current.innerHTML = '';
      }
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const bbcode = htmlToBBCode(html);
      onChange(bbcode);
    }
  };

  const execCmd = (command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
    handleInput();
  };

  const handleLink = () => {
    const url = prompt(t('editor.enterUrl'));
    if (url) execCmd('createLink', url);
  };

  const handleImage = () => {
    const url = prompt(t('editor.enterImgUrl'));
    if (url) execCmd('insertImage', url);
  };

  const triggerColorPicker = () => {
    colorInputRef.current?.click();
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    execCmd('foreColor', e.target.value);
  };

  const tools = [
    { icon: <Bold className="w-4 h-4" />, action: () => execCmd('bold'), title: t('editor.bold') },
    { icon: <Italic className="w-4 h-4" />, action: () => execCmd('italic'), title: t('editor.italic') },
    { icon: <Underline className="w-4 h-4" />, action: () => execCmd('underline'), title: t('editor.underline') },
    { icon: <Type className="w-4 h-4" />, action: () => execCmd('strikeThrough'), title: t('editor.strike') },
    { type: 'divider' },
    { icon: <Palette className="w-4 h-4 text-white" />, action: triggerColorPicker, title: t('editor.color') },
    { type: 'divider' },
    { icon: <Link className="w-4 h-4" />, action: handleLink, title: t('editor.link') },
    { icon: <Image className="w-4 h-4" />, action: handleImage, title: t('editor.image') },
    { icon: <Quote className="w-4 h-4" />, action: () => execCmd('formatBlock', 'blockquote'), title: t('editor.quote') },
    { icon: <Code className="w-4 h-4" />, action: () => execCmd('formatBlock', 'pre'), title: t('editor.code') },
    { type: 'divider' },
    { icon: <Undo className="w-4 h-4" />, action: () => execCmd('undo'), title: t('editor.undo') },
    { icon: <Redo className="w-4 h-4" />, action: () => execCmd('redo'), title: t('editor.redo') },
  ];

  return (
    <div className="border border-[#333] rounded bg-[#0a0a0a] overflow-hidden flex flex-col">
      {/* Hidden Color Input */}
      <input 
        type="color" 
        ref={colorInputRef} 
        onChange={handleColorChange} 
        className="hidden" 
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#111] border-b border-[#333] sticky top-0 z-10">
        {tools.map((t, i) => (
          t.type === 'divider' ? (
            <div key={i} className="w-px h-5 bg-[#333] mx-1"></div>
          ) : (
            <button
              key={i}
              type="button"
              // @ts-ignore
              onClick={(e) => { e.preventDefault(); t.action(); }}
              // @ts-ignore
              title={t.title}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#222] rounded transition-colors"
            >
              {/* @ts-ignore */}
              {t.icon}
            </button>
          )
        ))}
      </div>
      
      {/* Content Editable Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className={`w-full bg-[#0a0a0a] p-4 text-gray-200 focus:outline-none min-h-[150px] max-h-[500px] overflow-y-auto prose prose-invert prose-p:my-1 prose-pre:bg-black prose-pre:border prose-pre:border-[#333] ${className}`}
        style={{ whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder}
      />
      <div className="px-3 py-1 bg-[#111] border-t border-[#333] text-[10px] text-gray-600 flex justify-between">
         <span>{t('editor.mode')}</span>
         <span>{t('editor.supported')}</span>
      </div>
    </div>
  );
};

export default BBCodeEditor;
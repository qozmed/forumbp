import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Code, Link, Image, Quote, Type, Palette, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify } from 'lucide-react';
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
  
  // FIX: Initialize with null so the first useEffect ALWAYS runs to populate the editor.
  // Using 'value' here previously caused the effect to skip the initial render.
  const lastEmittedValue = useRef<string | null>(null);
  
  const { t } = useLanguage();

  // Initialize content ONLY on mount or when value changes EXTERNALLY (not from typing)
  useEffect(() => {
    // If the new value is exactly what we just emitted, DO NOT touch the DOM.
    // We check !== null to ensure we DO run this on the very first mount.
    if (lastEmittedValue.current !== null && value === lastEmittedValue.current) {
      return;
    }

    // Special case: If value is empty (reset form), clear the editor
    if (!value) {
      if (editorRef.current && editorRef.current.innerHTML !== '') {
         editorRef.current.innerHTML = '';
      }
      lastEmittedValue.current = '';
      return;
    }

    // Otherwise, this is an external update (e.g. loading a post to edit)
    const initialHtml = bbcodeToEditorHtml(value);
    if (editorRef.current) {
      // Check if semantic content is actually different to avoid unnecessary resets/cursor jumps
      if (editorRef.current.innerHTML !== initialHtml) {
         editorRef.current.innerHTML = initialHtml;
      }
    }
    lastEmittedValue.current = value;
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      const bbcode = htmlToBBCode(html);
      
      // Update ref BEFORE calling onChange to prevent the useEffect loop
      lastEmittedValue.current = bbcode;
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
    { icon: <AlignLeft className="w-4 h-4" />, action: () => execCmd('justifyLeft'), title: t('editor.alignLeft') },
    { icon: <AlignCenter className="w-4 h-4" />, action: () => execCmd('justifyCenter'), title: t('editor.alignCenter') },
    { icon: <AlignRight className="w-4 h-4" />, action: () => execCmd('justifyRight'), title: t('editor.alignRight') },
    { icon: <AlignJustify className="w-4 h-4" />, action: () => execCmd('justifyFull'), title: t('editor.alignJustify') },
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
        className={`w-full bg-[#0a0a0a] p-4 text-gray-200 focus:outline-none min-h-[300px] max-h-[600px] overflow-y-auto prose prose-invert prose-p:my-1 prose-pre:bg-black prose-pre:border prose-pre:border-[#333] ${className}`}
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
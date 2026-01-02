import React, { useRef, useEffect } from 'react';
import { Bold, Italic, Underline, Code, Link, Image, Quote, Type, Palette, Undo, Redo, AlignLeft, AlignCenter, AlignRight, AlignJustify, List, ListOrdered, Minus, Heading } from 'lucide-react';
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
  const sizeInputRef = useRef<HTMLSelectElement>(null);
  
  const lastEmittedValue = useRef<string | null>(null);
  const isTyping = useRef(false);
  
  const { t } = useLanguage();

  // Initialize content
  useEffect(() => {
    if (!editorRef.current) return;

    // Only update content if it differs significantly (external change), 
    // NOT when we are just emitting what we typed.
    if (!isTyping.current && value !== lastEmittedValue.current) {
         // Convert BBCode to Editor HTML
         const htmlFromProps = bbcodeToEditorHtml(value || '');
         
         // Only replace innerHTML if it effectively changes the BBCode output 
         // (prevents cursor jumping on formatting updates)
         const currentBBCode = htmlToBBCode(editorRef.current.innerHTML);
         if (currentBBCode !== value) {
            editorRef.current.innerHTML = htmlFromProps;
         }
         lastEmittedValue.current = value;
    }
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const bbcode = htmlToBBCode(html);
    
    if (bbcode !== lastEmittedValue.current) {
        lastEmittedValue.current = bbcode;
        onChange(bbcode);
    }
  };

  const handleInput = () => {
    isTyping.current = true;
    emitChange();
    // Debounce typing status clear
    setTimeout(() => { isTyping.current = false; }, 500);
  };

  // --- ACTIONS ---

  const execCmd = (command: string, val: string | undefined = undefined) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, val);
    emitChange();
  };

  const handleLink = () => {
    const url = prompt(t('editor.enterUrl'));
    if (url) execCmd('createLink', url);
  };

  const handleImage = () => {
    const url = prompt(t('editor.enterImgUrl'));
    if (url) execCmd('insertImage', url);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    // Insert simple text to stripping rich formatting from external sites
    document.execCommand('insertText', false, text);
    emitChange();
  };

  const triggerColorPicker = () => colorInputRef.current?.click();
  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => execCmd('foreColor', e.target.value);
  
  const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      execCmd('fontSize', e.target.value);
      // Reset select
      e.target.value = ""; 
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
    { icon: <List className="w-4 h-4" />, action: () => execCmd('insertUnorderedList'), title: t('editor.listUnordered') },
    { icon: <ListOrdered className="w-4 h-4" />, action: () => execCmd('insertOrderedList'), title: t('editor.listOrdered') },
    { type: 'divider' },
    { icon: <Palette className="w-4 h-4 text-cyan-400" />, action: triggerColorPicker, title: t('editor.color') },
    // Font Size Component inserted manually in render
    { type: 'divider' },
    { icon: <Link className="w-4 h-4" />, action: handleLink, title: t('editor.link') },
    { icon: <Image className="w-4 h-4" />, action: handleImage, title: t('editor.image') },
    { icon: <Minus className="w-4 h-4" />, action: () => execCmd('insertHorizontalRule'), title: t('editor.hr') },
    { type: 'divider' },
    { icon: <Quote className="w-4 h-4" />, action: () => execCmd('formatBlock', 'blockquote'), title: t('editor.quote') },
    { icon: <Code className="w-4 h-4" />, action: () => execCmd('formatBlock', 'pre'), title: t('editor.code') },
    { type: 'divider' },
    { icon: <Undo className="w-4 h-4" />, action: () => execCmd('undo'), title: t('editor.undo') },
    { icon: <Redo className="w-4 h-4" />, action: () => execCmd('redo'), title: t('editor.redo') },
  ];

  return (
    <div className="border border-[#333] rounded-lg bg-[#0f0f0f] overflow-hidden flex flex-col shadow-sm transition-all focus-within:border-gray-500">
      <input type="color" ref={colorInputRef} onChange={handleColorChange} className="hidden" />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-[#151515] border-b border-[#333] sticky top-0 z-10 select-none">
        
        {/* Size Selector */}
        <div className="relative group mr-1">
            <select 
                ref={sizeInputRef}
                onChange={handleSizeChange} 
                className="appearance-none bg-[#222] text-gray-300 text-xs px-2 py-1.5 pr-6 rounded border border-[#333] hover:border-gray-500 focus:outline-none cursor-pointer"
                title={t('editor.size')}
            >
                <option value="" disabled selected>Size</option>
                <option value="1">XS</option>
                <option value="2">S</option>
                <option value="3">M (Normal)</option>
                <option value="4">L</option>
                <option value="5">XL</option>
                <option value="6">XXL</option>
                <option value="7">Huge</option>
            </select>
            <Heading className="w-3 h-3 absolute right-2 top-2 text-gray-500 pointer-events-none" />
        </div>

        {tools.map((t, i) => (
          t.type === 'divider' ? (
            <div key={i} className="w-px h-5 bg-[#333] mx-1"></div>
          ) : (
            <button
              key={i}
              type="button"
              // @ts-ignore
              onMouseDown={(e) => { e.preventDefault(); t.action(); }} // use onMouseDown to prevent focus loss
              // @ts-ignore
              title={t.title}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-[#252525] rounded transition-colors"
            >
              {/* @ts-ignore */}
              {t.icon}
            </button>
          )
        ))}
      </div>
      
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onPaste={handlePaste}
        className={`w-full bg-[#0a0a0a] p-4 text-gray-200 focus:outline-none min-h-[300px] max-h-[600px] overflow-y-auto prose prose-invert max-w-none 
            prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0
            ${className}`}
        style={{ whiteSpace: 'pre-wrap' }}
        data-placeholder={placeholder}
        spellCheck={false}
      />
      
      <div className="px-3 py-1.5 bg-[#151515] border-t border-[#333] text-[10px] text-gray-600 flex justify-between font-mono">
         <span>HTML Mode / Clean Paste Active</span>
         <span>{t('editor.supported')}</span>
      </div>
    </div>
  );
};

export default BBCodeEditor;

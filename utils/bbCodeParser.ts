/**
 * BBCode Parser - Fixed Newline & Spacing Logic
 */

// --- 1. Security & Helpers ---

export const escapeHtml = (text: string) => {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/javascript:/gi, "blocked:")
    .replace(/on\w+=/gi, "blocked="); 
};

const generateId = () => `__BB_TOKEN_${Math.random().toString(36).substr(2, 9)}__`;

const rgbToHex = (color: string): string | null => {
    if (!color) return null;
    if (color.startsWith('#')) return color;
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
    if (!match) return null;
    const hex = (x: string) => ("0" + parseInt(x).toString(16)).slice(-2);
    const result = "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    if (result === '#000000' || result === '#0d0d0d') return null; 
    return result;
};

// --- 2. Main Parser (BBCode -> HTML for Display) ---

export const parseBBCodeToHtml = (content: string) => {
  if (!content) return '';

  // Step 0: Normalize newlines
  // We remove a single newline immediately following a closing block tag,
  // because the HTML block element (div, blockquote) already provides the visual break.
  // If the user wanted an EMPTY line, they would have typed two newlines.
  let processed = content.replace(/(\[\/(center|left|right|justify|quote|code)\])\n/gi, '$1');

  const placeholders: Record<string, string> = {};
  
  // A. Extract Leaf Tags
  processed = processed.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_, codeContent) => {
    const id = generateId();
    placeholders[id] = `<pre class="bg-[#0a0a0a] p-4 rounded border border-[#333] overflow-x-auto my-3 text-sm font-mono text-gray-300 shadow-inner"><code>${escapeHtml(codeContent)}</code></pre>`;
    return id;
  });

  processed = processed.replace(/\[img\](.*?)\[\/img\]/gi, (_, url) => {
    const id = generateId();
    const safeUrl = escapeHtml(url.trim());
    placeholders[id] = `<img src="${safeUrl}" class="max-w-full rounded border border-[#333] my-3 shadow inline-block" alt="Image" loading="lazy" />`;
    return id;
  });

  processed = processed.replace(/\[youtube\](.*?)\[\/youtube\]/gi, (_, videoId) => {
    const id = generateId();
    const safeId = escapeHtml(videoId.trim());
    placeholders[id] = `<div class="relative w-full aspect-video rounded overflow-hidden shadow-2xl my-4 border border-[#333]"><iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${safeId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    return id;
  });

  // B. Standard Formatting
  processed = escapeHtml(processed); 

  const replacements: [RegExp, string][] = [
    [/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong class="text-white font-bold">$1</strong>'],
    [/\[i\]([\s\S]*?)\[\/i\]/gi, '<em class="italic">$1</em>'],
    [/\[u\]([\s\S]*?)\[\/u\]/gi, '<u class="underline">$1</u>'],
    [/\[s\]([\s\S]*?)\[\/s\]/gi, '<s class="line-through opacity-70">$1</s>'],
    [/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>'],
    [/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>'],
    [/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>'],
    [/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div class="text-justify">$1</div>'],
    [/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="border-l-2 border-gray-600 pl-4 py-2 my-4 text-gray-500 italic bg-[#111] p-2 rounded-r">$1</blockquote>'],
    [/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-900 hover:decoration-cyan-400 transition-all">$2</a>'],
    [/\[color=['"]?(.*?)['"]?\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>'] 
  ];

  replacements.forEach(([regex, replacement]) => {
    let old = processed;
    processed = processed.replace(regex, replacement);
    if (old !== processed) processed = processed.replace(regex, replacement);
  });

  // Convert newlines to breaks
  processed = processed.replace(/\n/g, '<br />');

  // C. Restore Placeholders
  Object.keys(placeholders).forEach(key => {
    processed = processed.replace(key, placeholders[key]);
  });

  return processed;
};

// --- 3. Editor Helpers (HTML -> BBCode & BBCode -> HTML for Editor) ---

export const bbcodeToEditorHtml = (content: string) => {
  if (!content) return '';
  
  // Ensure we strip the newline after block tags here too, so the editor doesn't show double gaps on load
  let processed = content.replace(/(\[\/(center|left|right|justify|quote|code)\])\n/gi, '$1');

  return processed
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, '<br>')
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<b>$1</b>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<i>$1</i>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align: center;">$1</div>')
    .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div style="text-align: left;">$1</div>')
    .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div style="text-align: right;">$1</div>')
    .replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div style="text-align: justify;">$1</div>')
    .replace(/\[color=['"]?(.*?)['"]?\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" style="max-width: 100%; border-radius: 4px;" />')
    .replace(/\[url=['"]?(.*?)['"]?\]([\s\S]*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre>$1</pre>');
};

export const htmlToBBCode = (html: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const traverse = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const style = el.style;
    const tagName = el.tagName.toUpperCase();
    
    let content = '';
    el.childNodes.forEach(child => { content += traverse(child); });

    // --- Strict Tag Handling ---
    
    // Formatting
    if (tagName === 'B' || tagName === 'STRONG' || style.fontWeight === 'bold' || parseInt(style.fontWeight || '0') >= 700) {
        if (!content.startsWith('[b]')) content = `[b]${content}[/b]`;
    }
    if (tagName === 'I' || tagName === 'EM' || style.fontStyle === 'italic') {
         if (!content.startsWith('[i]')) content = `[i]${content}[/i]`;
    }
    if (tagName === 'U' || style.textDecoration.includes('underline')) {
         if (!content.startsWith('[u]')) content = `[u]${content}[/u]`;
    }
    if (tagName === 'S' || tagName === 'STRIKE' || tagName === 'DEL' || style.textDecoration.includes('line-through')) {
         if (!content.startsWith('[s]')) content = `[s]${content}[/s]`;
    }
    const color = rgbToHex(style.color) || el.getAttribute('color');
    if (color && !['#000000', '#0d0d0d', '#0a0a0a'].includes(color)) {
         content = `[color=${color}]${content}[/color]`;
    }

    // Structural Elements
    if (tagName === 'DIV' || tagName === 'P') {
        let align = style.textAlign || el.getAttribute('align');
        if (el.className.includes('text-center')) align = 'center';
        if (el.className.includes('text-right')) align = 'right';

        if (align === 'center') content = `[center]${content}[/center]`;
        else if (align === 'right') content = `[right]${content}[/right]`;
        else if (align === 'justify') content = `[justify]${content}[/justify]`;
        else if (align === 'left') content = `[left]${content}[/left]`;
        
        // Critical Fix: Only add newline for generic block elements that didn't become BBCode tags.
        // If it became [center], the tag itself acts as a block.
        // We add a newline to separate it from the *next* element in raw BBCode, 
        // but the cleanup step below handles duplicates.
        return content + '\n';
    }

    if (tagName === 'BR') return '\n';
    if (tagName === 'IMG') return `[img]${el.getAttribute('src') || ''}[/img]`;
    if (tagName === 'A') return `[url=${el.getAttribute('href') || '#'}]${content}[/url]`;
    if (tagName === 'BLOCKQUOTE') return `[quote]${content.trim()}[/quote]\n`;
    if (tagName === 'PRE' || tagName === 'CODE') return `[code]${content.trim()}[/code]\n`;
    
    return content;
  };
  
  let bbcode = traverse(temp);
  
  // --- CLEANUP (The "Ironclad" logic) ---
  
  // 1. Remove newlines immediately following closing block tags.
  //    [center]Text[/center]\n -> [center]Text[/center]
  //    This prevents the loop: Tag -> Div+\n -> Tag+\n -> Div+\n+\n
  bbcode = bbcode.replace(/(\[\/(center|left|right|justify|quote|code)\])\s*\n/gi, '$1');

  // 2. Collapse 3+ newlines into 2 (Max 1 empty line visually)
  bbcode = bbcode.replace(/\n{3,}/g, '\n\n');
  
  // 3. Trim outer whitespace
  return bbcode.trim();
};

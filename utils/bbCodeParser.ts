/**
 * BBCode Parser - Robust "Ironclad" Version
 * Handles bi-directional conversion with strict HTML normalization.
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

// Generates a random placeholder ID to protect content like [code] blocks
const generateId = () => `__BB_TOKEN_${Math.random().toString(36).substr(2, 9)}__`;

// Robust RGB to Hex converter for consistent color handling
const rgbToHex = (color: string): string | null => {
    if (!color) return null;
    if (color.startsWith('#')) return color;
    
    const match = color.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/);
    if (!match) return null;
    
    const hex = (x: string) => ("0" + parseInt(x).toString(16)).slice(-2);
    const result = "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    
    // Ignore black/inherit as they are defaults
    if (result === '#000000' || result === '#0d0d0d') return null; 
    return result;
};

// --- 2. Main Parser (BBCode -> HTML for Display) ---

export const parseBBCodeToHtml = (content: string) => {
  if (!content) return '';

  const placeholders: Record<string, string> = {};
  
  // A. Extract Leaf Tags (Content that should NOT be parsed recursively)
  
  // 1. Code Blocks
  let processed = content.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_, codeContent) => {
    const id = generateId();
    placeholders[id] = `<pre class="bg-[#0a0a0a] p-4 rounded border border-[#333] overflow-x-auto my-3 text-sm font-mono text-gray-300 shadow-inner"><code>${escapeHtml(codeContent)}</code></pre>`;
    return id;
  });

  // 2. Images
  processed = processed.replace(/\[img\](.*?)\[\/img\]/gi, (_, url) => {
    const id = generateId();
    const safeUrl = escapeHtml(url.trim());
    placeholders[id] = `<img src="${safeUrl}" class="max-w-full rounded border border-[#333] my-3 shadow inline-block" alt="Image" loading="lazy" />`;
    return id;
  });

  // 3. YouTube
  processed = processed.replace(/\[youtube\](.*?)\[\/youtube\]/gi, (_, videoId) => {
    const id = generateId();
    const safeId = escapeHtml(videoId.trim());
    placeholders[id] = `<div class="relative w-full aspect-video rounded overflow-hidden shadow-2xl my-4 border border-[#333]"><iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/${safeId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
    return id;
  });

  // B. Standard Formatting (Using Regex for simplicity in display mode)
  // We escape HTML first to prevent XSS, then apply formatting.
  
  processed = escapeHtml(processed); 

  // Regex Replacements
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
    // Handle Color with strict quoting optional
    [/\[color=['"]?(.*?)['"]?\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>'] 
  ];

  // Apply replacements iteratively to handle simple nesting
  replacements.forEach(([regex, replacement]) => {
    let old = processed;
    processed = processed.replace(regex, replacement);
    // Simple 1-level nested retry
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

/**
 * Converts BBCode to HTML specifically for the WYSIWYG editor.
 * Uses inline styles preferred by contentEditable.
 */
export const bbcodeToEditorHtml = (content: string) => {
  if (!content) return '';
  
  return content
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

/**
 * The "Ironclad" HTML to BBCode Converter.
 * Traverses DOM tree and checks Tags AND Styles to handle cross-browser contentEditable differences.
 */
export const htmlToBBCode = (html: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const traverse = (node: Node): string => {
    // 1. Text Nodes
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    // 2. Element Nodes
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    const style = el.style;
    const tagName = el.tagName.toUpperCase();
    
    // Process children first
    let content = '';
    el.childNodes.forEach(child => { content += traverse(child); });

    // --- LOGIC: Wrap content based on Tags OR Styles ---
    
    // BOLD
    if (tagName === 'B' || tagName === 'STRONG' || style.fontWeight === 'bold' || parseInt(style.fontWeight || '0') >= 700) {
        if (!content.startsWith('[b]')) content = `[b]${content}[/b]`;
    }

    // ITALIC
    if (tagName === 'I' || tagName === 'EM' || style.fontStyle === 'italic') {
         if (!content.startsWith('[i]')) content = `[i]${content}[/i]`;
    }

    // UNDERLINE
    if (tagName === 'U' || style.textDecoration.includes('underline')) {
         if (!content.startsWith('[u]')) content = `[u]${content}[/u]`;
    }

    // STRIKE
    if (tagName === 'S' || tagName === 'STRIKE' || tagName === 'DEL' || style.textDecoration.includes('line-through')) {
         if (!content.startsWith('[s]')) content = `[s]${content}[/s]`;
    }

    // COLOR
    const color = rgbToHex(style.color) || el.getAttribute('color');
    if (color && !['#000000', '#0d0d0d', '#0a0a0a'].includes(color)) {
         content = `[color=${color}]${content}[/color]`;
    }

    // ALIGNMENT (Divs/Paragraphs)
    if (tagName === 'DIV' || tagName === 'P') {
        let align = style.textAlign || el.getAttribute('align');
        
        // Handle CSS classes if present (e.g., text-center)
        if (el.className.includes('text-center')) align = 'center';
        if (el.className.includes('text-right')) align = 'right';

        if (align === 'center') content = `[center]${content}[/center]`;
        else if (align === 'right') content = `[right]${content}[/right]`;
        else if (align === 'justify') content = `[justify]${content}[/justify]`;
        else if (align === 'left') content = `[left]${content}[/left]`;
        
        // Block elements imply a newline.
        return content + '\n';
    }

    // SPECIFIC TAGS
    if (tagName === 'BR') return '\n';
    if (tagName === 'IMG') return `[img]${el.getAttribute('src') || ''}[/img]`;
    if (tagName === 'A') return `[url=${el.getAttribute('href') || '#'}]${content}[/url]`;
    if (tagName === 'BLOCKQUOTE') return `[quote]${content.trim()}[/quote]\n`;
    if (tagName === 'PRE' || tagName === 'CODE') return `[code]${content.trim()}[/code]\n`;
    
    return content;
  };
  
  let bbcode = traverse(temp);
  
  // Final Cleanup:
  // 1. Collapse multiple newlines into max 2
  bbcode = bbcode.replace(/\n\s*\n\s*\n/g, '\n\n');
  // 2. Trim whitespace
  return bbcode.trim();
};

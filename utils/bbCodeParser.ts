/**
 * BBCode Parser
 * 
 * Strategy:
 * 1. "Leaf" tags (Code, Img, YouTube) are extracted first and replaced with placeholders.
 *    This prevents their content from being parsed as BBCode or HTML.
 * 2. "Stack" parsing is used for formatting tags (B, I, Color, etc.).
 *    This ensures HTML validity (e.g. correctly handling [b][i]...[/b][/i] by auto-closing).
 * 3. Placeholders are restored.
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

// Generates a random placeholder ID
const generateId = () => `__BB_TOKEN_${Math.random().toString(36).substr(2, 9)}__`;

// Helper to sanitize color input
const sanitizeColor = (color: string) => {
    // Remove quotes if present
    const cleaned = color.replace(/['"]/g, '').trim();
    // Allow hex, rgb, rgba, and standard color names
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(cleaned)) return cleaned;
    if (/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/.test(cleaned)) return cleaned;
    if (/^[a-zA-Z]+$/.test(cleaned)) return cleaned;
    return null; 
};

// Tags that render as block elements in HTML. 
// A newline immediately following these closing tags should often be consumed to prevent double spacing.
const BLOCK_TAGS = ['center', 'left', 'right', 'justify', 'quote', 'code', 'youtube'];

// --- 2. Main Parser ---

export const parseBBCodeToHtml = (content: string) => {
  if (!content) return '';

  const placeholders: Record<string, string> = {};
  
  // --- A. Extract Leaf Tags (Content that should NOT be parsed) ---
  
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

  // --- B. Stack Parser for Nestable Tags ---
  
  // Definitions of supported tags
  const tags: Record<string, { open: (attr: string) => string, close: string | ((attr: string) => string) }> = {
    b: { open: () => '<strong class="text-white font-bold">', close: '</strong>' },
    i: { open: () => '<em class="italic">', close: '</em>' },
    u: { open: () => '<u class="underline">', close: '</u>' },
    s: { open: () => '<s class="line-through opacity-70">', close: '</s>' },
    center: { open: () => '<div class="text-center">', close: '</div>' },
    left: { open: () => '<div class="text-left">', close: '</div>' },
    right: { open: () => '<div class="text-right">', close: '</div>' },
    justify: { open: () => '<div class="text-justify">', close: '</div>' },
    quote: { 
        open: (attr) => attr 
            ? `<div class="my-4 border-l-2 border-white bg-[#1a1a1a] p-4 rounded-r"><div class="text-xs text-white font-bold mb-2 uppercase tracking-wider opacity-70">${escapeHtml(attr)} wrote:</div><div class="text-gray-400 italic pl-1">`
            : `<blockquote class="border-l-2 border-gray-600 pl-4 py-2 my-4 text-gray-500 italic bg-[#111] p-2 rounded-r">`,
        close: (attr: string) => attr ? `</div></div>` : `</blockquote>`
    },
    url: {
        open: (attr) => `<a href="${escapeHtml(attr || '#')}" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-900 hover:decoration-cyan-400 transition-all">`,
        close: '</a>'
    },
    color: {
        open: (attr) => {
            const validColor = sanitizeColor(attr);
            return validColor ? `<span style="color:${validColor}">` : '<span>';
        },
        close: '</span>'
    }
  };

  // Tokenize the string: Find [tag]...[/tag] or [tag=val]
  // Regex looks for [ /? tagName (=val)? ]
  const tokens = processed.split(/(\[\/?[a-zA-Z0-9]+(?:=(?:.|[\r\n])*?)?\])/g);
  
  const stack: { tag: string, attr: string }[] = []; 
  let output: string[] = [];
  let lastWasBlockClose = false;

  tokens.forEach(token => {
    // Check if it looks like a tag
    const match = token.match(/^\[(\/?)([a-zA-Z0-9]+)(?:=(.*))?\]$/);
    
    if (match) {
      const isClose = match[1] === '/';
      const tagName = match[2].toLowerCase();
      const attr = match[3] ? match[3].replace(/^['"]|['"]$/g, '') : ''; // Remove surrounding quotes

      if (tags[tagName]) {
        lastWasBlockClose = false; // Reset by default
        
        if (!isClose) {
          // OPEN TAG
          output.push(tags[tagName].open(attr));
          stack.push({ tag: tagName, attr });
        } else {
          // CLOSE TAG
          const stackTags = stack.map(s => s.tag);
          const index = stackTags.lastIndexOf(tagName);

          if (index !== -1) {
            // Unwind stack
            while (stack.length > index) {
                const popped = stack.pop();
                if (popped) {
                    const closeDef = tags[popped.tag].close;
                    output.push(typeof closeDef === 'function' ? closeDef(popped.attr) : closeDef);
                    
                    // If we just closed a block tag, set flag to consume next newline
                    if (BLOCK_TAGS.includes(popped.tag)) {
                        lastWasBlockClose = true;
                    }
                }
            }
          } else {
             output.push(escapeHtml(token));
          }
        }
      } else {
        // Unknown tag
        output.push(escapeHtml(token));
        lastWasBlockClose = false;
      }
    } else {
      // It's text content
      let text = token;
      
      // If previous token was a closing block tag, consume ONE leading newline
      if (lastWasBlockClose && text.startsWith('\n')) {
          text = text.substring(1);
      }
      
      if (text.length > 0) {
        // Handle newlines -> <br>
        const safeText = escapeHtml(text).replace(/\n/g, '<br />');
        output.push(safeText);
      }
      
      lastWasBlockClose = false;
    }
  });

  // Close any remaining tags in stack
  while (stack.length > 0) {
    const popped = stack.pop();
    if (popped && tags[popped.tag]) {
       const closeDef = tags[popped.tag].close;
       output.push(typeof closeDef === 'function' ? closeDef(popped.attr) : closeDef);
    }
  }

  let finalHtml = output.join('');

  // --- C. Restore Placeholders ---
  Object.keys(placeholders).forEach(key => {
    finalHtml = finalHtml.replace(key, placeholders[key]);
  });

  return finalHtml;
};

// --- 3. Editor Helpers (Simpler Regex Approach for WYSIWYG sync) ---

export const bbcodeToEditorHtml = (content: string) => {
  if (!content) return '';
  return content
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
    // 1. Handle Text Nodes
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    
    // 2. Ignore non-elements (comments, etc)
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const el = node as HTMLElement;
    let content = '';
    
    // Process children first
    el.childNodes.forEach(child => { content += traverse(child); });
    
    const tagName = el.tagName.toLowerCase();
    const computedStyle = el.style;
    
    // Helper to get hex from rgb
    const rgb2hex = (rgb: string) => {
        if (!rgb || rgb.search("rgb") === -1) return rgb;
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
        if (!match) return rgb;
        const hex = (x: string) => ("0" + parseInt(x).toString(16)).slice(-2);
        return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    };

    switch (tagName) {
      // Formatting
      case 'b': case 'strong': 
        if (computedStyle.fontWeight === 'normal') return content;
        return `[b]${content}[/b]`;
      case 'i': case 'em': return `[i]${content}[/i]`;
      case 'u': return `[u]${content}[/u]`;
      case 's': case 'strike': case 'del': return `[s]${content}[/s]`;
      
      // Structure
      case 'br': return '\n';
      case 'div': case 'p': 
        // ALIGNMENT HANDLING (Style based)
        let align = el.getAttribute('align') || computedStyle.textAlign;
        
        // Enhance detection with classes (e.g. text-center) and logical properties
        if (!align && el.className) {
           if (el.className.includes('text-center')) align = 'center';
           else if (el.className.includes('text-right')) align = 'right';
           else if (el.className.includes('text-justify')) align = 'justify';
           else if (el.className.includes('text-left')) align = 'left';
        }

        if (align === 'start') align = 'left';
        if (align === 'end') align = 'right';
        
        let wrappedContent = content;
        if (align === 'center') wrappedContent = `[center]${content}[/center]`;
        else if (align === 'right') wrappedContent = `[right]${content}[/right]`;
        else if (align === 'justify') wrappedContent = `[justify]${content}[/justify]`;
        else if (align === 'left') wrappedContent = `[left]${content}[/left]`;
        
        // Block elements typically end with a newline in BBCode to separate from next block.
        // Prevent stacking newlines: if content already ends with \n (e.g. from nested div or br), don't add another.
        return wrappedContent.endsWith('\n') ? wrappedContent : `${wrappedContent}\n`;

      // Media
      case 'img': return `[img]${el.getAttribute('src') || ''}[/img]`;
      case 'a': return `[url=${el.getAttribute('href')}]${content}[/url]`;
      case 'blockquote': return `[quote]${content}[/quote]`;
      case 'pre': return `[code]${content}[/code]`;
      
      // Styles
      case 'span': case 'font': 
        const rawColor = computedStyle.color || el.getAttribute('color');
        if (rawColor) { 
            const hex = rgb2hex(rawColor);
            // Avoid black (default) if not explicitly set to something else
            if (hex && hex !== '#000000' && hex !== 'rgb(0, 0, 0)') {
               return `[color=${hex}]${content}[/color]`; 
            }
        } 
        return content;
        
      default: return content;
    }
  };
  
  let bbcode = traverse(temp);
  
  // Cleanup excessive newlines (max 2) and trim ends
  return bbcode.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
};

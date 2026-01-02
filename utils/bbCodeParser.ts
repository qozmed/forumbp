/**
 * Ultimate BBCode Parser & Converter
 * Handles Lists, Fonts, Sizes, and robust nested HTML/BBCode conversion.
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

// --- 2. Main Parser (BBCode -> HTML for Display) ---

export const parseBBCodeToHtml = (content: string) => {
  if (!content) return '';

  let processed = content;

  // Preserve Placeholders for "Raw" content (Code, NoParse)
  const placeholders: Record<string, string> = {};
  
  processed = processed.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, (_, codeContent) => {
    const id = generateId();
    placeholders[id] = `<pre class="bg-[#0f0f0f] p-4 rounded border border-[#333] overflow-x-auto my-4 text-sm font-mono text-gray-300 shadow-inner whitespace-pre"><code>${escapeHtml(codeContent)}</code></pre>`;
    return id;
  });

  // Basic cleaning of newlines to prevent massive gaps around block elements
  processed = processed.replace(/(\[\/(center|left|right|justify|quote|list)\])\s*\n/gi, '$1');

  processed = escapeHtml(processed); 

  // --- REPLACEMENT RULES ---

  // 1. Structural Containers
  processed = processed
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>')
    .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>')
    .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>')
    .replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div class="text-justify">$1</div>')
    .replace(/\[hr\]/gi, '<hr class="my-4 border-[#333]" />');

  // 2. Lists (Complex Handling)
  // We first convert item tags [*] to <li>. 
  // Note: This regex assumes well-formed lists.
  processed = processed.replace(/\[\*\](.*?)(\n|\[\/?(?:list|\*)\])/gi, '<li>$1</li>$2');
  
  // Wrap in UL/OL
  processed = processed
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul class="list-disc pl-5 my-2 space-y-1 text-gray-300">$1</ul>')
    .replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, '<ol class="list-decimal pl-5 my-2 space-y-1 text-gray-300">$1</ol>');

  // 3. Typography & Styling
  processed = processed
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong class="text-white font-bold">$1</strong>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em class="italic text-gray-200">$1</em>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u class="underline decoration-gray-500 underline-offset-2">$1</u>')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s class="line-through opacity-60">$1</s>')
    .replace(/\[size=([1-7])\]([\s\S]*?)\[\/size\]/gi, (_, size, text) => {
        // Map 1-7 to Tailwind/CSS classes roughly
        const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl'];
        const cls = sizes[parseInt(size) - 1] || 'text-base';
        return `<span class="${cls}">${text}</span>`;
    })
    .replace(/\[color=['"]?(.*?)['"]?\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
    .replace(/\[font=['"]?(.*?)['"]?\]([\s\S]*?)\[\/font\]/gi, '<span style="font-family:$1">$2</span>');

  // 4. Media & Links
  processed = processed
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" class="max-w-full rounded border border-[#333] my-2 shadow inline-block hover:opacity-95 transition-opacity" alt="User Image" loading="lazy" />')
    .replace(/\[url=(.*?)\](.*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-900/50 hover:decoration-cyan-400 transition-all">$2</a>')
    .replace(/\[youtube\](.*?)\[\/youtube\]/gi, '<div class="relative w-full aspect-video rounded overflow-hidden shadow-2xl my-4 border border-[#333] bg-black"><iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>');

  // 5. Blockquotes
  processed = processed.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, 
    '<blockquote class="border-l-4 border-cyan-900/50 bg-[#151515] p-4 my-4 rounded-r text-gray-400 italic shadow-sm relative"><div class="absolute -top-2 -left-2 text-4xl text-cyan-900 opacity-50">"</div>$1</blockquote>'
  );

  // Restore Code Blocks (to avoid parsing BBCode inside them)
  Object.keys(placeholders).forEach(key => {
    processed = processed.replace(key, placeholders[key]);
  });

  // Convert remaining newlines to breaks
  processed = processed.replace(/\n/g, '<br />');

  return processed;
};

// --- 3. Editor Converters (HTML <-> BBCode) ---

// BBCode -> HTML (For Editor Preview)
// Needs to produce valid HTML that document.execCommand matches
export const bbcodeToEditorHtml = (content: string) => {
  if (!content) return '';
  
  let processed = content
    // Normalize breaks
    .replace(/(\[\/(center|left|right|justify|quote|list)\])\n/gi, '$1')
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, '<br>');

  // Tags matching execCommand output
  processed = processed
    .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<b>$1</b>')
    .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<i>$1</i>')
    .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u>$1</u>')
    .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s>$1</s>')
    .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div style="text-align: center;">$1</div>')
    .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div style="text-align: left;">$1</div>')
    .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div style="text-align: right;">$1</div>')
    .replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div style="text-align: justify;">$1</div>')
    .replace(/\[hr\]/gi, '<hr>')
    .replace(/\[size=([1-7])\]([\s\S]*?)\[\/size\]/gi, '<font size="$1">$2</font>')
    .replace(/\[color=['"]?(.*?)['"]?\]([\s\S]*?)\[\/color\]/gi, '<span style="color:$1">$2</span>')
    .replace(/\[font=['"]?(.*?)['"]?\]([\s\S]*?)\[\/font\]/gi, '<span style="font-family:$1">$2</span>')
    
    // Lists
    .replace(/\[list\]([\s\S]*?)\[\/list\]/gi, '<ul>$1</ul>')
    .replace(/\[list=1\]([\s\S]*?)\[\/list\]/gi, '<ol>$1</ol>')
    .replace(/\[\*\](.*?)(\[|$|<br>)/gi, '<li>$1</li>') // Crude list item approximation for editor load
    
    // Others
    .replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" />')
    .replace(/\[url=['"]?(.*?)['"]?\]([\s\S]*?)\[\/url\]/gi, '<a href="$1">$2</a>')
    .replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote>$1</blockquote>')
    .replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre>$1</pre>');

  return processed;
};

// HTML -> BBCode (For Saving)
// Recursively traverses the DOM to build strict BBCode
export const htmlToBBCode = (html: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const rgbToHex = (color: string) => {
    if (!color || color.startsWith('#')) return color;
    const digits = color.match(/\d+/g);
    if (!digits || digits.length < 3) return color;
    return "#" + ((1 << 24) + (parseInt(digits[0]) << 16) + (parseInt(digits[1]) << 8) + parseInt(digits[2])).toString(16).slice(1);
  };

  const traverse = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const style = el.style;
    
    // Recursive content
    let content = '';
    el.childNodes.forEach(child => content += traverse(child));

    // skip empty tags if not specific void elements
    if (content.trim() === '' && !['img', 'br', 'hr'].includes(tagName)) return '';

    switch (tagName) {
        case 'b':
        case 'strong': return (style.fontWeight === 'normal') ? content : `[b]${content}[/b]`;
        case 'i':
        case 'em': return (style.fontStyle === 'normal') ? content : `[i]${content}[/i]`;
        case 'u': return `[u]${content}[/u]`;
        case 's':
        case 'strike':
        case 'del': return `[s]${content}[/s]`;
        case 'ul': return `\n[list]${content}[/list]\n`;
        case 'ol': return `\n[list=1]${content}[/list]\n`;
        case 'li': 
            // Only add [*] if we are not already inside a manual text formatting of a list
            return `\n[*]${content.trim()}`; 
        case 'br': return '\n';
        case 'hr': return '\n[hr]\n';
        case 'div': 
        case 'p':
            let align = style.textAlign || el.getAttribute('align');
            if (align === 'center') return `\n[center]${content}[/center]\n`;
            if (align === 'right') return `\n[right]${content}[/right]\n`;
            if (align === 'justify') return `\n[justify]${content}[/justify]\n`;
            return `\n${content}\n`;
        case 'img': return `[img]${el.getAttribute('src') || ''}[/img]`;
        case 'a': return `[url=${el.getAttribute('href')}]${content}[/url]`;
        case 'blockquote': return `\n[quote]${content.trim()}[/quote]\n`;
        case 'pre': return `\n[code]${content.trim()}[/code]\n`;
        case 'font':
            if (el.getAttribute('size')) return `[size=${el.getAttribute('size')}]${content}[/size]`;
            if (el.getAttribute('face')) return `[font=${el.getAttribute('face')}]${content}[/font]`;
            return content;
        case 'span':
            if (style.color) {
                const hex = rgbToHex(style.color);
                if (hex && hex !== '#000000' && hex !== '#0d0d0d') return `[color=${hex}]${content}[/color]`;
            }
            if (style.fontSize) {
                // Approximate font-size px to 1-7
                // Simplified fallback
                return content; 
            }
            if (style.fontFamily) return `[font=${style.fontFamily}]${content}[/font]`;
            return content;
        default: return content;
    }
  };

  let bbcode = traverse(temp);
  
  // Cleanup: Remove excessive newlines
  // 1. Collapse multiple newlines to max 2
  bbcode = bbcode.replace(/\n\s*\n\s*\n/g, '\n\n');
  // 2. Remove leading/trailing
  return bbcode.trim();
};

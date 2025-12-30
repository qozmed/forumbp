// Stronger XSS protection
export const escapeHtml = (text: string) => {
  if (!text) return '';
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/javascript:/gi, "blocked:") // Prevent basic JS injection via href
    .replace(/on\w+=/gi, "blocked="); // Prevent event handlers
};

/**
 * Converts BBCode to HTML for Display (Post View)
 * Uses a loop to handle nested tags correctly (e.g. [b][color]...[/color][/b])
 */
export const parseBBCodeToHtml = (content: string) => {
  if (!content) return '';
  
  // 1. Escape HTML entities first to prevent XSS
  let parsed = escapeHtml(content);

  // 2. Recursive Parsing Loop
  // We loop until the string stops changing. This allows for:
  // - Deeply nested tags (e.g., [b][i]Text[/i][/b])
  // - Nested tags of the same type (e.g., [quote] [quote] ... [/quote] [/quote])
  // - Correct ordering execution
  let previous = "";
  let loopCount = 0;
  const MAX_LOOPS = 20; // Prevent infinite loops just in case

  while (parsed !== previous && loopCount < MAX_LOOPS) {
    previous = parsed;
    loopCount++;

    // --- Simple Formatting ---
    parsed = parsed
      .replace(/\[b\]([\s\S]*?)\[\/b\]/gi, '<strong class="text-white font-bold">$1</strong>')
      .replace(/\[i\]([\s\S]*?)\[\/i\]/gi, '<em class="italic">$1</em>')
      .replace(/\[u\]([\s\S]*?)\[\/u\]/gi, '<u class="underline">$1</u>')
      .replace(/\[s\]([\s\S]*?)\[\/s\]/gi, '<s class="line-through opacity-70">$1</s>');

    // --- Alignment ---
    parsed = parsed
      .replace(/\[center\]([\s\S]*?)\[\/center\]/gi, '<div class="text-center">$1</div>')
      .replace(/\[left\]([\s\S]*?)\[\/left\]/gi, '<div class="text-left">$1</div>')
      .replace(/\[right\]([\s\S]*?)\[\/right\]/gi, '<div class="text-right">$1</div>')
      .replace(/\[justify\]([\s\S]*?)\[\/justify\]/gi, '<div class="text-justify">$1</div>');

    // --- Complex Tags (Color) ---
    // Regex explanation:
    // \[color= : matches start
    // ['"]? : optional quote
    // ([#a-zA-Z0-9,\s\(\)\-\.]+) : captures the color value (hex, name, rgb), rejects dangerous chars
    // ['"]? : optional closing quote
    // \] : end of opening tag
    // ([\s\S]*?) : content
    // \[\/color\] : closing tag
    parsed = parsed.replace(/\[color=['"]?([#a-zA-Z0-9,\s\(\)\-\.]+)['"]?\]([\s\S]*?)\[\/color\]/gi, (_, color, text) => {
        return `<span style="color:${color}">${text}</span>`;
    });

    // --- Images ---
    parsed = parsed.replace(/\[img\](.*?)\[\/img\]/gi, '<img src="$1" class="max-w-full rounded border border-[#333] my-3 shadow inline-block" alt="Image" />');

    // --- Links ---
    parsed = parsed.replace(/\[url=['"]?(.*?)['"]?\]([\s\S]*?)\[\/url\]/gi, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-cyan-400 hover:text-cyan-300 underline decoration-cyan-900 hover:decoration-cyan-400 transition-all">$2</a>');

    // --- Quotes (Specific User) ---
    parsed = parsed.replace(/\[quote=['"]?(.*?)['"]?\]([\s\S]*?)\[\/quote\]/gi, '<div class="my-4 border-l-2 border-white bg-[#1a1a1a] p-4 rounded-r"><div class="text-xs text-white font-bold mb-2 uppercase tracking-wider opacity-70">$1 wrote:</div><div class="text-gray-400 italic pl-1">$2</div></div>');

    // --- Quotes (Generic) ---
    parsed = parsed.replace(/\[quote\]([\s\S]*?)\[\/quote\]/gi, '<blockquote class="border-l-2 border-gray-600 pl-4 py-2 my-4 text-gray-500 italic bg-[#111] p-2 rounded-r">$1</blockquote>');

    // --- Code Blocks ---
    parsed = parsed.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, '<pre class="bg-[#050505] p-4 rounded border border-[#333] overflow-x-auto my-3 text-sm font-mono text-gray-300"><code>$1</code></pre>');

    // --- YouTube ---
    parsed = parsed.replace(/\[youtube\](.*?)\[\/youtube\]/gi, '<div class="relative w-full aspect-video rounded overflow-hidden shadow-2xl my-4 border border-[#333]"><iframe class="absolute top-0 left-0 w-full h-full" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>');
  }

  // 3. Convert line breaks (do this last to avoid interfering with regex dots/newlines)
  parsed = parsed.replace(/\n/g, '<br />');

  return parsed;
};

// Editor helpers - Keeping these simpler as `execCommand` handles most nesting naturally
export const bbcodeToEditorHtml = (content: string) => {
  if (!content) return '';
  let parsed = content
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
  return parsed;
};

export const htmlToBBCode = (html: string) => {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  const traverse = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    let content = '';
    el.childNodes.forEach(child => { content += traverse(child); });
    const tagName = el.tagName.toLowerCase();
    const style = el.getAttribute('style') || '';
    
    // Helper to get hex from rgb
    const rgb2hex = (rgb: string) => {
        if (rgb.search("rgb") == -1) return rgb;
        const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+))?\)$/);
        if (!match) return rgb;
        const hex = (x: string) => ("0" + parseInt(x).toString(16)).slice(-2);
        return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
    };

    switch (tagName) {
      case 'b': case 'strong': if (el.style.fontWeight === 'normal') return content; return `[b]${content}[/b]`;
      case 'i': case 'em': return `[i]${content}[/i]`;
      case 'u': return `[u]${content}[/u]`;
      case 's': case 'strike': case 'del': return `[s]${content}[/s]`;
      case 'br': return '\n';
      case 'div': case 'p': 
        const align = el.style.textAlign || el.getAttribute('align');
        if (align === 'center') return `\n[center]${content}[/center]\n`;
        if (align === 'right') return `\n[right]${content}[/right]\n`;
        if (align === 'justify') return `\n[justify]${content}[/justify]\n`;
        if (align === 'left') return `\n[left]${content}[/left]\n`;
        if (style.includes('text-align: center')) return `\n[center]${content}[/center]\n`;
        return `\n${content}\n`;
      case 'img': return `[img]${el.getAttribute('src') || ''}[/img]`;
      case 'a': return `[url=${el.getAttribute('href')}]${content}[/url]`;
      case 'blockquote': return `[quote]${content}[/quote]`;
      case 'pre': return `[code]${content}[/code]`;
      case 'span': case 'font': 
        if (el.style.color || el.getAttribute('color')) { 
            const rawColor = el.style.color || el.getAttribute('color') || '';
            const color = rgb2hex(rawColor);
            return `[color=${color}]${content}[/color]`; 
        } 
        return content;
      default: return content;
    }
  };
  let bbcode = traverse(temp);
  bbcode = bbcode.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  return bbcode;
};

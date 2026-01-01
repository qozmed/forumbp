/**
 * Compress image file to base64 string
 * For JPEGs/PNGs: Resizes and compresses via Canvas.
 * For GIFs: Reads directly as Base64 to preserve animation (skips compression).
 * 
 * @param file File object from input
 * @param maxWidth Max width for resizing (ignored for GIFs)
 * @param quality Quality (0-1) (ignored for GIFs)
 */
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      // 1. Handle GIF Animations - Skip Canvas
      if (file.type === 'image/gif') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
           resolve(event.target?.result as string || '');
        };
        reader.onerror = (err) => reject(err);
        return;
      }

      // 2. Handle Static Images (JPEG, PNG, etc)
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const elem = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
  
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
  
          elem.width = width;
          elem.height = height;
          const ctx = elem.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(ctx?.canvas.toDataURL('image/jpeg', quality) || '');
        };
        img.onerror = (err) => reject(err);
      };
      reader.onerror = (err) => reject(err);
    });
  };
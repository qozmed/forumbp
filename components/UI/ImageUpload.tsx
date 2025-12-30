import React, { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { compressImage } from '../../utils/image';

interface Props {
  label: string;
  currentImage?: string;
  onImageChange: (base64: string) => void;
  maxWidth?: number;
}

const ImageUpload: React.FC<Props> = ({ label, currentImage, onImageChange, maxWidth = 500 }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Only images are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size too large (max 5MB)');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const base64 = await compressImage(file, maxWidth);
      onImageChange(base64);
    } catch (err) {
      setError('Failed to process image');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
        <ImageIcon className="w-4 h-4" /> {label}
      </label>
      
      <div className="flex items-start gap-4">
        {currentImage && (
          <img 
            src={currentImage} 
            alt="Preview" 
            className="w-20 h-20 rounded object-cover border border-gray-700 bg-black" 
          />
        )}
        
        <div className="flex-1">
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 border border-gray-700 hover:bg-gray-800 text-white rounded transition-colors text-sm w-full justify-center md:w-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {loading ? 'Processing...' : 'Upload Image'}
          </button>
          
          <input 
            ref={fileInputRef}
            type="file" 
            accept="image/*" 
            className="hidden"
            onChange={handleFileChange}
          />
          
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
          <p className="text-xs text-gray-500 mt-2">
             Supported: JPG, PNG, GIF. Max 5MB. Auto-resized.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ImageUpload;


import React, { useState, useCallback, useRef, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { UploadedPhoto } from '../types';
import Button from './common/Button';
import Alert from './common/Alert';
import LoadingSpinner from './LoadingSpinner';

interface PhotoUploadFormProps {
  onSubmit: (photos: UploadedPhoto[], onProgress: (progress: number) => void) => void;
  maxPhotos: number;
  numToSelect: number;
}

const PhotoUploadForm: React.FC<PhotoUploadFormProps> = ({ onSubmit, maxPhotos, numToSelect }) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<UploadedPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCompressing, setIsCompressing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const expectingFileRef = useRef(false);

  // Effect to handle user cancelling the file selection dialog
  useEffect(() => {
    const handleFocus = () => {
      // Use a timeout to allow the onChange event to fire first if a file was selected.
      setTimeout(() => {
        if (expectingFileRef.current) {
          // If the flag is still true, onChange was not called. The user likely cancelled.
          // Re-show the overlay if there are photos, as the user might want to proceed.
          if (photoPreviews.length > 0) {
            setShowOverlay(true);
          }
          expectingFileRef.current = false; // Reset for the next interaction.
        }
      }, 300);
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [photoPreviews.length]);


  const processFiles = async (filesToProcess: File[]) => {
    if (selectedFiles.length + filesToProcess.length > maxPhotos) {
      setError(`You can upload a maximum of ${maxPhotos} photos. Please select fewer files or remove existing ones.`);
      return;
    }
    
    setIsCompressing(true);
    setError(null);

    const validFiles = filesToProcess.filter(file => {
      if (typeof file.size === 'number' && file.size === 0) {
        console.warn('[PhotoUploadForm] Skipping zero-byte or cloud-only file:', file.name);
        return false;
      }
      return true;
    });

    if (validFiles.length < filesToProcess.length) {
      console.warn('Some zero-byte files were filtered out.');
    }

    const compressionOptions = {
      maxSizeMB: 2, // Max file size in MB
      maxWidthOrHeight: 1920, // Max width or height
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.8
    };

    try {
      const compressedFiles = await Promise.all(validFiles.map(async (file) => {
          try {
              console.log(`Original size: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
              const compressedFile = await imageCompression(file, compressionOptions);
              console.log(`Compressed size: ${(compressedFile.size / 1024 / 1024).toFixed(2)} MB`);
              return compressedFile;
          } catch (error) {
              console.error(`Could not compress image ${file.name}:`, error);
              // Return null for failed compressions to filter out later
              return null;
          }
      }));
        
      const successfulFiles = compressedFiles.filter((f): f is File => f !== null);

      if (successfulFiles.length < validFiles.length) {
          console.warn(`Could not process ${validFiles.length - successfulFiles.length} files. They were likely unsupported types or corrupt.`);
      }

      const newUploadedPhotos: UploadedPhoto[] = successfulFiles.map(file => ({
        id: `${file.name}-${Date.now()}-${Math.random()}`,
        file,
        objectURL: URL.createObjectURL(file),
      }));

      setSelectedFiles(prev => [...prev, ...newUploadedPhotos.map(p => p.file)]);
      setPhotoPreviews(prev => [...prev, ...newUploadedPhotos]);
      if (newUploadedPhotos.length > 0) {
        setShowOverlay(true);
      }
    } catch (error) {
      console.error('An error occurred during image processing:', error);
      setError('An unexpected error occurred while processing images. Please try again.');
    } finally {
      setIsCompressing(false);
    }
  }

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    expectingFileRef.current = false; // A file was selected, so reset the flag immediately.
    setError(null);
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    processFiles(files);
    event.target.value = ''; // Reset file input
  }, [selectedFiles.length, maxPhotos]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    setError(null);
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length === 0) return;
    processFiles(files);
  }, [selectedFiles.length, maxPhotos]);


  const removePhoto = (idToRemove: string) => {
    const photoToRemove = photoPreviews.find(p => p.id === idToRemove);
    if (photoToRemove) {
      URL.revokeObjectURL(photoToRemove.objectURL); // Clean up object URL
    }
    const updatedPreviews = photoPreviews.filter(p => p.id !== idToRemove);
    setPhotoPreviews(updatedPreviews);
    setSelectedFiles(prev => prev.filter(f => photoPreviews.find(p => p.id === idToRemove && p.file === f) ? false : true));
    
    // If error was about not enough photos, clear it if condition is now met.
    if (updatedPreviews.length >= numToSelect && error?.includes("Please upload at least")) {
        setError(null);
    }
    
    // As per user request, show the overlay again if photos remain.
    if (updatedPreviews.length > 0) {
        setShowOverlay(true);
    } else {
        setShowOverlay(false);
    }
  };
  
  const handleUploadMoreClick = () => {
    setShowOverlay(false);
  };
  
  const handleUploadAreaClick = () => {
    if (!showOverlay) {
      // Set the flag indicating we are expecting a file dialog to open.
      expectingFileRef.current = true;
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (photoPreviews.length === 0) {
      setError(`Please upload at least one photo. We recommend ${numToSelect} to ${maxPhotos} photos for the best selection.`);
      return;
    }
     if (photoPreviews.length < numToSelect) {
      setError(`Please upload at least ${numToSelect} photos for a good selection. You've uploaded ${photoPreviews.length}. More photos provide better options!`);
      setShowOverlay(true);
      return;
    }
    setError(null);
    setUploadProgress(0);
    onSubmit(photoPreviews, (progress) => {
      setUploadProgress(progress);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">Upload Your Photos</h2>
        <p className="text-slate-300 mb-1">
          Upload between {numToSelect} and {maxPhotos} of your best photos. We'll analyze them and pick the top {numToSelect} to feature in your profile mock-up!
        </p>
        <p className="text-sm text-slate-400 mb-6">
            Use clear, high-quality images showcasing you in various settings (JPEG, PNG, WEBP accepted).
        </p>
      </div>

      {error && <Alert message={error} type="error" onClose={() => setError(null)} />}

      <div 
        className="relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        >
        <div 
          onClick={handleUploadAreaClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') handleUploadAreaClick()}}
          className={`w-full flex flex-col items-center justify-center px-4 py-10 bg-slate-700  text-slate-300 rounded-lg shadow-md tracking-wide border-2 border-dashed transition-all duration-300 ease-in-out
                      ${isDragging ? 'border-purple-600 bg-slate-600 scale-105' : 'border-slate-500'}
                      ${!showOverlay && !isCompressing ? 'cursor-pointer hover:bg-slate-600 hover:border-purple-500' : 'cursor-default'}`}
        >
          {isCompressing ? (
            <div className="flex flex-col items-center">
              <LoadingSpinner />
              <span className="mt-4 text-lg text-slate-300">Optimizing images...</span>
            </div>
          ) : uploadProgress !== null ? (
            <div className="w-full">
              <div className="flex justify-between mb-1">
                <span className="text-base font-medium text-purple-300">Uploading...</span>
                <span className="text-sm font-medium text-purple-300">{Math.round(uploadProgress)}%</span>
              </div>
              <div className="w-full bg-slate-600 rounded-full h-2.5">
                <div className="bg-purple-500 h-2.5 rounded-full" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            </div>
          ) : (
            <>
              <svg className="w-12 h-12 mb-3 text-purple-400" fill="currentColor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M16.88 9.1A4 4 0 0 1 16 17H5a5 5 0 0 1-1-9.9V7a3 3 0 0 1 4.52-2.59A4.98 4.98 0 0 1 17 8c0 .38-.04.74-.12 1.1zM11 11h3l-4-4-4 4h3v3h2v-3z" />
              </svg>
              <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">{isDragging ? 'Drop Photos to Begin!' : 'Upload Your Photos'}</span>
              <p className="text-base text-slate-300 mt-2 text-center max-w-xs">
                Let us find your best shots & help build a profile that gets noticed.
              </p>
              <span className="text-sm mt-3 text-slate-400">(Max {maxPhotos} files. {numToSelect} recommended minimum)</span>
            </>
          )}
        </div>
        
        {showOverlay && photoPreviews.length > 0 && (
          <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 rounded-lg z-10 animate-fade-in-up">
            <Button
              type="submit"
              variant="primary"
              size="large"
              className="w-full sm:w-auto"
              disabled={photoPreviews.length < numToSelect}
            >
              Analyze & Generate Profile
            </Button>

             <Button
                type="button"
                onClick={handleUploadMoreClick}
                variant="ghost"
                size="small"
                className="mt-4"
            >
                Upload More / Change
            </Button>
            
            {photoPreviews.length < numToSelect && (
              <p className="text-sm text-yellow-400 mt-2 text-center">
                Please upload at least {numToSelect} photos for optimal results.
              </p>
            )}
          </div>
        )}

        <input
          id="photo-upload"
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {photoPreviews.length > 0 && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-semibold text-slate-100">Your Uploaded Photos ({photoPreviews.length}/{maxPhotos})</h3>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-4">
            {photoPreviews.map((photo) => (
              <div key={photo.id} className="relative group aspect-w-1 aspect-h-1 bg-slate-800 rounded-lg overflow-hidden shadow-lg">
                <img
                  src={photo.objectURL}
                  alt={photo.file.name}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-300 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform scale-75 group-hover:scale-100 focus:opacity-100"
                    aria-label="Remove photo"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                 <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-black bg-opacity-50">
                    <p className="text-white text-xs truncate" title={photo.file.name}>{photo.file.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </form>
  );
};

export default PhotoUploadForm;
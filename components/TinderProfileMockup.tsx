


import React, { useState, useEffect } from 'react';
import { SelectedPhoto } from '../types';
import Button from './common/Button';
import { downloadSinglePhoto } from '../services/downloadService';
import ImageComparisonSlider from './ImageComparisonSlider';

interface TinderProfileMockupProps {
  userName: string;
  userAge?: number;
  bio: string;
  photos: SelectedPhoto[];
  isEnhancing: boolean;
  enhancementProgress: number | null;
  onRegenerateBio: (tone?: string) => void;
  isBioLoading: boolean;
  onSuperchargePhoto?: (photoId: string) => void;
  superchargingState?: { [key: string]: boolean };
}

const TinderProfileMockup: React.FC<TinderProfileMockupProps> = ({ userName, userAge, bio, photos, isEnhancing, enhancementProgress, onRegenerateBio, isBioLoading, onSuperchargePhoto, superchargingState }) => {
  console.log("--- Step 7: Inside TinderProfileMockup ---");
  console.log("Received props:", { userName, userAge, bio, photos });
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isDownloadingSingle, setIsDownloadingSingle] = useState(false);
  const [bioCopied, setBioCopied] = useState(false);
  const [showSlider, setShowSlider] = useState(false);

  const hasPhotos = photos && photos.length > 0;
  const currentPhoto = hasPhotos ? photos[currentPhotoIndex] : null;

  useEffect(() => {
    // When the photo changes, determine if the slider should be shown
    if (currentPhoto?.superchargedObjectURL && currentPhoto.enhancedObjectURL) {
      setShowSlider(true);
    } else {
      setShowSlider(false);
    }
  }, [currentPhoto]);

  const nextPhoto = (e: React.MouseEvent) => {
    if (!hasPhotos) return;
    e.stopPropagation(); // Prevent card click if on image
    setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % photos.length);
  };

  const prevPhoto = (e: React.MouseEvent) => {
    if (!hasPhotos) return;
    e.stopPropagation();
    setCurrentPhotoIndex((prevIndex) => (prevIndex - 1 + photos.length) % photos.length);
  };
  
  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left; // x position within the element.
    if (x < rect.width / 2) {
      prevPhoto(e);
    } else {
      nextPhoto(e);
    }
  };


  
  const handleSingleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentPhoto || isDownloadingSingle) return;

    setIsDownloadingSingle(true);
    try {
        await downloadSinglePhoto(currentPhoto);
    } catch (error) {
        console.error("Failed to download single photo:", error);
        alert(`Could not download photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsDownloadingSingle(false);
    }
  };

  const handleCopyBio = () => {
    navigator.clipboard.writeText(bio).then(() => {
      setBioCopied(true);
      setTimeout(() => setBioCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy bio: ", err);
      alert("Failed to copy bio.");
    });
  };

  const displayBio = (bio && bio.trim() !== '') ? bio : "Bio could not be generated at this time. Please try refining or starting over.";

  return (
    <div className="w-full max-w-md mx-auto bg-slate-800 rounded-2xl shadow-xl overflow-hidden border-2 border-slate-700 select-none">
      {/* Image Section with Navigation */}
      <div 
        className={`relative w-full aspect-[3/4] group bg-slate-700 overflow-hidden ${isEnhancing ? 'cursor-default' : 'cursor-pointer'}`}
        onClick={hasPhotos && !isEnhancing ? handleImageClick : undefined}
      >
        {/* Wrapper for blurrable content */}
        <div className={`w-full h-full transition-all duration-300 ${isEnhancing ? 'filter blur-md brightness-75' : ''}`}>
          {hasPhotos && currentPhoto ? (
            <>
              {/* Progress bars for photos */}
              {photos.length > 1 && (
                  <div className="absolute top-2 left-2 right-2 h-1 flex space-x-1 z-20 px-1">
                      {photos.map((_, index) => (
                      <div key={index} className="flex-1 h-full rounded-full bg-black/30 overflow-hidden">
                          <div
                          className={`h-full ${index === currentPhotoIndex ? 'bg-white' : 'bg-transparent'}`}
                          style={{ width: '100%' }}
                          />
                      </div>
                      ))}
                  </div>
              )}

              {showSlider && currentPhoto?.enhancedObjectURL && currentPhoto?.superchargedObjectURL ? (
                <ImageComparisonSlider
                  beforeImageUrl={currentPhoto.enhancedObjectURL}
                  afterImageUrl={currentPhoto.superchargedObjectURL}
                  altText={`${userName}'s profile photo ${currentPhotoIndex + 1}`}
                />
              ) : (
                <img
                  src={currentPhoto?.enhancedObjectURL || currentPhoto?.objectURL}
                  alt={`${userName}'s profile photo ${currentPhotoIndex + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22300%22%20height%3D%22400%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20300%20400%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_1%20text%20%7B%20fill%3A%23aaa%3Bfont-weight%3Anormal%3Bfont-family%3AHelvetica%2C%20monospace%3Bfont-size%3A15pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_1%22%3E%3Crect%20width%3D%22300%22%20height%3D%22400%22%20fill%3D%22%23555%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22100%22%20y%3D%22205%22%3EError%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
                    target.alt = 'Error loading image';
                  }}
                />
              )}

              {/* Single Photo Download Button */}
              {!isEnhancing && currentPhoto.enhancedObjectURL && (
                <button
                  onClick={handleSingleDownloadClick}
                  disabled={isDownloadingSingle}
                  aria-label="Download this photo"
                  title="Download this enhanced photo"
                  className="absolute bottom-4 right-4 z-20 p-2.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-all duration-200 opacity-0 group-hover:opacity-100 disabled:opacity-50 disabled:cursor-wait"
                >
                  {isDownloadingSingle ? (
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              )}

              {/* Supercharge Button on Photo */}
                {onSuperchargePhoto && currentPhoto && !isEnhancing && (
                    <div className="absolute top-4 left-4 z-20">
                        <div className="relative group flex items-center">
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSuperchargePhoto(currentPhoto.id);
                                }}
                                disabled={!currentPhoto.enhancedObjectURL || superchargingState?.[currentPhoto.id]}
                                variant="secondary"
                                size="icon"
                                className="bg-black/50 hover:bg-black/70 text-white rounded-full transition-all duration-200"
                                title="Supercharge your looks"
                            >
                                {superchargingState?.[currentPhoto.id] ? (
                                    <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    '✨'
                                )}
                            </Button>
                            <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 w-max bg-black/80 text-white text-xs rounded py-1 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                Let AI take your looks to the next level
                            </div>
                        </div>
                    </div>
                )}

              {/* Gradient overlay for text */}
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/80 via-black/50 to-transparent"></div>
              
              {/* Photo Navigation buttons */}
              {photos.length > 1 && !isEnhancing && (
                <>
                  <button
                      onClick={prevPhoto}
                      aria-label="Previous photo"
                      className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  ></button>
                  <button
                      onClick={nextPhoto}
                      aria-label="Next photo"
                      className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  ></button>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-slate-400 text-center p-4">Photo display area.<br/>Upload photos to see them here.</p>
            </div>
          )}
        </div>
        
        {/* ENHANCEMENT OVERLAY */}
        {isEnhancing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-30 p-4 text-center bg-black/40">
              <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-white mb-4"></div>
              <h4 className="text-lg font-bold text-white mb-2 drop-shadow-lg">Magic in Progress...</h4>
              <p className="text-sm text-slate-200 mb-4 drop-shadow-md">Enhancing your photos. Please wait.</p>
              <div className="w-full max-w-xs bg-slate-900/50 rounded-full h-3 border border-slate-500">
                  <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${enhancementProgress ?? 0}%` }}
                      role="progressbar"
                      aria-valuenow={enhancementProgress ?? 0}
                      aria-valuemin={0}
                      aria-valuemax={100}
                  ></div>
              </div>
              <p className="text-xl font-bold text-white mt-2 drop-shadow-lg">{Math.round(enhancementProgress ?? 0)}%</p>
          </div>
        )}
      </div>

      {/* reason for the current photo */}
      {hasPhotos && currentPhoto && (
        <div className="px-5 pt-3 pb-1">
          <p className="text-sm text-slate-300" title={currentPhoto.reason}>
            <span className="font-semibold text-purple-300"></span>{currentPhoto.reason || "This photo looks great!"}
          </p>
        </div>
      )}

      {/* Info Section */}
      <div className="p-5 pt-2 text-slate-100 space-y-2">
        <h3 className="text-2xl font-bold">
          {userName}{userAge && `, ${userAge}`}
        </h3>
        
        {/* BIO TEXT and loading overlay */}
        <div className="relative text-sm text-slate-200 leading-relaxed whitespace-pre-wrap h-28 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700">
          <div className={`transition-all duration-300 ${isBioLoading ? 'opacity-30 blur-sm' : 'opacity-100'}`}>
              {displayBio}
          </div>
          {isBioLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-2 text-center rounded-lg">
                  <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-purple-400 mb-3"></div>
                  <p className="text-sm font-bold text-white drop-shadow-lg">Supercharging Bio...</p>
              </div>
          )}
        </div>
        
        {/* BIO ACTIONS outside of text area */}
        <div className="flex items-center justify-end gap-2 pt-1">
             <Button
                onClick={() => onRegenerateBio(undefined)}
                disabled={isBioLoading}
                aria-label="Regenerate bio"
                title="Get a new bio suggestion"
                variant="secondary"
                size="small"
                className="flex items-center gap-1.5"
            >
                {isBioLoading ? (
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                )}
                <span>Regenerate</span>
            </Button>
            <Button
                onClick={handleCopyBio}
                size="small"
                variant="secondary"
                aria-label="Copy bio to clipboard"
                disabled={isBioLoading}
            >
                {bioCopied ? 'Copied!' : 'Copy Bio'}
            </Button>
        </div>
      </div>

      {/* Mock Tinder Actions (Non-functional) */}
      <div className="flex justify-around items-center p-4 border-t border-slate-700">
        <button aria-label="Pass" className="p-3 rounded-full hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
        <button aria-label="Super Like" className="p-3 rounded-full hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
        <button aria-label="Like" className="p-3 rounded-full hover:bg-slate-700 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default TinderProfileMockup;
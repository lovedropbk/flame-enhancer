

import React, { useState, useMemo, useEffect } from 'react';
import { GeneratedProfile } from '../types';
import TinderProfileMockup from './TinderProfileMockup';
import Button from './common/Button';
import { downloadProfileAsZip, downloadSinglePhoto } from '../services/downloadService';
import RefinementChat from './RefinementChat';

interface GeneratedProfileViewProps {
  profile: GeneratedProfile;
  onReset: () => void;
  isPreliminary: boolean;
  onEnhanceAllPhotos: () => void;
  isEnhancing: boolean;
  enhancementProgress: number | null;
  onRegenerateBio: (tone?: string) => void;
  isBioLoading: boolean;
  onOpenRefinementModal: () => void;
  onChatBioRefine: (feedback: string) => void;
  chatRefinementCount: number;
  onSuperchargePhoto: (photoId: string) => Promise<void>;
  superchargingState?: { [key: string]: boolean };
}

const GeneratedProfileView: React.FC<GeneratedProfileViewProps> = ({
    profile,
    onReset,
    isPreliminary,
    onEnhanceAllPhotos,
    isEnhancing,
    enhancementProgress,
    onRegenerateBio,
    isBioLoading,
    onOpenRefinementModal,
    onChatBioRefine,
    chatRefinementCount,
    onSuperchargePhoto,
    superchargingState
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPictures, setIsDownloadingPictures] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const checkIsDesktop = () => setIsDesktop(window.innerWidth > 768);
    checkIsDesktop();
    window.addEventListener('resize', checkIsDesktop);
    return () => window.removeEventListener('resize', checkIsDesktop);
  }, []);

  console.log("--- Step 6: Inside GeneratedProfileView ---");
  console.log("Received profile prop:", profile);

  const hasEnhancedPhotos = useMemo(() => {
    return profile.selectedPhotos.some(p => p.enhancedObjectURL);
  }, [profile.selectedPhotos]);

  const isEnhancementComplete = useMemo(() => {
    if (!profile.selectedPhotos || profile.selectedPhotos.length === 0) {
      return true; // No photos to enhance, so it's considered "complete" for this logic
    }
    return profile.selectedPhotos.every(p => !!p.enhancedObjectURL);
  }, [profile.selectedPhotos]);


  const handleDownloadZip = async () => {
    if (!profile) return;
    setIsDownloading(true);
    try {
      await downloadProfileAsZip(profile);
    } catch (error) {
      console.error("Failed to generate zip for download:", error);
      // The service already alerts the user, but you could add more UI feedback here
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownloadPictures = async () => {
    if (!profile) return;
    const photosToDownload = profile.selectedPhotos.filter(p => p.enhancedObjectURL);
    
    if (photosToDownload.length === 0) {
        alert("No enhanced photos available to download. Please use the 'Magic Enhance' feature first.");
        return;
    }

    setIsDownloadingPictures(true);
    try {
        for (const photo of photosToDownload) {
            await downloadSinglePhoto(photo);
            // Wait a bit before starting the next download to avoid pop-up blockers
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    } catch (error) {
        console.error("Failed during sequential photo download:", error);
        alert(`An error occurred during download: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
        setIsDownloadingPictures(false);
    }
  };


  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-cyan-500 to-blue-500 mb-2 text-center">
          {isPreliminary 
            ? (isEnhancementComplete ? "Pictures Enhanced!" : "Base Profile Ready!") 
            : "Your Fully Refined Profile!"}
        </h2>
        
        {isPreliminary && !isEnhancing && (
            <div className="text-center my-6">
                {!isEnhancementComplete ? (
                    <>
                        <Button
                            onClick={onEnhanceAllPhotos}
                            variant="primary"
                            size="large"
                            className="transform hover:scale-105 transition-transform duration-200 shadow-lg hover:shadow-purple-500/50"
                            disabled={isEnhancing}
                        >
                            ✨ MagicEnhance Photos & Supercharge Bio ✨
                        </Button>
                        <p className="text-slate-400 mt-3 text-sm max-w-lg mx-auto">
                            We enhance photos, fix lighting, and sharpen your bio to attract more matches.
                        </p>
                    </>
                ) : (
                    <div className="py-0">
                        <h3 className="text-xl font-bold text-white">Next Step: Fine-Tune Your Targeting</h3>
                        <p className="text-slate-300 my-2 max-w-md mx-auto px-4">Tell us exactly who you're looking for to refine your bio and photo selection further.</p>
                        <Button onClick={onOpenRefinementModal} variant="primary" size="large" className="transform hover:scale-105 transition-transform duration-200">
                            🎯 Target Your Profile
                        </Button>
                    </div>
                )}
            </div>
        )}

        {!isPreliminary && (
            <p className="text-center text-slate-300 mb-8">Looking great! Happy swiping ;)</p>
        )}
      </div>
      
      <TinderProfileMockup 
        userName={profile.userName || "Your Name"} 
        userAge={profile.userAge ? parseInt(profile.userAge, 10) : undefined}
        bio={profile.bio}
        photos={profile.selectedPhotos}
        isEnhancing={isEnhancing}
        enhancementProgress={enhancementProgress}
        onRegenerateBio={onRegenerateBio}
        isBioLoading={isBioLoading}
        onSuperchargePhoto={onSuperchargePhoto}
        superchargingState={superchargingState}
      />
      
      {!isPreliminary && (
        <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 p-6 rounded-xl shadow-2xl text-white mt-12 text-center">
            <h3 className="text-2xl font-bold mb-2">✅ Your Profile is Ready!</h3>
            <p className="mb-4 text-purple-100">
                Still want to refine? Tell us your thoughts and we will weave them in!
            </p>
            <RefinementChat 
              onSubmit={onChatBioRefine}
              isLoading={isBioLoading}
              refinementsLeft={2 - chatRefinementCount}
            />
        </div>
      )}

      <div className="text-center pt-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 flex-wrap">
          {isDesktop && (
            <Button
              onClick={handleDownloadZip}
              variant="primary"
              size="large"
              disabled={isDownloading || !hasEnhancedPhotos}
              title={!hasEnhancedPhotos ? "Enhance your photos first to enable download!" : "Download a ZIP of your bio and enhanced photos"}
              className="flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Zipping files...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download Zip
                </>
              )}
            </Button>
          )}

          <Button
            onClick={handleDownloadPictures}
            variant="secondary"
            size="large"
            disabled={isDownloadingPictures || !hasEnhancedPhotos}
            title={!hasEnhancedPhotos ? "Enhance your photos first!" : "Download all enhanced photos one by one"}
            className="flex items-center justify-center gap-2"
          >
            {isDownloadingPictures ? (
               <>
                <svg className="animate-spin -ml-1 mr-1 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Downloading...
              </>
            ) : (
              <>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                Download Pictures
              </>
            )}
          </Button>

          <Button onClick={onReset} variant="secondary" size="large">
            Start Over
          </Button>
        </div>

      </div>
       <style>{`
          .animate-fade-in-up {
              animation: fadeInUp 0.5s ease-out forwards;
          }
          @keyframes fadeInUp {
              from {
                  opacity: 0;
                  transform: translateY(10px);
              }
              to {
                  opacity: 1;
                  transform: translateY(0);
              }
          }
       `}</style>
    </div>
  );
};

export default GeneratedProfileView;
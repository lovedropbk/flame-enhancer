



import React, { useState, useCallback } from 'react';
import { AppStep, QuestionnaireAnswers, UploadedPhoto, GeneratedProfile, SelectedPhoto, RefinementSettings } from './types';
import { generateBioFromAnswers, selectBestPhotos, refineBioWithChatFeedback } from './services/geminiService';
import { uploadAndEnhanceImage } from './services/cloudinaryService';
import { ESSENTIAL_QUESTIONS, MAX_UPLOAD_PHOTOS, NUM_PHOTOS_TO_SELECT } from './constants';

import WelcomeScreen from './components/WelcomeScreen';
import QuestionnaireForm from './components/QuestionnaireForm';
import PhotoUploadForm from './components/PhotoUploadForm';
import GeneratedProfileView from './components/GeneratedProfileView';
import LoadingSpinner from './components/LoadingSpinner';
import Header from './components/Header';
import Alert from './components/common/Alert';
import RefinementModal from './components/RefinementControls';

// Helper function for Base64 conversion
export const fileToBase64 = (file: File, timeoutMs: number = 30000): Promise<{ base64Data: string; mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      try { reader.abort(); } catch {}
      reject(new Error(`Reading file timed out: ${file.name}`));
    }, timeoutMs);

    reader.onload = () => {
      if (timedOut) return;
      window.clearTimeout(timeoutId);
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      const mimeType = result.substring(result.indexOf(':') + 1, result.indexOf(';'));
      resolve({ base64Data, mimeType });
    };
    reader.onerror = (error) => {
      if (timedOut) return;
      window.clearTimeout(timeoutId);
      reject(error instanceof Error ? error : new Error('Unknown FileReader error'));
    };
    reader.onabort = () => {
      if (timedOut) return;
      window.clearTimeout(timeoutId);
      reject(new Error('File read aborted'));
    };

    reader.readAsDataURL(file);
  });
};

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<AppStep>('welcome');
  const [essentialAnswers, setEssentialAnswers] = useState<QuestionnaireAnswers>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [generatedProfile, setGeneratedProfile] = useState<GeneratedProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>("Processing...");
  const [isEnhancing, setIsEnhancing] = useState<boolean>(false);
  const [enhancementProgress, setEnhancementProgress] = useState<number | null>(null);
  const [generationProgress, setGenerationProgress] = useState<number | null>(null);
  const [isBioLoading, setIsBioLoading] = useState<boolean>(false);
  const [isRefinementModalOpen, setIsRefinementModalOpen] = useState<boolean>(false);
  const [chatRefinementCount, setChatRefinementCount] = useState<number>(0);
  const [currentRefinementSettings, setCurrentRefinementSettings] = useState<RefinementSettings | undefined>(undefined);

  const handleStart = useCallback(() => {
    setCurrentStep('essentialQuestionnaire');
    setError(null);
  }, []);

  const generateProfileData = async (currentAnswers: QuestionnaireAnswers, isFinalStage: boolean, currentUploadedPhotos: UploadedPhoto[], refinementSettings?: RefinementSettings) => {
    // Watchdog helper: ensures we never hang indefinitely on mobile
    function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const t = window.setTimeout(() => {
          reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
        p.then((v) => {
          window.clearTimeout(t);
          resolve(v);
        }).catch((err) => {
          window.clearTimeout(t);
          reject(err);
        });
      });
    }

    console.log("--- generateProfileData ---");
    console.log("isFinalStage:", isFinalStage);
    let analyzingWatchdogId: number | null = null;
    // Bio-only refinement flow (no photo changes, no full-screen loader)
    if (isFinalStage && generatedProfile) {
        console.log("--- Refining Bio Only ---");
        setIsBioLoading(true);
        setError(null);
        try {
            const newBio = await generateBioFromAnswers(currentAnswers, undefined, refinementSettings, generatedProfile.bio);
            console.log("--- Refined Bio received ---", newBio);
            
            setGeneratedProfile(prev => {
                if (!prev) return null; // Should not happen in this flow
                // Keep existing photos, only update the bio
                return { ...prev, bio: newBio, selectedPhotos: prev.selectedPhotos };
            });
            setCurrentStep('finalResults');

        } catch (err) {
            console.error("Bio refinement failed:", err);
            const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during bio refinement.";
            setError(errorMessage);
        } finally {
            setIsBioLoading(false);
        }
        return; // Exit here to prevent full regeneration
    }
    
    // --- Initial full profile generation flow ---
    setIsLoading(true);
    setError(null);
    setLoadingMessage("Crafting your initial profile...");
    setCurrentStep('analyzingPreliminary');

    // Watchdog for long-running analyzing on mobile (e.g., cloud-only Google Photos or decode stalls)
    analyzingWatchdogId = window.setTimeout(() => {
      console.error('Analyzing watchdog timeout fired');
      setError(`This is taking longer than expected. On some Android devices, selecting from Google Photos provides cloud-only items that cannot be processed directly. Save the photo(s) to your device first, then retry.`);
      setCurrentStep('photoUpload');
      setIsLoading(false);
    }, 60000);

    setGenerationProgress(0);
    const progressInterval = setInterval(() => {
        setGenerationProgress(prev => {
            if (prev === null) {
                clearInterval(progressInterval);
                return null;
            }
            if (prev >= 95) return 95;
            return prev + (95 / 300);
        });
    }, 100);

    try {
        let newBio = "Bio generation failed or was skipped. Please try again.";
        let finalSelectedPhotosForMockup: SelectedPhoto[] = [];

        if (currentUploadedPhotos.length > 0) {
            console.log("--- Step 2a: Starting photo selection ---");
            setLoadingMessage("Analyzing your photos...");
            
            // Lightweight path (mobile-friendly): avoid pre-reading files to base64.
            // Pass File objects directly to the selector and guard against cloud-only selections.
            const photosForSelection = currentUploadedPhotos;
            for (const p of photosForSelection) {
                const name = p.file?.name || 'selected photo';
                const size = typeof p.file?.size === 'number' ? p.file.size : -1;
                if (!p.file || size === 0) {
                    setError(`The file "${name}" isn’t available locally on this device. Please save it to your device first and retry.`);
                    setCurrentStep('photoUpload');
                    return;
                }
            }
            
            let aiSelectedPhotosInfo: Array<{ id: string; reason: string }> = [];
            try {
                console.log("Calling selectBestPhotos service...");
                aiSelectedPhotosInfo = await withTimeout(
                  selectBestPhotos(
                    photosForSelection.map(p => ({
                      id: p.id,
                      file: p.file,
                      fileName: p.file.name
                    })),
                    NUM_PHOTOS_TO_SELECT,
                    currentAnswers.q0_gender,
                    currentAnswers.q0_target_gender
                  ),
                  45000,
                  'Photo analysis'
                );
                 console.log("AI Photo selection successful, reasons:", aiSelectedPhotosInfo);
            } catch (photoSelectionError) {
                console.error("❌ AI photo selection failed:", photoSelectionError);
                
                // Show detailed error information
                let detailedError = "Unknown error occurred";
                if (photoSelectionError instanceof Error) {
                    detailedError = photoSelectionError.message;
                    console.error("Error details:", {
                        message: photoSelectionError.message,
                        stack: photoSelectionError.stack,
                        name: photoSelectionError.name
                    });
                }
                
                // Display comprehensive error message
                setError(`❌ Photo Analysis Failed
                
🔍 Error Details: ${detailedError}

📸 Troubleshooting Tips:
• Try uploading different photos (JPEG/PNG work best)
• Ensure photos are clear and well-lit
• Check that faces are visible in the photos
• Try reducing the number of photos

🔧 Technical Info: Check browser console for detailed logs`);
                setCurrentStep('photoUpload');
                return;
            }

            const mappedAiPhotos = aiSelectedPhotosInfo.map(selectedInfo => {
                const originalUploadedPhoto = currentUploadedPhotos.find(p => p.id === selectedInfo.id);
                // Check for original photo AND a valid reason string.
                if (!originalUploadedPhoto || !selectedInfo.reason || typeof selectedInfo.reason !== 'string' || selectedInfo.reason.trim() === '') {
                    console.warn(`Skipping AI-selected photo due to missing data: ID=${selectedInfo.id}, Reason=${selectedInfo.reason}`);
                    return null;
                }
                return {
                    id: selectedInfo.id,
                    objectURL: originalUploadedPhoto.objectURL,
                    reason: selectedInfo.reason,
                    originalFileName: originalUploadedPhoto.file.name,
                };
            }).filter(p => p !== null) as SelectedPhoto[];

            const targetPhotoCount = Math.min(NUM_PHOTOS_TO_SELECT, currentUploadedPhotos.length);
            
            // This single check replaces the fallback logic and verifies the AI result is complete and valid.
            if (mappedAiPhotos.length < targetPhotoCount) {
                console.error(`AI selection and mapping resulted in ${mappedAiPhotos.length} valid photos, but expected ${targetPhotoCount}.`);
                setError("The AI failed to provide a complete and valid analysis for your photos. This can be due to image quality or a temporary API issue. Please try again with different photos.");
                setCurrentStep('photoUpload');
                return;
            }
            
            finalSelectedPhotosForMockup = mappedAiPhotos.slice(0, targetPhotoCount);
            console.log("Final photos selected (pre-enhancement):", finalSelectedPhotosForMockup);

        } else {
            console.log("No photos uploaded, skipping photo selection.");
            finalSelectedPhotosForMockup = [];
        }

        try {
          setLoadingMessage("Crafting your bio...");
          // No refinement settings for initial generation
          let generatedBioText = await withTimeout(
            generateBioFromAnswers(currentAnswers, undefined, undefined),
            45000,
            'Bio generation'
          );
          console.log("--- Step 3: Bio received from service ---");
          console.log("Generated Bio Text:", generatedBioText);
          
          newBio = generatedBioText || "Could not generate a bio based on the answers. Please try again.";
          
          const newProfile: GeneratedProfile = {
            bio: newBio,
            selectedPhotos: finalSelectedPhotosForMockup,
            userName: currentAnswers.q0_name as string || "User",
            userAge: currentAnswers.q0_age as string || undefined,
          };

          console.log("--- Step 4: Setting generatedProfile state ---", newProfile);
          setGeneratedProfile(newProfile);
          setCurrentStep('preliminaryResults');

        } catch (err) {
          console.error("Profile generation failed:", err);
          const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during profile generation.";
          setError(errorMessage);
          
          setGeneratedProfile({
            bio: `Error generating profile: ${errorMessage}.`,
            selectedPhotos: finalSelectedPhotosForMockup,
            userName: currentAnswers.q0_name as string || "User",
            userAge: currentAnswers.q0_age as string || undefined,
          });

          setCurrentStep('preliminaryResults'); 
        }
    } finally {
        if (analyzingWatchdogId !== null) {
          window.clearTimeout(analyzingWatchdogId);
          analyzingWatchdogId = null;
        }
        clearInterval(progressInterval);
        // Finalize determinate phase at 100% and immediately unmount loader
        setGenerationProgress(100);
        setIsLoading(false);
        // Cleanup progress on the next tick (loader already unmounted)
        setTimeout(() => {
            setGenerationProgress(null);
        }, 0);
    }
  };

  const handleEssentialQuestionnaireComplete = useCallback(async (answers: QuestionnaireAnswers) => {
    console.log("--- Step 1: handleEssentialQuestionnaireComplete called ---");
    setEssentialAnswers(answers);
    setCurrentStep('photoUpload');
    setError(null);
  }, []);

  const handlePhotosSubmitted = useCallback(async (photos: UploadedPhoto[]) => {
    console.log("--- Step 1b: Photos submitted ---", photos);
    setUploadedPhotos(photos);
    await generateProfileData(essentialAnswers, false, photos);
  }, [essentialAnswers]);

  const handleModalRefinementComplete = useCallback(async (settings: RefinementSettings) => {
    setIsRefinementModalOpen(false);
    setCurrentRefinementSettings(settings); // Store the refinement settings
    await generateProfileData(essentialAnswers, true, uploadedPhotos, settings);
  }, [essentialAnswers, uploadedPhotos, generatedProfile]);

  const handleEnhanceAllPhotos = useCallback(async () => {
    if (isEnhancing || !generatedProfile || !generatedProfile.selectedPhotos.length) return;
    setError(null);
    const enhancementErrors: string[] = [];
    const photosToEnhance = generatedProfile.selectedPhotos.filter(p => !p.enhancedObjectURL);

    if (photosToEnhance.length === 0) {
        console.log("No photos to enhance.");
        return;
    }
    
    setIsEnhancing(true);
    setEnhancementProgress(0);
    const totalToEnhance = photosToEnhance.length;
    const uploadProgressWeight = 90;
    const preloadProgressWeight = 10;
    let completedUploads = 0;
    console.log(`Starting bulk enhancement for ${totalToEnhance} photos.`);

    const uploadPromises = photosToEnhance.map(photo => {
        const originalUploadedPhoto = uploadedPhotos.find(p => p.id === photo.id);
        if (!originalUploadedPhoto) {
            return Promise.resolve({
                status: 'rejected' as const,
                reason: { fileName: photo.originalFileName, reason: new Error("Could not find the original photo file to enhance.") }
            });
        }
        return uploadAndEnhanceImage(originalUploadedPhoto.file)
            .then(result => ({ status: 'fulfilled' as const, value: { id: photo.id, enhancedUrl: result.enhanced } }))
            .catch(err => ({ status: 'rejected' as const, reason: { fileName: photo.originalFileName, reason: err } }))
            .finally(() => {
                completedUploads++;
                setEnhancementProgress(Math.round((completedUploads / totalToEnhance) * uploadProgressWeight));
            });
    });

    const results = await Promise.all(uploadPromises);
    const enhancedUrlMap = new Map<string, string>();
    results.forEach(result => {
        if (result.status === 'fulfilled') {
            enhancedUrlMap.set(result.value.id, result.value.enhancedUrl);
        } else {
            console.error(`Enhancement failed for ${result.reason.fileName}:`, result.reason.reason);
            enhancementErrors.push(`Failed to enhance: ${result.reason.fileName}.`);
        }
    });
    
    const urlsToPreload = Array.from(enhancedUrlMap.values());
    if (urlsToPreload.length > 0) {
        console.log("Preloading enhanced images...");
        let preloadedCount = 0;
        const preloadPromises = urlsToPreload.map(url => {
            return new Promise<void>((resolve) => {
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    preloadedCount++;
                    const preloadProgress = (preloadedCount / urlsToPreload.length) * preloadProgressWeight;
                    setEnhancementProgress(uploadProgressWeight + Math.round(preloadProgress));
                    resolve();
                };
                img.onerror = () => {
                    console.warn(`Failed to preload image: ${url}`);
                    preloadedCount++;
                    const preloadProgress = (preloadedCount / urlsToPreload.length) * preloadProgressWeight;
                    setEnhancementProgress(uploadProgressWeight + Math.round(preloadProgress));
                    resolve(); 
                };
            });
        });
        await Promise.all(preloadPromises);
        console.log("Image preloading complete.");
    }

    if (enhancementErrors.length > 0) {
        setError(prev => prev ? `${prev}\n${enhancementErrors.join('\n')}` : enhancementErrors.join('\n'));
    }
    
    setGeneratedProfile(currentProfile => {
        if (!currentProfile) return null;
        const updatedPhotos = currentProfile.selectedPhotos.map(p => {
            if (enhancedUrlMap.has(p.id)) {
                return { ...p, enhancedObjectURL: enhancedUrlMap.get(p.id) };
            }
            return p;
        });
        return { ...currentProfile, selectedPhotos: updatedPhotos };
    });
    
    setTimeout(() => {
        setIsEnhancing(false);
        setEnhancementProgress(null);
    }, 500); 

  }, [isEnhancing, generatedProfile, uploadedPhotos]);

  const handleRegenerateBio = useCallback(async (tone?: string) => {
    if (isBioLoading || !generatedProfile) return;

    setIsBioLoading(true);
    setError(null);

    try {
      const newBio = await generateBioFromAnswers(essentialAnswers, tone);
      setGeneratedProfile(prev => {
        if (!prev) return null;
        return { ...prev, bio: newBio };
      });
    } catch (err) {
      console.error("Bio regeneration failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during bio regeneration.";
      setError(errorMessage);
    } finally {
      setIsBioLoading(false);
    }
  }, [isBioLoading, generatedProfile, essentialAnswers, currentStep]);

  const handleChatBioRefine = useCallback(async (feedback: string) => {
    if (chatRefinementCount >= 2 || !generatedProfile || isBioLoading) return;

    setIsBioLoading(true);
    setError(null);
    try {
      const newBio = await refineBioWithChatFeedback(generatedProfile.bio, feedback, currentRefinementSettings);
      setGeneratedProfile(prev => {
        if (!prev) return null;
        return { ...prev, bio: newBio };
      });
      setChatRefinementCount(prev => prev + 1);
    } catch (err) {
      console.error("Chat bio refinement failed:", err);
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during chat bio refinement.";
      setError(errorMessage);
    } finally {
      setIsBioLoading(false);
    }
  }, [chatRefinementCount, generatedProfile, isBioLoading, currentRefinementSettings]);


  const handleReset = useCallback(() => {
    setCurrentStep('welcome');
    setEssentialAnswers({});
    setUploadedPhotos([]);
    setGeneratedProfile(null);
    setError(null);
    setIsLoading(false);
    setIsEnhancing(false);
    setEnhancementProgress(null);
    setGenerationProgress(null);
    setIsBioLoading(false);
    setIsRefinementModalOpen(false);
    setChatRefinementCount(0);
    setCurrentRefinementSettings(undefined);
  }, []);
  
  const renderStep = () => {
    if (isLoading) {
        return <LoadingSpinner message={loadingMessage} progress={generationProgress} />;
    }

    switch (currentStep) {
      case 'welcome':
        return <WelcomeScreen onStart={handleStart} />;
      case 'essentialQuestionnaire':
        return (
          <QuestionnaireForm
            questions={ESSENTIAL_QUESTIONS}
            onSubmit={handleEssentialQuestionnaireComplete}
            initialAnswers={essentialAnswers}
            title="Let's Start with the Essentials"
            submitButtonText="Next: Upload Photos" 
            totalQuestions={ESSENTIAL_QUESTIONS.length}
            baseQuestionIndex={0}
            onReset={handleReset}
          />
        );
      case 'photoUpload': 
        return (
          <PhotoUploadForm
            onSubmit={handlePhotosSubmitted}
            maxPhotos={MAX_UPLOAD_PHOTOS}
            numToSelect={NUM_PHOTOS_TO_SELECT}
          />
        );
      case 'analyzingPreliminary':
      case 'analyzingFinal':
        // Always render the spinner during analyzing steps; progress may be determinate or fallback.
        return <LoadingSpinner message={loadingMessage} progress={generationProgress} />;
      case 'preliminaryResults':
      case 'finalResults':
        if (generatedProfile) {
          console.log("--- Step 5: Rendering GeneratedProfileView ---");
          return (
            <GeneratedProfileView
              profile={generatedProfile}
              onReset={handleReset}
              isPreliminary={currentStep === 'preliminaryResults'}
              onEnhanceAllPhotos={handleEnhanceAllPhotos}
              isEnhancing={isEnhancing}
              enhancementProgress={enhancementProgress}
              onRegenerateBio={handleRegenerateBio}
              isBioLoading={isBioLoading}
              onOpenRefinementModal={() => setIsRefinementModalOpen(true)}
              onChatBioRefine={handleChatBioRefine}
              chatRefinementCount={chatRefinementCount}
            />
          );
        }
        if (!error) setError("Failed to display profile. Data is missing. Please try starting over.");
        return <Alert message={error || "Profile data is unavailable. Please start over."} type="error" onClose={handleReset}/>;
      
      default:
        return <WelcomeScreen onStart={handleStart} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-slate-100 flex flex-col items-center p-2 sm:p-4 selection:bg-purple-500 selection:text-white">
      <main className="container mx-auto max-w-6xl w-full flex-grow bg-slate-800 bg-opacity-70 backdrop-blur-md shadow-2xl rounded-xl p-6 md:p-10 my-4">
        <Header />
        {error && (
          <Alert message={error} type="error" onClose={() => setError(null)} />
        )}
        {renderStep()}
      </main>
      <RefinementModal 
        isOpen={isRefinementModalOpen}
        onClose={() => setIsRefinementModalOpen(false)}
        onSubmit={handleModalRefinementComplete}
      />
      <footer className="text-center text-sm text-slate-400 py-4">
        <p>&copy; {new Date().getFullYear()} FlameEnhancer.</p>
        <p className="text-xs mt-1">Disclaimer: This tool provides suggestions and is for entertainment purposes. Profile changes are user's own responsibility.</p>
      </footer>
    </div>
  );
};

export default App;
import { SelectedPhoto } from '../types';
import { downsizeImage } from '../utils/imageProcessor';

const CLOUD_NAME = 'ddyevx5fl';
const UPLOAD_PRESET = 'magify';

/**
 * Uploads an image to Cloudinary and returns URLs for original and enhanced versions.
 * The enhancement is applied via a URL transformation.
 * @param file The image file to upload.
 * @returns An object with original and enhanced secure URLs.
 */
export const uploadAndEnhanceImage = async (file: File): Promise<{ original: string; enhanced: string; }> => {
  console.log(`[cloudinaryService] Initiating image upload for file: ${file.name} (Size: ${file.size} bytes)`);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

  console.log(`[cloudinaryService] Preparing to POST to: ${cloudinaryUrl}`);
  console.log(`[cloudinaryService] FormData contains: file object, upload_preset ('${UPLOAD_PRESET}')`);

  const response = await fetch(cloudinaryUrl, {
    method: 'POST',
    body: formData,
  });

  console.log(`[cloudinaryService] Received response from Cloudinary with status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorData = await response.json();
    console.error('[cloudinaryService] Cloudinary upload failed. Full error response:', errorData);
    const errorMessage = errorData?.error?.message || JSON.stringify(errorData.error) || 'An unknown Cloudinary error occurred.';
    throw new Error(`Cloudinary upload failed: ${errorMessage}`);
  }

  const data = await response.json();
  console.log('[cloudinaryService] Cloudinary upload successful. Full success response:', data);

  const originalUrl = data.secure_url;

  if (typeof originalUrl !== 'string' || !originalUrl) {
    console.error('[cloudinaryService] Cloudinary response did not include a secure_url:', data);
    throw new Error('Cloudinary upload succeeded but did not return a valid URL.');
  }

  console.log(`[cloudinaryService] Extracted original secure_url: ${originalUrl}`);

  // We will now construct the enhanced URL by inserting the new standard transformations
  // into the URL path.
  const transformations = [
    'e_enhance',
    'e_improve:100',
    'q_auto',
    'f_auto'
  ];
  // Note: 'dpr_auto' was removed as per request.
  const transformationString = transformations.join(',');

  const urlParts = originalUrl.split('/upload/');

  if (urlParts.length !== 2) {
    console.warn('[cloudinaryService] Could not construct enhanced URL from the Cloudinary response. The URL structure was unexpected. Returning the original, unenhanced URL.', originalUrl);
    return { original: originalUrl, enhanced: originalUrl };
  }

  const enhancedUrl = `${urlParts[0]}/upload/${transformationString}/${urlParts[1]}`;

  console.log(`Successfully constructed enhanced image URL: ${enhancedUrl}`);
  return { original: originalUrl, enhanced: enhancedUrl };
};


/**
 * Generic helper: insert transformation(s) into a Cloudinary delivery URL.
 * If the URL is not a standard Cloudinary upload URL, returns the original URL.
 */
export const buildTransformedUrl = (originalUrl: string, transformations: string[]): string => {
  try {
    const parts = originalUrl.split('/upload/');
    if (parts.length !== 2) {
      console.warn('[cloudinaryService] buildTransformedUrl: Unexpected URL format. Returning original URL.', originalUrl);
      return originalUrl;
    }
    const t = transformations.filter(Boolean).join(',');
    return `${parts[0]}/upload/${t}/${parts[1]}`;
  } catch (e) {
    console.warn('[cloudinaryService] buildTransformedUrl failed; returning original URL.', e);
    return originalUrl;
  }
};

/**
 * Build a bandwidth-conscious analysis URL for AI (limits width, JPEG, and quality).
 * Defaults to 640px width for mobile reliability.
 */
export const buildAnalysisUrl = (originalUrl: string, maxWidth: number = 640): string => {
  // Use c_limit to preserve aspect ratio while restricting max dimension
  return buildTransformedUrl(originalUrl, [
    'c_limit',
    `w_${Math.max(320, Math.floor(maxWidth))}`,
    'q_auto:good',
    'f_jpg'
  ]);
};

/**
 * Upload an image for AI analysis and return:
 * - original: original asset URL
 * - analysis: a transformed delivery URL suited for model ingestion (smaller width/quality)
 */
export const uploadForAnalysis = async (file: File, maxWidth: number = 640, onProgress?: (progress: number) => void): Promise<{ original: string; analysis: string; }> => {
    console.log(`[cloudinaryService] [analysis] Starting upload for ${file.name}, original size: ${file.size}`);

    const downsizedBlob = await downsizeImage(file, 1024, 1024);
    const downsizedFile = new File([downsizedBlob], file.name, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    console.log(`[cloudinaryService] [analysis] Downsized to: ${downsizedFile.size}`);


    // High-quality, but reasonably compressed, settings for the original upload
    const uploadPreset = 'magify'; // Assuming this is your general-purpose preset

    const formData = new FormData();
    formData.append('file', downsizedFile);
    formData.append('upload_preset', uploadPreset);

    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', cloudinaryUrl, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                const progress = (event.loaded / event.total) * 100;
                onProgress(progress);
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const data = JSON.parse(xhr.responseText);
                const originalUrl = data.secure_url;
                if (!originalUrl) {
                    reject(new Error('Cloudinary analysis upload succeeded but did not provide secure_url'));
                    return;
                }
                const analysisUrl = buildAnalysisUrl(originalUrl, maxWidth);
                console.log('[cloudinaryService] [analysis] URLs:', { originalUrl, analysisUrl });
                resolve({ original: originalUrl, analysis: analysisUrl });
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    const errorMessage = errorData?.error?.message || `Cloudinary error ${xhr.status}`;
                    console.error('[cloudinaryService] Direct Cloudinary upload failed:', {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        error: errorData
                    });
                    reject(new Error(`Cloudinary upload failed: ${errorMessage}`));
                } catch (e) {
                    reject(new Error(`Cloudinary upload failed with status ${xhr.status}: ${xhr.statusText}`));
                }
            }
        };

        xhr.onerror = () => {
            reject(new Error('Network error during Cloudinary upload.'));
        };

        xhr.send(formData);
    });
};


/**
 * A helper service to fetch a photo from its object URL, create a file, and then
 * call the Cloudinary enhancement service.
 * @param photo A SelectedPhoto object containing the objectURL and original file name.
 * @returns The secure URL of the enhanced image.
 */
export const enhancePhoto = async (
  photo: SelectedPhoto
): Promise<string> => {
  try {
    // Fetch the image data from the object URL
    const response = await fetch(photo.objectURL);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from object URL: ${response.statusText}`);
    }
    const blob = await response.blob();

    // Create a File object from the blob
    const file = new File([blob], photo.originalFileName, { type: blob.type });

    // Upload and get the enhanced URL
    const { enhanced } = await uploadAndEnhanceImage(file);
    
    return enhanced;
  } catch (error) {
    console.error("Error in enhancePhoto service:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during photo enhancement.";
    // Re-throw the error to be caught by the calling function
    throw new Error(`Failed to enhance photo: ${errorMessage}`);
  }
};

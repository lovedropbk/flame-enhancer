
import JSZip from 'jszip';
import { GeneratedProfile, SelectedPhoto } from '../types';

/**
 * Fetches a resource from a URL and returns it as a Blob.
 * This works for both remote URLs (http/https) and local Object URLs (blob:).
 * @param url The URL to fetch.
 * @returns A Promise that resolves to a Blob.
 */
const fetchBlob = async (url: string): Promise<Blob> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.blob();
};

/**
 * Extracts the file extension from a filename.
 * @param fileName The full name of the file (e.g., "photo.jpg").
 * @returns The file extension without the dot (e.g., "jpg"). Defaults to 'jpg'.
 */
const getFileExtension = (fileName: string): string => {
  const parts = fileName.toLowerCase().split('.');
  // Return the last part if it exists and is a reasonable length, otherwise default.
  return parts.length > 1 && parts[parts.length - 1].length < 5 ? parts.pop()! : 'jpg';
};

/**
 * Downloads a single enhanced/upscaled photo.
 * It automatically selects the highest available quality (upscaled > enhanced).
 * @param photo The selected photo object.
 */
export const downloadSinglePhoto = async (photo: SelectedPhoto) => {
  // Prioritize the highest quality URL available: upscaled, then enhanced.
  const urlToFetch = photo.enhancedObjectURL;
  if (!urlToFetch) {
    console.error("No enhanced URL available for this photo.", photo);
    throw new Error("This photo has not been enhanced yet.");
  }

  const blob = await fetchBlob(urlToFetch);
  const extension = getFileExtension(photo.originalFileName);
  // Sanitize filename and create a more descriptive name
  const safeOriginalName = photo.originalFileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `uplifted_${safeOriginalName}.${extension}`;
  
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadUrl;
  a.download = fileName;
  
  document.body.appendChild(a);
  a.click();
  
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};


/**
 * Creates a ZIP archive containing the user's generated bio and their highest-quality photos (upscaled or enhanced),
 * then triggers a download in the browser.
 * @param profile The generated profile data.
 */
export const downloadProfileAsZip = async (profile: GeneratedProfile) => {
  const zip = new JSZip();

  // 1. Add the bio to a text file
  zip.file("bio.txt", profile.bio || "No bio was generated.");

  // Filter for ONLY enhanced or upscaled photos
  const photosToZip = profile.selectedPhotos.filter(p => p.enhancedObjectURL);

  if (photosToZip.length === 0) {
      alert("No enhanced photos available to download. Please use the 'Magic Enhance' feature first.");
      throw new Error("No enhanced photos to zip.");
  }

  // 2. Fetch and add each photo to the zip, prioritizing highest quality.
  const photoPromises = photosToZip.map(async (photo, index) => {
    try {
      // Prioritize the highest quality URL available: upscaled, then enhanced.
      const urlToFetch = photo.enhancedObjectURL!;
      const blob = await fetchBlob(urlToFetch);
      
      const extension = getFileExtension(photo.originalFileName);
      const fileName = `photo_${index + 1}.${extension}`;
      
      zip.file(fileName, blob);
    } catch (error) {
      console.error(`Failed to download or add photo '${photo.originalFileName}' to zip:`, error);
      zip.file(
        `ERROR_downloading_photo_${index + 1}.txt`,
        `Could not download image: ${photo.originalFileName}\nURL: ${photo.enhancedObjectURL}\nError: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  await Promise.all(photoPromises);

  // 3. Generate the ZIP file as a blob
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: "DEFLATE",
    compressionOptions: {
      level: 9
    }
  });

  // 4. Trigger the download
  const downloadUrl = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadUrl;
  a.download = `${(profile.userName || 'Profile').replace(/\s+/g, '_')}_Uplift_Enhanced.zip`;
  
  document.body.appendChild(a);
  a.click();
  
  // 5. Clean up
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
};

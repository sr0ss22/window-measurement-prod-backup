import { createClient } from './client'; // Supabase client
import { v4 as uuidv4 } from 'uuid'; // For unique file names

// Lazy load Supabase client to avoid build-time issues
let supabase: ReturnType<typeof createClient> | null = null;
const getSupabase = () => {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
};

const BUCKET_NAME = 'window-files'; // Assuming this bucket exists

/**
 * Uploads a base64 data URL to Supabase Storage.
 * @param base64Data The base64 data URL (e.g., 'data:image/jpeg;base64,...').
 * @param folder The subfolder within the bucket (e.g., 'images', 'annotations').
 * @param userId The ID of the user uploading the file.
 * @returns The public URL of the uploaded file, or null if upload fails.
 */
export async function uploadBase64File(base64Data: string, folder: string, userId: string): Promise<string | null> {
  if (!base64Data) {
    return null;
  }

  const base64Content = base64Data.split(',')[1];
  const mimeType = base64Data.split(',')[0].split(':')[1].split(';')[0];
  const fileExtension = mimeType.split('/')[1] || 'bin'; // Default to 'bin' if no extension

  const fileName = `${userId}/${folder}/${uuidv4()}.${fileExtension}`;
  const path = `${fileName}`;

  try {
    const supabaseClient = getSupabase();
    const { data, error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .upload(path, decode(base64Content), {
        contentType: mimeType,
        upsert: true, // Overwrite if file exists (though UUID should prevent this)
      });

    if (error) {
      console.error(`Supabase Storage: Error uploading file to ${BUCKET_NAME}/${path}:`, error);
      return null;
    }

    // Get public URL
    const { data: publicUrlData } = supabaseClient.storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);

    return publicUrlData.publicUrl;

  } catch (e) {
    console.error('Supabase Storage: Exception during file upload:', e);
    return null;
  }
}

/**
 * Downloads a file from a public URL.
 * @param publicUrl The public URL of the file.
 * @returns The base64 data URL of the downloaded file, or null if download fails.
 */
export async function downloadFileAsBase64(publicUrl: string): Promise<string | null> {
  if (!publicUrl) {
    return null;
  }

  try {
    const response = await fetch(publicUrl);
    if (!response.ok) {
      console.error(`Supabase Storage: Error downloading file from ${publicUrl}: ${response.statusText}`);
      return null;
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = (e) => {
        console.error("Supabase Storage: FileReader error during download:", e);
        reject(e);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Supabase Storage: Exception during file download:', e);
    return null;
  }
}

/**
 * Deletes a file from Supabase Storage.
 * @param filePath The path of the file within the bucket (e.g., 'user_id/images/uuid.jpeg').
 * @returns True if deletion is successful, false otherwise.
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  if (!filePath) {
    return true; // Already no file to delete
  }

  // Extract path relative to the bucket
  // Example: "https://dntfkxqtnwijuskdpkhq.supabase.co/storage/v1/object/public/window-files/user_id/images/uuid.jpeg"
  // Should become "user_id/images/uuid.jpeg"
  const urlParts = filePath.split(`${BUCKET_NAME}/`);
  const relativePath = urlParts.length > 1 ? urlParts[1] : filePath; // Handle both public URL and direct path

  try {
    const supabaseClient = getSupabase();
    const { error } = await supabaseClient.storage
      .from(BUCKET_NAME)
      .remove([relativePath]);

    if (error) {
      console.error(`Supabase Storage: Error deleting file from ${BUCKET_NAME}/${relativePath}:`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Supabase Storage: Exception during file deletion:', e);
    return false;
  }
}

// Helper to decode base64 string to ArrayBuffer
function decode(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}
import { put, del } from '@vercel/blob';
import { AppError } from './errors';
import { ValidationError } from '@/lib/validation';
import { FILE_TYPES, FILE_SIZE_LIMITS, validateFiles } from './validation/file-schemas';
import { validationMessages } from '@/lib/validation-messages';

/**
 * File constraints for Antrag attachments
 * Using centralized FILE_SIZE_LIMITS constants
 */

/**
 * Allowed file types for Antrag attachments
 * Using centralized file type configuration
 */
export const ALLOWED_ANTRAG_FILE_TYPES = FILE_TYPES.ANTRAG;

/**
 * Get a user-friendly list of allowed file extensions
 */
export function getAllowedFileExtensions(): string {
  const extensions = [
    'jpg', 'jpeg', 'png', 'gif', // Images
    'pdf', // PDF
    'doc', 'docx', // Word
    'xls', 'xlsx' // Excel
  ];
  return extensions.join(', ');
}

/**
 * Sleep for a specified duration
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Validates files for Antrag attachments
 * Uses centralized validation with custom total size check
 *
 * @param files - Array of files to validate
 * @returns void if valid, throws ValidationError if invalid
 */
export function validateAntragFiles(files: File[]): void {
  if (!files || files.length === 0) {
    return; // No files to validate
  }

  // Use centralized validation for file count, individual file size, and file types
  const validationResult = validateFiles(
    files,
    FILE_SIZE_LIMITS.ANTRAG_COUNT,
    FILE_SIZE_LIMITS.ANTRAG,
    FILE_TYPES.ANTRAG
  );

  // Handle basic validation errors
  if (!validationResult.isValid && validationResult.errors) {
    throw new ValidationError({
      files: validationResult.errors[0] || validationMessages.required('files')
    });
  }

  // Add custom total size validation (not covered by centralized helper)
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  if (totalSize > FILE_SIZE_LIMITS.ANTRAG_TOTAL) {
    const maxSizeMB = FILE_SIZE_LIMITS.ANTRAG_TOTAL / (1024 * 1024);
    throw new ValidationError({
      files: validationMessages.fileSizeExceeds('files', maxSizeMB)
    });
  }
}

/**
 * Uploads multiple files for Antrag attachments with retry capability
 * 
 * @param files - Array of files to upload
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Base delay in ms between retries (default: 1000)
 * @returns Array of uploaded file URLs
 * @throws ValidationError if validation fails, AppError if upload fails
 */
export async function uploadAntragFiles(
  files: File[],
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<string[]> {
  // Validate files first
  validateAntragFiles(files);

  // Skip if no files
  if (!files || files.length === 0) {
    return [];
  }

  const uploadedUrls: string[] = [];
  const timestamp = new Date().getTime();

  try {
    // Upload each file sequentially with retry logic
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const sanitizedFileName = file.name.replace(/\s+/g, '-');
      const blobPathname = `antraege/${timestamp}-${i}-${sanitizedFileName}`;

      let attempt = 0;
      let uploaded = false;

      while (attempt <= maxRetries && !uploaded) {
        try {
          if (attempt > 0) {
            console.log(`🔄 Retrying upload for file ${i + 1}/${files.length} (attempt ${attempt}/${maxRetries})...`);
          }

          const arrayBuffer = await file.arrayBuffer();
          const blob = new Blob([arrayBuffer], { type: file.type });

          const { url } = await put(blobPathname, blob, {
            access: 'public',
            contentType: file.type,
            addRandomSuffix: false,
            cacheControlMaxAge: 31536000, // Cache for 1 year
          });

          uploadedUrls.push(url);
          uploaded = true;
          console.log(`✅ File ${i + 1}/${files.length} uploaded successfully to: ${url}`);
        } catch (error) {
          console.error(`❌ Upload attempt ${attempt + 1}/${maxRetries + 1} failed for file ${i + 1}:`, error);

          if (attempt >= maxRetries) {
            // Clean up any successfully uploaded files before throwing
            if (uploadedUrls.length > 0) {
              console.log('🧹 Cleaning up successfully uploaded files after failure...');
              await deleteAntragFiles(uploadedUrls).catch(deleteError => {
                console.error('Failed to clean up uploaded files:', deleteError);
              });
            }

            throw AppError.fileUpload(
              `Fehler beim Hochladen der Datei "${file.name}". Bitte versuchen Sie es später erneut.`
            );
          }

          // Wait before retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`⏳ Waiting ${delay}ms before retry...`);
          await sleep(delay);
          attempt++;
        }
      }
    }

    return uploadedUrls;
  } catch (error) {
    // Re-throw ValidationError or AppError
    if (error instanceof ValidationError || error instanceof AppError) {
      throw error;
    }

    // Clean up any successfully uploaded files before throwing generic error
    if (uploadedUrls.length > 0) {
      console.log('🧹 Cleaning up successfully uploaded files after unexpected error...');
      await deleteAntragFiles(uploadedUrls).catch(deleteError => {
        console.error('Failed to clean up uploaded files:', deleteError);
      });
    }

    console.error('❌ Unexpected error uploading Antrag files:', error);
    throw AppError.fileUpload(
      'Fehler beim Hochladen der Dateien. Bitte versuchen Sie es später erneut.'
    );
  }
}

/**
 * Delete files from Vercel Blob Storage with retry capability
 * 
 * @param urls - Array of URLs to delete
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Base delay in ms between retries (default: 1000)
 * @returns Object containing success status and deleted URLs
 */
export async function deleteAntragFiles(
  urls: string[],
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<{ success: boolean; deletedUrls: string[] }> {
  if (!urls || urls.length === 0) {
    return { success: true, deletedUrls: [] };
  }

  let attempt = 0;
  const deletedUrls: string[] = [];
  let remainingUrls = [...urls];

  console.log(`🗑️ Attempting to delete ${urls.length} Antrag files from blob storage`);

  while (attempt <= maxRetries && remainingUrls.length > 0) {
    try {
      if (attempt > 0) {
        console.log(`🔄 Retrying file deletion (attempt ${attempt}/${maxRetries})...`);
      }

      // Delete the remaining files
      await del(remainingUrls);

      // If we get here, all remaining files were deleted successfully
      deletedUrls.push(...remainingUrls);
      remainingUrls = [];

      console.log('✅ Antrag files deleted successfully');
      return { success: true, deletedUrls };
    } catch (error) {
      console.error(`❌ File deletion attempt ${attempt + 1}/${maxRetries + 1} failed:`, error);

      // If we've reached max retries, return partial success
      if (attempt >= maxRetries) {
        console.error('Maximum retries exceeded for Antrag file deletion');
        return { 
          success: false, 
          deletedUrls
        };
      }

      // Otherwise, wait and retry with exponential backoff
      const delay = retryDelay * Math.pow(2, attempt);
      console.log(`⏳ Waiting ${delay}ms before retry...`);
      await sleep(delay);
      attempt++;
    }
  }

  // This should only be reached if all retries failed
  return { 
    success: deletedUrls.length === urls.length,
    deletedUrls
  };
}
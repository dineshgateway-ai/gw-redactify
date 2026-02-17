import axios from 'axios';

// Use a relative path to hit the Vite proxy configured in vite.config.ts
const API_ROOT = '/api';

export interface Dataroom {
  id: string;
  name: string;
  realm_id: string;
}

// Define the structure of the document/folder object expected from the API
export interface Document {
  id: string;
  filename: string;
  name?: string;           // Common field name
  original_name?: string;  // Previously used
  original_filename?: string; // Another common variation
  uploadDate: string;
  size: number; // in bytes
  boxPath: string;
  isFolder: boolean;
  children?: Document[];
  redactedContent?: string; 
  pdfUrl?: string; 
}

/**
 * Fetches the list of all datarooms for a given realm ID.
 * @param realmId The ID of the realm to fetch datarooms for.
 * @returns A promise that resolves to an array of Dataroom objects.
 */
export const fetchDatarooms = async (realmId: string): Promise<Dataroom[]> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/dataroom/`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching datarooms:', error);
    return [];
  }
};

/**
 * Fetches the list of all documents and folders for a given realm ID and dataroom ID.
 * @param realmId The ID of the realm.
 * @param dataroomId The ID of the dataroom.
 * @returns A promise that resolves to an array of Document objects.
 */
export const fetchDocuments = async (realmId: string, dataroomId: string): Promise<Document[]> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/document?listing=all`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching documents:', error);
    return [];
  }
};

/**
 * Fetches the file URL for a given document.
 * @param realmId The ID of the realm.
 * @param dataroomId The ID of the dataroom.
 * @param documentId The ID of the document.
 * @returns A promise that resolves to the file URL string.
 */
export const fetchFileUrl = async (realmId: string, dataroomId: string, documentId: string, original: boolean = false): Promise<string | null> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/document/${documentId}/file-url${original ? '?original=true' : ''}`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
      },
    });
    return response.data.file_url;
  } catch (error) {
    console.error('Error fetching file URL:', error);
    return null;
  }
};

/**
 * Fetches the document file as a Blob for local viewing with progress reporting.
 * @param realmId The ID of the realm.
 * @param dataroomId The ID of the dataroom.
 * @param documentId The ID of the document.
 * @param onProgress Callback for download progress.
 * @returns A promise that resolves to a Blob of the file content.
 */
export const fetchFileBlob = async (
  realmId: string,
  dataroomId: string,
  documentId: string,
  onProgress?: (progress: number) => void,
  original: boolean = false
): Promise<Blob | null> => {
  try {
    const fileUrl = await fetchFileUrl(realmId, dataroomId, documentId, original);
    if (!fileUrl) return null;

    const response = await axios.get(fileUrl, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        }
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching file blob:', error);
    return null;
  }
};

/**
 * Fetches the markdown representation of a document.
 * @param realmId The ID of the realm.
 * @param dataroomId The ID of the dataroom.
 * @param documentId The ID of the document.
 * @returns A promise that resolves to the markdown content string.
 */
export const fetchDocumentMarkdown = async (realmId: string, dataroomId: string, documentId: string): Promise<string> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/document/${documentId}/markdown`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
      },
    });
    // Assuming the response data is the markdown string directly or an object with a markdown property
    // If it's a string, return it. If it's an object, we might need response.data.markdown or similar.
    // Given the curl, it likely returns the markdown content.
    return typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2);
  } catch (error) {
    console.error('Error fetching document markdown:', error);
    return 'Loading the markdown content';
  }
};

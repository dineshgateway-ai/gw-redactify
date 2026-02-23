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
  
  // New fields from the API revamp
  realm_id?: string;
  created_at?: string;
  updated_at?: string;
  dataroom_id?: string;
  parent_document_id?: string;
  batch_id?: string;
  storage_id?: string;
  category?: string;
  subcategory?: string;
  document_type?: string;
  folder_type?: string;
  document_state?: string;
  summary?: string;
  source_storage_id?: string;
  document_count?: number;
}

/**
 * Fetches the list of all datarooms for a given realm ID.
 * @param realmId The ID of the realm to fetch datarooms for.
 * @param namespace The kubernetes namespace.
 * @returns A promise that resolves to an array of Dataroom objects.
 */
export const fetchDatarooms = async (realmId: string, namespace: string = 'gatewayai'): Promise<Dataroom[]> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/dataroom/`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Namespace': namespace,
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
 * @param namespace The kubernetes namespace.
 * @returns A promise that resolves to an array of Document objects.
 */
export const fetchDocuments = async (realmId: string, dataroomId: string, namespace: string = 'gatewayai'): Promise<Document[]> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/document?listing=all`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
        'X-Namespace': namespace,
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
 * @param original Whether to fetch the original file.
 * @param namespace The kubernetes namespace.
 * @returns A promise that resolves to the file URL string.
 */
export const fetchFileUrl = async (realmId: string, dataroomId: string, documentId: string, original: boolean = false, namespace: string = 'gatewayai'): Promise<string | null> => {
  try {
    const url = `${API_ROOT}/dataroom/v1/document/${documentId}/file-url${original ? '?original=true' : ''}`;
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
        'X-Namespace': namespace,
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
 * @param original Whether to fetch the original file.
 * @param namespace The kubernetes namespace.
 * @returns A promise that resolves to a Blob of the file content.
 */
export const fetchFileBlob = async (
  realmId: string,
  dataroomId: string,
  documentId: string,
  onProgress?: (progress: number) => void,
  original: boolean = false,
  namespace: string = 'gatewayai'
): Promise<Blob | null> => {
  try {
    const fileUrl = await fetchFileUrl(realmId, dataroomId, documentId, original, namespace);
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
 * @param original Whether to fetch the markdown of the original file.
 * @param anonymize Whether to fetch the anonymized version.
 * @param namespace The kubernetes namespace.
 * @returns A promise that resolves to the markdown content string.
 */
export const fetchDocumentMarkdown = async (realmId: string, dataroomId: string, documentId: string, original: boolean = false, anonymize: boolean = false, namespace: string = 'gatewayai'): Promise<string> => {
  try {
    const params = new URLSearchParams();
    if (original) params.append('original', 'true');
    if (anonymize) params.append('anonymize', 'true');
    
    const queryString = params.toString();
    const url = `${API_ROOT}/dataroom/v1/document/${documentId}/markdown${queryString ? '?' + queryString : ''}`;
    
    const response = await axios.get(url, {
      headers: {
        'X-Realm-Id': realmId,
        'X-Dataroom-Id': dataroomId,
        'X-Namespace': namespace,
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

/**
 * Builds a folder hierarchy from a flat list of documents based on category and subcategory.
 */
export const buildHierarchy = (docs: Document[]): Document[] => {
  const root: Document[] = [];
  const categories: Record<string, Document> = {};

  docs.forEach((doc) => {
    const catName = doc.category || 'Uncategorized';
    const subCatName = doc.subcategory || 'General';

    if (!categories[catName]) {
      categories[catName] = {
        id: `cat-${catName}`,
        filename: catName,
        name: catName,
        isFolder: true,
        children: [],
        uploadDate: '',
        size: 0,
        boxPath: catName,
      };
      root.push(categories[catName]);
    }

    const categoryFolder = categories[catName];
    let subCategoryFolder = categoryFolder.children?.find(c => c.name === subCatName);

    if (!subCategoryFolder) {
      subCategoryFolder = {
        id: `subcat-${catName}-${subCatName}`,
        filename: subCatName,
        name: subCatName,
        isFolder: true,
        children: [],
        uploadDate: '',
        size: 0,
        boxPath: `${catName}/${subCatName}`,
      };
      categoryFolder.children?.push(subCategoryFolder);
    }

    subCategoryFolder.children?.push(doc);
  });

  return root;
};

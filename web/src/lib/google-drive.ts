/**
 * Google Drive Client-Side Picker & File Streaming Engine.
 * Enables in-memory importation of files and whole folders from Google Drive without server uploads.
 */

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

export interface GoogleDriveConfig {
  clientId: string;
  apiKey: string;
}

const STORAGE_KEY_CLIENT_ID = 'docucraft_gdrive_client_id';
const STORAGE_KEY_API_KEY = 'docucraft_gdrive_api_key';

export function getSavedGoogleConfig(): GoogleDriveConfig {
  const envClientId = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';
  const envApiKey = (import.meta as any).env?.VITE_GOOGLE_API_KEY || '';

  const storedClientId = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_CLIENT_ID) || '' : '';
  const storedApiKey = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_API_KEY) || '' : '';

  return {
    clientId: storedClientId || envClientId,
    apiKey: storedApiKey || envApiKey,
  };
}

export function saveGoogleConfig(config: GoogleDriveConfig): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY_CLIENT_ID, config.clientId.trim());
    localStorage.setItem(STORAGE_KEY_API_KEY, config.apiKey.trim());
  }
}

/**
 * Loads the Google API client script and Google Identity Services script dynamically.
 */
export async function loadGoogleScripts(): Promise<void> {
  if (typeof window === 'undefined') return;

  const loadScript = (src: string, id: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (document.getElementById(id)) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      document.body.appendChild(script);
    });
  };

  await Promise.all([
    loadScript('https://apis.google.com/js/api.js', 'gapi-script'),
    loadScript('https://accounts.google.com/gsi/client', 'gis-script'),
  ]);

  // Initialize GAPI client & picker
  await new Promise<void>((resolve) => {
    window.gapi.load('picker', () => resolve());
  });
}

/**
 * Requests an OAuth 2.0 Access Token from Google Identity Services.
 */
export function requestGoogleAccessToken(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google Identity Services not initialized.'));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error !== undefined) {
          reject(response);
          return;
        }
        resolve(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export interface GoogleDriveSelectedDoc {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
}

/**
 * Opens the Google Drive Picker for single or multiple files / folders.
 */
export async function openGooglePicker(
  config: GoogleDriveConfig,
  accessToken: string,
  options: {
    mimeTypeFilter?: string; // e.g. 'application/pdf', 'image/*'
    title?: string;
  } = {}
): Promise<GoogleDriveSelectedDoc[]> {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.picker) {
      reject(new Error('Google Picker API not loaded.'));
      return;
    }

    const viewDocs = new window.google.picker.DocsView()
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    if (options.mimeTypeFilter) {
      if (options.mimeTypeFilter.includes('pdf')) {
        viewDocs.setMimeTypes('application/pdf,application/vnd.google-apps.folder');
      } else if (options.mimeTypeFilter.includes('image')) {
        viewDocs.setMimeTypes('image/png,image/jpeg,image/webp,application/vnd.google-apps.folder');
      }
    }

    const picker = new window.google.picker.PickerBuilder()
      .addView(viewDocs)
      .addView(new window.google.picker.DocsUploadView())
      .setOAuthToken(accessToken)
      .setDeveloperKey(config.apiKey)
      .setTitle(options.title || 'Select PDF documents or folders from Google Drive')
      .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
      .setCallback((data: any) => {
        if (data.action === window.google.picker.Action.PICKED) {
          const docs: GoogleDriveSelectedDoc[] = (data.docs || []).map((doc: any) => ({
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
            sizeBytes: doc.sizeBytes ? parseInt(doc.sizeBytes, 10) : undefined,
          }));
          resolve(docs);
        } else if (data.action === window.google.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build();

    picker.setVisible(true);
  });
}

/**
 * Parses Google Drive Link or File/Folder ID.
 */
export function parseGoogleDriveLink(inputUrl: string): {
  type: 'folder' | 'file' | 'unknown';
  id: string;
} | null {
  const url = inputUrl.trim();
  if (!url) return null;

  // Folder Match: https://drive.google.com/drive/folders/1aBcDeF...
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]{20,})/);
  if (folderMatch) {
    return { type: 'folder', id: folderMatch[1] };
  }

  // File Match: https://drive.google.com/file/d/1aBcDeF...
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fileMatch) {
    return { type: 'file', id: fileMatch[1] };
  }

  // Query Param Match: ?id=1aBcDeF...
  const queryMatch = url.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (queryMatch) {
    return { type: 'file', id: queryMatch[1] };
  }

  // Raw ID match
  if (/^[a-zA-Z0-9_-]{25,}$/.test(url)) {
    return { type: 'unknown', id: url };
  }

  return null;
}

/**
 * Recursively lists all files in a Google Drive folder with full pagination support.
 */
export async function listFilesInDriveFolder(
  folderId: string,
  apiKey: string,
  accessToken?: string,
  mimeFilter?: string
): Promise<GoogleDriveSelectedDoc[]> {
  const allFiles: GoogleDriveSelectedDoc[] = [];
  let pageToken: string | undefined = undefined;

  do {
    let query = `'${folderId}' in parents and trashed = false`;
    if (mimeFilter && mimeFilter.includes('pdf')) {
      query += ` and (mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.folder')`;
    }

    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query
    )}&fields=nextPageToken,files(id,name,mimeType,size)&pageSize=1000&key=${apiKey}`;

    if (pageToken) {
      url += `&pageToken=${encodeURIComponent(pageToken)}`;
    }

    const headers: HeadersInit = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const res = await fetch(url, { headers });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(
        errJson?.error?.message ||
          `Failed to access Google Drive folder (${res.status}). Ensure the link sharing is set to 'Anyone with the link can view'.`
      );
    }

    const data = await res.json();
    pageToken = data.nextPageToken;

    for (const item of data.files || []) {
      if (item.mimeType === 'application/vnd.google-apps.folder') {
        const subFiles = await listFilesInDriveFolder(item.id, apiKey, accessToken, mimeFilter);
        allFiles.push(...subFiles);
      } else {
        allFiles.push({
          id: item.id,
          name: item.name,
          mimeType: item.mimeType,
          sizeBytes: item.size ? parseInt(item.size, 10) : undefined,
        });
      }
    }
  } while (pageToken);

  return allFiles;
}

/**
 * Downloads a file from Google Drive directly into a browser File object in RAM.
 */
export async function downloadDriveFile(
  fileId: string,
  fileName: string,
  mimeType: string,
  apiKey: string,
  accessToken?: string
): Promise<File> {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(
      `Failed to download ${fileName} from Google Drive. Ensure the file sharing is set to 'Anyone with the link can view'.`
    );
  }

  const blob = await response.blob();
  return new File([blob], fileName, { type: mimeType || 'application/pdf' });
}

/**
 * Batch downloads selected Google Drive items into in-memory File objects.
 */
export async function fetchDriveFilesIntoMemory(
  selectedDocs: GoogleDriveSelectedDoc[],
  apiKey: string,
  accessToken?: string,
  mimeFilter?: string,
  onProgress?: (current: number, total: number, currentName: string) => void
): Promise<File[]> {
  const filesToDownload: GoogleDriveSelectedDoc[] = [];

  // Expand folders
  for (const doc of selectedDocs) {
    if (doc.mimeType === 'application/vnd.google-apps.folder') {
      const folderFiles = await listFilesInDriveFolder(doc.id, apiKey, accessToken, mimeFilter);
      filesToDownload.push(...folderFiles);
    } else {
      filesToDownload.push(doc);
    }
  }

  // Naturally sort items by name
  filesToDownload.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const downloadedFiles: File[] = [];
  const total = filesToDownload.length;

  for (let i = 0; i < total; i++) {
    const item = filesToDownload[i];
    if (onProgress) {
      onProgress(i + 1, total, item.name);
    }
    const file = await downloadDriveFile(item.id, item.name, item.mimeType, apiKey, accessToken);
    downloadedFiles.push(file);
  }

  return downloadedFiles;
}

/**
 * Imports files directly from a Google Drive File or Folder URL.
 */
export async function importFromDriveUrl(
  inputUrl: string,
  apiKey: string,
  accessToken?: string,
  mimeFilter?: string,
  onProgress?: (current: number, total: number, currentName: string) => void
): Promise<File[]> {
  const parsed = parseGoogleDriveLink(inputUrl);
  if (!parsed) {
    throw new Error('Invalid Google Drive link. Please paste a valid file or folder URL.');
  }

  // Check if it's a folder or file by attempting metadata fetch
  if (parsed.type === 'folder') {
    const files = await listFilesInDriveFolder(parsed.id, apiKey, accessToken, mimeFilter);
    if (files.length === 0) {
      throw new Error('No compatible files found in this Google Drive folder.');
    }
    return await fetchDriveFilesIntoMemory(files, apiKey, accessToken, mimeFilter, onProgress);
  }

  // File metadata check
  const metaUrl = `https://www.googleapis.com/drive/v3/files/${parsed.id}?fields=id,name,mimeType,size&key=${apiKey}`;
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(metaUrl, { headers });
  if (!res.ok) {
    // Fallback: try folder if type was unknown
    if (parsed.type === 'unknown') {
      try {
        const folderFiles = await listFilesInDriveFolder(parsed.id, apiKey, accessToken, mimeFilter);
        if (folderFiles.length > 0) {
          return await fetchDriveFilesIntoMemory(folderFiles, apiKey, accessToken, mimeFilter, onProgress);
        }
      } catch {}
    }
    throw new Error(
      `Could not retrieve Google Drive file details (${res.status}). Ensure the link sharing is set to 'Anyone with the link can view'.`
    );
  }

  const meta = await res.json();
  if (meta.mimeType === 'application/vnd.google-apps.folder') {
    const folderFiles = await listFilesInDriveFolder(meta.id, apiKey, accessToken, mimeFilter);
    return await fetchDriveFilesIntoMemory(folderFiles, apiKey, accessToken, mimeFilter, onProgress);
  }

  if (onProgress) {
    onProgress(1, 1, meta.name);
  }

  const file = await downloadDriveFile(meta.id, meta.name, meta.mimeType, apiKey, accessToken);
  return [file];
}

/**
 * Folder Scanner & Directory Traversal Engine for Browser Client-Side File Processing.
 * Supports recursive directory extraction, type filtering, and natural alphanumeric sorting.
 */

export interface ScannedFileItem {
  file: File;
  relativePath: string;
}

/**
 * Natural alphanumeric comparator (e.g. 1.pdf, 2.pdf, 10.pdf, 20.pdf).
 */
export function naturalSortFiles<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
  );
}

/**
 * Matches a file against an accept string pattern (e.g. 'application/pdf', 'image/*', 'image/png').
 */
export function isFileAccepted(file: File, acceptPattern?: string): boolean {
  if (!acceptPattern || acceptPattern === '*' || acceptPattern === '*/*') return true;

  const patterns = acceptPattern.split(',').map((p) => p.trim().toLowerCase());
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();

  return patterns.some((pattern) => {
    if (pattern.startsWith('.')) {
      return fileName.endsWith(pattern);
    }
    if (pattern.endsWith('/*')) {
      const prefix = pattern.replace('/*', '');
      return fileType.startsWith(prefix);
    }
    return fileType === pattern;
  });
}

/**
 * Recursively scans DataTransferItemList for files inside dropped directories.
 */
export async function scanDroppedEntries(
  dataTransferItems: DataTransferItemList,
  acceptPattern?: string
): Promise<File[]> {
  const files: File[] = [];
  const entries: any[] = [];

  for (let i = 0; i < dataTransferItems.length; i++) {
    const item = dataTransferItems[i];
    if (item.kind === 'file') {
      const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
      if (entry) {
        entries.push(entry);
      } else {
        const file = item.getAsFile();
        if (file && isFileAccepted(file, acceptPattern)) {
          files.push(file);
        }
      }
    }
  }

  for (const entry of entries) {
    await traverseEntry(entry, files, acceptPattern);
  }

  return naturalSortFiles(files);
}

async function traverseEntry(entry: any, fileList: File[], acceptPattern?: string): Promise<void> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          if (isFileAccepted(file, acceptPattern)) {
            fileList.push(file);
          }
          resolve();
        },
        () => resolve()
      );
    });
  } else if (entry.isDirectory) {
    const dirReader = entry.createReader();
    const readEntries = async (): Promise<void> => {
      return new Promise((resolve) => {
        dirReader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            resolve();
          } else {
            for (const childEntry of entries) {
              await traverseEntry(childEntry, fileList, acceptPattern);
            }
            await readEntries();
            resolve();
          }
        }, () => resolve());
      });
    };
    await readEntries();
  }
}

/**
 * Filters and naturally sorts files selected via <input webkitdirectory />.
 */
export function processDirectoryFileList(
  fileList: FileList | File[],
  acceptPattern?: string
): File[] {
  const arr = Array.from(fileList);
  const filtered = arr.filter((f) => isFileAccepted(f, acceptPattern));
  return naturalSortFiles(filtered);
}

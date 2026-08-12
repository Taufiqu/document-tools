import React, { useState, useEffect } from 'react';
import {
  X,
  HardDrive,
  Key,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderUp,
  Settings,
  Link as LinkIcon,
  DownloadCloud,
} from 'lucide-react';
import {
  getSavedGoogleConfig,
  saveGoogleConfig,
  loadGoogleScripts,
  requestGoogleAccessToken,
  openGooglePicker,
  fetchDriveFilesIntoMemory,
  importFromDriveUrl,
} from '@/lib/google-drive';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesImported: (files: File[]) => void;
  acceptMimeType?: string; // e.g. 'application/pdf'
}

type ActiveTab = 'link' | 'picker';

export function GoogleDriveModal({
  isOpen,
  onClose,
  onFilesImported,
  acceptMimeType = 'application/pdf',
}: GoogleDriveModalProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('link');
  const [driveUrl, setDriveUrl] = useState('');

  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showConfig, setShowConfig] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedGoogleConfig();
      setClientId(saved.clientId);
      setApiKey(saved.apiKey);
      setErrorMessage('');
      setStatusMessage('');
      setIsLoading(false);
      setDriveUrl('');
      // If no API key configured, show config
      if (!saved.apiKey) {
        setShowConfig(true);
      } else {
        setShowConfig(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 1. Handle Import from Direct Link (File or Folder)
  const handleImportByUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrl.trim()) return;

    const currentConfig = getSavedGoogleConfig();
    const effectiveApiKey = apiKey.trim() || currentConfig.apiKey;

    if (!effectiveApiKey) {
      setShowConfig(true);
      setErrorMessage('Google API Key is required to fetch files.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStatusMessage('Resolving Google Drive link...');

    try {
      saveGoogleConfig({ clientId, apiKey: effectiveApiKey });
      const downloaded = await importFromDriveUrl(
        driveUrl,
        effectiveApiKey,
        undefined,
        acceptMimeType,
        (curr, total, name) => {
          setStatusMessage(`Downloading file ${curr} of ${total}: ${name}`);
        }
      );

      setIsLoading(false);
      onFilesImported(downloaded);
      onClose();
    } catch (err: any) {
      console.error('Link import error:', err);
      setErrorMessage(
        err?.message ||
          'Failed to import from link. Make sure the file or folder is set to "Anyone with the link can view".'
      );
      setIsLoading(false);
    }
  };

  // 2. Handle Browse with Google Picker
  const handleStartDrivePicker = async () => {
    const currentConfig = getSavedGoogleConfig();
    const effectiveClientId = clientId.trim() || currentConfig.clientId;
    const effectiveApiKey = apiKey.trim() || currentConfig.apiKey;

    if (!effectiveClientId || !effectiveApiKey) {
      setShowConfig(true);
      setErrorMessage('Google Client ID and API Key are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStatusMessage('Connecting to Google Identity Services...');

    try {
      saveGoogleConfig({ clientId: effectiveClientId, apiKey: effectiveApiKey });
      await loadGoogleScripts();

      setStatusMessage('Waiting for Google Account authorization...');
      const accessToken = await requestGoogleAccessToken(effectiveClientId);

      setStatusMessage('Opening Google Drive Picker...');
      const pickedDocs = await openGooglePicker(
        { clientId: effectiveClientId, apiKey: effectiveApiKey },
        accessToken,
        {
          mimeTypeFilter: acceptMimeType,
          title: 'Select PDF files or folders from Google Drive',
        }
      );

      if (pickedDocs.length === 0) {
        setIsLoading(false);
        setStatusMessage('');
        return;
      }

      setStatusMessage(`Found ${pickedDocs.length} item(s). Streaming directly into RAM...`);
      const downloadedFiles = await fetchDriveFilesIntoMemory(
        pickedDocs,
        effectiveApiKey,
        accessToken,
        acceptMimeType,
        (curr, total, name) => {
          setStatusMessage(`Downloading file ${curr} of ${total}: ${name}`);
        }
      );

      setIsLoading(false);
      onFilesImported(downloadedFiles);
      onClose();
    } catch (err: any) {
      console.error('Google Drive error:', err);
      setErrorMessage(
        err?.message ||
          err?.details ||
          'Failed to connect to Google Drive. Please ensure your domain/localhost is added to Authorized JavaScript Origins.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-surface-200 border border-border rounded-xl p-6 shadow-elevated text-zinc-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-surface-100 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-surface-100 border border-border flex items-center justify-center text-zinc-100">
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Import from Google Drive</h3>
            <p className="text-xs text-zinc-400">Stream documents and entire folders directly to RAM</p>
          </div>
        </div>

        {/* Status / Loading view */}
        {isLoading ? (
          <div className="py-8 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
            <p className="text-xs font-mono text-zinc-300 text-center max-w-sm">{statusMessage}</p>
            <span className="text-[10px] text-zinc-500 font-mono">100% Client-Side Direct Memory Stream</span>
          </div>
        ) : (
          <div className="space-y-4">
            {errorMessage && (
              <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            )}

            {!showConfig ? (
              <div className="space-y-4">
                {/* Tabs */}
                <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-surface-100 border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('link')}
                    className={`py-1.5 rounded-md font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'link'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Paste Link / URL</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('picker')}
                    className={`py-1.5 rounded-md font-medium transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      activeTab === 'picker'
                        ? 'bg-zinc-800 text-white shadow-sm'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Browse Drive</span>
                  </button>
                </div>

                {/* Tab 1: Paste Link */}
                {activeTab === 'link' && (
                  <form onSubmit={handleImportByUrl} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-zinc-300 block">
                        Google Drive File or Folder Link
                      </label>
                      <div className="relative">
                        <input
                          type="url"
                          value={driveUrl}
                          onChange={(e) => setDriveUrl(e.target.value)}
                          placeholder="https://drive.google.com/drive/folders/... or file/d/..."
                          className="w-full px-3 py-2 text-xs rounded-lg bg-surface-100 border border-border text-white placeholder:text-zinc-500 focus:outline-none focus:border-zinc-400"
                          autoFocus
                          required
                        />
                      </div>
                      <p className="text-[10px] text-zinc-400 leading-relaxed">
                        Pastikan link diset ke <span className="text-zinc-200">"Anyone with the link can view"</span> (Siapa saja yang memiliki link).
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={!driveUrl.trim()}
                      className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle disabled:opacity-40"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      <span>Fetch & Import into RAM</span>
                    </button>
                  </form>
                )}

                {/* Tab 2: Google Picker */}
                {activeTab === 'picker' && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-surface-100 border border-border text-xs space-y-1.5">
                      <div className="flex items-center gap-2 text-white font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span>Interactive Google Drive Picker</span>
                      </div>
                      <p className="text-zinc-400 text-[11px] leading-relaxed">
                        Opens a pop-up window connected directly to your Google account to browse and pick documents or folders.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleStartDrivePicker}
                      className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
                    >
                      <FolderUp className="w-4 h-4" />
                      <span>Open Google Drive Window</span>
                    </button>
                  </div>
                )}

                <div className="pt-1 flex justify-between items-center text-[11px] text-zinc-500">
                  <span className="font-mono text-[10px]">100% Client-Side Direct Memory</span>
                  <button
                    onClick={() => setShowConfig(true)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <Settings className="w-3 h-3" />
                    <span>Credentials</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between pb-1 border-b border-border">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Google Cloud Credentials</span>
                  </span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1"
                  >
                    <span>Google Cloud Console</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Provide your OAuth 2.0 Web Client ID and Google API Key.
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-300 block">Google Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx.apps.googleusercontent.com"
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none focus:border-zinc-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-300 block">Google API Key (Picker & Drive API)</label>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-100 border border-border text-white text-xs font-mono focus:outline-none focus:border-zinc-400"
                  />
                </div>

                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => {
                      saveGoogleConfig({ clientId, apiKey });
                      setShowConfig(false);
                    }}
                    className="flex-1 py-2 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
                  >
                    <span>Save Credentials</span>
                  </button>

                  <button
                    onClick={() => setShowConfig(false)}
                    className="px-3 py-2 btn-secondary text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

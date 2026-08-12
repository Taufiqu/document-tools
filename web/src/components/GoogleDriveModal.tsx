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
} from 'lucide-react';
import {
  getSavedGoogleConfig,
  saveGoogleConfig,
  loadGoogleScripts,
  requestGoogleAccessToken,
  openGooglePicker,
  fetchDriveFilesIntoMemory,
} from '@/lib/google-drive';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilesImported: (files: File[]) => void;
  acceptMimeType?: string; // e.g. 'application/pdf'
}

export function GoogleDriveModal({
  isOpen,
  onClose,
  onFilesImported,
  acceptMimeType = 'application/pdf',
}: GoogleDriveModalProps) {
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
      if (!saved.clientId || !saved.apiKey) {
        setShowConfig(true);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveConfig = () => {
    saveGoogleConfig({ clientId, apiKey });
    setShowConfig(false);
  };

  const handleStartDrivePicker = async () => {
    if (!clientId.trim() || !apiKey.trim()) {
      setShowConfig(true);
      setErrorMessage('Google Client ID and API Key are required.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setStatusMessage('Initializing Google Identity Services...');

    try {
      saveGoogleConfig({ clientId, apiKey });
      await loadGoogleScripts();

      setStatusMessage('Authenticating with Google Account...');
      const accessToken = await requestGoogleAccessToken(clientId);

      setStatusMessage('Opening Google Drive Picker...');
      const pickedDocs = await openGooglePicker({ clientId, apiKey }, accessToken, {
        mimeTypeFilter: acceptMimeType,
        title: 'Select PDF files or folders from Google Drive',
      });

      if (pickedDocs.length === 0) {
        setIsLoading(false);
        setStatusMessage('');
        return;
      }

      setStatusMessage(`Found ${pickedDocs.length} items. Streaming into RAM...`);
      const downloadedFiles = await fetchDriveFilesIntoMemory(
        pickedDocs,
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
          'Failed to connect to Google Drive. Check your Client ID, API Key, and authorized origins.'
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
            <p className="text-xs text-zinc-400">Stream files and folders directly to RAM without server upload</p>
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
              <div className="space-y-3">
                <div className="p-3.5 rounded-lg bg-surface-100 border border-border text-xs space-y-2">
                  <div className="flex items-center gap-2 text-white font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Direct In-Memory Drive Integration</span>
                  </div>
                  <p className="text-zinc-400 text-[11px] leading-relaxed">
                    You can pick single PDF documents or entire Google Drive folders. All files will be fetched directly into your browser's RAM memory and sorted naturally.
                  </p>
                </div>

                <button
                  onClick={handleStartDrivePicker}
                  className="w-full py-2.5 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
                >
                  <FolderUp className="w-4 h-4" />
                  <span>Open Google Drive Picker</span>
                </button>

                <div className="pt-2 flex justify-between items-center text-[11px] text-zinc-500">
                  <span>Using configured Google OAuth credentials</span>
                  <button
                    onClick={() => setShowConfig(true)}
                    className="text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    Edit API Keys
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
                  To securely access your Google Drive from the browser, provide a standard Google OAuth 2.0 Web Client ID and Google Picker API Key (enabled in Google Cloud Console with your domain / localhost in Authorized JavaScript Origins).
                </p>

                <div className="space-y-1">
                  <label className="text-[11px] text-zinc-300 block">Google Client ID</label>
                  <input
                    type="text"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    placeholder="xxxx-xxxx.apps.googleusercontent.com"
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
                    onClick={handleStartDrivePicker}
                    className="flex-1 py-2 btn-primary text-xs flex items-center justify-center gap-2 cursor-pointer shadow-subtle"
                  >
                    <span>Save & Connect Drive</span>
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

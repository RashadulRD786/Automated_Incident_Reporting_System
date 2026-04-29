import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api from '../utils/api';

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
      {type === 'success' ? '✓' : '✕'} {message}
      <button onClick={onClose} className="ml-2 opacity-75 hover:opacity-100">×</button>
    </div>
  );
}

const SOURCE_LABELS = {
  manual:     { text: 'Manual',     style: 'bg-gray-100 text-gray-700' },
  uipath:     { text: 'UiPath',     style: 'bg-yellow-100 text-yellow-800' },
  text_paste: { text: 'Text Input', style: 'bg-gray-100 text-gray-700' },
};

const STATUS_CONFIG = {
  pending:    { dot: '●', label: 'Pending',      style: 'text-gray-500' },
  processing: { dot: '◌', label: 'Processing...', style: 'text-blue-600' },
  processed:  { dot: '✓', label: 'Processed',    style: 'text-green-600' },
  failed:     { dot: '✕', label: 'Failed',        style: 'text-red-600' },
};

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatTime(ts) {
  return new Date(ts * 1000).toLocaleString('en-MY', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [text, setText] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingText, setUploadingText] = useState(false);
  const [queue, setQueue] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const fetchQueue = useCallback(async () => {
    try {
      const { data } = await api.get('/uploads/queue');
      setQueue(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }

  async function handleFileUpload() {
    if (!selectedFile) return;
    setUploadingFile(true);
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      await api.post('/uploads/file', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showToast('File uploaded. Processing queued.');
      setSelectedFile(null);
      fetchQueue();
    } catch (err) {
      showToast(err.response?.data?.error || 'Upload failed', 'error');
    } finally {
      setUploadingFile(false);
    }
  }

  async function handleTextSubmit() {
    if (!text.trim()) return;
    setUploadingText(true);
    try {
      await api.post('/uploads/text', { text });
      showToast('Text submitted. Processing queued.');
      setText('');
      fetchQueue();
    } catch (err) {
      showToast(err.response?.data?.error || 'Submission failed', 'error');
    } finally {
      setUploadingText(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navbar />
      <main className="ml-60 flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Upload Raw Information</h1>
          <p className="text-gray-500 text-sm mt-1">Submit files or text for UiPath to process and classify</p>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* LEFT: Upload */}
          <div className="space-y-5">
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">Upload File</h2>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-gray-400'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                />
                {selectedFile ? (
                  <div className="space-y-1">
                    <div className="text-3xl">📄</div>
                    <p className="font-medium text-gray-800 text-sm">{selectedFile.name}</p>
                    <p className="text-gray-400 text-xs">{formatFileSize(selectedFile.size)}</p>
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                      className="text-xs text-red-500 hover:underline mt-1"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-4xl text-gray-300">↑</div>
                    <p className="text-gray-600 text-sm font-medium">Drop files here or click to browse</p>
                    <p className="text-gray-400 text-xs">Supported: PDF, DOCX, JPG, PNG</p>
                  </div>
                )}
              </div>

              {selectedFile && (
                <button
                  onClick={handleFileUpload}
                  disabled={uploadingFile}
                  className="w-full mt-3 bg-dhl-red text-white font-semibold py-2 rounded-md hover:bg-dhl-red-dark disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {uploadingFile ? (
                    <><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Uploading...</>
                  ) : 'Upload File'}
                </button>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 border-t border-gray-200" />
              <span className="text-gray-400 text-sm">— or —</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>

            {/* Text Paste */}
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-1">Paste Raw Text</h2>
              <p className="text-gray-400 text-xs mb-3">Phone notes, typed messages, email content</p>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="input-field resize-y"
                placeholder="Paste incident text here..."
              />
              <button
                onClick={handleTextSubmit}
                disabled={uploadingText || !text.trim()}
                className="w-full mt-3 border border-dhl-red text-dhl-red font-semibold py-2 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadingText ? 'Submitting...' : 'Submit Text'}
              </button>
            </div>
          </div>

          {/* RIGHT: Queue */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Processing Queue</h2>
                <p className="text-gray-400 text-xs mt-0.5">Auto-refreshes every 10 seconds</p>
              </div>
              <button onClick={fetchQueue} className="text-xs text-gray-400 hover:text-gray-600">⟳ Refresh</button>
            </div>

            {queue.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400 text-sm">
                No uploads yet. Upload a file to get started.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <th className="px-4 py-2 text-left">File / Source</th>
                      <th className="px-4 py-2 text-left">Type</th>
                      <th className="px-4 py-2 text-left">Time</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {queue.map((item) => {
                      const src = SOURCE_LABELS[item.source_type] || SOURCE_LABELS.manual;
                      const st = STATUS_CONFIG[item.processing_status] || STATUS_CONFIG.pending;
                      return (
                        <tr
                          key={item.id}
                          className={`hover:bg-gray-50 ${item.processing_status === 'processed' && item.incident_id ? 'cursor-pointer' : ''}`}
                          onClick={() => {
                            if (item.processing_status === 'processed' && item.incident_id) {
                              navigate(`/incidents/${item.incident_id}`);
                            }
                          }}
                          title={item.error_message || undefined}
                        >
                          <td className="px-4 py-2.5 max-w-[140px]">
                            <p className="truncate text-gray-700 text-xs font-medium">
                              {item.filename || 'Text Input'}
                            </p>
                            <span className={`inline-block mt-0.5 px-1.5 py-0.5 rounded-full text-xs ${src.style}`}>
                              {src.text}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-500 capitalize">
                            {item.content_type || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">
                            {formatTime(item.uploaded_at)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`flex items-center gap-1.5 text-xs font-medium ${st.style}`}>
                              {item.processing_status === 'processing' ? (
                                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : (
                                <span>{st.dot}</span>
                              )}
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

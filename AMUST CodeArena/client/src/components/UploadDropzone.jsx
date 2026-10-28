/**
 * components/UploadDropzone.jsx
 * ──────────────────────────────
 * Drag-and-drop file upload area for Teacher bulk problem import.
 * Accepts .xlsx and .csv files, max 5 MB.
 *
 * Props:
 *   onUpload   (file: File) => Promise<void>   called when the user picks a file
 *   isUploading boolean
 *   result     { imported, skipped, errors[] } | null
 */

import { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle } from 'lucide-react';

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTS = /\.(xlsx|csv)$/i;

export default function UploadDropzone({ onUpload, isUploading, result }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const [pickedFile, setPickedFile] = useState(null);

  function validate(file) {
    if (!ALLOWED_EXTS.test(file.name)) return 'Only .xlsx and .csv files are accepted.';
    if (file.size > MAX_SIZE) return 'File must be under 5 MB.';
    return null;
  }

  const handleFile = useCallback(
    (file) => {
      setFileError('');
      const err = validate(file);
      if (err) { setFileError(err); return; }
      setPickedFile(file);
      onUpload(file);
    },
    [onUpload]
  );

  function onInputChange(e) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-uploaded
    e.target.value = '';
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                    transition-colors select-none
                    ${dragOver ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-500'}
                    ${isUploading ? 'opacity-60 cursor-wait' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          onChange={onInputChange}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Importing {pickedFile?.name}…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            {dragOver ? (
              <Upload className="w-10 h-10 text-blue-400" />
            ) : (
              <FileSpreadsheet className="w-10 h-10 text-gray-500" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-200">
                {dragOver ? 'Drop to import' : 'Drop a spreadsheet here'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                or click to browse — .xlsx or .csv, max 5 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {/* File validation error */}
      {fileError && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-lg px-3 py-2">
          <X className="w-4 h-4 shrink-0" />
          {fileError}
        </div>
      )}

      {/* Import result */}
      {result && !isUploading && (
        <div className="rounded-lg border border-gray-700 overflow-hidden">
          {/* Summary row */}
          <div className="bg-gray-800/60 px-4 py-3 flex items-center gap-4 text-sm">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <span className="text-gray-200 font-medium">Import complete</span>
            <span className="text-green-400">{result.imported} imported</span>
            {result.skipped > 0 && (
              <span className="text-gray-500">{result.skipped} skipped</span>
            )}
            {result.errors?.length > 0 && (
              <span className="text-red-400">{result.errors.length} error(s)</span>
            )}
          </div>

          {/* Row-level errors */}
          {result.errors?.length > 0 && (
            <div className="px-4 py-3 space-y-2 max-h-48 overflow-y-auto">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Validation errors
              </p>
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  <span className="text-gray-400">
                    <span className="text-gray-300">Row {e.row}</span>
                    {e.title && ` — ${e.title}`}
                    {': '}
                    {Object.entries(e.issues ?? {})
                      .map(([f, msgs]) => `${f}: ${msgs.join(', ')}`)
                      .join(' | ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

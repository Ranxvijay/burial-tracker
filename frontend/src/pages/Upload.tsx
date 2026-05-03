import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import {
  Upload as UploadIcon, FileSpreadsheet, CheckCircle,
  AlertCircle, X, ChevronRight, Settings2, RefreshCw,
  MapPin, User, Hash, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { UploadPreview, ColumnMapping } from '../types';

type Step = 'select' | 'preview' | 'done';

const NONE = '__none__';

function ColSelect({
  label,
  icon,
  value,
  headers,
  onChange,
  allowNone,
}: {
  label: string;
  icon: React.ReactNode;
  value: string;
  headers: string[];
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
        {icon}
        {label}
      </label>
      <select
        value={value || NONE}
        onChange={e => onChange(e.target.value === NONE ? '' : e.target.value)}
        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-800"
      >
        {allowNone && <option value={NONE}>— not used —</option>}
        {headers.map(h => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
    </div>
  );
}

export default function UploadPage() {
  const [step, setStep] = useState<Step>('select');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping | null>(null);
  const [showMapper, setShowMapper] = useState(false);
  const [remapping, setRemapping] = useState(false);
  const [importResult, setImportResult] = useState<{ jobsImported: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      toast.error('Only Excel (.xlsx, .xls) and CSV files are supported');
      return;
    }
    setSelectedFile(file);
    setLoading(true);
    try {
      const result = await api.previewUpload(file);
      setPreview(result);
      setMapping(result.columnMapping);
      setStep('preview');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  async function applyRemap() {
    if (!preview || !mapping) return;
    setRemapping(true);
    try {
      const result = await api.remapUpload(preview.sessionId, mapping);
      setPreview(result);
      setMapping(result.columnMapping);
      toast.success('Column mapping applied');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Remap failed');
    } finally {
      setRemapping(false);
    }
  }

  async function handleConfirm() {
    if (!preview) return;
    setLoading(true);
    try {
      const result = await api.confirmUpload(preview.sessionId);
      setImportResult({ jobsImported: result.jobsImported });
      setStep('done');
      toast.success(result.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep('select');
    setPreview(null);
    setMapping(null);
    setImportResult(null);
    setSelectedFile(null);
    setShowMapper(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  function updateMapping(key: keyof ColumnMapping, value: string) {
    setMapping(prev => prev ? { ...prev, [key]: value } : prev);
  }

  const headers = preview?.detectedHeaders || [];
  const isCombined = mapping?.addressMode === 'combined';

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import technician job records from Excel or CSV</p>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {(['select', 'preview', 'done'] as Step[]).map((s, i) => {
          const stepIdx = ['select', 'preview', 'done'].indexOf(step);
          const isActive = step === s;
          const isDone = stepIdx > i;
          return (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
              <div className={`flex items-center gap-1.5 ${isActive ? 'text-brand-600 font-medium' : isDone ? 'text-green-600' : 'text-gray-400'}`}>
                <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center border ${
                  isActive ? 'border-brand-600 bg-brand-50' : isDone ? 'border-green-500 bg-green-50' : 'border-gray-300'
                }`}>
                  {isDone ? '✓' : i + 1}
                </span>
                {s === 'select' ? 'Select File' : s === 'preview' ? 'Map Columns' : 'Done'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── STEP: Select ── */}
      {step === 'select' && (
        <div className="space-y-4">
          <div
            onDrop={onDrop}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            className={`card p-12 flex flex-col items-center cursor-pointer transition-all border-2 border-dashed ${
              dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-brand-300 hover:bg-gray-50'
            }`}
          >
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileChange} />
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-brand-400 animate-spin" />
                <p className="text-gray-600 text-sm">Parsing file, detecting columns...</p>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 bg-brand-50 rounded-xl flex items-center justify-center mb-4">
                  <UploadIcon className="w-7 h-7 text-brand-500" />
                </div>
                <p className="text-gray-800 font-semibold">Drop your Excel or CSV file here</p>
                <p className="text-gray-500 text-sm mt-1">or click to browse</p>
                <p className="text-gray-400 text-xs mt-3">Supports .xlsx · .xls · .csv · Max 50MB</p>
              </>
            )}
          </div>

          {/* Format tip */}
          <div className="card p-5">
            <div className="flex items-start gap-3">
              <FileSpreadsheet className="w-5 h-5 text-brand-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 text-sm mb-1">Column auto-detection</p>
                <p className="text-sm text-gray-500">
                  The system automatically detects columns for Tech ID, Tech Name, Address, and Date — even with custom column names like
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mx-1">Primary Tech</span>,
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mx-1">Burial Crew</span>,
                  <span className="font-mono text-xs bg-gray-100 px-1 rounded mx-1">Crew Work Complete Date</span>.
                  You can adjust the mapping after upload if anything looks wrong.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP: Preview ── */}
      {step === 'preview' && preview && mapping && (
        <div className="space-y-4">
          {/* File info */}
          <div className="card p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {preview.validRows.toLocaleString()} valid records of {preview.totalRows.toLocaleString()} rows
                    {preview.dateRange.start && ` · ${preview.dateRange.start} to ${preview.dateRange.end}`}
                  </p>
                </div>
              </div>
              <button onClick={reset} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-gray-500" />
                <h3 className="font-semibold text-gray-900 text-sm">Column Mapping</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  isCombined ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {isCombined ? 'Combined Address' : 'Single Address Column'}
                </span>
              </div>
              <button
                onClick={() => setShowMapper(v => !v)}
                className="text-xs text-brand-600 hover:underline"
              >
                {showMapper ? 'Hide settings' : 'Change mapping'}
              </button>
            </div>

            {/* Current mapping summary (always visible) */}
            <div className="grid grid-cols-2 gap-3 text-sm mb-3">
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Tech ID:</span>
                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{mapping.techId}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Tech Name:</span>
                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{mapping.techName}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Address:</span>
                {isCombined ? (
                  <span className="font-mono text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">
                    {[mapping.addressStreetNo, mapping.addressStreetName, mapping.addressStreetType, mapping.addressMunicipality]
                      .filter(Boolean).join(' + ')}
                  </span>
                ) : (
                  <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{mapping.address}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-gray-500">Date:</span>
                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-medium">{mapping.date}</span>
              </div>
            </div>

            {/* Expanded mapping editor */}
            {showMapper && (
              <div className="border-t border-gray-100 pt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <ColSelect
                    label="Tech ID column"
                    icon={<Hash className="w-3.5 h-3.5" />}
                    value={mapping.techId}
                    headers={headers}
                    onChange={v => updateMapping('techId', v)}
                  />
                  <ColSelect
                    label="Tech Name column"
                    icon={<User className="w-3.5 h-3.5" />}
                    value={mapping.techName}
                    headers={headers}
                    onChange={v => updateMapping('techName', v)}
                  />
                  <ColSelect
                    label="Date column"
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    value={mapping.date}
                    headers={headers}
                    onChange={v => updateMapping('date', v)}
                  />
                </div>

                {/* Address mode toggle */}
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Address
                  </p>
                  <div className="inline-flex bg-gray-100 rounded-lg p-1 mb-3">
                    <button
                      onClick={() => setMapping(prev => prev ? { ...prev, addressMode: 'single' } : prev)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        !isCombined ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Single column
                    </button>
                    <button
                      onClick={() => setMapping(prev => prev ? { ...prev, addressMode: 'combined' } : prev)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        isCombined ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      Combine columns
                    </button>
                  </div>

                  {!isCombined ? (
                    <ColSelect
                      label="Address column"
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      value={mapping.address}
                      headers={headers}
                      onChange={v => updateMapping('address', v)}
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <ColSelect label="Street Number" icon={<Hash className="w-3 h-3" />} value={mapping.addressStreetNo || ''} headers={headers} onChange={v => updateMapping('addressStreetNo', v)} allowNone />
                      <ColSelect label="Street Name" icon={<MapPin className="w-3 h-3" />} value={mapping.addressStreetName || ''} headers={headers} onChange={v => updateMapping('addressStreetName', v)} allowNone />
                      <ColSelect label="Street Type" icon={<MapPin className="w-3 h-3" />} value={mapping.addressStreetType || ''} headers={headers} onChange={v => updateMapping('addressStreetType', v)} allowNone />
                      <ColSelect label="Suffix" icon={<MapPin className="w-3 h-3" />} value={mapping.addressSuffix || ''} headers={headers} onChange={v => updateMapping('addressSuffix', v)} allowNone />
                      <ColSelect label="Municipality / City" icon={<MapPin className="w-3 h-3" />} value={mapping.addressMunicipality || ''} headers={headers} onChange={v => updateMapping('addressMunicipality', v)} allowNone />
                    </div>
                  )}
                </div>

                <button onClick={applyRemap} disabled={remapping} className="btn-primary w-full justify-center">
                  {remapping ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Re-parsing...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4" /> Apply & Re-preview</>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* No valid records warning */}
          {preview.validRows === 0 && (
            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>No valid records could be read. Check the column mapping above — every row needs a Tech ID, Address, and Date.</p>
            </div>
          )}

          {/* Preview table */}
          {preview.preview.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h3 className="font-medium text-gray-900 text-sm">
                  Preview — first {preview.preview.length} records
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Tech ID</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {preview.preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">{row.techId}</td>
                        <td className="px-4 py-2.5 text-gray-700 text-sm">{row.techName}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs max-w-xs truncate">{row.address}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{row.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleConfirm}
              disabled={loading || preview.validRows === 0}
              className="btn-primary"
            >
              {loading ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Importing...</>
              ) : (
                <>Import {preview.validRows.toLocaleString()} Records</>
              )}
            </button>
            <button onClick={reset} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}

      {/* ── STEP: Done ── */}
      {step === 'done' && importResult && (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Import Complete!</h3>
          <p className="text-gray-600 mt-2">
            Successfully imported{' '}
            <span className="font-semibold text-brand-600">{importResult.jobsImported.toLocaleString()}</span>{' '}
            job records
          </p>
          <div className="flex items-center gap-3 mt-6">
            <button onClick={reset} className="btn-secondary">
              <UploadIcon className="w-4 h-4" />
              Upload Another
            </button>
            <a href="/" className="btn-primary">View Dashboard</a>
          </div>
        </div>
      )}
    </div>
  );
}

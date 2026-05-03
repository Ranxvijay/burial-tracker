import { useState, useEffect } from 'react';
import { Trash2, FileSpreadsheet, RefreshCw, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../api';
import { Upload } from '../types';
import { format, parseISO } from 'date-fns';

export default function History() {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.getUploadHistory();
      setUploads(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number) {
    if (!confirm('Delete this upload and all its job records?')) return;
    setDeleting(id);
    try {
      await api.deleteUpload(id);
      toast.success('Upload deleted');
      setUploads(prev => prev.filter(u => u.id !== id));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  }

  function formatDt(dt: string) {
    try { return format(parseISO(dt), 'MMM d, yyyy HH:mm'); } catch { return dt; }
  }

  function formatDate(d: string) {
    try { return format(parseISO(d), 'MMM d, yyyy'); } catch { return d; }
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload History</h1>
          <p className="text-sm text-gray-500 mt-0.5">All previously imported Excel files</p>
        </div>
        <button onClick={load} className="btn-secondary">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <RefreshCw className="w-5 h-5 text-brand-500 animate-spin" />
          </div>
        ) : uploads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Clock className="w-8 h-8 text-gray-300" />
            <p className="text-gray-500 text-sm">No uploads yet</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">File</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Jobs</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden md:table-cell">Date Range</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide hidden lg:table-cell">Uploaded</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {uploads.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="font-medium text-gray-800 text-sm">{u.filename}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700">
                      {u.job_count.toLocaleString()} jobs
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs hidden md:table-cell">
                    {u.date_range_start && u.date_range_end ? (
                      `${formatDate(u.date_range_start)} – ${formatDate(u.date_range_end)}`
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs hidden lg:table-cell">
                    {formatDt(u.uploaded_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(u.id)}
                      disabled={deleting === u.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      title="Delete upload"
                    >
                      {deleting === u.id ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

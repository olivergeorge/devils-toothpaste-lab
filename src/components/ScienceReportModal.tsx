import React, { useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  Download,
  FileText,
  Image as ImageIcon,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { CapturedPhoto, ScienceReport } from '../types/chemistry';
import { exportReportAsPngCard, formatReportAsMarkdown } from '../utils/reportGenerator';

interface ScienceReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftReport: ScienceReport;
  savedReports: ScienceReport[];
  onSaveReport: (report: ScienceReport) => void;
  onDeleteSavedReport: (id: string) => void;
  onSnapLivePhoto: () => CapturedPhoto | null;
}

export const ScienceReportModal: React.FC<ScienceReportModalProps> = ({
  isOpen,
  onClose,
  draftReport,
  savedReports,
  onSaveReport,
  onDeleteSavedReport,
  onSnapLivePhoto,
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'saved'>('editor');
  const [report, setReport] = useState<ScienceReport>(draftReport);
  const [copiedState, setCopiedState] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [isExportingPng, setIsExportingPng] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setReport(draftReport);
    }
  }, [isOpen, draftReport]);

  if (!isOpen) return null;

  const handleSnapPhotoInsideModal = () => {
    const snapped = onSnapLivePhoto();
    if (snapped) {
      setReport((prev) => ({
        ...prev,
        photos: [snapped, ...prev.photos],
      }));
    }
  };

  const handleRemovePhoto = (photoId: string) => {
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== photoId),
    }));
  };

  const handleSaveToNotebook = () => {
    onSaveReport(report);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  const handleCopyShareSummary = async () => {
    const md = formatReportAsMarkdown(report);
    try {
      await navigator.clipboard.writeText(md);
      setCopiedState(true);
      setTimeout(() => setCopiedState(false), 2200);
    } catch {
      // Fallback
    }
  };

  const handleDownloadMarkdown = () => {
    const md = formatReportAsMarkdown(report);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPosterPng = async () => {
    setIsExportingPng(true);
    try {
      const pngUrl = await exportReportAsPngCard(report);
      if (pngUrl) {
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `science-report-${report.config.scaleId}-${report.config.peroxideConcentration}pct.png`;
        a.click();
      }
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="science-report-modal-title"
    >
      <div className="w-full max-w-4xl max-h-[88vh] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 id="science-report-modal-title" className="text-lg font-bold tracking-tight text-white">
              My Science Fair Report & Photo Poster
            </h2>
            <p className="text-xs text-slate-400">
              Save your Aim, Equipment, Recipe Order, Results, and 3D Photos to share!
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('editor')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'editor'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Current Report
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('saved')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === 'saved'
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                Saved Notebook ({savedReports.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close Science Report Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {activeTab === 'editor' ? (
          <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left 7 Cols: Kid-Friendly Science Report Sections */}
            <div className="lg:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Experiment Title
                  </label>
                  <input
                    type="text"
                    value={report.title}
                    onChange={(e) => setReport({ ...report, title: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Scientist Name
                  </label>
                  <input
                    type="text"
                    value={report.scientistName}
                    onChange={(e) => setReport({ ...report, scientistName: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 01. Aim & Hypothesis */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold text-amber-400">
                  1. AIM & HYPOTHESIS (What I Wanted to Test)
                </h3>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Aim</label>
                  <textarea
                    rows={2}
                    value={report.aim}
                    onChange={(e) => setReport({ ...report, aim: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">My Prediction (Hypothesis)</label>
                  <textarea
                    rows={2}
                    value={report.hypothesis}
                    onChange={(e) => setReport({ ...report, hypothesis: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 02. Equipment & Safety Gear */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold text-sky-400">
                  2. EQUIPMENT & SAFETY GEAR (What I Used)
                </h3>
                <ul className="space-y-1 text-xs text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {report.equipmentList.map((eq, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-sky-400 font-mono-tabular">{idx + 1}.</span>
                      <span>{eq}</span>
                    </li>
                  ))}
                  <li className="pt-1.5 mt-1.5 border-t border-slate-800 text-amber-300">
                    {report.safetyNotes}
                  </li>
                </ul>
              </div>

              {/* 03. Method (Order of Ingredients) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold text-emerald-400">
                  3. METHOD (Exact Order I Poured the Ingredients)
                </h3>
                <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                  {report.methodSteps.map((step, idx) => (
                    <p key={idx} className="text-xs text-slate-300 leading-relaxed">
                      {step}
                    </p>
                  ))}
                </div>
              </div>

              {/* 04. Results, Bloopers & Conclusion */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h3 className="text-xs font-bold text-purple-400">
                  4. WHAT REALLY HAPPENED, LAB BLOOPERS & CONCLUSION
                </h3>
                {report.bloopersAndMishaps && report.bloopersAndMishaps.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 space-y-1">
                    <div className="text-[11px] font-bold text-rose-300">
                      FUNNY LAB BLOOPERS RECORDED:
                    </div>
                    {report.bloopersAndMishaps.map((b, i) => (
                      <div key={i} className="text-xs text-rose-200">
                        • {b}
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                  rows={3}
                  value={report.conclusion}
                  onChange={(e) => setReport({ ...report, conclusion: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Right 5 Cols: Scoreboard Numbers & 3D Photos */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-slate-200">
                    Experiment Scoreboard
                  </span>
                  <span className="text-xs font-mono-tabular text-amber-400">
                    2H₂O₂ → 2H₂O + O₂
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400">Foam Height</div>
                    <div className="text-lg font-bold font-mono-tabular text-amber-400">
                      {report.telemetry.peakHeightMeters} m
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400">Foam Volume</div>
                    <div className="text-lg font-bold font-mono-tabular text-sky-400">
                      {report.telemetry.foamVolumeCubicMeters} m³
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400">Reaction Heat</div>
                    <div className="text-lg font-bold font-mono-tabular text-rose-400">
                      {report.telemetry.peakTempCelsius} °C
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <div className="text-[11px] text-slate-400">Oxygen Gas</div>
                    <div className="text-lg font-bold font-mono-tabular text-emerald-400">
                      {report.telemetry.oxygenGasLiters.toLocaleString()} L
                    </div>
                  </div>
                </div>
              </div>

              {/* 3D Experiment Photos */}
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white">
                      My Experiment Photos ({report.photos.length})
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Included on your downloadable PNG Poster!
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSnapPhotoInsideModal}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Take 3D Photo
                  </button>
                </div>

                {report.photos.length === 0 ? (
                  <div className="h-40 rounded-lg border border-dashed border-slate-800 flex flex-col items-center justify-center text-center p-4 text-slate-500">
                    <ImageIcon className="w-7 h-7 mb-1.5 text-slate-600" />
                    <p className="text-xs">
                      Click &ldquo;Take 3D Photo&rdquo; to snap a picture of your experiment!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {report.photos.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden"
                      >
                        <div className="relative aspect-video bg-slate-950">
                          <img
                            src={photo.dataUrl}
                            alt={photo.caption}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePhoto(photo.id)}
                            className="absolute top-2 right-2 p-1.5 bg-slate-950/85 text-slate-300 hover:text-rose-400 rounded-md transition-colors"
                            aria-label="Remove photo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-2 flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={photo.caption}
                            onChange={(e) => {
                              const next = [...report.photos];
                              next[idx] = { ...photo, caption: e.target.value };
                              setReport({ ...report, photos: next });
                            }}
                            className="flex-1 text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-amber-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Saved Lab Notebook Tab */
          <div className="flex-1 overflow-y-auto p-5">
            {savedReports.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-center text-slate-400">
                <FileText className="w-10 h-10 mb-2 text-slate-600" />
                <p className="text-sm font-medium text-slate-300">No Saved Science Reports Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md">
                  Click &ldquo;Save to Notebook&rdquo; below to keep your favorite foam explosions!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {savedReports.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex gap-3">
                      {item.photos[0] ? (
                        <img
                          src={item.photos[0].dataUrl}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="w-24 h-20 object-cover rounded-lg border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div className="w-24 h-20 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-semibold text-white truncate">{item.title}</h4>
                        <div className="text-xs font-mono-tabular text-amber-400 mt-1">
                          Height: {item.telemetry.peakHeightMeters}m · Heat: {item.telemetry.peakTempCelsius}°C
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.aim}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900">
                      <button
                        type="button"
                        onClick={() => {
                          setReport(item);
                          setActiveTab('editor');
                        }}
                        className="px-3 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
                      >
                        Open Report
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSavedReport(item.id)}
                        className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                        aria-label="Delete saved report"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-t border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveToNotebook}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {savedToast ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {savedToast ? 'Saved!' : 'Save to Notebook'}
            </button>

            <button
              type="button"
              onClick={handleCopyShareSummary}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {copiedState ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copiedState ? 'Copied!' : 'Copy Text'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <FileText className="w-4 h-4" />
              Save .MD
            </button>

            <button
              type="button"
              onClick={handleDownloadPosterPng}
              disabled={isExportingPng}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-4 h-4" />
              {isExportingPng ? 'Making Poster...' : 'Download PNG Poster Card'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

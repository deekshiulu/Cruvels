'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import AppShell from '@/components/layout/AppShell';
import {
  Folder,
  FileText,
  FileSpreadsheet,
  Presentation,
  File,
  Link2,
  ExternalLink,
  Plus,
  Search,
  Trash2,
  Shield,
  Users,
  CheckCircle2,
  AlertCircle,
  X,
  HardDrive,
  FolderGit2,
  Globe,
  Lock,
} from 'lucide-react';
import { DriveResource, DriveSection, DriveFileType } from '@/lib/db/types';
import { clientCache } from '@/lib/cache/clientCache';

const SECTION_CONFIG: { id: DriveSection; label: string; icon: React.ElementType; description: string }[] = [
  { id: 'company_resources', label: 'Company Resources', icon: Globe,       description: 'Official company guidelines, brand assets, and standard templates.' },
  { id: 'project_files',     label: 'Project Files',     icon: FolderGit2,  description: 'Squad deliverables, repositories, and team project drives.' },
  { id: 'shared_files',      label: 'Shared Files',      icon: Users,       description: 'Cross-functional documents shared among team members.' },
  { id: 'my_files',          label: 'My Deliverables',   icon: Folder,      description: 'Your personal workspace deliverables and linked drive files.' },
];

function getFileIcon(type: DriveFileType) {
  switch (type) {
    case 'doc':
      return { Icon: FileText, color: '#3B82F6', label: 'Google Doc', bg: 'rgba(59,130,246,0.12)' };
    case 'sheet':
      return { Icon: FileSpreadsheet, color: '#10B981', label: 'Google Sheet', bg: 'rgba(16,185,129,0.12)' };
    case 'slide':
      return { Icon: Presentation, color: '#F59E0B', label: 'Google Slide', bg: 'rgba(245,158,11,0.12)' };
    case 'folder':
      return { Icon: Folder, color: '#2563EB', label: 'Drive Folder', bg: 'rgba(37,99,235,0.12)' };
    case 'pdf':
      return { Icon: File, color: '#EF4444', label: 'PDF File', bg: 'rgba(239,68,68,0.12)' };
    default:
      return { Icon: Link2, color: '#8B5CF6', label: 'Resource Link', bg: 'rgba(139,92,246,0.12)' };
  }
}

export default function GoogleDrivePage() {
  const [resources, setResources] = useState<DriveResource[]>(() => {
    if (typeof window !== 'undefined') {
      return clientCache.get<DriveResource[]>('drive_resources') || [];
    }
    return [];
  });
  const [activeSection, setActiveSection] = useState<DriveSection>('company_resources');
  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      return !clientCache.get<DriveResource[]>('drive_resources');
    }
    return true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [section, setSection] = useState<DriveSection>('my_files');
  const [fileType, setFileType] = useState<DriveFileType>('doc');
  const [externalUrl, setExternalUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchResources = useCallback(async () => {
    try {
      const res = await fetch('/api/drive');
      if (res.ok) {
        const d = await res.json();
        setResources(d.resources || []);
        clientCache.set('drive_resources', undefined, d.resources || []);
      }
    } catch {
      setError('Failed to load drive resources.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const filtered = useMemo(() => {
    return resources.filter((r) => {
      if (r.section !== activeSection) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = r.name.toLowerCase().includes(q);
        const matchDesc = (r.description || '').toLowerCase().includes(q);
        const matchOwner = (r.owner_name || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchOwner) return false;
      }
      return true;
    });
  }, [resources, activeSection, searchQuery]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          section,
          fileType,
          externalUrl,
        }),
      });
      const d = await res.json();
      if (res.ok && d.success) {
        setNotification('Resource linked successfully!');
        setShowModal(false);
        setName('');
        setDescription('');
        setExternalUrl('');
        fetchResources();
        setTimeout(() => setNotification(null), 4000);
      } else {
        setError(d.error || 'Failed to link resource.');
      }
    } catch {
      setError('Network error while saving resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteResource = async (id: string, resourceName: string) => {
    if (!confirm(`Unlink "${resourceName}" from workspace?`)) return;
    try {
      const res = await fetch(`/api/drive/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setNotification('Resource unlinked.');
        fetchResources();
        setTimeout(() => setNotification(null), 4000);
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to remove resource.');
      }
    } catch {
      alert('Network error unlinking resource.');
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col h-full gap-0" style={{ color: 'var(--ink)' }}>
        {/* Page Header */}
        <div className="pb-3 mb-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--line)' }}>
          <div>
            <h1
              className="text-lg font-bold flex items-center gap-2"
              style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: 'var(--ink)' }}
            >
              <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Google Drive Workspace Explorer
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
              Controlled Workspace Access, Squad Deliverables & Official Cruvels Resources (§ 12)
            </p>
          </div>
          <button
            onClick={() => {
              setSection(activeSection);
              setShowModal(true);
            }}
            className="glow-btn-primary px-3.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" /> Link Drive File
          </button>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className="mb-3 flex items-center gap-2 rounded-md px-3 py-2 text-xs"
            style={{
              background: 'var(--teal-wash)',
              border: '1px solid var(--teal)',
              color: 'var(--teal-ink)',
            }}
          >
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold">{notification}</span>
          </div>
        )}

        {/* Section Navigation Tabs (§ 12.1) */}
        <div className="flex items-center gap-2 mb-4 border-b border-[var(--line)] overflow-x-auto pb-2">
          {SECTION_CONFIG.map((sec) => {
            const Icon = sec.icon;
            const count = resources.filter((r) => r.section === sec.id).length;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{sec.label}</span>
                <span
                  className="rounded-full px-1.5 py-0.2 text-[10px] font-extrabold"
                  style={{
                    background: isActive ? 'var(--teal)' : 'var(--line)',
                    color: isActive ? '#FFFFFF' : 'var(--muted)',
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Stats Bar */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search file name, description, owner..."
              className="w-full rounded-md py-1.5 pl-8 pr-3 text-xs focus:outline-none"
              style={{ background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' }}
            />
          </div>

          <div className="text-xs text-[var(--muted)] flex items-center gap-2">
            <span>
              {SECTION_CONFIG.find((s) => s.id === activeSection)?.description}
            </span>
          </div>
        </div>

        {/* Resources Grid */}
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-t-transparent border-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex-1 flex flex-col items-center justify-center p-8 rounded-xl border border-dashed border-[var(--line)]"
            style={{ background: 'var(--surface)' }}
          >
            <Folder className="h-10 w-10 text-[var(--muted)] mb-2" />
            <p className="text-sm font-bold text-[var(--ink)]">No resources in this section</p>
            <p className="text-xs text-[var(--muted)] mt-1 max-w-sm text-center">
              Link Google Docs, Sheets, Slides, or folders to keep your workspace synchronized.
            </p>
            <button
              onClick={() => {
                setSection(activeSection);
                setShowModal(true);
              }}
              className="glow-btn-primary mt-4 px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> Link First Resource
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 overflow-y-auto pb-4">
            {filtered.map((r) => {
              const fileInfo = getFileIcon(r.file_type);
              const Icon = fileInfo.Icon;

              return (
                <div
                  key={r.id}
                  className="rounded-xl p-4 flex flex-col justify-between border border-[var(--line)] transition-all hover:shadow-md group"
                  style={{ background: 'var(--surface)' }}
                >
                  <div>
                    {/* Top Row: File Type Badge + Squad Pill + Delete */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1"
                          style={{ background: fileInfo.bg, color: fileInfo.color }}
                        >
                          <Icon className="h-3 w-3" />
                          {fileInfo.label}
                        </span>
                        {r.group_name && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold border border-[var(--line)] text-[var(--muted)]">
                            {r.group_name}
                          </span>
                        )}
                        {r.is_company_wide && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                            Public
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeleteResource(r.id, r.name)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--muted)] hover:text-red-500 transition-all"
                        title="Unlink resource"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-bold leading-snug text-[var(--ink)] mb-1">
                      {r.name}
                    </h3>

                    {/* Description */}
                    <p className="text-[11px] leading-relaxed text-[var(--muted)] line-clamp-2 mb-3">
                      {r.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Bottom Row: Owner Info + Launch Button */}
                  <div className="pt-2.5 border-t border-[var(--line)] flex items-center justify-between text-[11px]">
                    <span className="text-[var(--muted)]">
                      By <strong>{r.owner_name}</strong>
                    </span>

                    <a
                      href={r.external_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-btn-primary px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1"
                    >
                      <span>Open</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Link Drive File Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm p-4"
          style={{ background: 'rgba(18,32,42,0.6)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6 shadow-2xl space-y-4"
            style={{ background: 'var(--surface)', border: '1px solid var(--line)' }}
          >
            <div className="flex items-center justify-between pb-3 border-b border-[var(--line)]">
              <h3 className="text-sm font-bold flex items-center gap-2 text-[var(--ink)]">
                <HardDrive className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Link Google Drive File / Folder
              </h3>
              <button onClick={() => setShowModal(false)} className="text-[var(--muted)]">
                <X className="h-4 w-4" />
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-md px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 text-red-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleCreateResource} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Q3 Architecture RFC or Sprint Board"
                  className="w-full rounded-md p-2.5 focus:outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    Target Section
                  </label>
                  <select
                    value={section}
                    onChange={(e) => setSection(e.target.value as any)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="company_resources">Company Resources</option>
                    <option value="project_files">Project Files (Squad)</option>
                    <option value="shared_files">Shared Files</option>
                    <option value="my_files">My Deliverables</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                    File Type
                  </label>
                  <select
                    value={fileType}
                    onChange={(e) => setFileType(e.target.value as any)}
                    className="w-full rounded-md p-2.5 focus:outline-none"
                    style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                  >
                    <option value="doc">Google Doc</option>
                    <option value="sheet">Google Sheet</option>
                    <option value="slide">Google Slide</option>
                    <option value="folder">Drive Folder</option>
                    <option value="pdf">PDF</option>
                    <option value="link">Other Link</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                  Google Drive / Docs URL
                </label>
                <input
                  type="url"
                  required
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://docs.google.com/... or https://drive.google.com/..."
                  className="w-full rounded-md p-2.5 focus:outline-none"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)' }}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1 text-[var(--muted)]">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief summary of this resource..."
                  className="w-full rounded-md p-2.5 focus:outline-none leading-relaxed"
                  style={{ background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink)', resize: 'none' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--line)]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-md px-4 py-2 text-xs font-semibold border border-[var(--line)] text-[var(--muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="glow-btn-primary rounded-md px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {submitting ? 'Linking…' : 'Link Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

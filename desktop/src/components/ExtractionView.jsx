import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Mail,
  MapPin,
  Phone,
  Plus,
  Quote,
  Receipt,
  RotateCw,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PrivacyConsentDialog } from './PrivacyConsentDialog.jsx';
import { Badge, Button, Spinner } from './ui.jsx';

const PROFILES = [
  { id: 'general', label: 'General Document', icon: FileText, desc: 'Title, entities, dates & key facts' },
  { id: 'invoice', label: 'Invoice / Receipt', icon: Receipt, desc: 'Vendor, invoice #, amounts & line items' },
  { id: 'resume', label: 'Resume / CV', icon: User, desc: 'Candidate info, skills, education & experience' },
];

export function ExtractionView({ doc }) {
  const [profile, setProfile] = useState('general');
  const [extraction, setExtraction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showConsent, setShowConsent] = useState(false);

  // Editable form state
  const [formData, setFormData] = useState({});
  const [isVerified, setIsVerified] = useState(false);
  const [userNotes, setUserNotes] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const docId = doc?.metadata?.id;

  // Load cached extraction asynchronously when document or profile changes
  useEffect(() => {
    if (!docId) return;
    let ignore = false;

    window.transformo?.ai
      ?.getExtraction(docId, profile)
      .then((res) => {
        if (ignore) return;
        if (res?.ok && res.data) {
          setExtraction(res.data);
          setFormData(res.data.data || {});
          setIsVerified(Boolean(res.data.is_verified));
          setUserNotes(res.data.user_notes || '');
          setIsDirty(false);
        } else {
          setExtraction(null);
          setFormData({});
          setIsVerified(false);
          setUserNotes('');
          setIsDirty(false);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!ignore) {
          setExtraction(null);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [docId, profile]);

  const handleProfileChange = (newProfile) => {
    if (newProfile === profile) return;
    setProfile(newProfile);
  };

  const handleRunExtraction = async (force = false) => {
    if (!docId) return;

    // Check user privacy consent first
    try {
      const stored = localStorage.getItem('transformo_ai_consent');
      if (stored !== 'true') {
        setShowConsent(true);
        return;
      }
    } catch {
      // ignore
    }

    setExtracting(true);
    setError(null);

    try {
      const res = await window.transformo?.ai?.extractDocument({
        docId,
        profile,
        force,
      });

      if (!res?.ok) {
        throw new Error(res?.error || 'Extraction failed');
      }

      setExtraction(res.data);
      setFormData(res.data.data || {});
      setIsVerified(Boolean(res.data.is_verified));
      setUserNotes(res.data.user_notes || '');
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  };

  const handleConsentGranted = () => {
    setShowConsent(false);
    handleRunExtraction(false);
  };

  const handleSaveChanges = async () => {
    if (!docId) return;
    setSaving(true);
    setError(null);

    try {
      const res = await window.transformo?.ai?.updateExtraction({
        docId,
        profile,
        data: formData,
        isVerified,
        userNotes,
      });

      if (!res?.ok) {
        throw new Error(res?.error || 'Failed to save changes');
      }

      setExtraction(res.data);
      setFormData(res.data.data || {});
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleVerified = async () => {
    const nextVerified = !isVerified;
    setIsVerified(nextVerified);

    if (extraction) {
      try {
        const res = await window.transformo?.ai?.updateExtraction({
          docId,
          profile,
          data: formData,
          isVerified: nextVerified,
          userNotes,
        });
        if (res?.ok) {
          setExtraction(res.data);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleCopyJSON = async () => {
    if (!extraction) return;
    try {
      const payload = {
        document_id: docId,
        profile,
        is_verified: isVerified,
        data: formData,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleExport = async (format) => {
    if (!docId) return;
    setExporting(format);
    setError(null);

    try {
      const res = await window.transformo?.ai?.exportExtraction({
        docId,
        profile,
        format,
        saveDialog: true,
      });

      if (!res?.ok) {
        throw new Error(res?.error || `Export to ${format.toUpperCase()} failed`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(null);
    }
  };

  // Field change helpers
  const updateField = (key, val) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const updateNestedField = (parentKey, key, val) => {
    setFormData((prev) => ({
      ...prev,
      [parentKey]: {
        ...(prev[parentKey] || {}),
        [key]: val,
      },
    }));
    setIsDirty(true);
  };

  return (
    <div className="space-y-6 py-2">
      <PrivacyConsentDialog
        open={showConsent}
        onClose={() => setShowConsent(false)}
        onConsentGranted={handleConsentGranted}
      />

      {/* Profile Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PROFILES.map((p) => {
          const Icon = p.icon;
          const isSelected = profile === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => handleProfileChange(p.id)}
              className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'border-accent bg-accent-soft/20 text-ink ring-1 ring-accent'
                  : 'border-border bg-sunken/40 text-muted hover:border-border-strong hover:text-ink'
              }`}
            >
              <div
                className={`p-2 rounded-lg ${
                  isSelected ? 'bg-accent text-accent-ink' : 'bg-surface text-muted'
                }`}
              >
                <Icon size={18} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs tracking-tight">{p.label}</div>
                <div className="text-[11px] text-muted line-clamp-1">{p.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-danger/40 bg-danger-soft p-4 text-xs text-ink">
          <AlertCircle size={16} className="mt-0.5 shrink-0 text-danger" />
          <div className="flex-1 min-w-0">
            <span className="font-semibold text-danger">Extraction error: </span>
            <span className="text-muted">{error}</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => handleRunExtraction(true)}
            icon={<RotateCw size={12} />}
            className="!h-7 !px-2.5 !text-xs !text-danger hover:!bg-danger/20"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Spinner size="md" />
          <span className="text-xs text-muted">Checking cached extraction...</span>
        </div>
      )}

      {/* Extracting state */}
      {extracting && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-border bg-sunken/30">
          <Spinner size="lg" />
          <div className="text-center">
            <div className="text-sm font-medium text-ink">Analyzing document fields with Groq AI...</div>
            <div className="text-xs text-muted mt-1">
              Extracting structured profile data & verifying provenance
            </div>
          </div>
        </div>
      )}

      {/* Empty State: Not yet extracted */}
      {!loading && !extracting && !extraction && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Sparkles size={24} />
          </div>
          <h4 className="text-sm font-semibold text-ink">
            No {PROFILES.find((p) => p.id === profile)?.label} Extracted Yet
          </h4>
          <p className="mx-auto mt-1 max-w-sm text-xs text-muted">
            Run automated extraction to discover machine-readable fields, validate totals, and review citations.
          </p>
          <div className="mt-6 flex justify-center">
            <Button
              variant="primary"
              onClick={() => handleRunExtraction(false)}
              icon={<Sparkles size={14} />}
            >
              Run {PROFILES.find((p) => p.id === profile)?.label} Extraction
            </Button>
          </div>
        </div>
      )}

      {/* Extraction Results */}
      {!loading && !extracting && extraction && (
        <div className="space-y-6">
          {/* Top Verification & Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-sunken/60 p-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleVerified}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                  isVerified
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'
                    : 'border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20'
                }`}
                title="Click to toggle user verification status"
              >
                {isVerified ? (
                  <>
                    <CheckCircle2 size={14} />
                    Verified by User
                  </>
                ) : (
                  <>
                    <TriangleAlert size={14} />
                    Unverified AI Extraction (Click to Verify)
                  </>
                )}
              </button>

              <Badge tone="neutral" className="text-[11px] font-mono">
                {extraction.model}
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDirty && (
                <Button
                  variant="primary"
                  onClick={handleSaveChanges}
                  loading={saving}
                  icon={<Save size={13} />}
                  className="!h-8 !px-3 !text-xs"
                >
                  Save Edits
                </Button>
              )}

              <Button
                variant="ghost"
                onClick={handleCopyJSON}
                icon={copied ? <Check size={13} /> : <Copy size={13} />}
                className="!h-8 !px-3 !text-xs"
              >
                {copied ? 'Copied' : 'Copy JSON'}
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleExport('json')}
                loading={exporting === 'json'}
                icon={<Download size={13} />}
                className="!h-8 !px-3 !text-xs"
              >
                Export JSON
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleExport('csv')}
                loading={exporting === 'csv'}
                icon={<FileSpreadsheet size={13} />}
                className="!h-8 !px-3 !text-xs"
              >
                Export CSV
              </Button>

              <Button
                variant="ghost"
                onClick={() => handleRunExtraction(true)}
                icon={<RotateCw size={13} />}
                className="!h-8 !px-3 !text-xs"
                title="Re-extract fresh from document"
              >
                Re-extract
              </Button>
            </div>
          </div>

          {/* User Notes (Optional review commentary) */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted uppercase tracking-wider">
              Verification / Review Notes
            </label>
            <input
              type="text"
              value={userNotes}
              onChange={(e) => {
                setUserNotes(e.target.value);
                setIsDirty(true);
              }}
              placeholder="e.g. Verified by Accounts Payable on 2026-10-17"
              className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Profile-Specific Editor */}
          {profile === 'general' && (
            <GeneralEditor
              data={formData}
              onChange={updateField}
            />
          )}

          {profile === 'invoice' && (
            <InvoiceEditor
              data={formData}
              onChange={updateField}
              onNestedChange={updateNestedField}
            />
          )}

          {profile === 'resume' && (
            <ResumeEditor
              data={formData}
              onChange={updateField}
              onNestedChange={updateNestedField}
            />
          )}

          {/* Provenance & Citations Section */}
          <ProvenanceViewer provenance={formData.provenance} />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Profile 1: General Editor
// ============================================================================

function GeneralEditor({ data, onChange }) {
  const [newPerson, setNewPerson] = useState('');
  const [newOrg, setNewOrg] = useState('');

  const addTag = (field, val, setter) => {
    if (!val.trim()) return;
    const current = data[field] || [];
    onChange(field, [...current, val.trim()]);
    setter('');
  };

  const removeTag = (field, idx) => {
    const current = data[field] || [];
    onChange(field, current.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldContainer label="Document Type" isMissing={!data.document_type}>
          <input
            type="text"
            value={data.document_type || ''}
            onChange={(e) => onChange('document_type', e.target.value)}
            placeholder="e.g. Master Services Agreement"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>

        <FieldContainer label="Document Title" isMissing={!data.title}>
          <input
            type="text"
            value={data.title || ''}
            onChange={(e) => onChange('title', e.target.value)}
            placeholder="e.g. Annual Executive Briefing"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>
      </div>

      {/* People Mentioned */}
      <FieldContainer label="People Mentioned" isMissing={!data.people || data.people.length === 0}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(data.people || []).map((person, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sunken border border-border text-xs text-ink"
              >
                <User size={11} className="text-muted" />
                {person}
                <button
                  type="button"
                  onClick={() => removeTag('people', idx)}
                  className="text-muted hover:text-danger ml-1"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPerson}
              onChange={(e) => setNewPerson(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag('people', newPerson, setNewPerson)}
              placeholder="Add person..."
              className="w-48 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <Button
              variant="ghost"
              onClick={() => addTag('people', newPerson, setNewPerson)}
              icon={<Plus size={12} />}
              className="!h-7 !px-2 !text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      </FieldContainer>

      {/* Organizations */}
      <FieldContainer label="Organizations" isMissing={!data.organizations || data.organizations.length === 0}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(data.organizations || []).map((org, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sunken border border-border text-xs text-ink"
              >
                <Building2 size={11} className="text-muted" />
                {org}
                <button
                  type="button"
                  onClick={() => removeTag('organizations', idx)}
                  className="text-muted hover:text-danger ml-1"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newOrg}
              onChange={(e) => setNewOrg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTag('organizations', newOrg, setNewOrg)}
              placeholder="Add organization..."
              className="w-48 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <Button
              variant="ghost"
              onClick={() => addTag('organizations', newOrg, setNewOrg)}
              icon={<Plus size={12} />}
              className="!h-7 !px-2 !text-xs"
            >
              Add
            </Button>
          </div>
        </div>
      </FieldContainer>

      {/* Key Facts */}
      <FieldContainer label="Key Facts & Findings" isMissing={!data.key_facts || data.key_facts.length === 0}>
        <div className="space-y-2">
          {(data.key_facts || []).map((fact, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-accent font-semibold text-xs mt-2">•</span>
              <textarea
                rows={2}
                value={fact}
                onChange={(e) => {
                  const updated = [...(data.key_facts || [])];
                  updated[idx] = e.target.value;
                  onChange('key_facts', updated);
                }}
                className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const updated = (data.key_facts || []).filter((_, i) => i !== idx);
                  onChange('key_facts', updated);
                }}
                className="p-1 text-muted hover:text-danger mt-1.5"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            onClick={() => onChange('key_facts', [...(data.key_facts || []), ''])}
            icon={<Plus size={12} />}
            className="!h-7 !px-2.5 !text-xs"
          >
            Add Key Fact
          </Button>
        </div>
      </FieldContainer>
    </div>
  );
}

// ============================================================================
// Profile 2: Invoice Editor
// ============================================================================

function InvoiceEditor({ data, onChange }) {
  const lineItems = data.line_items || [];

  const updateLineItem = (idx, key, val) => {
    const updated = [...lineItems];
    updated[idx] = { ...updated[idx], [key]: val };
    onChange('line_items', updated);
  };

  const addLineItem = () => {
    onChange('line_items', [
      ...lineItems,
      { description: 'New Item', quantity: 1, unit_price: 0, total_price: 0 },
    ]);
  };

  const removeLineItem = (idx) => {
    onChange('line_items', lineItems.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Financial Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-3">
          <div className="text-[11px] font-semibold text-accent uppercase">Total Amount</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-mono text-muted">{data.currency || '$'}</span>
            <input
              type="number"
              step="0.01"
              value={data.total_amount ?? ''}
              onChange={(e) => onChange('total_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-transparent text-lg font-bold text-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 p-3">
          <div className="text-[11px] font-medium text-muted uppercase">Subtotal</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-mono text-muted">{data.currency || '$'}</span>
            <input
              type="number"
              step="0.01"
              value={data.subtotal ?? ''}
              onChange={(e) => onChange('subtotal', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 p-3">
          <div className="text-[11px] font-medium text-muted uppercase">Tax Amount</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="text-xs font-mono text-muted">{data.currency || '$'}</span>
            <input
              type="number"
              step="0.01"
              value={data.tax_amount ?? ''}
              onChange={(e) => onChange('tax_amount', e.target.value === '' ? null : parseFloat(e.target.value))}
              placeholder="0.00"
              className="w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-sunken/40 p-3">
          <div className="text-[11px] font-medium text-muted uppercase">Currency</div>
          <input
            type="text"
            value={data.currency || ''}
            onChange={(e) => onChange('currency', e.target.value)}
            placeholder="USD, EUR, INR"
            className="mt-1 w-full bg-transparent text-sm font-semibold text-ink focus:outline-none"
          />
        </div>
      </div>

      {/* Vendor & Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FieldContainer label="Vendor Name" isMissing={!data.vendor_name}>
          <input
            type="text"
            value={data.vendor_name || ''}
            onChange={(e) => onChange('vendor_name', e.target.value)}
            placeholder="e.g. Acme Corporation"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>

        <FieldContainer label="Customer / Bill To" isMissing={!data.customer_name}>
          <input
            type="text"
            value={data.customer_name || ''}
            onChange={(e) => onChange('customer_name', e.target.value)}
            placeholder="e.g. Globex Inc."
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>
      </div>

      {/* Invoice Meta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FieldContainer label="Invoice Number" isMissing={!data.invoice_number}>
          <input
            type="text"
            value={data.invoice_number || ''}
            onChange={(e) => onChange('invoice_number', e.target.value)}
            placeholder="e.g. INV-2026-0042"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none font-mono"
          />
        </FieldContainer>

        <FieldContainer label="Invoice Date" isMissing={!data.invoice_date}>
          <input
            type="text"
            value={data.invoice_date || ''}
            onChange={(e) => onChange('invoice_date', e.target.value)}
            placeholder="YYYY-MM-DD"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>

        <FieldContainer label="Due Date" isMissing={!data.due_date}>
          <input
            type="text"
            value={data.due_date || ''}
            onChange={(e) => onChange('due_date', e.target.value)}
            placeholder="YYYY-MM-DD"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </FieldContainer>
      </div>

      {/* Itemized Line Items Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-ink">Itemized Billing Rows ({lineItems.length})</label>
          <Button
            variant="ghost"
            onClick={addLineItem}
            icon={<Plus size={12} />}
            className="!h-7 !px-2.5 !text-xs"
          >
            Add Line Item
          </Button>
        </div>

        {lineItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted">
            No line items extracted. Click "Add Line Item" to enter rows manually.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-sunken text-muted border-b border-border">
                <tr>
                  <th className="py-2 px-3 font-medium">Description</th>
                  <th className="py-2 px-3 font-medium w-20">Qty</th>
                  <th className="py-2 px-3 font-medium w-28">Unit Price</th>
                  <th className="py-2 px-3 font-medium w-28">Total Price</th>
                  <th className="py-2 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-surface">
                {lineItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-sunken/40">
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        value={item.description || ''}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        className="w-full bg-transparent text-xs text-ink focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="number"
                        value={item.quantity ?? ''}
                        onChange={(e) => updateLineItem(idx, 'quantity', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-transparent text-xs text-ink focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={item.unit_price ?? ''}
                        onChange={(e) => updateLineItem(idx, 'unit_price', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-transparent text-xs text-ink focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-3 font-medium">
                      <input
                        type="number"
                        step="0.01"
                        value={item.total_price ?? ''}
                        onChange={(e) => updateLineItem(idx, 'total_price', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full bg-transparent text-xs text-ink focus:outline-none"
                      />
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="text-muted hover:text-danger"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Profile 3: Resume Editor
// ============================================================================

function ResumeEditor({ data, onChange, onNestedChange }) {
  const contact = data.contact_details || {};
  const [newSkill, setNewSkill] = useState('');

  const addSkill = () => {
    if (!newSkill.trim()) return;
    const current = data.skills || [];
    onChange('skills', [...current, newSkill.trim()]);
    setNewSkill('');
  };

  const removeSkill = (idx) => {
    const current = data.skills || [];
    onChange('skills', current.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Candidate Name & Contact Details */}
      <FieldContainer label="Candidate Name" isMissing={!data.candidate_name}>
        <input
          type="text"
          value={data.candidate_name || ''}
          onChange={(e) => onChange('candidate_name', e.target.value)}
          placeholder="e.g. Dr. Alex Morgan"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm font-semibold text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </FieldContainer>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <Mail size={12} /> Email
          </label>
          <input
            type="email"
            value={contact.email || ''}
            onChange={(e) => onNestedChange('contact_details', 'email', e.target.value)}
            placeholder="alex@example.com"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <Phone size={12} /> Phone
          </label>
          <input
            type="text"
            value={contact.phone || ''}
            onChange={(e) => onNestedChange('contact_details', 'phone', e.target.value)}
            placeholder="+1 (555) 012-3456"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted flex items-center gap-1.5">
            <MapPin size={12} /> Location
          </label>
          <input
            type="text"
            value={contact.location || ''}
            onChange={(e) => onNestedChange('contact_details', 'location', e.target.value)}
            placeholder="San Francisco, CA"
            className="w-full rounded-lg border border-border bg-surface px-3 py-1.5 text-xs text-ink focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Summary */}
      <FieldContainer label="Professional Summary" isMissing={!data.summary}>
        <textarea
          rows={3}
          value={data.summary || ''}
          onChange={(e) => onChange('summary', e.target.value)}
          placeholder="Summary of experience..."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink focus:border-accent focus:outline-none"
        />
      </FieldContainer>

      {/* Skills */}
      <FieldContainer label="Skills & Competencies" isMissing={!data.skills || data.skills.length === 0}>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {(data.skills || []).map((skill, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-accent-soft text-accent border border-accent/20 text-xs font-medium"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(idx)}
                  className="text-accent/60 hover:text-danger ml-1"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSkill()}
              placeholder="Add skill..."
              className="w-48 rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-ink focus:border-accent focus:outline-none"
            />
            <Button
              variant="ghost"
              onClick={addSkill}
              icon={<Plus size={12} />}
              className="!h-7 !px-2 !text-xs"
            >
              Add Skill
            </Button>
          </div>
        </div>
      </FieldContainer>
    </div>
  );
}

// ============================================================================
// Helper Components: FieldContainer & ProvenanceViewer
// ============================================================================

function FieldContainer({ label, isMissing, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-ink">{label}</label>
        {isMissing && (
          <Badge tone="neutral" className="text-[10px] text-amber-500 bg-amber-500/10 border-amber-500/30">
            Not specified in document
          </Badge>
        )}
      </div>
      {children}
    </div>
  );
}

function ProvenanceViewer({ provenance }) {
  if (!provenance || Object.keys(provenance).length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-sunken/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-ink">
        <Quote size={14} className="text-accent" />
        Provenance & Supporting Citations
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {Object.entries(provenance).map(([key, quote]) => (
          <div key={key} className="rounded-lg border border-border bg-surface p-2.5 space-y-1">
            <div className="font-semibold text-accent text-[11px] uppercase tracking-wider">
              {key.replaceAll('_', ' ')}
            </div>
            <div className="text-muted italic text-[11px]">"{quote}"</div>
          </div>
        ))}
      </div>
    </div>
  );
}

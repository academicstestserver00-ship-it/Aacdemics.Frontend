import { useState, useEffect } from 'react';
import { Plus, Search, Clock, Eye, X, Copy, Tag, Lock, Globe, ToggleLeft, ToggleRight, Pencil, Check, Trash2 } from 'lucide-react';
import { apiClient } from '../services/api';
import TestDetailsPage from './TestDetailsPage';
import QuestionsModal from './QuestionsModal';

const API_URL = '/api/teacher'; // v18
const IST_TIMEZONE = 'Asia/Kolkata';

const LANGUAGE_OPTIONS = [
  { id: 'python', label: 'Python' },
  { id: 'c',      label: 'C' },
  { id: 'cpp',    label: 'C++' },
  { id: 'java',   label: 'Java' },
];

function resolvePermission(test) {
  const p = String(test?.my_permission || '').toLowerCase();
  if (p === 'owner' || p === 'edit' || p === 'view') return p;
  return 'owner';
}

function canEditTest(test) {
  const p = resolvePermission(test);
  return p === 'owner' || p === 'edit';
}

function isOwnerTest(test) {
  return resolvePermission(test) === 'owner';
}

function formatDate(iso) {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Not set';
  const datePart = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric', timeZone: IST_TIMEZONE });
  const timePart = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: IST_TIMEZONE });
  const combined = `${datePart} ${timePart}`;
  return `${combined} IST`;
}

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

// â”€â”€â”€ Inline Editable Field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditableField({ label, value, onSave, type = 'text', options = null, disabled = false }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const handleSave = () => { setEditing(false); onSave(draft); };

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {options ? (
            <select value={draft} onChange={e => setDraft(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #2196F3', borderRadius: '4px', fontSize: '14px' }}>
              {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          ) : (
            <input type={type} value={draft} onChange={e => setDraft(e.target.value)} autoFocus
              style={{ flex: 1, padding: '6px 8px', border: '1px solid #2196F3', borderRadius: '4px', fontSize: '14px' }} />
          )}
          <button onClick={handleSave} disabled={disabled} style={{ background: '#2196F3', border: 'none', borderRadius: '4px', padding: '6px 10px', cursor: disabled ? 'not-allowed' : 'pointer', color: '#fff', display: 'flex', opacity: disabled ? 0.6 : 1 }}>
            <Check size={14} />
          </button>
          <button onClick={() => { setEditing(false); setDraft(value); }} style={{ background: '#f5f5f5', border: '1px solid #ddd', borderRadius: '4px', padding: '6px 10px', cursor: 'pointer', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: disabled ? 'not-allowed' : 'pointer', group: true, opacity: disabled ? 0.7 : 1 }}
          onClick={() => {
            if (disabled) return;
            setDraft(value);
            setEditing(true);
          }}>
          <span style={{ fontSize: '14px', color: value ? '#333' : '#bbb' }}>{value || 'Click to set'}</span>
          <Pencil size={13} color="#ccc" />
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Test Info Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function TestInfoModal({ test, onClose, onUpdate, onLiveControl, onEndNow, onRestartSession }) {
  const [localTest, setLocalTest] = useState(test);
  const [copied, setCopied] = useState(false);
  const [accessEmail, setAccessEmail] = useState('');
  const [accessPermission, setAccessPermission] = useState('view');
  const [collaborators, setCollaborators] = useState([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [accessSaving, setAccessSaving] = useState(false);
  const [accessNotice, setAccessNotice] = useState('');
  const testLink = `${window.location.origin}/test/${test.id}`;
  const permission = resolvePermission(localTest);
  const canEdit = canEditTest(localTest);
  const canManageAccess = isOwnerTest(localTest);

  const save = async (field, value) => {
    if (!canEdit) {
      alert('You have view-only access for this test.');
      return;
    }
    try {
      const payload = { [field]: value };
      const res = await apiClient.patch(`${API_URL}/tests/${localTest.id}`, payload);
      const updated = { ...localTest, ...res.data };
      setLocalTest(updated);
      onUpdate(updated);
    } catch (err) { console.error('Save failed:', err); }
  };

  const toggleAccess = async () => {
    if (!canEdit) {
      alert('You have view-only access for this test.');
      return;
    }
    try {
      const res = await apiClient.patch(`${API_URL}/tests/${localTest.id}`, { is_active: !localTest.is_active });
      const updated = { ...localTest, is_active: res.data.is_active };
      setLocalTest(updated);
      onUpdate(updated);
    } catch (err) { console.error('Toggle failed:', err); }
  };

  const startNow = async () => {
    if (!canEdit) {
      alert('You have view-only access for this test.');
      return;
    }
    try {
      const res = await apiClient.post(`${API_URL}/tests/${localTest.id}/start-now`);
      const updated = { ...localTest, ...res.data };
      setLocalTest(updated);
      onUpdate(updated);
    } catch (err) {
      console.error('Start now failed:', err);
      alert('Failed to start test. Please try again.');
    }
  };

  const endNow = () => {
    if (!canEdit) {
      alert('You have view-only access for this test.');
      return;
    }
    if (onEndNow) return onEndNow(localTest);
  };

  const restartSession = () => {
    if (!canEdit) {
      alert('You have view-only access for this test.');
      return;
    }
    if (onRestartSession) return onRestartSession(localTest);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(testLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadTeacherAccess = async () => {
    if (!canManageAccess) return;
    try {
      setAccessLoading(true);
      const res = await apiClient.get(`${API_URL}/tests/${localTest.id}/access`);
      setCollaborators(Array.isArray(res.data?.collaborators) ? res.data.collaborators : []);
    } catch (err) {
      console.error('Failed to load collaborators:', err);
      setAccessNotice('Could not load shared teacher access.');
    } finally {
      setAccessLoading(false);
    }
  };

  useEffect(() => {
    setAccessNotice('');
    if (canManageAccess) loadTeacherAccess();
  }, [localTest.id, canManageAccess]);

  const handleGrantAccess = async () => {
    const email = accessEmail.trim();
    if (!email) return;
    try {
      setAccessSaving(true);
      setAccessNotice('');
      await apiClient.post(`${API_URL}/tests/${localTest.id}/access`, {
        email,
        permission: accessPermission,
      });
      setAccessEmail('');
      setAccessPermission('view');
      setAccessNotice('Access granted successfully.');
      await loadTeacherAccess();
    } catch (err) {
      console.error('Failed to grant access:', err);
      const msg = err?.response?.data?.detail || 'Failed to grant access.';
      setAccessNotice(msg);
    } finally {
      setAccessSaving(false);
    }
  };

  const handleRevokeAccess = async (teacherId) => {
    if (!teacherId) return;
    try {
      setAccessSaving(true);
      setAccessNotice('');
      await apiClient.delete(`${API_URL}/tests/${localTest.id}/access/${teacherId}`);
      setAccessNotice('Access revoked successfully.');
      await loadTeacherAccess();
    } catch (err) {
      console.error('Failed to revoke access:', err);
      const msg = err?.response?.data?.detail || 'Failed to revoke access.';
      setAccessNotice(msg);
    } finally {
      setAccessSaving(false);
    }
  };

  const tagString = Array.isArray(localTest.tags) ? localTest.tags.join(', ') : (localTest.tags || '');
  const antiPasteEnabled = localTest.anti_paste_enabled !== false;
  const tabSwitchEnabled = localTest.tab_switch_enabled !== false;
  const tabSwitchLimit = localTest.tab_switch_limit ?? 3;
  const autoEndAtEndDate = localTest.auto_end_at_end_date !== false;
  const negativeEnabled = localTest.negative_marking_enabled === true;
  const negativeMarks = localTest.negative_marking_marks ?? 0;
  const geoEnabled = localTest.geo_fencing_enabled === true;
  const geoLatitude = localTest.geo_latitude ?? '';
  const geoLongitude = localTest.geo_longitude ?? '';
  const geoRadius = localTest.geo_radius_meters ?? 100;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}
      onClick={onClose}>
      <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto', margin: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', color: '#999', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>Test Details</div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#333', margin: 0 }}>{localTest.title}</h2>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#666' }}>
              Your access: <strong style={{ textTransform: 'capitalize' }}>{permission}</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999', padding: '4px' }}><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
        {!canEdit && (
          <div style={{ marginBottom: '16px', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cfe8ff', background: '#f3f9ff', color: '#1565c0', fontSize: '12px', fontWeight: 600 }}>
            View-only access. You can inspect this test, but editing is disabled.
          </div>
        )}

        {/* Test Access Toggle */}
        <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#f8f9fa', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>Test Access</div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>
              {localTest.is_active ? 'Students can access this test' : 'Test is hidden from students'}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 500, color: localTest.is_active ? '#4CAF50' : '#999' }}>
                {localTest.is_active ? 'On' : 'Off'}
              </span>
              <button onClick={toggleAccess} disabled={!canEdit} style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'not-allowed', padding: 0, display: 'flex', color: localTest.is_active ? '#4CAF50' : '#ccc', opacity: canEdit ? 1 : 0.6 }}>
                {localTest.is_active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {!localTest.is_active && (
                <button
                  onClick={startNow}
                  disabled={!canEdit}
                  style={{ padding: '6px 10px', backgroundColor: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9', borderRadius: '6px', cursor: canEdit ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: canEdit ? 1 : 0.6 }}
                >
                  Start Now
                </button>
              )}
              {localTest.is_active && (
                <button
                  onClick={endNow}
                  disabled={!canEdit}
                  style={{ padding: '6px 10px', backgroundColor: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: '6px', cursor: canEdit ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: canEdit ? 1 : 0.6 }}
                >
                  End Now
                </button>
              )}
              <button
                onClick={restartSession}
                disabled={!canEdit}
                style={{ padding: '6px 10px', backgroundColor: '#FFF3E0', color: '#EF6C00', border: '1px solid #FFE0B2', borderRadius: '6px', cursor: canEdit ? 'pointer' : 'not-allowed', fontSize: '12px', fontWeight: 600, opacity: canEdit ? 1 : 0.6 }}
              >
                Restart Session
              </button>
              <button
                onClick={() => onLiveControl && onLiveControl(localTest)}
                style={{ padding: '6px 10px', backgroundColor: '#fff', color: '#1565c0', border: '1px solid #90CAF9', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
              >
                Live Control
              </button>
            </div>
          </div>
        </div>

          {/* Anti-Cheat Settings */}
          <div style={{ marginBottom: '20px', padding: '14px 16px', background: '#f8f9fa', borderRadius: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '8px' }}>Anti-Cheat Settings</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={antiPasteEnabled}
                  disabled={!canEdit}
                  onChange={() => save('anti_paste_enabled', !antiPasteEnabled)}
                />
                Disable Copy/Paste
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={tabSwitchEnabled}
                  disabled={!canEdit}
                  onChange={() => save('tab_switch_enabled', !tabSwitchEnabled)}
                />
                Enable Tab Switch Detection
              </label>
            </div>
            <div style={{ marginTop: '10px' }}>
              <EditableField
                label="Tab Switch Limit"
                value={String(tabSwitchLimit)}
                type="number"
                disabled={!canEdit}
                onSave={(v) => save('tab_switch_limit', parseInt(v, 10) || 1)}
              />
              {!tabSwitchEnabled && (
                <div style={{ fontSize: '12px', color: '#999', marginTop: '-6px' }}>
                  Tab switch detection is off.
                </div>
              )}
            </div>
          </div>

          {/* Test Name */}
          <EditableField label="Test name" value={localTest.title} onSave={v => save('title', v)} disabled={!canEdit} />

          {/* Test Type */}
          <EditableField label="Test type" value={localTest.test_type}
            onSave={v => save('test_type', v)}
            disabled={!canEdit}
            options={[{ value: 'invite_only', label: 'Invite Only' }, { value: 'public', label: 'Public' }]} />

          {/* Start Date */}
          <EditableField label="Starts on" value={toDatetimeLocal(localTest.start_date)}
            type="datetime-local"
            disabled={!canEdit}
            onSave={v => save('start_date', v || null)} />
          <div style={{ fontSize: '12px', color: '#999', marginTop: '-10px', marginBottom: '16px' }}>
            {formatDate(localTest.start_date)}
          </div>

          {/* End Date */}
          <EditableField label="Ends on" value={toDatetimeLocal(localTest.end_date)}
            type="datetime-local"
            disabled={!canEdit}
            onSave={v => save('end_date', v || null)} />
          <div style={{ fontSize: '12px', color: '#999', marginTop: '-10px', marginBottom: '16px' }}>
            {formatDate(localTest.end_date)}
          </div>

          {/* Entry Window Summary */}
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#666', background: '#f5f5f5', border: '1px solid #eee', borderRadius: '6px', padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: '4px' }}>Entry Window</div>
            <div>Opens: {formatDate(localTest.start_date)}</div>
            <div>Closes: {formatDate(localTest.end_date)}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={autoEndAtEndDate}
                disabled={!canEdit}
                onChange={() => save('auto_end_at_end_date', !autoEndAtEndDate)}
              />
              Auto-end test at end date
            </label>
          </div>

          {/* Scoring Settings */}
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#666', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '6px', padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: '6px' }}>Scoring</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={negativeEnabled}
                disabled={!canEdit}
                onChange={() => save('negative_marking_enabled', !negativeEnabled)}
              />
              Enable Negative Marking (Coding)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="0"
                step="0.25"
                value={negativeMarks}
                disabled={!negativeEnabled || !canEdit}
                onChange={(e) => save('negative_marking_marks', parseFloat(e.target.value) || 0)}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '140px', backgroundColor: (negativeEnabled && canEdit) ? '#fff' : '#f5f5f5' }}
              />
              <span style={{ fontSize: '12px', color: '#999' }}>points per wrong submission</span>
            </div>
          </div>

          {/* Geofencing Settings */}
          <div style={{ marginBottom: '16px', fontSize: '12px', color: '#666', background: '#f8f9fa', border: '1px solid #eee', borderRadius: '6px', padding: '10px 12px' }}>
            <div style={{ fontWeight: 600, color: '#333', marginBottom: '6px' }}>Location Restriction</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={geoEnabled}
                disabled={!canEdit}
                onChange={() => save('geo_fencing_enabled', !geoEnabled)}
              />
              Allow attempts only from a specific location
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              <input
                type="number"
                step="0.000001"
                value={geoLatitude}
                disabled={!canEdit}
                onChange={(e) => save('geo_latitude', e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: canEdit ? '#fff' : '#f5f5f5' }}
                placeholder="Latitude"
              />
              <input
                type="number"
                step="0.000001"
                value={geoLongitude}
                disabled={!canEdit}
                onChange={(e) => save('geo_longitude', e.target.value === '' ? null : parseFloat(e.target.value))}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', backgroundColor: canEdit ? '#fff' : '#f5f5f5' }}
                placeholder="Longitude"
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="number"
                min="25"
                max="5000"
                value={geoRadius}
                disabled={!canEdit}
                onChange={(e) => save('geo_radius_meters', parseInt(e.target.value, 10) || 100)}
                style={{ padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px', width: '140px', backgroundColor: canEdit ? '#fff' : '#f5f5f5' }}
              />
              <span style={{ fontSize: '12px', color: '#999' }}>meters radius</span>
            </div>
          </div>

          {/* Test Link */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Test Link</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#f5f5f5', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
              <span style={{ flex: 1, fontSize: '13px', color: '#2196F3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{testLink}</span>
              <button onClick={copyLink} style={{ background: copied ? '#E8F5E9' : '#fff', border: `1px solid ${copied ? '#C8E6C9' : '#ddd'}`, borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '12px', color: copied ? '#4CAF50' : '#666', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Assessment ID */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assessment ID</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontSize: '16px', fontWeight: 700, color: '#333', letterSpacing: '2px' }}>{localTest.assessment_id || '-'}</span>
              {localTest.assessment_id && (
                <button onClick={() => { navigator.clipboard.writeText(localTest.assessment_id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', display: 'flex' }}>
                  <Copy size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Tags */}
          <EditableField label="Tags (comma separated)" value={tagString}
            disabled={!canEdit}
            onSave={v => save('tags', v)} />
          {Array.isArray(localTest.tags) && localTest.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '-8px', marginBottom: '16px' }}>
              {localTest.tags.map((tag, i) => (
                <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 8px', backgroundColor: '#fff8e1', color: '#f57f17', borderRadius: '12px', fontSize: '11px', fontWeight: 500, border: '1px solid #ffe082' }}>
                  <Tag size={10} />{tag}
                </span>
              ))}
            </div>
          )}

          {/* Teacher Access Sharing */}
          <div style={{ marginBottom: '16px', border: '1px solid #eee', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Teacher Access Sharing
            </div>
            {canManageAccess ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px auto', gap: '8px', marginBottom: '10px' }}>
                  <input
                    type="email"
                    value={accessEmail}
                    onChange={(e) => setAccessEmail(e.target.value)}
                    placeholder="teacher@email.com"
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
                  />
                  <select
                    value={accessPermission}
                    onChange={(e) => setAccessPermission(e.target.value)}
                    style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid #ddd', fontSize: '13px' }}
                  >
                    <option value="view">View</option>
                    <option value="edit">Edit</option>
                  </select>
                  <button
                    onClick={handleGrantAccess}
                    disabled={accessSaving || !accessEmail.trim()}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', background: '#2196F3', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: (accessSaving || !accessEmail.trim()) ? 'not-allowed' : 'pointer', opacity: (accessSaving || !accessEmail.trim()) ? 0.7 : 1 }}
                  >
                    {accessSaving ? 'Saving...' : 'Grant'}
                  </button>
                </div>
                {accessNotice && (
                  <div style={{ fontSize: '12px', color: '#1565c0', marginBottom: '8px' }}>{accessNotice}</div>
                )}
                {accessLoading ? (
                  <div style={{ fontSize: '12px', color: '#999' }}>Loading shared access...</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {collaborators.length === 0 && (
                      <div style={{ fontSize: '12px', color: '#999' }}>No shared teachers yet.</div>
                    )}
                    {collaborators.map((c) => (
                      <div key={c.teacher_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '8px 10px', background: '#fafafa' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>{c.name || 'Teacher'}</div>
                          <div style={{ fontSize: '12px', color: '#777' }}>{c.email || '-'}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, color: c.permission === 'edit' ? '#ef6c00' : '#1565c0' }}>
                            {c.permission}
                          </span>
                          <button
                            onClick={() => handleRevokeAccess(c.teacher_id)}
                            disabled={accessSaving}
                            style={{ padding: '5px 9px', borderRadius: '5px', border: '1px solid #f44336', background: '#fff', color: '#f44336', fontSize: '11px', fontWeight: 600, cursor: accessSaving ? 'not-allowed' : 'pointer', opacity: accessSaving ? 0.7 : 1 }}
                          >
                            Revoke
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '12px', color: '#777' }}>
                Only the original test creator can grant or revoke teacher access.
              </div>
            )}
          </div>

          {/* Allowed Languages */}
          <div style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '12px', color: '#999', fontWeight: 500, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Allowed Languages</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(localTest.allowed_languages || []).map(lang => (
                <span key={lang} style={{ padding: '3px 10px', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                  {lang === 'cpp' ? 'C++' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 24px', background: '#2196F3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Done</button>
        </div>
      </div>
    </div>
  );
}

// â”€â”€â”€ Teacher Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// ??? End Test Confirmation Modal ?????????????????????????????????????????????
function EndTestConfirmModal({ test, onCancel, onConfirm }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`${API_URL}/tests/${test.id}/live-status`);
        if (mounted) setStatus(res.data);
      } catch (err) {
        console.error('Failed to load live status:', err);
        if (mounted) setError('Failed to load live status.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStatus();
    return () => { mounted = false; };
  }, [test.id]);

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '480px', margin: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#333' }}>End Test Now?</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '14px', color: '#444', marginBottom: '10px' }}>
            This will immediately close <strong>{test.title}</strong> for new entries.
          </div>
          {loading && <div style={{ fontSize: '13px', color: '#999' }}>Loading live status?</div>}
          {!loading && error && <div style={{ fontSize: '13px', color: '#C62828' }}>{error}</div>}
          {!loading && !error && status && (
            <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#555' }}>
              <div style={{ fontWeight: 600, color: '#333', marginBottom: '6px' }}>Active Students</div>
              <div>{status.active_count} currently active</div>
              <div style={{ marginTop: '6px', color: '#777' }}>Total attempts: {status.total_attempts}</div>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#C62828', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>End Test Now</button>
        </div>
      </div>
    </div>
  );
}

// --- Restart Session Confirmation Modal ---
function RestartSessionConfirmModal({ test, onCancel, onConfirm }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const fetchStatus = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get(`${API_URL}/tests/${test.id}/live-status`);
        if (mounted) setStatus(res.data);
      } catch (err) {
        console.error('Failed to load live status:', err);
        if (mounted) setError('Failed to load live status.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchStatus();
    return () => { mounted = false; };
  }, [test.id]);

  const formatRemaining = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const total = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = Math.floor(total % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const activeStudents = status?.active_students || [];
  const hasExpiredWindow =
    Boolean(status?.end_date && status?.now) &&
    new Date(status.end_date).getTime() <= new Date(status.now).getTime();

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '620px', margin: '20px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ padding: '18px 20px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#333' }}>Restart Session?</div>
          <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#999' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px' }}>
          <div style={{ fontSize: '14px', color: '#444', marginBottom: '10px' }}>
            This creates a new session for <strong>{test.title}</strong>. Students can attempt again.
          </div>
          {loading && <div style={{ fontSize: '13px', color: '#999' }}>Loading live status?</div>}
          {!loading && error && <div style={{ fontSize: '13px', color: '#C62828' }}>{error}</div>}
          {!loading && !error && status && (
            <>
              <div style={{ background: '#f8f9fa', border: '1px solid #eee', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#555' }}>
                <div style={{ fontWeight: 600, color: '#333', marginBottom: '6px' }}>Active Students</div>
                <div>{status.active_count} currently active</div>
                {activeStudents.length > 0 ? (
                  <div style={{ marginTop: '10px', border: '1px solid #e9e9e9', borderRadius: '6px', overflow: 'hidden', background: '#fff' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 90px', gap: '8px', padding: '8px 10px', background: '#f7f7f7', borderBottom: '1px solid #eee', fontSize: '11px', fontWeight: 700, color: '#777', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      <span>Name</span>
                      <span>Email</span>
                      <span style={{ textAlign: 'right' }}>Remaining</span>
                    </div>
                    {activeStudents.map((s) => (
                      <div key={s.student_id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 2fr 90px', gap: '8px', padding: '8px 10px', fontSize: '12px', borderBottom: '1px solid #f1f1f1' }}>
                        <span style={{ color: '#333', fontWeight: 600 }}>{s.student_name}</span>
                        <span style={{ color: '#777', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.student_email}</span>
                        <span style={{ color: '#555', textAlign: 'right', fontWeight: 600 }}>{formatRemaining(s.remaining_seconds)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>No active students right now.</div>
                )}
              </div>
              <div style={{ marginTop: '10px', fontSize: '12px', color: '#666', background: '#fffaf2', border: '1px solid #fde3b0', borderRadius: '6px', padding: '8px 10px' }}>
                This action creates a new session ID and archives the current one in Session History.
                {hasExpiredWindow ? ' The previous end date is in the past, so restart will reopen the test window.' : ''}
              </div>
            </>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: '1px solid #eee', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 14px', borderRadius: '6px', border: '1px solid #ddd', background: '#fff', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 14px', borderRadius: '6px', border: 'none', background: '#EF6C00', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Restart Session</button>
        </div>
      </div>
    </div>
  );
}

// ??? Live Control Page ???????????????????????????????????????????????????????
function LiveControlPage({ test, onBack, onStartNow, onEndNow, onRestartSession, onTestUpdate }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autoEndSaving, setAutoEndSaving] = useState(false);
  const canEdit = canEditTest(test);

  const formatRemaining = (seconds) => {
    if (seconds === null || seconds === undefined) return '--:--';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`${API_URL}/tests/${test.id}/live-status`);
      setStatus(res.data);
      setError('');
    } catch (err) {
      console.error('Failed to load live status:', err);
      setError('Failed to load live status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!mounted) return;
      await fetchStatus();
    };
    load();
    const id = setInterval(() => { if (mounted) fetchStatus(); }, 10000);
    return () => { mounted = false; clearInterval(id); };
  }, [test.id]);

  const handleAutoEndToggle = async () => {
    if (!status) return;
    const next = !(status.auto_end_at_end_date !== false);
    try {
      setAutoEndSaving(true);
      const res = await apiClient.patch(`${API_URL}/tests/${test.id}`, { auto_end_at_end_date: next });
      setStatus(prev => ({ ...(prev || {}), auto_end_at_end_date: res.data.auto_end_at_end_date }));
      if (onTestUpdate) onTestUpdate(res.data);
    } catch (err) {
      console.error('Failed to update auto-end setting:', err);
      alert('Failed to update auto-end setting. Please try again.');
    } finally {
      setAutoEndSaving(false);
    }
  };

  const copySessionId = async (sessionId) => {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch (err) {
      console.error('Failed to copy session ID:', err);
    }
  };

  return (
    <div style={{ padding: '24px 40px' }}>
      <div style={{ marginBottom: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '14px' }}>? Back</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#999', textTransform: 'uppercase', fontWeight: 600 }}>Live Control</div>
          <h2 style={{ margin: '6px 0 0', fontSize: '20px', color: '#333' }}>{test.title}</h2>
          {!canEdit && (
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#1565c0', fontWeight: 600 }}>
              View-only mode: live edits are disabled.
            </div>
          )}
          {status?.current_session_id && (
            <div style={{ marginTop: '6px', fontSize: '12px', color: '#777' }}>
              Session: <span style={{ fontFamily: 'monospace' }}>{status.current_session_id}</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onStartNow(test)}
            disabled={status?.is_active || !canEdit}
            style={{ padding: '8px 14px', background: (status?.is_active || !canEdit) ? '#f5f5f5' : '#E8F5E9', color: (status?.is_active || !canEdit) ? '#999' : '#2E7D32', border: '1px solid #C8E6C9', borderRadius: '6px', cursor: (status?.is_active || !canEdit) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            Start Now
          </button>
          <button
            onClick={() => onEndNow(test)}
            disabled={!status?.is_active || !canEdit}
            style={{ padding: '8px 14px', background: (!status?.is_active || !canEdit) ? '#f5f5f5' : '#FFEBEE', color: (!status?.is_active || !canEdit) ? '#999' : '#C62828', border: '1px solid #FFCDD2', borderRadius: '6px', cursor: (!status?.is_active || !canEdit) ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            End Now
          </button>
          <button
            onClick={() => onRestartSession && onRestartSession(test)}
            disabled={!canEdit}
            style={{ padding: '8px 14px', background: canEdit ? '#FFF3E0' : '#f5f5f5', color: canEdit ? '#EF6C00' : '#999', border: '1px solid #FFE0B2', borderRadius: '6px', cursor: canEdit ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >
            Restart Session
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '12px', color: '#999' }}>Active Students</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#333' }}>{status?.active_count ?? '--'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '12px', color: '#999' }}>Total Attempts</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#333' }}>{status?.total_attempts ?? '--'}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
          <div style={{ fontSize: '12px', color: '#999' }}>Submitted</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#333' }}>{status?.submitted_count ?? '--'}</div>
        </div>
      </div>

      <div style={{ marginBottom: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>Session Auto-End</div>
            <div style={{ fontSize: '12px', color: '#777', marginTop: '4px' }}>
              Automatically close session at <strong>end date</strong>. Manual restart stays available.
            </div>
          </div>
          <button
            onClick={handleAutoEndToggle}
            disabled={autoEndSaving || !status || !canEdit}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: `1px solid ${(status?.auto_end_at_end_date !== false) ? '#81C784' : '#e0e0e0'}`,
              background: (status?.auto_end_at_end_date !== false) ? '#E8F5E9' : '#fafafa',
              color: (status?.auto_end_at_end_date !== false) ? '#2E7D32' : '#666',
              cursor: autoEndSaving || !status || !canEdit ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: '12px',
              minWidth: '120px',
              opacity: canEdit ? 1 : 0.7,
            }}
          >
            {autoEndSaving ? 'Saving...' : (status?.auto_end_at_end_date !== false ? 'Auto-End: ON' : 'Auto-End: OFF')}
          </button>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#333' }}>Active Students</div>
          <button onClick={fetchStatus} style={{ background: '#fff', border: '1px solid #ddd', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px' }}>Refresh</button>
        </div>
        {loading && <div style={{ fontSize: '13px', color: '#999' }}>Loading?</div>}
        {!loading && error && <div style={{ fontSize: '13px', color: '#C62828' }}>{error}</div>}
        {!loading && !error && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(status?.active_students || []).length === 0 && (
              <div style={{ fontSize: '13px', color: '#999' }}>No active students right now.</div>
            )}
            {(status?.active_students || []).map((s) => (
              <div key={s.student_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid #f0f0f0', borderRadius: '6px', background: '#fafafa' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>{s.student_name}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{s.student_email}</div>
                </div>
                <div style={{ fontSize: '12px', color: '#666', fontWeight: 600 }}>{formatRemaining(s.remaining_seconds)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', padding: '16px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>Session History</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {status?.current_session_id && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', border: '1px solid #d8ebff', background: '#f4f9ff', borderRadius: '6px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#1565c0', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Current Session</div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#333' }}>{status.current_session_id}</div>
              </div>
              <button onClick={() => copySessionId(status.current_session_id)} style={{ border: '1px solid #bbdefb', background: '#fff', color: '#1565c0', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Copy</button>
            </div>
          )}
          {(status?.session_history || []).length === 0 ? (
            <div style={{ fontSize: '13px', color: '#999' }}>No previous sessions yet.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(status.session_history || []).slice().reverse().map((sid, i) => (
                <div key={`${sid}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #f0f0f0', borderRadius: '6px', padding: '6px 10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#999' }}>Previous #{i + 1}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '12px', color: '#555' }}>{sid}</div>
                  </div>
                  <button onClick={() => copySessionId(sid)} style={{ border: '1px solid #ddd', background: '#fff', color: '#666', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}>Copy</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherTestCard({
  test,
  onOpenInfo,
  onStartNow,
  onEndNow,
  onRestartSession,
  onPreview,
  onAddQuestion,
  onLiveControl,
  onOpenDetails,
  onDelete,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const editable = canEditTest(test);
  const owner = isOwnerTest(test);
  const permission = resolvePermission(test);

  return (
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        padding: '18px 22px',
        cursor: 'pointer',
        transition: 'box-shadow 160ms ease, border-color 160ms ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 10px 28px rgba(15,23,42,0.08)';
        e.currentTarget.style.borderColor = '#cbd5e1';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = '#e0e0e0';
      }}
      onClick={() => onOpenInfo(test)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '8px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#263238', margin: 0, minWidth: 0 }}>{test.title}</h3>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', background: permission === 'owner' ? '#ede7f6' : permission === 'edit' ? '#fff3e0' : '#e3f2fd', color: permission === 'owner' ? '#5e35b1' : permission === 'edit' ? '#ef6c00' : '#1565c0' }}>
            {permission}
          </span>
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: test.is_active ? '#E8F5E9' : '#f5f5f5', color: test.is_active ? '#4CAF50' : '#999' }}>
            {test.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#667085', marginBottom: '10px', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {test.test_type === 'invite_only' ? <Lock size={12} /> : <Globe size={12} />}
          {test.test_type === 'invite_only' ? 'Invite only' : 'Public'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {test.duration_minutes} min
        </span>
        {test.assessment_id && <span style={{ fontFamily: 'monospace' }}>ID: {test.assessment_id}</span>}
        <span>Created {Math.max(0, Math.floor((Date.now() - new Date(test.created_at)) / 3600000))}h ago</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '14px' }}>
        {(test.allowed_languages || []).map(lang => (
          <span key={lang} style={{ padding: '2px 7px', backgroundColor: '#e3f2fd', color: '#1565c0', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
            {lang === 'cpp' ? 'C++' : lang.charAt(0).toUpperCase() + lang.slice(1)}
          </span>
        ))}
        {Array.isArray(test.tags) && test.tags.length > 0 && test.tags.map((tag, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', backgroundColor: '#fff8e1', color: '#f57f17', borderRadius: '10px', fontSize: '11px', border: '1px solid #ffe082' }}>
            <Tag size={9} />{tag}
          </span>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          aria-expanded={isExpanded}
          style={{
            padding: '7px 14px',
            backgroundColor: isExpanded ? '#eef2ff' : '#fff',
            color: '#1d4ed8',
            border: '1px solid #bfdbfe',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 800,
          }}
        >
          {isExpanded ? 'Close' : 'Open'}
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: isExpanded ? 240 : 0,
          opacity: isExpanded ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 220ms ease, opacity 180ms ease, margin-top 180ms ease',
          marginTop: isExpanded ? 14 : 0,
          borderTop: isExpanded ? '1px solid #eef2f7' : '1px solid transparent',
          paddingTop: isExpanded ? 14 : 0,
        }}
      >
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {!test.is_active && editable && (
            <button onClick={(e) => onStartNow(test, e)} style={{ padding: '7px 12px', backgroundColor: '#E8F5E9', color: '#2E7D32', border: '1px solid #C8E6C9', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              Start Now
            </button>
          )}
          {test.is_active && editable && (
            <button onClick={(e) => onEndNow(test, e)} style={{ padding: '7px 12px', backgroundColor: '#FFEBEE', color: '#C62828', border: '1px solid #FFCDD2', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              End Now
            </button>
          )}
          {editable && (
            <button onClick={(e) => onRestartSession(test, e)} style={{ padding: '7px 12px', backgroundColor: '#FFF3E0', color: '#EF6C00', border: '1px solid #FFE0B2', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
              Restart Session
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onPreview(test); }} style={{ padding: '7px 12px', backgroundColor: '#fff', color: '#2196F3', border: '1px solid #2196F3', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Eye size={12} /> Preview
          </button>
          {editable && (
            <button onClick={(e) => onAddQuestion(test, e)} style={{ padding: '7px 12px', backgroundColor: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={12} /> Add Question
            </button>
          )}
          <button onClick={(e) => { e.stopPropagation(); onLiveControl(test); }} style={{ padding: '7px 12px', backgroundColor: '#fff', color: '#1565c0', border: '1px solid #90CAF9', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
            Live Control
          </button>
          <button onClick={(e) => { e.stopPropagation(); onOpenDetails(test); }} style={{ padding: '7px 12px', backgroundColor: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
            Analysis
          </button>
          {owner && (
            <button onClick={(e) => onDelete(test, e)} style={{ padding: '7px 12px', backgroundColor: '#fff', color: '#F44336', border: '1px solid #F44336', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Trash2 size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TeacherDashboard() {
  const [selectedTestForDetails, setSelectedTestForDetails] = useState(null);
  const [testInfoModal, setTestInfoModal] = useState(null);
  const [tests, setTests] = useState([]);
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [showCreateQuestion, setShowCreateQuestion] = useState(false);
  const [selectedTest, setSelectedTest] = useState(null);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [selectedTestTitle, setSelectedTestTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [endConfirmTest, setEndConfirmTest] = useState(null);
  const [restartConfirmTest, setRestartConfirmTest] = useState(null);
  const [liveControlTest, setLiveControlTest] = useState(null);

  useEffect(() => { fetchTests(); }, []);

  const fetchTests = async () => {
    try {
      const response = await apiClient.get(`${API_URL}/tests`);
      setTests(response.data);
    } catch (error) { console.error('Error fetching tests:', error); }
  };

  const handleDeleteTest = async (test, e) => {
    if (e) e.stopPropagation();
    if (!isOwnerTest(test)) {
      alert('Only the original test creator can delete this test.');
      return;
    }
    const ok = window.confirm(`Delete test "${test.title}"? This will remove all questions, test cases, and submissions.`);
    if (!ok) return;
    try {
      await apiClient.delete(`${API_URL}/tests/${test.id}`);
      fetchTests();
    } catch (error) {
      console.error('Error deleting test:', error);
      alert('Failed to delete test. Please try again.');
    }
  };

  const handleStartNow = async (test, e) => {
    if (e) e.stopPropagation();
    if (!canEditTest(test)) {
      alert('You have view-only access for this test.');
      return;
    }
    try {
      const res = await apiClient.post(`${API_URL}/tests/${test.id}/start-now`);
      handleTestUpdate(res.data);
    } catch (error) {
      console.error('Error starting test:', error);
      alert('Failed to start test. Please try again.');
    }
  };

  const openCreateQuestion = (test, e) => {
    if (e) e.stopPropagation();
    if (!canEditTest(test || selectedTestForDetails)) {
      alert('You have view-only access for this test.');
      return;
    }
    if (selectedTestForDetails) {
      setShowCreateQuestion(true);
      return;
    }
    setSelectedTest(test);
    setShowCreateQuestion(true);
  };

  const handleEndNow = (test, e) => {
    if (e) e.stopPropagation();
    if (!canEditTest(test)) {
      alert('You have view-only access for this test.');
      return;
    }
    setEndConfirmTest(test);
  };

  const handleRestartSession = async (test, e) => {
    if (e) e.stopPropagation();
    if (!canEditTest(test)) {
      alert('You have view-only access for this test.');
      return;
    }
    setRestartConfirmTest(test);
  };

  const handleTestUpdate = (updated) => {
    setTests(prev => prev.map(t => t.id === updated.id ? updated : t));
    if (testInfoModal?.id === updated.id) setTestInfoModal(updated);
    if (liveControlTest?.id === updated.id) setLiveControlTest(updated);
  };

  const confirmEndNow = async () => {
    if (!endConfirmTest) return;
    try {
      const res = await apiClient.post(`${API_URL}/tests/${endConfirmTest.id}/end-now`);
      handleTestUpdate(res.data);
      setEndConfirmTest(null);
    } catch (error) {
      console.error('Error ending test:', error);
      alert('Failed to end test. Please try again.');
    }
  };

  const confirmRestartSession = async () => {
    if (!restartConfirmTest) return;
    try {
      const res = await apiClient.post(`${API_URL}/tests/${restartConfirmTest.id}/restart-session`);
      handleTestUpdate(res.data);
      setRestartConfirmTest(null);
    } catch (error) {
      console.error('Error restarting session:', error);
      alert('Failed to restart session. Please try again.');
    }
  };

  const filteredTests = tests.filter(test => {
    const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (Array.isArray(test.tags) ? test.tags : []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'drafts' && !test.is_active);
    return matchesSearch && matchesStatus;
  });

  if (liveControlTest) {
    return (
      <>
      <LiveControlPage
          test={liveControlTest}
          onBack={() => setLiveControlTest(null)}
          onStartNow={handleStartNow}
          onEndNow={handleEndNow}
          onRestartSession={handleRestartSession}
          onTestUpdate={handleTestUpdate}
        />
        {endConfirmTest && (
          <EndTestConfirmModal
            test={endConfirmTest}
            onCancel={() => setEndConfirmTest(null)}
            onConfirm={confirmEndNow}
          />
        )}
        {restartConfirmTest && (
          <RestartSessionConfirmModal
            test={restartConfirmTest}
            onCancel={() => setRestartConfirmTest(null)}
            onConfirm={confirmRestartSession}
          />
        )}
      </>
    );
  }

  if (selectedTestForDetails) {
    return (
      <>
        <TestDetailsPage
          test={selectedTestForDetails}
          canEdit={canEditTest(selectedTestForDetails)}
          onBack={() => setSelectedTestForDetails(null)}
          onAddQuestion={(test) => openCreateQuestion(test)}
        />
        {showCreateQuestion && selectedTestForDetails && (
          <CreateQuestionModal
            test={selectedTestForDetails}
            onClose={() => { setShowCreateQuestion(false); }}
            onSuccess={() => { setShowCreateQuestion(false); }}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f5f5f5', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: '200px', backgroundColor: '#fff', borderRight: '1px solid #e0e0e0', padding: '20px', flexShrink: 0 }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', fontWeight: 600 }}>Test status</div>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input type="radio" name="status" checked={statusFilter === 'all'} onChange={() => setStatusFilter('all')} style={{ marginRight: '8px' }} />
            <span>All ({tests.length})</span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input type="radio" name="status" checked={statusFilter === 'drafts'} onChange={() => setStatusFilter('drafts')} style={{ marginRight: '8px' }} />
            <span style={{ color: '#2196F3' }}>Drafts ({tests.filter(t => !t.is_active).length})</span>
          </label>
        </div>
        <div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px', fontWeight: 600 }}>Test type</div>
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} /> Public
          </label>
          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
            <input type="checkbox" defaultChecked style={{ marginRight: '8px' }} /> Invite only
          </label>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '24px 40px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', flex: 1, maxWidth: '500px' }}>
            <input type="text" placeholder="Search by test names or tags" value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid #ddd', borderRadius: '4px 0 0 4px', fontSize: '14px', outline: 'none' }} />
            <button style={{ padding: '8px 14px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '0 4px 4px 0', cursor: 'pointer' }}>
              <Search size={15} />
            </button>
          </div>
          <button onClick={() => setShowCreateTest(true)}
            style={{ padding: '10px 20px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={16} /> Create new test
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredTests.map(test => (
            <TeacherTestCard
              key={test.id}
              test={test}
              onOpenInfo={setTestInfoModal}
              onStartNow={handleStartNow}
              onEndNow={handleEndNow}
              onRestartSession={handleRestartSession}
              onPreview={(t) => {
                setSelectedTestId(t.id);
                setSelectedTestTitle(t.title);
                setShowQuestionsModal(true);
              }}
              onAddQuestion={openCreateQuestion}
              onLiveControl={setLiveControlTest}
              onOpenDetails={setSelectedTestForDetails}
              onDelete={handleDeleteTest}
            />
          ))}

          {filteredTests.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#fff', borderRadius: '4px', border: '1px solid #e0e0e0' }}>
              <p style={{ color: '#999', fontSize: '14px' }}>No tests found</p>
            </div>
          )}
        </div>
      </div>

      {/* Test Info Modal */}
      {testInfoModal && (
        <TestInfoModal
          test={testInfoModal}
          onClose={() => setTestInfoModal(null)}
          onUpdate={handleTestUpdate}
          onLiveControl={(t) => { setTestInfoModal(null); setLiveControlTest(t); }}
          onEndNow={(t) => setEndConfirmTest(t)}
          onRestartSession={handleRestartSession}
        />
      )}

      {showCreateTest && (
        <CreateTestModal onClose={() => setShowCreateTest(false)} onSuccess={() => { setShowCreateTest(false); fetchTests(); }} />
      )}
      {showCreateQuestion && selectedTest && (
        <CreateQuestionModal test={selectedTest}
          onClose={() => { setShowCreateQuestion(false); setSelectedTest(null); }}
          onSuccess={() => { setShowCreateQuestion(false); setSelectedTest(null); }} />
      )}
      <QuestionsModal testId={selectedTestId} testTitle={selectedTestTitle} isOpen={showQuestionsModal}
        onClose={() => { setShowQuestionsModal(false); setSelectedTestId(null); setSelectedTestTitle(''); }} />

      {endConfirmTest && (
        <EndTestConfirmModal
          test={endConfirmTest}
          onCancel={() => setEndConfirmTest(null)}
          onConfirm={confirmEndNow}
        />
      )}
      {restartConfirmTest && (
        <RestartSessionConfirmModal
          test={restartConfirmTest}
          onCancel={() => setRestartConfirmTest(null)}
          onConfirm={confirmRestartSession}
        />
      )}
    </div>
  );
}

// â”€â”€â”€ Create Test Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CreateTestModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    title: '', description: '', duration_minutes: 60, is_active: true,
    test_type: 'invite_only', start_date: '', end_date: '', tags: '',
    anti_paste_enabled: true, tab_switch_enabled: true, tab_switch_limit: 3,
    auto_end_at_end_date: true,
    negative_marking_enabled: false,
    negative_marking_marks: 0,
    geo_fencing_enabled: false,
    geo_latitude: '',
    geo_longitude: '',
    geo_radius_meters: 100
  });
  const [allowedLangs, setAllowedLangs] = useState(['python', 'c', 'cpp', 'java']);

  const toggleLang = id => setAllowedLangs(prev => prev.includes(id) ? prev.filter(l => l !== id) : [...prev, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (allowedLangs.length === 0) { alert('Please allow at least one programming language.'); return; }
    if (formData.geo_fencing_enabled && (!formData.geo_latitude || !formData.geo_longitude)) {
      alert('Please enter latitude and longitude for geofencing.');
      return;
    }
    try {
      await apiClient.post(`${API_URL}/tests`, {
        ...formData,
        duration_minutes: parseInt(formData.duration_minutes),
        allowed_languages: allowedLangs,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        tab_switch_limit: parseInt(formData.tab_switch_limit) || 3,
        negative_marking_enabled: !!formData.negative_marking_enabled,
        negative_marking_marks: parseFloat(formData.negative_marking_marks) || 0,
        geo_fencing_enabled: !!formData.geo_fencing_enabled,
        geo_latitude: formData.geo_latitude === '' ? null : parseFloat(formData.geo_latitude),
        geo_longitude: formData.geo_longitude === '' ? null : parseFloat(formData.geo_longitude),
        geo_radius_meters: parseInt(formData.geo_radius_meters, 10) || 100,
      });
      onSuccess();
    } catch (error) { console.error('Error creating test:', error); alert('Failed to create test'); }
  };

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '28px', width: '100%', maxWidth: '540px', margin: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Create New Test</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Title *</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={inp} required />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ ...inp, minHeight: '70px' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Duration (minutes)</label>
              <input type="number" value={formData.duration_minutes} min="1" onChange={e => setFormData({ ...formData, duration_minutes: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Test Type</label>
              <select value={formData.test_type} onChange={e => setFormData({ ...formData, test_type: e.target.value })} style={inp}>
                <option value="invite_only">Invite Only</option>
                <option value="public">Public</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Start Date</label>
              <input type="datetime-local" value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>End Date</label>
              <input type="datetime-local" value={formData.end_date} onChange={e => setFormData({ ...formData, end_date: e.target.value })} style={inp} />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Tags <span style={{ color: '#999', fontWeight: 400 }}>(comma separated)</span></label>
            <input type="text" placeholder="e.g. DSA, Arrays, Midterm" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} style={inp} />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Anti-Cheat Settings</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.anti_paste_enabled}
                  onChange={e => setFormData({ ...formData, anti_paste_enabled: e.target.checked })}
                />
                Disable Copy/Paste
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.tab_switch_enabled}
                  onChange={e => setFormData({ ...formData, tab_switch_enabled: e.target.checked })}
                />
                Enable Tab Switch Detection
              </label>
            </div>
            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '6px', color: '#555' }}>
                Tab Switch Limit
              </label>
              <input
                type="number"
                min="1"
                value={formData.tab_switch_limit}
                disabled={!formData.tab_switch_enabled}
                onChange={e => setFormData({ ...formData, tab_switch_limit: e.target.value })}
                style={{ ...inp, backgroundColor: formData.tab_switch_enabled ? '#fff' : '#f5f5f5' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.auto_end_at_end_date}
                onChange={e => setFormData({ ...formData, auto_end_at_end_date: e.target.checked })}
              />
              Auto-end test at end date
            </label>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Scoring</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={formData.negative_marking_enabled}
                onChange={e => setFormData({ ...formData, negative_marking_enabled: e.target.checked })}
              />
              Enable Negative Marking (Coding)
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={formData.negative_marking_marks}
              disabled={!formData.negative_marking_enabled}
              onChange={e => setFormData({ ...formData, negative_marking_marks: e.target.value })}
              style={{ ...inp, backgroundColor: formData.negative_marking_enabled ? '#fff' : '#f5f5f5' }}
              placeholder="Negative points per wrong submission"
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px' }}>Location Restriction</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', marginBottom: '8px' }}>
              <input
                type="checkbox"
                checked={formData.geo_fencing_enabled}
                onChange={e => setFormData({ ...formData, geo_fencing_enabled: e.target.checked })}
              />
              Allow attempts only from a specific location
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <input
                type="number"
                step="0.000001"
                value={formData.geo_latitude}
                onChange={e => setFormData({ ...formData, geo_latitude: e.target.value })}
                style={inp}
                placeholder="Latitude"
              />
              <input
                type="number"
                step="0.000001"
                value={formData.geo_longitude}
                onChange={e => setFormData({ ...formData, geo_longitude: e.target.value })}
                style={inp}
                placeholder="Longitude"
              />
            </div>
            <input
              type="number"
              min="25"
              max="5000"
              value={formData.geo_radius_meters}
              onChange={e => setFormData({ ...formData, geo_radius_meters: e.target.value })}
              style={inp}
              placeholder="Allowed radius in meters"
            />
            <div style={{ fontSize: '12px', color: '#999', marginTop: '6px' }}>
              Example: use 100-250 meters for a classroom or campus building.
            </div>
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '8px' }}>Allowed Languages</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', padding: '10px', border: '1px solid #ddd', borderRadius: '4px', backgroundColor: '#fafafa' }}>
              {LANGUAGE_OPTIONS.map(lang => {
                const checked = allowedLangs.includes(lang.id);
                return (
                  <label key={lang.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', padding: '5px 12px', borderRadius: '4px', border: `1px solid ${checked ? '#2196F3' : '#ddd'}`, backgroundColor: checked ? '#e3f2fd' : '#fff', fontSize: '13px', fontWeight: 500, color: checked ? '#1565c0' : '#555', userSelect: 'none' }}>
                    <input type="checkbox" checked={checked} onChange={() => toggleLang(lang.id)} style={{ display: 'none' }} />
                    {checked ? <Check size={12} /> : null} {lang.label}
                  </label>
                );
              })}
            </div>
            {allowedLangs.length === 0 && <div style={{ fontSize: '12px', color: '#F44336', marginTop: '4px' }}>Select at least one language</div>}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', backgroundColor: 'white' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Create Test</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// â”€â”€â”€ Create Question Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CreateQuestionModal({ test, onClose, onSuccess }) {
  const [formData, setFormData] = useState({ test_id: test.id, title: '', description: '', image_url: '', difficulty: 'EASY', topic: 'ARRAYS', points: 10, time_limit_ms: 2000 });
  const [customTopic, setCustomTopic] = useState('');
  const [isCustomTopic, setIsCustomTopic] = useState(false);
  const [customDifficulty, setCustomDifficulty] = useState('');
  const [isCustomDifficulty, setIsCustomDifficulty] = useState(false);
  const [testCases, setTestCases] = useState([{ input: '', expected_output: '', is_hidden: false, points: 1 }]);
  const [questionType, setQuestionType] = useState('coding'); // "coding" | "mcq"
  const [mcqOptions, setMcqOptions] = useState(['', '']);
  const [mcqCorrect, setMcqCorrect] = useState(0);
  const [mcqNegativeEnabled, setMcqNegativeEnabled] = useState(false);
  const [mcqNegativeMarks, setMcqNegativeMarks] = useState(0);

  const addTestCase = () => setTestCases([...testCases, { input: '', expected_output: '', is_hidden: false, points: 1 }]);
  const removeTestCase = index => { if (testCases.length === 1) return; setTestCases(testCases.filter((_, i) => i !== index)); };

  const handleTopicChange = e => {
    const value = e.target.value;
    if (value === 'CUSTOM') { setIsCustomTopic(true); setFormData({ ...formData, topic: '' }); }
    else { setIsCustomTopic(false); setCustomTopic(''); setFormData({ ...formData, topic: value }); }
  };

  const handleDifficultyChange = e => {
    const value = e.target.value;
    if (value === 'CUSTOM') {
      setIsCustomDifficulty(true);
      setFormData({ ...formData, difficulty: '' });
      return;
    }
    setIsCustomDifficulty(false);
    setCustomDifficulty('');
    setFormData({ ...formData, difficulty: value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (isCustomTopic && !customTopic.trim()) { alert('Please enter a custom topic name.'); return; }
    try {
      if (questionType === 'mcq') {
        const options = mcqOptions.map(o => o.trim()).filter(Boolean);
        if (options.length < 2) { alert('MCQ needs at least 2 options.'); return; }
        if (mcqCorrect < 0 || mcqCorrect >= options.length) { alert('Select a valid correct option.'); return; }
        await apiClient.post(`${API_URL}/questions`, {
          ...formData,
          question_type: 'mcq',
          mcq_options: options,
          mcq_correct_option: mcqCorrect,
          mcq_negative_enabled: mcqNegativeEnabled,
          mcq_negative_marks: mcqNegativeEnabled ? parseFloat(mcqNegativeMarks) || 0 : 0,
          time_limit_ms: formData.time_limit_ms ?? 0,
        });
      } else {
        const qRes = await apiClient.post(`${API_URL}/questions`, { ...formData, question_type: 'coding' });
        for (const tc of testCases) await apiClient.post(`${API_URL}/test-cases`, { question_id: qRes.data.id, ...tc });
      }
      alert('Question created successfully!');
      onSuccess();
    } catch (error) { console.error('Error:', error); alert('Failed to create question'); }
  };

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '14px', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, overflowY: 'auto' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '100%', maxWidth: '700px', margin: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px' }}>Add Question to: {test.title}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Question Type</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setQuestionType('coding')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${questionType === 'coding' ? '#2196F3' : '#ddd'}`,
                  background: questionType === 'coding' ? '#e3f2fd' : '#fff',
                  color: questionType === 'coding' ? '#1565c0' : '#555',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Normal (Coding)
              </button>
              <button
                type="button"
                onClick={() => setQuestionType('mcq')}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${questionType === 'mcq' ? '#2196F3' : '#ddd'}`,
                  background: questionType === 'mcq' ? '#e3f2fd' : '#fff',
                  color: questionType === 'mcq' ? '#1565c0' : '#555',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                MCQ
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Question Title</label>
            <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={inp} required />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Description</label>
            <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} style={{ ...inp, minHeight: '100px' }} required />
          </div>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Question Image URL</label>
            <input
              type="url"
              value={formData.image_url}
              onChange={e => setFormData({ ...formData, image_url: e.target.value })}
              style={inp}
              placeholder="https://example.com/question-image.png"
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Difficulty</label>
              <select value={isCustomDifficulty ? 'CUSTOM' : formData.difficulty} onChange={handleDifficultyChange} style={inp}>
                <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                <option value="CUSTOM">Custom Difficulty...</option>
              </select>
              {isCustomDifficulty && (
                <input
                  type="text"
                  placeholder="e.g. Beginner, Expert, Company-Level"
                  value={customDifficulty}
                  onChange={e => {
                    const raw = e.target.value;
                    setCustomDifficulty(raw);
                    setFormData({ ...formData, difficulty: raw.trim().toUpperCase().replace(/\s+/g, '_') });
                  }}
                  style={{ ...inp, border: '1px solid #2196F3', marginTop: '8px' }}
                  autoFocus
                  required={isCustomDifficulty}
                />
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Topic</label>
              <select value={isCustomTopic ? 'CUSTOM' : formData.topic} onChange={handleTopicChange} style={inp}>
                <option value="ARRAYS">Arrays</option><option value="STRINGS">Strings</option>
                <option value="LINKED_LISTS">Linked Lists</option><option value="TREES">Trees</option>
                <option value="GRAPHS">Graphs</option><option value="SORTING">Sorting</option>
                <option value="SEARCHING">Searching</option><option value="DYNAMIC_PROGRAMMING">Dynamic Programming</option>
                <option value="RECURSION">Recursion</option><option value="BACKTRACKING">Backtracking</option>
                <option value="STACK_QUEUE">Stack & Queue</option><option value="HEAP">Heap / Priority Queue</option>
                <option value="CUSTOM">Custom Topic...</option>
              </select>
              {isCustomTopic && (
                <input type="text" placeholder="e.g. Machine Learning" value={customTopic}
                  onChange={e => { setCustomTopic(e.target.value); setFormData({ ...formData, topic: e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') }); }}
                  style={{ ...inp, border: '1px solid #2196F3', marginTop: '8px' }} autoFocus required={isCustomTopic} />
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Points</label>
              <input type="number" value={formData.points} min="1" onChange={e => setFormData({ ...formData, points: parseInt(e.target.value) })} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Time Limit (ms)</label>
              <input type="number" value={formData.time_limit_ms} min="100" step="100" onChange={e => setFormData({ ...formData, time_limit_ms: parseInt(e.target.value) })} style={inp} />
            </div>
          </div>
          {questionType === 'coding' ? (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '15px', fontWeight: 600 }}>Test Cases</h4>
                <button type="button" onClick={addTestCase} style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>+ Add Test Case</button>
              </div>
              {testCases.map((tc, index) => (
                <div key={index} style={{ backgroundColor: '#f9f9f9', padding: '12px', borderRadius: '4px', marginBottom: '10px', border: '1px solid #eee' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#555' }}>Test Case #{index + 1}</span>
                    {testCases.length > 1 && <button type="button" onClick={() => removeTestCase(index)} style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px' }}>Remove</button>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Input</label>
                      <textarea value={tc.input} onChange={e => { const u = [...testCases]; u[index].input = e.target.value; setTestCases(u); }}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '60px', fontFamily: 'monospace', boxSizing: 'border-box' }} required />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Expected Output</label>
                      <textarea value={tc.expected_output} onChange={e => { const u = [...testCases]; u[index].expected_output = e.target.value; setTestCases(u); }}
                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', minHeight: '60px', fontFamily: 'monospace', boxSizing: 'border-box' }} required />
                    </div>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', marginTop: '8px', fontSize: '13px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={tc.is_hidden} onChange={e => { const u = [...testCases]; u[index].is_hidden = e.target.checked; setTestCases(u); }} style={{ marginRight: '6px' }} />
                    Hidden Test Case
                  </label>
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, marginBottom: '4px' }}>Marks</label>
                    <input
                      type="number"
                      min="1"
                      value={tc.points}
                      onChange={e => {
                        const u = [...testCases];
                        u[index].points = parseInt(e.target.value, 10) || 1;
                        setTestCases(u);
                      }}
                      style={{ ...inp, fontSize: '13px' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ borderTop: '1px solid #eee', paddingTop: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>MCQ Options</div>
              {mcqOptions.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="radio"
                    checked={mcqCorrect === idx}
                    onChange={() => setMcqCorrect(idx)}
                  />
                  <input
                    type="text"
                    value={opt}
                    onChange={(e) => {
                      const next = [...mcqOptions];
                      next[idx] = e.target.value;
                      setMcqOptions(next);
                    }}
                    placeholder={`Option ${idx + 1}`}
                    style={{ ...inp, flex: 1 }}
                    required
                  />
                  {mcqOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const next = mcqOptions.filter((_, i) => i !== idx);
                        setMcqOptions(next);
                        if (mcqCorrect >= next.length) setMcqCorrect(next.length - 1);
                      }}
                      style={{ background: 'none', border: 'none', color: '#F44336', cursor: 'pointer', fontSize: '12px' }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMcqOptions(prev => [...prev, ''])}
                style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
              >
                + Add Option
              </button>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={mcqNegativeEnabled}
                    onChange={(e) => setMcqNegativeEnabled(e.target.checked)}
                  />
                  Enable Negative Marking
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={mcqNegativeMarks}
                  disabled={!mcqNegativeEnabled}
                  onChange={(e) => setMcqNegativeMarks(e.target.value)}
                  style={{ ...inp, width: '140px', backgroundColor: mcqNegativeEnabled ? '#fff' : '#f5f5f5' }}
                  placeholder="Negative points"
                />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', backgroundColor: 'white' }}>Cancel</button>
            <button type="submit" style={{ flex: 1, padding: '10px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>Create Question</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TeacherDashboard;

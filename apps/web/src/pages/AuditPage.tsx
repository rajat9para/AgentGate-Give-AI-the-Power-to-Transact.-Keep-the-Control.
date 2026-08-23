import { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, FileText,
  Search, Download, Code2, RefreshCw, Filter, Sparkles, Shield
} from 'lucide-react';
import { auditApi } from '../lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = () => {
    setRefreshing(true);
    auditApi.getAll()
      .then(setLogs)
      .catch(console.error)
      .finally(() => {
        setLoaded(true);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'success': return <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />;
      case 'failed': return <XCircle size={16} style={{ color: 'var(--error)' }} />;
      case 'blocked': return <AlertTriangle size={16} style={{ color: 'var(--error)' }} />;
      case 'pending': return <Clock size={16} style={{ color: 'var(--warning)' }} />;
      default: return null;
    }
  };

  const getDecisionBadge = (decision: string | null) => {
    if (!decision) return null;
    const cls = decision === 'GREEN' ? 'green' : decision === 'AMBER' ? 'amber' : 'red';
    return <span className={`badge badge-${cls}`}>{decision}</span>;
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `agentgate-audit-trail-${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filterResult === 'ALL' || log.result === filterResult.toLowerCase();
    const matchesSearch = searchTerm
      ? log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.agent_id && log.agent_id.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;
    return matchesFilter && matchesSearch;
  });

  if (!loaded) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1>Immutable Audit Trail</h1>
          <p>Every autonomous action, negotiation step, policy check, and payment event recorded for full auditability</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" onClick={handleExportJson} disabled={logs.length === 0}>
            <Download size={15} /> Export JSON
          </button>
          <button className="btn btn-secondary" onClick={fetchLogs} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spinner' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-label">Total Audit Events</div>
          <div className="stat-card-value" style={{ color: 'var(--text-primary)' }}>{logs.length}</div>
          <div className="stat-card-subtitle">Recorded in session history</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Successful Actions</div>
          <div className="stat-card-value" style={{ color: 'var(--success)' }}>
            {logs.filter(l => l.result === 'success').length}
          </div>
          <div className="stat-card-subtitle">Policy approved & executed</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-label">Blocked / Guarded Actions</div>
          <div className="stat-card-value" style={{ color: 'var(--error)' }}>
            {logs.filter(l => l.result === 'blocked').length}
          </div>
          <div className="stat-card-subtitle">Protected from policy violation</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {['ALL', 'SUCCESS', 'BLOCKED', 'FAILED', 'PENDING'].map((res) => (
            <button
              key={res}
              className={`category-pill ${filterResult === res ? 'active' : ''}`}
              onClick={() => setFilterResult(res)}
            >
              {res}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="form-input"
            placeholder="Search audit actions, reasons, or agents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', paddingLeft: 38 }}
          />
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <FileText size={48} style={{ color: 'var(--text-muted)', marginBottom: 16 }} />
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Audit Logs Yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Execute a purchase flow in the <strong>AI Buyer</strong> tab to generate an end-to-end audit trail.
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ color: 'var(--text-muted)' }}>No audit events matching current filter or search criteria.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Event Sequence ({filteredLogs.length} events)</span>
            <span className="badge badge-purple">Full Traceability</span>
          </div>

          <div className="audit-timeline">
            {filteredLogs.map((log, i) => {
              const isExpanded = expandedLogId === (log.id || `log-${i}`);
              return (
                <div key={log.id || i} className="audit-item">
                  <div className={`audit-dot ${log.result}`}>
                    {getResultIcon(log.result)}
                  </div>
                  <div className="audit-content">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="audit-action" style={{ fontSize: 14, fontWeight: 700 }}>
                          {log.action.replace(/_/g, ' ')}
                        </span>
                        {getDecisionBadge(log.policy_result)}
                        <span className={`badge badge-${log.result === 'success' ? 'green' : log.result === 'blocked' ? 'red' : log.result === 'failed' ? 'red' : 'amber'}`}>
                          {log.result}
                        </span>
                      </div>

                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => setExpandedLogId(isExpanded ? null : (log.id || `log-${i}`))}
                      >
                        <Code2 size={13} /> {isExpanded ? 'Hide Raw JSON' : 'Inspect JSON'}
                      </button>
                    </div>

                    <div className="audit-reason" style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                      {log.reason}
                    </div>

                    <div className="audit-meta" style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                      {log.requested_amount != null && (
                        <span>Requested: <strong style={{ color: 'var(--text-secondary)' }}>₹{log.requested_amount}</strong></span>
                      )}
                      {log.approved_amount != null && (
                        <span>Approved: <strong style={{ color: 'var(--success)' }}>₹{log.approved_amount}</strong></span>
                      )}
                      <span>Agent: <strong style={{ color: 'var(--accent-primary)' }}>{log.agent_id}</strong></span>
                      <span>Time: {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    </div>

                    {/* Expandable JSON Inspector */}
                    {isExpanded && (
                      <div style={{ marginTop: 12 }}>
                        <div className="code-inspector">
                          <pre>{JSON.stringify(log, null, 2)}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

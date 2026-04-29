import { useState, useEffect } from 'react';
import { Search, Clock, FileText, Mail, CheckCircle } from 'lucide-react';
import { apiClient } from '../services/api';

function StudentTestList({ onSelectTest, onSwitchView }) {
  const [tests, setTests]               = useState([]);
  const [submissions, setSubmissions]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingSubs, setLoadingSubs]   = useState(true);
  const [searchQuery, setSearchQuery]   = useState('');
  const [activeTab, setActiveTab]       = useState('available'); // 'available' | 'completed'

  useEffect(() => {
    fetchTests();
    fetchSubmissions();
  }, []);

  const fetchTests = async () => {
    try {
      const response = await apiClient.get('/teacher/student/tests');
      setTests(response.data);
    } catch (error) {
      console.error('Error fetching tests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const response = await apiClient.get('/student/my-submissions');
      setSubmissions(response.data);
    } catch (error) {
      console.error('Error fetching submissions:', error);
    } finally {
      setLoadingSubs(false);
    }
  };

  // Set of test_ids the student has already submitted
  const completedTestIds = new Set(submissions.map(s => s.test_id));

  const filteredTests = tests.filter(test =>
    (test.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     test.description?.toLowerCase().includes(searchQuery.toLowerCase())) &&
    !completedTestIds.has(test.id)
  );

  const filteredSubmissions = submissions.filter(sub =>
    sub.test_title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isLoading = activeTab === 'available' ? loading : loadingSubs;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5', fontFamily: "'Segoe UI', sans-serif" }}>

      {/* Sidebar */}
      <div style={{ width: '200px', background: '#fff', borderRight: '1px solid #e0e0e0', padding: '24px 16px', flexShrink: 0 }}>
        <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '16px', marginTop: 0 }}>
          Test filters
        </h3>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>Test status</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333', marginBottom: '6px', cursor: 'pointer' }}>
            <input type="radio" name="status" checked={activeTab === 'available'} onChange={() => setActiveTab('available')} readOnly /> Active
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333', marginBottom: '6px', cursor: 'pointer' }}>
            <input type="radio" name="status" checked={activeTab === 'completed'} onChange={() => setActiveTab('completed')} readOnly /> Completed
          </label>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>Difficulty</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#333', marginBottom: '6px' }}>
            <input type="checkbox" defaultChecked /> All levels
          </label>
        </div>

        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#666', marginBottom: '8px' }}>Duration</div>
          <select style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #e0e0e0', borderRadius: '4px', background: '#fff' }}>
            <option>Any time</option>
            <option>Under 30 mins</option>
            <option>30â€“60 mins</option>
            <option>60â€“90 mins</option>
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '32px 40px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '600', color: '#333', margin: '0 0 4px' }}>
              {activeTab === 'available' ? 'Available Tests' : 'Completed Tests'}
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              {activeTab === 'available'
                ? 'Select a test to begin your coding challenge'
                : 'Tests you have already submitted'}
            </p>
          </div>
          {onSwitchView && (
            <button onClick={onSwitchView} style={{
              background: '#fff', color: '#2196F3', border: '1px solid #2196F3',
              borderRadius: '4px', padding: '8px 16px', fontSize: '14px', fontWeight: '500', cursor: 'pointer'
            }}>
              Teacher View
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid #e0e0e0' }}>
          {['available', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '10px 24px',
                fontSize: '14px',
                fontWeight: activeTab === tab ? '600' : '400',
                color: activeTab === tab ? '#2196F3' : '#666',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #2196F3' : '2px solid transparent',
                marginBottom: '-2px',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.15s',
              }}
            >
              {tab === 'available' ? `Available (${tests.filter(t => !completedTestIds.has(t.id)).length})` : `Completed (${submissions.length})`}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
            <input
              type="text"
              placeholder={activeTab === 'available' ? 'Search by test name or description' : 'Search completed tests'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', padding: '10px 12px 10px 36px', fontSize: '14px',
                border: '1px solid #e0e0e0', borderRadius: '4px', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <button style={{
            background: '#2196F3', color: '#fff', border: 'none',
            borderRadius: '4px', padding: '10px 20px', fontSize: '14px', fontWeight: '500',
            cursor: 'pointer', whiteSpace: 'nowrap'
          }}>
            Search
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{
              width: '32px', height: '32px', border: '3px solid #e0e0e0',
              borderTopColor: '#2196F3', borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 12px'
            }} />
            <p style={{ color: '#999', fontSize: '14px' }}>Loading...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Available Tests */}
        {!isLoading && activeTab === 'available' && (
          <>
            {filteredTests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <FileText size={48} color="#ccc" style={{ margin: '0 auto 16px', display: 'block' }} />
                <h3 style={{ color: '#666', fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                  {searchQuery ? 'No tests found' : 'No tests available'}
                </h3>
                <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                  {searchQuery ? 'Try adjusting your search' : 'Check back later for new coding challenges'}
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredTests.map(test => (
                  <TestCard key={test.id} test={test} onSelectTest={onSelectTest} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Completed Tests */}
        {!isLoading && activeTab === 'completed' && (
          <>
            {filteredSubmissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <CheckCircle size={48} color="#ccc" style={{ margin: '0 auto 16px', display: 'block' }} />
                <h3 style={{ color: '#666', fontSize: '18px', fontWeight: '500', marginBottom: '8px' }}>
                  No completed tests yet
                </h3>
                <p style={{ color: '#999', fontSize: '14px', margin: 0 }}>
                  Complete a test and it will appear here
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {filteredSubmissions.map(sub => (
                  <CompletedCard key={sub.submission_id} submission={sub} />
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}

// â”€â”€ Available Test Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TestCard({ test, onSelectTest }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px',
        padding: '20px 24px', transition: 'box-shadow 0.2s',
        boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#333', margin: '0 0 8px' }}>
            {test.title}
          </h3>
          <p style={{ fontSize: '14px', color: '#666', margin: '0 0 16px', lineHeight: '1.5' }}>
            {test.description || 'No description'}
          </p>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#666' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /><span>Invite only</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={14} /><span>{test.duration_minutes} min</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileText size={14} />
              <span>{test.question_count || 0} question{test.question_count !== 1 ? 's' : ''}</span>
            </div>
          </div>
          <div style={{ marginTop: '12px', fontSize: '13px', color: '#999' }}>Available now</div>
        </div>

        <button
          onClick={() => onSelectTest(test)}
          style={{
            marginLeft: '24px', background: '#2196F3', color: '#fff',
            border: 'none', borderRadius: '4px', padding: '8px 20px',
            fontSize: '14px', fontWeight: '500', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => e.target.style.background = '#1976D2'}
          onMouseLeave={e => e.target.style.background = '#2196F3'}
        >
          Start Test
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Completed Test Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CompletedCard({ submission }) {
  const score = submission.score ?? 0;

  const scoreColor =
    score === 100 ? '#4CAF50' :
    score >= 50   ? '#FF9800' :
                    '#F44336';

  const scoreBg =
    score === 100 ? '#E8F5E9' :
    score >= 50   ? '#FFF3E0' :
                    '#FFEBEE';

  const formattedDate = submission.submitted_at
    ? `${new Date(submission.submitted_at).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })} IST`
    : 'â€”';

  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e0e0', borderRadius: '4px',
      padding: '20px 24px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <CheckCircle size={16} color="#4CAF50" />
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#333', margin: 0 }}>
              {submission.test_title}
            </h3>
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: '#999' }}>
            <span>Submitted: {formattedDate}</span>
            {submission.language && (
              <span style={{
                background: '#E3F2FD', color: '#2196F3',
                padding: '1px 8px', borderRadius: '4px', fontWeight: '600', fontSize: '12px'
              }}>
                {submission.language.toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Score Badge */}
        <div style={{
          background: scoreBg, color: scoreColor,
          border: `1px solid ${scoreColor}33`,
          borderRadius: '8px', padding: '8px 20px',
          textAlign: 'center', minWidth: '80px', marginLeft: '24px'
        }}>
          <div style={{ fontSize: '22px', fontWeight: '700', lineHeight: 1 }}>{score}%</div>
          <div style={{ fontSize: '11px', fontWeight: '600', marginTop: '2px', opacity: 0.8 }}>
            {score === 100 ? 'Perfect' : score >= 50 ? 'Passed' : 'Failed'}
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentTestList;

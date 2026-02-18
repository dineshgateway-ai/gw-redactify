import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { 
  Navbar, 
  Container, 
  Nav, 
  Row, 
  Col, 
  Form, 
  FormControl, 
  Button, 
  Spinner, 
  Alert,
  Badge,
  Dropdown
} from 'react-bootstrap';
import { 
  Search, 
  FileText, 
  Database, 
  Shield, 
  Settings, 
  Menu, 
  LogOut,
  User,
  Monitor
} from 'lucide-react';
import { Document, Dataroom, fetchDatarooms, fetchDocuments } from './api/documentService';
import DocumentTreeView from './components/DocumentTreeView';
import RedactionView from './pages/RedactionView';
import './App.css';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [realmId, setRealmId] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [datarooms, setDatarooms] = useState<Dataroom[]>([]);
  const [selectedDataroomId, setSelectedDataroomId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isDevMode, setIsDevMode] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadDatarooms = useCallback(async (id: string) => {
    const normalized = id?.trim() || '';
    setError(null);
    setDatarooms([]);
    setDocuments([]);
    setSelectedDataroomId('');

    if (!normalized) {
      setRealmId('');
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      const data = await fetchDatarooms(normalized);
      setDatarooms(data);
      setRealmId(normalized);
      if (data.length > 0) {
        setSelectedDataroomId(data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch datarooms. Please verify the Realm ID.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  const loadDocuments = useCallback(async (rId: string, dId: string) => {
    if (!rId || !dId) return;
    setIsFetching(true);
    setError(null);
    try {
      const data = await fetchDocuments(rId, dId);
      setDocuments(data);
    } catch (err) {
      setError('Failed to fetch documents from the selected dataroom.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    // Initial load if realmId is present
    if (realmId) {
      loadDatarooms(realmId);
    }
  }, []);

  useEffect(() => {
    if (selectedDataroomId) {
      loadDocuments(realmId, selectedDataroomId);
    }
  }, [loadDocuments, realmId, selectedDataroomId]);

  const handleDataroomChange = (newDataroomId: string) => {
    setSelectedDataroomId(newDataroomId);
    navigate('/'); 
  };

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = searchInput?.trim() || '';
    if (normalized !== realmId) {
      loadDatarooms(normalized);
      navigate('/');
    }
  };
  
  return (
    <div className="admin-dashboard">
      {/* Top Navbar */}
      <Navbar bg="white" expand="lg" sticky="top" className="border-bottom shadow-sm py-2">
        <Container fluid>
          <div className="d-flex align-items-center">
            <Button 
              variant="link" 
              className="p-0 me-3 text-dark d-lg-none" 
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu size={24} />
            </Button>
            <Navbar.Brand as={Link} to="/" className="d-flex align-items-center fw-bold text-primary">
              <Shield size={28} className="me-2" />
              <span>GW Redactify</span>
            </Navbar.Brand>
          </div>

          <div className="d-none d-md-flex flex-grow-1 mx-4">
            <Form className="w-100 position-relative max-width-400" onSubmit={onSearchSubmit}>
              <div className="input-group">
                <span className="input-group-text bg-light border-end-0">
                  <Search size={18} className="text-muted" />
                </span>
                <FormControl
                  type="search"
                  placeholder="Enter Realm ID..."
                  className="bg-light border-start-0"
                  aria-label="Search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <Button variant="primary" type="submit" disabled={isFetching}>
                  {isFetching ? <Spinner animation="border" size="sm" /> : 'Search'}
                </Button>
              </div>
            </Form>
          </div>

          <Nav className="ms-auto align-items-center">
            <Form.Check 
              type="switch"
              id="dev-mode-switch"
              label={<span className="d-none d-sm-inline ms-1 me-3 small text-muted">Dev Mode</span>}
              checked={isDevMode}
              onChange={() => setIsDevMode(!isDevMode)}
              className="me-3"
            />
            
            <Dropdown align="end">
              <Dropdown.Toggle variant="link" id="user-dropdown" className="p-0 text-decoration-none">
                <div className="avatar-circle">DK</div>
              </Dropdown.Toggle>
              <Dropdown.Menu className="shadow border-0 mt-2">
                <Dropdown.Header>Dinesh Kumar</Dropdown.Header>
                <Dropdown.Item href="#profile"><User size={16} className="me-2" /> Profile</Dropdown.Item>
                <Dropdown.Item href="#settings"><Settings size={16} className="me-2" /> Settings</Dropdown.Item>
                <Dropdown.Divider />
                <Dropdown.Item href="#logout" className="text-danger"><LogOut size={16} className="me-2" /> Logout</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </Nav>
        </Container>
      </Navbar>

      <div className="dashboard-container">
        <Row className="g-0 h-100">
          {/* Sidebar */}
          <Col 
            lg={3} 
            xl={2} 
            className={`sidebar-wrapper bg-light border-end transition-all ${sidebarOpen ? 'show' : 'hide'}`}
          >
            <div className="p-3">
              <div className="mb-4">
                <label className="small text-uppercase fw-bold text-muted mb-2 d-block">Environment</label>
                <div className="p-2 bg-white border rounded shadow-sm">
                  <div className="d-flex align-items-center mb-2">
                    <Database size={16} className="text-primary me-2" />
                    <span className="small fw-semibold text-truncate">{realmId || 'No Realm Selected'}</span>
                  </div>
                  
                  <Form.Group className="mb-0">
                    <Form.Select 
                      size="sm" 
                      value={selectedDataroomId} 
                      onChange={(e) => handleDataroomChange(e.target.value)}
                      disabled={isFetching || datarooms.length === 0}
                      className="border-0 bg-light"
                    >
                      {datarooms.length > 0 ? (
                        datarooms.map(dr => (
                          <option key={dr.id} value={dr.id}>{dr.name || dr.id}</option>
                        ))
                      ) : (
                        <option value="">Select Dataroom</option>
                      )}
                    </Form.Select>
                  </Form.Group>
                </div>
              </div>

              <div className="mb-4">
                <label className="small text-uppercase fw-bold text-muted mb-2 d-block">Documents</label>
                {isFetching ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" variant="primary" size="sm" />
                    <p className="small text-muted mt-2">Fetching assets...</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="text-center py-4 border rounded bg-white-50">
                    <FileText size={24} className="text-muted mb-2 opacity-50" />
                    <p className="small text-muted mb-0">No documents</p>
                  </div>
                ) : (
                  <div className="document-tree-container">
                    <DocumentTreeView documents={documents} />
                  </div>
                )}
              </div>

              <Nav className="flex-column mt-auto border-top pt-3">
                <Nav.Link as={Link} to="/" className="small text-muted mb-1 px-2 d-flex align-items-center">
                  <Monitor size={14} className="me-2" /> Dashboard
                </Nav.Link>
                <Nav.Link href="#" className="small text-muted px-2 d-flex align-items-center">
                  <Settings size={14} className="me-2" /> Preferences
                </Nav.Link>
              </Nav>
            </div>
          </Col>

          {/* Main Content Area */}
          <Col className="content-wrapper bg-white overflow-auto p-0">
            {error && (
              <Container fluid className="mt-3">
                <Alert variant="danger" onClose={() => setError(null)} dismissible>
                  {error}
                </Alert>
              </Container>
            )}

            <main className="h-100">
              <Routes>
                <Route path="/" element={
                  <div className="empty-state h-100 d-flex flex-column align-items-center justify-content-center text-center p-5">
                    <div className="empty-state-icon bg-light rounded-circle mb-4">
                      <FileText size={64} className="text-primary p-3" />
                    </div>
                    <h3 className="fw-bold">Welcome to Redactify</h3>
                    <p className="text-muted max-width-500 mx-auto">
                      Enter a Realm ID and select a dataroom to start reviewing and redacting documents. 
                      Protected by Gateway AI security protocols.
                    </p>
                    {realmId && datarooms.length > 0 && (
                      <Badge bg="info" pill className="mt-2 px-3 py-2">
                        Active Realm: {realmId}
                      </Badge>
                    )}
                  </div>
                } />
                <Route path="/document/:id" element={
                  <div className="h-100 d-flex flex-column">
                    <RedactionView 
                      isDevMode={isDevMode} 
                      realmId={realmId} 
                      dataroomId={selectedDataroomId} 
                      documents={documents} 
                    />
                  </div>
                } />
              </Routes>
            </main>
          </Col>
        </Row>
      </div>

      {/* Status Bar */}
      <footer className="status-bar border-top py-1 bg-light">
        <Container fluid className="d-flex justify-content-between align-items-center px-3">
          <div className="d-flex align-items-center">
            <div className={`status-indicator me-2 ${realmId ? 'bg-success' : 'bg-secondary opacity-50'}`}></div>
            <span className="x-small text-muted">{realmId ? `Connected to ${realmId}` : 'Disconnected'}</span>
          </div>
          <div className="x-small text-muted fw-semibold">
            &copy; {new Date().getFullYear()} GoGateway.ai &bull; v0.1.0
          </div>
        </Container>
      </footer>
    </div>
  );
};

export default App;

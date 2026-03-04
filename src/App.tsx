import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, Link } from 'react-router-dom';
import { Container, Navbar, Nav, Form, FormControl, Button, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { Search, Shield, Layout, Database } from 'lucide-react';
import { Document, Dataroom, fetchDatarooms, fetchDocuments, buildHierarchy } from './api/documentService';
import DocumentTreeView from './components/DocumentTreeView';
import RedactionView from './pages/RedactionView';
import RedactionTester from './pages/RedactionTester';
import './App.css';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [realmId, setRealmId] = useState<string>('');
  const [namespace, setNamespace] = useState<string>('gatewayai');
  const [cluster, setCluster] = useState<string>('gw-dev');
  const [datarooms, setDatarooms] = useState<Dataroom[]>([]);
  const [selectedDataroomId, setSelectedDataroomId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [rawDocuments, setRawDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isDevMode, setIsDevMode] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadDatarooms = useCallback(async (id: string, ns: string = 'gatewayai', cls: string = 'gw-dev') => {
    // normalize input and handle empty/whitespace values by clearing state
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
      const data = await fetchDatarooms(normalized, ns);
      setDatarooms(data);
      setRealmId(normalized);
      setNamespace(ns);
      setCluster(cls);
      if (data.length > 0) {
        setSelectedDataroomId(data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch datarooms. Check console for details.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  const loadDocuments = useCallback(async (rId: string, dId: string, ns: string = 'gatewayai') => {
    if (!rId || !dId) return;
    setIsFetching(true);
    setError(null);
    try {
      const data = await fetchDocuments(rId, dId, ns);
      setRawDocuments(data);
      const hierarchicalData = buildHierarchy(data);
      setDocuments(hierarchicalData);
    } catch (err) {
      setError('Failed to fetch documents. Check console for details.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  // Run once on mount. We intentionally omit deps to avoid double triggering in StrictMode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('App mounted, loading datarooms for default realmId');
    loadDatarooms(realmId, namespace, cluster);
  }, []);

  useEffect(() => {
    if (selectedDataroomId) {
      loadDocuments(realmId, selectedDataroomId, namespace);
    }
  }, [loadDocuments, realmId, selectedDataroomId, namespace]);

  const handleDataroomChange = (newDataroomId: string) => {
    setSelectedDataroomId(newDataroomId);
    navigate('/'); 
  };

  const handleSearch = (newRealmId: string, newNamespace: string, newCluster: string) => {
    const normalized = newRealmId?.trim() || '';
    if (normalized !== realmId || newNamespace !== namespace || newCluster !== cluster) {
      loadDatarooms(normalized, newNamespace, newCluster);
      navigate('/');
    }
  };

  const filteredDocuments = useMemo(() => {
    if (!searchTerm.trim()) return documents;
    
    const searchLower = searchTerm.toLowerCase();
    const filteredRaw = rawDocuments.filter(doc => {
      const name = (doc.name || doc.original_name || doc.filename || '').toLowerCase();
      return name.includes(searchLower);
    });
    
    return buildHierarchy(filteredRaw);
  }, [searchTerm, documents, rawDocuments]);
  
  const [realmInput, setRealmInput] = useState(realmId);
  const [namespaceInput, setNamespaceInput] = useState(namespace);
  const [clusterInput, setClusterInput] = useState(cluster);

  const onSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(realmInput, namespaceInput, clusterInput);
  };

  return (
    <div className="app-wrapper bg-light min-vh-100 d-flex flex-column overflow-hidden">
      <Navbar bg="dark" variant="dark" expand="lg" className="shadow-sm sticky-top px-4 py-2 border-bottom border-secondary flex-shrink-0">
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-bold text-primary me-3">
          <Shield size={24} />
          <span className="text-white d-none d-sm-inline">GW-REDACTIFY</span>
        </Navbar.Brand>
        <Nav className="me-4 d-none d-lg-flex">
          <Nav.Link as={Link} to="/tester" className="text-secondary small d-flex align-items-center gap-2">
            <Layout size={14} /> Tester
          </Nav.Link>
        </Nav>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Form className="d-flex flex-wrap gap-2 flex-grow-1 max-width-800" onSubmit={onSearchSubmit}>
            <Form.Group className="flex-grow-1">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-dark border-secondary text-secondary">
                  <Database size={14} />
                </span>
                <FormControl
                  type="search"
                  placeholder="Realm ID"
                  className="bg-dark border-secondary text-white"
                  value={realmInput}
                  onChange={(e) => setRealmInput(e.target.value)}
                />
              </div>
            </Form.Group>
            {/* <Form.Group style={{ width: '120px' }}>
              <FormControl
                size="sm"
                type="text"
                placeholder="Namespace"
                className="bg-dark border-secondary text-white"
                value={namespaceInput}
                onChange={(e) => setNamespaceInput(e.target.value)}
              />
            </Form.Group> */}
            <Form.Group style={{ width: '120px' }}>
              <FormControl
                size="sm"
                type="text"
                placeholder="Cluster"
                className="bg-dark border-secondary text-white"
                value={clusterInput}
                onChange={(e) => setClusterInput(e.target.value)}
              />
            </Form.Group>
            <Button variant="primary" size="sm" type="submit" disabled={isFetching}>
              {isFetching ? <Spinner animation="border" size="sm" /> : <Search size={14} />}
            </Button>
          </Form>
          
          <Nav className="ms-auto align-items-center gap-3 mt-3 mt-lg-0">
            <Form.Group className="d-flex align-items-center gap-2">
              <Form.Label className="text-secondary mb-0 small text-nowrap">Dataroom:</Form.Label>
              <Form.Select
                size="sm"
                className="bg-dark border-secondary text-white min-width-150"
                value={selectedDataroomId}
                onChange={(e) => handleDataroomChange(e.target.value)}
                disabled={datarooms.length === 0}
              >
                {datarooms.map(dr => (
                  <option key={dr.id} value={dr.id}>{dr.name || dr.id}</option>
                ))}
                {datarooms.length === 0 && <option value="">No Datarooms</option>}
              </Form.Select>
            </Form.Group>

            <Form.Check
              type="switch"
              id="dev-mode-switch"
              label={<span className="text-secondary small">Dev</span>}
              checked={isDevMode}
              onChange={() => setIsDevMode(!isDevMode)}
              className="mt-1"
            />
          </Nav>
        </Navbar.Collapse>
      </Navbar>

      {error && (
        <div className="alert alert-danger mb-0 rounded-0 py-2 small">
          <Container fluid>{error}</Container>
        </div>
      )}
      
      <Container fluid className="flex-grow-1 p-0 overflow-hidden">
        <Row className="g-0 h-100">
          <Col md={3} lg={2} className="bg-white border-end shadow-sm sidebar-scrollable overflow-auto h-100">
            <div className="p-3">
              <h6 className="text-uppercase text-muted fw-bold small mb-3 d-flex align-items-center gap-2">
                <Database size={14} />
                Explorer
              </h6>
              
              <Form.Group className="mb-3">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-light border-end-0">
                    <Search size={12} />
                  </span>
                  <FormControl
                    size="sm"
                    type="text"
                    placeholder="Filter docs..."
                    className="bg-light border-start-0"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </Form.Group>

              {isFetching ? (
                <div className="text-center py-4">
                  <Spinner animation="border" variant="primary" size="sm" />
                  <p className="text-muted small mt-2">Loading documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <p className="text-muted small italic">No documents loaded.</p>
              ) : (
                <DocumentTreeView documents={filteredDocuments} />
              )}
            </div>
          </Col>
          <Col md={9} lg={10} className="d-flex flex-column h-100 bg-white">
            <main className="h-100 flex-grow-1 overflow-hidden">
              <Routes>
                <Route path="/" element={
                  <div className="d-flex flex-column align-items-center justify-content-center h-100 text-muted bg-light">
                    <Layout size={64} className="mb-3 opacity-25 text-primary" />
                    <h5 className="fw-bold text-dark">Document Workspace</h5>
                    <p className="small text-muted text-center max-width-400 px-3">
                      Select a file from the sidebar to start reviewing and redacting information. Use the realm search above to switch data rooms.
                    </p>
                  </div>
                } />
                <Route path="/document/:id" element={
                  <RedactionView isDevMode={isDevMode} realmId={realmId} dataroomId={selectedDataroomId} documents={rawDocuments} namespace={namespace} />
                } />
                <Route path="/tester" element={<RedactionTester />} />
              </Routes>
            </main>
          </Col>
        </Row>
      </Container>

      <footer className="bg-dark text-secondary py-3 px-4 border-top border-secondary flex-shrink-0 x-small">
        <div className="d-flex justify-content-between align-items-center">
          <span>&copy; {new Date().getFullYear()} <a href="https://www.gogateway.ai/" target="_blank" rel="noopener noreferrer" className="text-primary text-decoration-none">GoGateway.ai</a></span>
          <div className="d-flex gap-3 align-items-center">
             <Badge bg="dark" className="border border-secondary text-secondary fw-normal">v0.1.0</Badge>
             <div className="d-flex align-items-center gap-1">
               <div className={`rounded-circle bg-${isDevMode ? "warning" : "success"}`} style={{ width: '8px', height: '8px' }}></div>
               <span className="small opacity-75">{isDevMode ? "Dev" : "Prod"}</span>
             </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

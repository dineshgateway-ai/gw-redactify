import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Document, Dataroom, fetchDatarooms, fetchDocuments } from './api/documentService';
import RealmSearch from './components/RealmSearch';
import DocumentTreeView from './components/DocumentTreeView';
import RedactionView from './pages/RedactionView';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import './App.css';

const App: React.FC = () => {
  const navigate = useNavigate();
  const [realmId, setRealmId] = useState<string>('361');
  const [datarooms, setDatarooms] = useState<Dataroom[]>([]);
  const [selectedDataroomId, setSelectedDataroomId] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isDevMode, setIsDevMode] = useState<boolean>(true);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadDatarooms = useCallback(async (id: string) => {
    setIsFetching(true);
    setError(null);
    setDatarooms([]);
    setDocuments([]);
    setSelectedDataroomId('');
    try {
      const data = await fetchDatarooms(id);
      setDatarooms(data);
      setRealmId(id);
      if (data.length > 0) {
        setSelectedDataroomId(data[0].id);
      }
    } catch (err) {
      setError('Failed to fetch datarooms. Check console for details.');
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
      setError('Failed to fetch documents. Check console for details.');
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    loadDatarooms(realmId);
  }, [loadDatarooms, realmId]);

  useEffect(() => {
    if (selectedDataroomId) {
      loadDocuments(realmId, selectedDataroomId);
    }
  }, [loadDocuments, realmId, selectedDataroomId]);

  const handleDataroomChange = (newDataroomId: string) => {
    setSelectedDataroomId(newDataroomId);
    navigate('/'); 
  };

  const handleSearch = (newRealmId: string) => {
    if (newRealmId !== realmId) {
        loadDatarooms(newRealmId);
        navigate('/');
    }
  };
  
  return (
    <div className="app-container">
      <header className="app-header">
        <RealmSearch initialRealmId={realmId} onSearch={handleSearch} isFetching={isFetching} />
        
        <div className="dataroom-selector">
          <label htmlFor="dataroom-select">Dataroom: </label>
          <select 
            id="dataroom-select" 
            value={selectedDataroomId} 
            onChange={(e) => handleDataroomChange(e.target.value)}
            disabled={isFetching || datarooms.length === 0}
          >
            {datarooms.map(dr => (
              <option key={dr.id} value={dr.id}>{dr.name || dr.id}</option>
            ))}
            {datarooms.length === 0 && <option value="">No datarooms</option>}
          </select>
        </div>

        <label>
            <input
                type="checkbox"
                checked={isDevMode}
                onChange={() => setIsDevMode(!isDevMode)}
            />
            Developer Mode
        </label>
      </header>
      
      {error && <div style={{ color: 'red', padding: '10px' }}>Error: {error}</div>}
      
      <div className="main-layout">
        <PanelGroup orientation="horizontal">
          <Panel defaultSize={250} minSize={15} maxSize={400} className="sidebar-panel">
            <aside className="sidebar">
              {isFetching ? (
                <p>Loading...</p>
              ) : documents.length === 0 ? (
                <p>No documents found.</p>
              ) : (
                <>
                  <h2>Documents</h2>
                  <DocumentTreeView documents={documents} />
                </>
              )}
            </aside>
          </Panel>
          <PanelResizeHandle className="resize-handle" />
          <Panel>
            <main className="content">
              <Routes>
                <Route path="/" element={<h2>Select Document</h2>} />
                <Route path="/document/:id" element={<RedactionView isDevMode={isDevMode} realmId={realmId} dataroomId={selectedDataroomId} documents={documents} />} />
              </Routes>
            </main>
          </Panel>
        </PanelGroup>
      </div>

      <footer className="app-footer">
        <p>&copy; {new Date().getFullYear()} <a href="https://www.gogateway.ai/" target="_blank" rel="noopener noreferrer">GoGateway.ai</a>. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default App;

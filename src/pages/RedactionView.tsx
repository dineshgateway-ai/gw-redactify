import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document as DocumentType, fetchFileBlob, fetchDocumentMarkdown } from '../api/documentService';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';

// Set PDF worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface RedactionViewProps {
  isDevMode: boolean;
  realmId: string;
  dataroomId: string;
  documents: DocumentType[]; // Added documents prop
}

// Sub-components
const MarkdownViewer: React.FC<{ content: string; onClose?: () => void; showHeader?: boolean }> = ({ content, onClose, showHeader = true }) => {
  return (
    <div className="markdown-viewer">
      {showHeader && (
        <div className="markdown-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Structured Redaction Information (Markdown)</h3>
          {onClose && (
            <button className="close-markdown-button" onClick={onClose} aria-label="Close Redacted View" title="Close Redacted View">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      )}
      <pre>{content}</pre>
    </div>
  );
};

const ViewMode = {
  FILE: 'FileView',
  ORIGINAL: 'OriginalFileView',
  REDACTED: 'RedactedFileView',
} as const;
type ViewModeType = typeof ViewMode[keyof typeof ViewMode];

// Helper function to find a document by ID in a nested array
const findDocument = (docs: DocumentType[], id: string): DocumentType | undefined => {
  for (const doc of docs) {
    if (doc.id === id) return doc;
    if (doc.children) {
      const found = findDocument(doc.children, id);
      if (found) return found;
    }
  }
  return undefined;
};

const RedactionView: React.FC<RedactionViewProps> = ({ isDevMode, realmId, dataroomId, documents }) => {
  const { id } = useParams<{ id: string }>();
  const [documentContent, setDocumentContent] = useState<{ blobUrl: string; redactedContent: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfScale, setPdfScale] = useState(1.0);
  
  // Find the selected document from the passed documents array
  const selectedDoc = id ? findDocument(documents, id) : undefined;
  const displayTitle = selectedDoc ? (selectedDoc.name || selectedDoc.original_name || selectedDoc.original_filename || selectedDoc.filename) : id;

  // 3-way Navigation State
  const [currentPdfView, setCurrentPdfView] = useState<ViewModeType>(ViewMode.FILE);
  const [showRedactedSection, setShowRedactedSection] = useState<boolean>(false);
  
  const loadContent = useCallback(async (docId: string) => {
    setLoading(true);
    setDownloadProgress(0);
    setDocumentContent(null); // Clear previous content
    
    try {
      // Initiate both requests in parallel
      const [blob, redactedContent] = await Promise.all([
        fetchFileBlob(realmId, dataroomId, docId, (progress) => {
          setDownloadProgress(progress);
        }),
        fetchDocumentMarkdown(realmId, dataroomId, docId)
      ]);
      
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        setDocumentContent({ blobUrl, redactedContent });
      } else {
        // Even if PDF fails, we might want to show markdown? 
        // But the current UI depends on documentContent.
        setDocumentContent(null);
      }
    } catch (error) {
      console.error('Failed to load document content:', error);
      setDocumentContent(null);
    } finally {
      setLoading(false);
    }
  }, [realmId, dataroomId]);

  useEffect(() => {
    if (id) {
      loadContent(id);
    }
  }, [id, loadContent]);

  useEffect(() => {
    return () => {
        if (documentContent?.blobUrl) {
            URL.revokeObjectURL(documentContent.blobUrl);
        }
    };
  }, [documentContent?.blobUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };
  
  const navigate = useNavigate();

  const handleClose = () => {
    // Revoke object URL to free memory, then navigate back
    if (documentContent?.blobUrl) {
      try {
        URL.revokeObjectURL(documentContent.blobUrl);
      } catch (e) {
        // ignore
      }
    }
    navigate(-1);
  };
  
  if (!id) {
    return <div className="loading-container">Error: No document selected.</div>;
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-status">
            <h3>Loading {displayTitle}...</h3> {/* Updated to use displayTitle */}
            <div className="progress-bar-container">
                <div className="progress-bar" style={{ width: `${downloadProgress}%` }}></div>
            </div>
            <p>{downloadProgress > 0 ? `Downloading: ${downloadProgress}%` : 'Preparing download...'}</p>
        </div>
      </div>
    );
  }

  if (!documentContent) {
    return <div>Failed to load content for {displayTitle}.</div>; {/* Updated to use displayTitle */}
  }
  
  const currentPdfUrl = documentContent.blobUrl; 

  const getPdfTitle = () => {
      switch (currentPdfView) {
          case ViewMode.FILE: return 'Current File View (from data-room)';
          case ViewMode.ORIGINAL: return 'Original File View (Pre-Redaction)';
          case ViewMode.REDACTED: return 'Redacted Document View';
          default: return 'File View';
      }
  }
  
  const handleDownload = () => {
    const blob = new Blob([documentContent.redactedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (selectedDoc?.filename || 'document') + '-redacted-summary.md'; // Use selectedDoc.filename
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  // alert('Downloading redacted summary.');
  };
  
  const handleCopy = () => {
      navigator.clipboard.writeText(documentContent.redactedContent);
      // alert('Redacted summary copied to clipboard!');
  };

  return (
    <div className="redaction-view-container">
      <h3>Document: {displayTitle}</h3> {/* Updated to use displayTitle */}
      
      <div className="view-navigation">
        <button onClick={() => setCurrentPdfView(ViewMode.FILE)} disabled={currentPdfView === ViewMode.FILE}>File View</button>
        {isDevMode && (
          <button onClick={() => setCurrentPdfView(ViewMode.ORIGINAL)} disabled={currentPdfView === ViewMode.ORIGINAL}>Original File View</button>
        )}
        {/* <button onClick={() => setCurrentPdfView(ViewMode.REDACTED)} disabled={currentPdfView === ViewMode.REDACTED}>View Redacted (PDF)</button> */}
        <button onClick={() => setShowRedactedSection(true)} disabled={showRedactedSection}>View Redacted</button>
      </div>

      <div className="redaction-side-by-side">
        <PanelGroup orientation="horizontal" className="redaction-panel-group">
          <Panel defaultSize={showRedactedSection ? 50 : 100} minSize={30}>
            <div className="pdf-pane">
              <div className="pdf-pane-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h4 style={{margin: 0}}>{getPdfTitle()}</h4>
                <button className="close-pdf-button" onClick={handleClose} aria-label="Close PDF" title="Close PDF">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
                <div className="pdf-viewer-content">
                    <PDFDocument 
                        file={currentPdfUrl} 
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="pdf-document"
                    >
                        {Array.from(new Array(numPages || 0), (el, index) => (
                            <Page 
                                key={'page_' + (index + 1)} 
                                pageNumber={index + 1} 
                                scale={pdfScale} 
                            />
                        ))}
                    </PDFDocument>
                    {!numPages && <p>Loading PDF...</p>}
                </div>
            </div>
          </Panel>
          {showRedactedSection && (
            <>
              <PanelResizeHandle className="resize-handle-vertical" />
              <Panel defaultSize={50} minSize={20}>
                <div className="markdown-pane">
                  <MarkdownViewer content={documentContent.redactedContent} onClose={() => setShowRedactedSection(false)} />

                  <div className="redaction-actions">
                    <button onClick={handleCopy}>Copy Redacted Text</button>
                    <button onClick={handleDownload}>Download Redacted Summary (.md)</button>
                  </div>
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
};

export default RedactionView;

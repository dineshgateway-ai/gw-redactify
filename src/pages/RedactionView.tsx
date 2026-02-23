import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document as DocumentType, fetchFileBlob, fetchDocumentMarkdown } from '../api/documentService';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PPTXViewer } from 'pptx-viewer';
import { CheckCircle, XCircle, File } from 'lucide-react';

// Set PDF worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface RedactionViewProps {
  isDevMode: boolean;
  realmId: string;
  dataroomId: string;
  documents: DocumentType[]; // Added documents prop
  namespace?: string;
}

// Sub-components
const MarkdownViewer: React.FC<{ 
  content: string; 
  onClose?: () => void; 
  showHeader?: boolean; 
  title?: string;
  actions?: React.ReactNode;
}> = ({ content, onClose, showHeader = true, title = "Structured Redaction Information (Markdown)", actions }) => {
  return (
    <div className="markdown-viewer">
      {showHeader && (
        <div className="markdown-view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '10px 20px', borderBottom: '1px solid var(--pane-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h3 style={{ margin: 0 }}>{title}</h3>
            {actions}
          </div>
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
      <div className="markdown-content-scroll">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

const DocxViewer: React.FC<{ blob: Blob }> = ({ blob }) => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderDocx = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        setHtml(result.value);
      } catch (e) {
        console.error('Error rendering docx:', e);
        setHtml('<p>Error rendering document. Please download to view.</p>');
      } finally {
        setLoading(false);
      }
    };
    renderDocx();
  }, [blob]);

  if (loading) return <p>Loading Word Document...</p>;
  return <div className="docx-viewer" dangerouslySetInnerHTML={{ __html: html }} />;
};

const ExcelViewer: React.FC<{ blob: Blob }> = ({ blob }) => {
  const [html, setHtml] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderExcel = async () => {
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const htmlString = XLSX.utils.sheet_to_html(worksheet);
        setHtml(htmlString);
      } catch (e) {
        console.error('Error rendering excel:', e);
        setHtml('<p>Error rendering spreadsheet. Please download to view.</p>');
      } finally {
        setLoading(false);
      }
    };
    renderExcel();
  }, [blob]);

  if (loading) return <p>Loading Spreadsheet...</p>;
  return <div className="excel-viewer" dangerouslySetInnerHTML={{ __html: html }} />;
};

const PptxViewer: React.FC<{ blob: Blob }> = ({ blob }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderPptx = async () => {
      if (containerRef.current) {
        try {
          // Clear container
          containerRef.current.innerHTML = '';
          const viewer = new PPTXViewer(containerRef.current);
          const arrayBuffer = await blob.arrayBuffer();
          await viewer.load(arrayBuffer);
        } catch (e) {
          console.error('Error rendering pptx:', e);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p>Error rendering presentation. Please download to view.</p>';
          }
        } finally {
          setLoading(false);
        }
      }
    };
    renderPptx();
  }, [blob]);

  return (
    <div className="pptx-viewer-container">
      {loading && <p>Loading Presentation...</p>}
      <div ref={containerRef} className="pptx-viewer" style={{ width: '100%', minHeight: '600px' }} />
    </div>
  );
};

const ViewMode = {
  FILE: 'FileView',
  ORIGINAL: 'OriginalFileView',
  REDACTED: 'RedactedFileView',
  PRE_REDACTED: 'PreRedactedFileView',
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

const RedactionView: React.FC<RedactionViewProps> = ({ isDevMode, realmId, dataroomId, documents, namespace = 'gatewayai' }) => {
  const { id } = useParams<{ id: string }>();
  const lastRequestedId = useRef<string | null>(null);
  const [documentContent, setDocumentContent] = useState<{
    blobUrl: string;
    originalBlobUrl?: string;
    redactedContent?: string;
    preRedactedContent?: string;
    originalText?: string;
    originalDocText?: string;
    filename?: string;
    blobType?: string;
    blob?: Blob | null;
    originalBlob?: Blob | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingRedacted, setLoadingRedacted] = useState(false);
  const [loadingPreRedacted, setLoadingPreRedacted] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfScale] = useState(1.0);
  
  // Find the selected document from the passed documents array
  const selectedDoc = id ? findDocument(documents, id) : undefined;
  const displayTitle = selectedDoc ? (selectedDoc.name || selectedDoc.original_name || selectedDoc.original_filename || selectedDoc.filename) : id;

  // 3-way Navigation State
  const [currentPdfView, setCurrentPdfView] = useState<ViewModeType>(ViewMode.FILE);
  const [showRedactedSection, setShowRedactedSection] = useState<boolean>(false);
  
  const loadContent = useCallback(async (docId: string) => {
    lastRequestedId.current = docId;
    setLoading(true);
    setDownloadProgress(0);
    setDocumentContent(null); // Clear previous content
    setNumPages(null); // Reset page count for new document
    
    try {
      // Initially ONLY fetch the original file blob
      const blob = await fetchFileBlob(realmId, dataroomId, docId, (progress) => {
        setDownloadProgress(progress);
      }, true, namespace);

      // Check if this request is still the latest one
      if (lastRequestedId.current !== docId) return;

      if (blob) {
        const originalBlobUrl = URL.createObjectURL(blob);
        
        // Try to determine filename/extension from provided documents
        const fileDoc = findDocument(documents, docId);
        const filename = fileDoc?.original_name || fileDoc?.original_filename || '';
        const blobType = blob.type || '';
        
        setDocumentContent({
          blobUrl: '', 
          originalBlobUrl,
          filename,
          blobType,
          originalBlob: blob
        });
      } else {
        setDocumentContent(null);
      }
    } catch (error) {
      console.error('Failed to load original document content:', error);
      if (lastRequestedId.current === docId) {
        setDocumentContent(null);
      }
    } finally {
      if (lastRequestedId.current === docId) {
        setLoading(false);
      }
    }
  }, [realmId, dataroomId, documents, namespace]);

  const loadRedactedMarkdown = async () => {
    if (!id || documentContent?.redactedContent || loadingRedacted) return;
    setLoadingRedacted(true);
    try {
      const content = await fetchDocumentMarkdown(realmId, dataroomId, id, false, true, namespace);
      setDocumentContent(prev => prev ? { ...prev, redactedContent: content } : null);
    } catch (e) {
      console.error('Failed to load redacted markdown:', e);
    } finally {
      setLoadingRedacted(false);
    }
  };

  const loadPreRedactedMarkdown = async () => {
    if (!id || documentContent?.preRedactedContent || loadingPreRedacted) return;
    setLoadingPreRedacted(true);
    try {
      const content = await fetchDocumentMarkdown(realmId, dataroomId, id, true, false, namespace);
      setDocumentContent(prev => prev ? { ...prev, preRedactedContent: content } : null);
    } catch (e) {
      console.error('Failed to load pre-redacted markdown:', e);
    } finally {
      setLoadingPreRedacted(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadContent(id);
      // Reset view modes to default when a new document is selected
      setCurrentPdfView(ViewMode.ORIGINAL);
      setShowRedactedSection(false);
    }
  }, [id, loadContent]);

  const handleShowRedacted = () => {
    loadRedactedMarkdown();
    setShowRedactedSection(true);
  };

  const handleSwitchToFileView = () => {
    loadPreRedactedMarkdown();
    setCurrentPdfView(ViewMode.FILE);
  };

  useEffect(() => {
    return () => {
        if (documentContent?.blobUrl) {
            URL.revokeObjectURL(documentContent.blobUrl);
        }
        if (documentContent?.originalBlobUrl) {
            URL.revokeObjectURL(documentContent.originalBlobUrl);
        }
    };
  }, [documentContent?.blobUrl, documentContent?.originalBlobUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };
  
  const navigate = useNavigate();

  const handleClose = () => {
    // Revoke object URL to free memory, then navigate back to root
    if (documentContent?.blobUrl) {
      try {
        URL.revokeObjectURL(documentContent.blobUrl);
      } catch (e) {
        // ignore
      }
    }
    if (documentContent?.originalBlobUrl) {
      try {
        URL.revokeObjectURL(documentContent.originalBlobUrl);
      } catch (e) {
        // ignore
      }
    }
    navigate('/');
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
  
  const isOriginalView = currentPdfView === ViewMode.ORIGINAL;
  const currentPdfUrl = (isOriginalView && documentContent.originalBlobUrl) ? documentContent.originalBlobUrl : documentContent.blobUrl;
  const currentText = (isOriginalView && documentContent.originalDocText) ? documentContent.originalDocText : documentContent.originalText;
  const currentBlob = (isOriginalView && documentContent.originalBlob) ? documentContent.originalBlob : documentContent.blob;

  const getPdfTitle = () => {
    switch (currentPdfView) {
      case ViewMode.FILE: return 'Markdown (Pre-Redacted)';
      case ViewMode.ORIGINAL: return 'Original File View (Pre-Redaction)';
      case ViewMode.REDACTED: return 'Markdown (Redacted)';
      case ViewMode.PRE_REDACTED: return 'Markdown (Pre-Redacted)';
      default: return 'File View';
    }
  }

  const detectedExt = (() => {
    const isOriginal = currentPdfView === ViewMode.ORIGINAL;
    const name = (isOriginal 
      ? (selectedDoc?.original_filename || selectedDoc?.original_name || selectedDoc?.filename || documentContent?.filename) 
      : (selectedDoc?.filename || documentContent?.filename)) || '';
    
    const parts = (name as string).split('.');
    const fromName = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
    
    const currentBlob = isOriginal ? documentContent?.originalBlob : documentContent?.blob;
    const bt = currentBlob?.type || '';
    const lower = bt.toLowerCase();
    
    // Prioritize known blob types
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('spreadsheet') || lower.includes('excel') || lower.includes('sheet') || lower.includes('spreadsheetml')) return 'xlsx';
    if (lower.includes('wordprocessingml') || lower.includes('msword') || lower.includes('officedocument.wordprocessingml')) return 'docx';
    if (lower.includes('presentationml') || lower.includes('powerpoint') || lower.includes('officedocument.presentationml')) return 'pptx';
    if (lower.startsWith('text/')) return 'txt';
    if (lower.includes('csv')) return 'csv';
    if (lower.includes('markdown')) return 'md';
    if (lower.startsWith('image/')) return 'image';
    
    // If blob type is generic, use extension from name
    if (fromName) return fromName;
    
    return undefined;
  })();
  
  const handleDownload = () => {
    if (!documentContent?.redactedContent) return;
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
      if (documentContent?.redactedContent) {
        navigator.clipboard.writeText(documentContent.redactedContent);
      }
      // alert('Redacted summary copied to clipboard!');
  };

  return (
    <div className="redaction-view-container">
      <h3>Document: {displayTitle}</h3> {/* Updated to use displayTitle */}

      {selectedDoc && (
        <div className="document-metadata" style={{ fontSize: '0.85rem', color: '#666', marginBottom: '15px', padding: '10px', backgroundColor: '#f9f9f9', border: '1px solid #eee', borderRadius: '4px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
          <div><strong>Category:</strong> {selectedDoc.category || 'N/A'}</div>
          <div><strong>Subcategory:</strong> {selectedDoc.subcategory || 'N/A'}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <strong>State:</strong> 
            {selectedDoc.document_state === 'success' ? (
              <span title="Success"><CheckCircle size={16} color="green" /></span>
            ) : (
              <span title={selectedDoc.document_state || 'Failure'}><XCircle size={16} color="red" /></span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <strong>Type:</strong> 
            <span title="File"><File size={16} color="#666" /></span>
          </div>
          <div><strong>Size:</strong> {selectedDoc.size !== undefined ? (selectedDoc.size / 1024).toFixed(2) + ' KB' : 'N/A'}</div>
          <div><strong>Created:</strong> {selectedDoc.created_at ? new Date(selectedDoc.created_at).toLocaleString() : 'N/A'}</div>
          <div><strong>Updated:</strong> {selectedDoc.updated_at ? new Date(selectedDoc.updated_at).toLocaleString() : 'N/A'}</div>
          {selectedDoc.summary && <div style={{ gridColumn: '1 / -1' }}><strong>Summary:</strong> {selectedDoc.summary}</div>}
        </div>
      )}
      
      <div className="view-navigation">
        <button onClick={() => setCurrentPdfView(ViewMode.ORIGINAL)} disabled={currentPdfView === ViewMode.ORIGINAL}>Original File View</button>
        <button onClick={handleSwitchToFileView} disabled={currentPdfView === ViewMode.FILE}>
          {loadingPreRedacted ? 'Loading...' : 'File View (Current)'}
        </button>
        <button onClick={handleShowRedacted} disabled={showRedactedSection}>
          {loadingRedacted ? 'Loading...' : 'View Redacted Section'}
        </button>
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
                    {currentPdfView === ViewMode.FILE && (
                      <MarkdownViewer content={documentContent.preRedactedContent || 'Loading the markdown content...'} showHeader={false} />
                    )}
                    {currentPdfView === ViewMode.REDACTED && (
                      <MarkdownViewer content={documentContent.redactedContent || 'Loading the markdown content...'} showHeader={false} />
                    )}
                    {currentPdfView === ViewMode.PRE_REDACTED && (
                      <MarkdownViewer content={documentContent.preRedactedContent || 'Loading the markdown content...'} showHeader={false} />
                    )}
                    {currentPdfView === ViewMode.ORIGINAL && (
                      <>
                        {/* Render based on file extension */}
                        {detectedExt === 'pdf' && (
                          <>
                            <PDFDocument 
                              file={currentPdfUrl} 
                              onLoadSuccess={onDocumentLoadSuccess}
                              className="pdf-document"
                            >
                              {Array.from(new Array(numPages || 0), (_, index) => (
                                <Page
                                  key={'page_' + (index + 1)}
                                  pageNumber={index + 1} 
                                  scale={pdfScale} 
                                />
                              ))}
                            </PDFDocument>
                            {!numPages && <p>Loading PDF...</p>}
                          </>
                        )}

                        {(detectedExt === 'md' || detectedExt === 'markdown' || detectedExt === 'txt') && currentText && (
                          <MarkdownViewer content={detectedExt === 'txt' ? `\`\`\`text\n${currentText}\n\`\`\`` : currentText} showHeader={false} title="Document Preview" />
                        )}

                        {(detectedExt === 'csv' || detectedExt === 'tsv') && currentText && (
                          <div className="table-preview">
                            <h4>Spreadsheet Preview</h4>
                            <div className="table-scroll">
                              <table>
                                <tbody>
                                  {currentText.split('\n').map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.split(detectedExt === 'tsv' ? '\t' : ',').map((cell, cIdx) => (
                                        <td key={cIdx}>{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                            <a href={currentPdfUrl} download={selectedDoc?.filename || 'file'}>Download</a>
                          </div>
                        )}

                        {(detectedExt === 'docx' || detectedExt === 'doc') && currentBlob && (
                          <DocxViewer blob={currentBlob} />
                        )}

                        {(detectedExt === 'xlsx' || detectedExt === 'xls') && currentBlob && (
                          <ExcelViewer blob={currentBlob} />
                        )}

                        {(detectedExt === 'pptx' || detectedExt === 'ppt') && currentBlob && (
                          <PptxViewer blob={currentBlob} />
                        )}

                        {detectedExt === 'image' && (
                          <div className="image-preview">
                            <img src={currentPdfUrl} alt={selectedDoc?.filename || 'image'} style={{ maxWidth: '100%' }} />
                          </div>
                        )}

                        {!detectedExt && (
                          <div>
                            <p>Unknown file type. <a href={currentPdfUrl} download={selectedDoc?.filename || 'file'}>Download</a></p>
                          </div>
                        )}
                      </>
                    )}
                </div>
            </div>
          </Panel>
          {showRedactedSection && (
            <>
              <PanelResizeHandle className="resize-handle-vertical" />
              <Panel defaultSize={50} minSize={20}>
                <div className="markdown-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0 10px' }}>
                  <MarkdownViewer 
                    content={documentContent.redactedContent || 'Loading the markdown content...'} 
                    onClose={() => setShowRedactedSection(false)} 
                    actions={
                      <div className="redaction-actions-inline" style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={handleCopy} className="primary-button" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Copy</button>
                        <button onClick={handleDownload} className="primary-button" style={{ padding: '4px 8px', fontSize: '0.8rem' }}>Download (.md)</button>
                      </div>
                    }
                  />
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

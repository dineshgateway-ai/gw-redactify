import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Row, Col, Button, ButtonGroup, Spinner, Card, Badge, Table } from 'react-bootstrap';
import { Download, Copy, X, FileText, FileSearch, Eye, Code, Maximize2, CheckCircle, XCircle, File } from 'lucide-react';
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
}> = ({ content, onClose, showHeader = true, title = "Structured Redaction Information", actions }) => {
  const renderContent = (text: string) => {
    // Regex to find tables wrapped in [TABLE START] and [TABLE END]
    const tableRegex = /\[TABLE START\]([\s\S]*?)\[TABLE END\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = tableRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'markdown', content: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'table', content: match[1] });
      lastIndex = tableRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'markdown', content: text.substring(lastIndex) });
    }

    if (parts.length === 0) return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;

    return parts.map((part, index) => {
      if (part.type === 'markdown') {
        return <ReactMarkdown key={index} remarkPlugins={[remarkGfm]}>{part.content}</ReactMarkdown>;
      } else {
        return (
          <div
            key={index}
            className="table-responsive my-3 markdown-html-table"
            dangerouslySetInnerHTML={{ __html: part.content }}
          />
        );
      }
    });
  };

  return (
    <Card className="h-100 border-0 shadow-sm overflow-hidden">
      {showHeader && (
        <Card.Header className="bg-white border-bottom py-2 d-flex justify-content-between align-items-center flex-shrink-0">
          <div className="d-flex align-items-center gap-3">
            <Card.Title className="mb-0 fs-6 fw-bold text-dark d-flex align-items-center gap-2">
              <Code size={16} className="text-primary" />
              {title}
            </Card.Title>
            {actions}
          </div>
          {onClose && (
            <Button variant="link" size="sm" className="p-0 text-muted hover-text-dark" onClick={onClose}>
              <X size={18} />
            </Button>
          )}
        </Card.Header>
      )}
      <Card.Body className="p-3 overflow-auto markdown-body">
        {renderContent(content)}
      </Card.Body>
    </Card>
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

  const loadRedactedMarkdown = useCallback(async () => {
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
  }, [id, realmId, dataroomId, namespace, documentContent?.redactedContent, loadingRedacted]);

  const loadPreRedactedMarkdown = useCallback(async () => {
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
  }, [id, realmId, dataroomId, namespace, documentContent?.preRedactedContent, loadingPreRedacted]);

  const handleShowRedacted = useCallback(() => {
    loadRedactedMarkdown();
    setShowRedactedSection(true);
  }, [loadRedactedMarkdown]);

  const handleSwitchToFileView = useCallback(() => {
    loadPreRedactedMarkdown();
    setCurrentPdfView(ViewMode.FILE);
  }, [loadPreRedactedMarkdown]);

  // Reset view modes when document changes
  useEffect(() => {
    if (id) {
      loadContent(id);
      setCurrentPdfView(isDevMode ? ViewMode.ORIGINAL : ViewMode.FILE);
      setShowRedactedSection(false);
    }
    // We only want to run this when the ID changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadContent]);

  // Handle mode switching and markdown loading
  useEffect(() => {
    if (!isDevMode && currentPdfView === ViewMode.ORIGINAL) {
      setCurrentPdfView(ViewMode.FILE);
    }
  }, [isDevMode, currentPdfView]);

  useEffect(() => {
    if (currentPdfView === ViewMode.FILE) {
      loadPreRedactedMarkdown();
    }
    if (showRedactedSection || currentPdfView === ViewMode.REDACTED) {
      loadRedactedMarkdown();
    }
  }, [currentPdfView, showRedactedSection, loadPreRedactedMarkdown, loadRedactedMarkdown]);

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
    <div className="redaction-view-container d-flex flex-column h-100 bg-light p-3 overflow-hidden">
      <div className="d-flex justify-content-between align-items-start mb-3">
        <div className="d-flex flex-column gap-1">
          <div className="d-flex align-items-center gap-2">
            <Button variant="outline-secondary" size="sm" onClick={handleClose} className="py-0 px-2">
              <X size={14} />
            </Button>
            <h5 className="mb-0 fw-bold text-dark">{displayTitle}</h5>
          </div>
          {selectedDoc && (
            <div className="d-flex flex-wrap gap-3 mt-1 ms-4 align-items-center">
              <span className="text-muted" style={{ fontSize: '0.75rem' }}><strong>Path:</strong> {selectedDoc.boxPath || 'N/A'}</span>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}><strong>Size:</strong> {selectedDoc.size !== undefined ? (selectedDoc.size / 1024).toFixed(2) + ' KB' : 'N/A'}</span>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}><strong>Date:</strong> {selectedDoc.uploadDate ? new Date(selectedDoc.uploadDate).toLocaleDateString() : 'N/A'}</span>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}><strong>State:</strong> {selectedDoc.document_state === 'success' ? <Badge bg="success" className="ms-1" style={{ fontSize: '0.65rem' }}>Success</Badge> : <Badge bg="danger" className="ms-1" style={{ fontSize: '0.65rem' }}>Failed</Badge>}</span>
            </div>
          )}
        </div>
        
        <div className="d-flex gap-2">
          <ButtonGroup size="sm">
            {isDevMode && (
              <Button
                variant={currentPdfView === ViewMode.ORIGINAL ? "primary" : "outline-secondary"}
                onClick={() => setCurrentPdfView(ViewMode.ORIGINAL)}
              >
                Original File
              </Button>
            )}
            <Button
              variant={currentPdfView === ViewMode.FILE ? "primary" : "outline-secondary"}
              onClick={handleSwitchToFileView}
            >
              {loadingPreRedacted ? <Spinner animation="border" size="sm" /> : 'Analysis View'}
            </Button>
          </ButtonGroup>
          
          <Button
            variant={showRedactedSection ? "info" : "outline-info"}
            size="sm"
            onClick={handleShowRedacted}
            disabled={showRedactedSection}
          >
            {loadingRedacted ? <Spinner animation="border" size="sm" /> : <><FileSearch size={14} className="me-1" /> View Redacted</>}
          </Button>
        </div>
      </div>

      <div className="redaction-side-by-side flex-grow-1 min-height-0">
        <PanelGroup orientation="horizontal" className="redaction-panel-group h-100">
          <Panel defaultSize={showRedactedSection ? 55 : 100} minSize={30}>
            <Card className="h-100 border-0 shadow-sm overflow-hidden">
              <Card.Header className="bg-white border-bottom py-2 d-flex justify-content-between align-items-center">
                <Card.Title className="mb-0 fs-6 fw-bold text-muted d-flex align-items-center gap-2">
                  <Eye size={16} />
                  {getPdfTitle()}
                </Card.Title>
              </Card.Header>
              <Card.Body className="p-0 overflow-hidden d-flex flex-column">
                <div className="pdf-viewer-content flex-grow-1 p-3 bg-white overflow-auto">
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
                              <Table striped bordered hover size="sm">
                                <tbody>
                                  {currentText.split('\n').map((row, rIdx) => (
                                    <tr key={rIdx}>
                                      {row.split(detectedExt === 'tsv' ? '\t' : ',').map((cell, cIdx) => (
                                        <td key={cIdx}>{cell}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </div>
                            <a href={currentPdfUrl} download={selectedDoc?.filename || 'file'} className="btn btn-link btn-sm mt-2 p-0 text-decoration-none">Download Data</a>
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
              </Card.Body>
            </Card>
          </Panel>
          {showRedactedSection && (
            <>
              <PanelResizeHandle className="resize-handle-vertical" />
              <Panel defaultSize={50} minSize={20}>
                <div className="h-100 ps-2">
                  <MarkdownViewer
                    content={documentContent.redactedContent || 'Loading the markdown content...'}
                    onClose={() => setShowRedactedSection(false)}
                    actions={
                      <div className="d-flex gap-2">
                        <Button variant="outline-primary" size="sm" onClick={handleCopy} className="py-0 px-2 small">Copy</Button>
                        <Button variant="outline-primary" size="sm" onClick={handleDownload} className="py-0 px-2 small">Download</Button>
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

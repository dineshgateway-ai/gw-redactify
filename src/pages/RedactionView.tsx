import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Container, 
  Row, 
  Col, 
  Button, 
  ButtonGroup, 
  Card, 
  ProgressBar, 
  Spinner, 
  Table,
  Badge,
  Stack,
  Alert
} from 'react-bootstrap';
import { 
  Download, 
  Copy, 
  X, 
  FileText, 
  Maximize, 
  ChevronLeft,
  Settings
} from 'lucide-react';
import { Document as DocumentType, fetchFileBlob, fetchDocumentMarkdown } from '../api/documentService';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import * as mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PPTXViewer } from 'pptx-viewer';

// Set PDF worker source for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface RedactionViewProps {
  isDevMode: boolean;
  realmId: string;
  dataroomId: string;
  documents: DocumentType[];
}

// Sub-components
const MarkdownViewer: React.FC<{ content: string; onClose?: () => void; showHeader?: boolean; title?: string }> = ({ content, onClose, showHeader = true, title = "Redaction Analysis" }) => {
  return (
    <Card className="h-100 border-0 shadow-sm">
      {showHeader && (
        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center border-bottom-0">
          <h5 className="mb-0 fw-bold">{title}</h5>
          {onClose && (
            <Button variant="link" className="text-muted p-0" onClick={onClose}>
              <X size={20} />
            </Button>
          )}
        </Card.Header>
      )}
      <Card.Body className="overflow-auto pt-0">
        <div className="markdown-body px-2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
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
        setHtml('<p class="text-danger">Error rendering document. Please download to view.</p>');
      } finally {
        setLoading(false);
      }
    };
    renderDocx();
  }, [blob]);

  if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
  return <div className="docx-viewer bg-white p-4 rounded shadow-sm overflow-auto h-100" dangerouslySetInnerHTML={{ __html: html }} />;
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
        setHtml('<p class="text-danger">Error rendering spreadsheet. Please download to view.</p>');
      } finally {
        setLoading(false);
      }
    };
    renderExcel();
  }, [blob]);

  if (loading) return <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>;
  return (
    <div className="excel-viewer bg-white p-2 rounded shadow-sm overflow-auto h-100">
       <div dangerouslySetInnerHTML={{ __html: html }} className="table-responsive" />
    </div>
  );
};

const PptxViewer: React.FC<{ blob: Blob }> = ({ blob }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const renderPptx = async () => {
      if (containerRef.current) {
        try {
          containerRef.current.innerHTML = '';
          const viewer = new PPTXViewer(containerRef.current);
          const arrayBuffer = await blob.arrayBuffer();
          await viewer.load(arrayBuffer);
        } catch (e) {
          console.error('Error rendering pptx:', e);
          if (containerRef.current) {
            containerRef.current.innerHTML = '<p class="text-danger">Error rendering presentation. Please download to view.</p>';
          }
        } finally {
          setLoading(false);
        }
      }
    };
    renderPptx();
  }, [blob]);

  return (
    <div className="pptx-viewer-container bg-white rounded shadow-sm p-3 h-100 overflow-auto">
      {loading && <div className="text-center p-5"><Spinner animation="border" variant="primary" /></div>}
      <div ref={containerRef} className="pptx-viewer" style={{ width: '100%', minHeight: '600px' }} />
    </div>
  );
};

const ViewMode = {
  FILE: 'FileView',
  ORIGINAL: 'OriginalFileView',
  REDACTED: 'RedactedFileView',
} as const;
type ViewModeType = typeof ViewMode[keyof typeof ViewMode];

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
  const navigate = useNavigate();
  const [documentContent, setDocumentContent] = useState<{
    blobUrl: string;
    originalBlobUrl?: string;
    redactedContent: string;
    originalText?: string;
    originalDocText?: string;
    filename?: string;
    blobType?: string;
    blob?: Blob | null;
    originalBlob?: Blob | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pdfScale] = useState(1.0);
  const [currentPdfView, setCurrentPdfView] = useState<ViewModeType>(ViewMode.FILE);
  const [showRedactedSection, setShowRedactedSection] = useState<boolean>(true);
  
  const selectedDoc = id ? findDocument(documents, id) : undefined;
  const displayTitle = selectedDoc ? (selectedDoc.name || selectedDoc.original_name || selectedDoc.original_filename || selectedDoc.filename) : id;

  const loadContent = useCallback(async (docId: string) => {
    setLoading(true);
    setDownloadProgress(0);
    setDocumentContent(null);
    
    try {
      const fetchPromises: [Promise<Blob | null>, Promise<string>, Promise<Blob | null> | null] = [
        fetchFileBlob(realmId, dataroomId, docId, (progress) => {
          setDownloadProgress(progress);
        }),
        fetchDocumentMarkdown(realmId, dataroomId, docId),
        isDevMode ? fetchFileBlob(realmId, dataroomId, docId, undefined, true) : null
      ];

      const [blob, redactedContent, originalBlob] = await Promise.all(fetchPromises);
      
      if (blob) {
        const blobUrl = URL.createObjectURL(blob);
        let originalBlobUrl = '';
        if (originalBlob) {
          originalBlobUrl = URL.createObjectURL(originalBlob);
        }

        const fileDoc = findDocument(documents, docId);
        const filename = fileDoc?.original_name || '';
        const blobType = blob.type || '';
        const extFromName = filename.split('.').pop()?.toLowerCase();
        
        const inferExtFromType = (t: string | undefined, filename: string) => {
          if (!t) return undefined;
          const lower = t.toLowerCase();
          if (lower.includes('pdf')) return 'pdf';
          if (lower.includes('spreadsheet') || lower.includes('excel') || lower.includes('sheet') || lower.includes('spreadsheetml')) return 'xlsx';
          if (lower.includes('wordprocessingml') || lower.includes('msword') || lower.includes('officedocument.wordprocessingml')) return 'docx';
          if (lower.includes('presentationml') || lower.includes('powerpoint') || lower.includes('officedocument.presentationml')) return 'pptx';
          if (lower.startsWith('text/')) return 'txt';
          if (lower.includes('csv')) return 'csv';
          if (lower.includes('markdown')) return 'md';
          if (lower.startsWith('image/')) return 'image';
          const ext = filename.split('.').pop()?.toLowerCase();
          if (ext === 'md' || ext === 'markdown') return 'md';
          if (ext === 'txt') return 'txt';
          if (ext === 'csv') return 'csv';
          return undefined;
        };

        const ext = inferExtFromType(blobType, filename) || extFromName;

        if (ext === 'md' || ext === 'markdown' || ext === 'txt' || ext === 'csv' || ext === 'tsv') {
          try {
            const originalText = await blob.text();
            let originalDocText = '';
            if (originalBlob && (ext === 'md' || ext === 'markdown' || ext === 'txt' || ext === 'csv' || ext === 'tsv')) {
              originalDocText = await originalBlob.text();
            }
            setDocumentContent({
              blobUrl, originalBlobUrl, redactedContent, originalText,
              originalDocText: originalDocText || originalText,
              filename, blobType, blob, originalBlob
            });
          } catch (e) {
            setDocumentContent({ blobUrl, originalBlobUrl, redactedContent, filename, blobType, blob, originalBlob });
          }
        } else {
          setDocumentContent({ blobUrl, originalBlobUrl, redactedContent, filename, blobType, blob, originalBlob });
        }
      }
    } catch (error) {
      console.error('Failed to load document content:', error);
    } finally {
      setLoading(false);
    }
  }, [realmId, dataroomId]);

  useEffect(() => {
    if (id) loadContent(id);
  }, [id, loadContent]);

  useEffect(() => {
    return () => {
      if (documentContent?.blobUrl) URL.revokeObjectURL(documentContent.blobUrl);
      if (documentContent?.originalBlobUrl) URL.revokeObjectURL(documentContent.originalBlobUrl);
    };
  }, [documentContent?.blobUrl, documentContent?.originalBlobUrl]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const handleDownload = () => {
    const blob = new Blob([documentContent!.redactedContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (selectedDoc?.filename || 'document') + '-redaction-report.md';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };
  
  const handleCopy = () => {
    navigator.clipboard.writeText(documentContent!.redactedContent);
  };

  if (loading) {
    return (
      <div className="h-100 d-flex align-items-center justify-content-center bg-light">
        <div className="text-center" style={{ maxWidth: '400px', width: '100%' }}>
            <h4 className="mb-4 fw-bold">Opening {displayTitle}</h4>
            <ProgressBar animated now={downloadProgress} label={`${downloadProgress}%`} className="mb-3" />
            <p className="text-muted small">Accessing Gateway Secure Storage...</p>
        </div>
      </div>
    );
  }

  if (!documentContent) {
    return (
      <Container className="py-5">
        <Alert variant="warning" className="shadow-sm">
          <Alert.Heading>Load Failed</Alert.Heading>
          <p>Failed to retrieve content for <strong>{displayTitle}</strong>. This might be due to security permissions or an expired session.</p>
          <Button variant="outline-warning" onClick={() => loadContent(id!)}>Retry Connection</Button>
        </Alert>
      </Container>
    );
  }
  
  const isOriginalView = currentPdfView === ViewMode.ORIGINAL;
  const currentPdfUrl = (isOriginalView && documentContent.originalBlobUrl) ? documentContent.originalBlobUrl : documentContent.blobUrl;
  const currentText = (isOriginalView && documentContent.originalDocText) ? documentContent.originalDocText : documentContent.originalText;
  const currentBlob = (isOriginalView && documentContent.originalBlob) ? documentContent.originalBlob : documentContent.blob;

  const detectedExt = (() => {
    const name = (selectedDoc?.filename || documentContent?.filename || '') as string;
    const parts = name.split('.');
    const fromName = parts.length > 1 ? parts.pop()?.toLowerCase() : undefined;
    const lower = (documentContent?.blobType || '').toLowerCase();
    if (lower.includes('pdf')) return 'pdf';
    if (lower.includes('spreadsheet') || lower.includes('excel') || lower.includes('sheet') || lower.includes('spreadsheetml')) return 'xlsx';
    if (lower.includes('wordprocessingml') || lower.includes('msword') || lower.includes('officedocument.wordprocessingml')) return 'docx';
    if (lower.includes('presentationml') || lower.includes('powerpoint') || lower.includes('officedocument.presentationml')) return 'pptx';
    if (lower.startsWith('text/')) return 'txt';
    if (lower.includes('csv')) return 'csv';
    if (lower.includes('markdown')) return 'md';
    if (lower.startsWith('image/')) return 'image';
    return fromName;
  })();

  return (
    <div className="redaction-view h-100 d-flex flex-column bg-light">
      {/* View Toolbar */}
      <div className="bg-white border-bottom py-2 px-3 shadow-xs">
        <Row className="align-items-center g-2">
          <Col xs="auto">
            <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)} className="d-flex align-items-center">
              <ChevronLeft size={16} className="me-1" /> Back
            </Button>
          </Col>
          <Col>
            <div className="d-flex align-items-center">
              <FileText size={18} className="text-primary me-2" />
              <h6 className="mb-0 fw-bold text-truncate" style={{ maxWidth: '300px' }}>{displayTitle}</h6>
              <Badge bg="light" text="dark" className="ms-2 border small fw-normal">.{detectedExt}</Badge>
            </div>
          </Col>
          <Col xs="auto">
            <Stack direction="horizontal" gap={2}>
              <ButtonGroup size="sm">
                <Button 
                  variant={currentPdfView === ViewMode.FILE ? 'primary' : 'outline-primary'} 
                  onClick={() => setCurrentPdfView(ViewMode.FILE)}
                >
                  Current
                </Button>
                {isDevMode && (
                  <Button 
                    variant={currentPdfView === ViewMode.ORIGINAL ? 'primary' : 'outline-primary'} 
                    onClick={() => setCurrentPdfView(ViewMode.ORIGINAL)}
                  >
                    Original
                  </Button>
                )}
              </ButtonGroup>
              <Button 
                variant={showRedactedSection ? 'secondary' : 'outline-secondary'} 
                size="sm"
                onClick={() => setShowRedactedSection(!showRedactedSection)}
              >
                {showRedactedSection ? 'Hide Analysis' : 'Show Analysis'}
              </Button>
            </Stack>
          </Col>
        </Row>
      </div>

      {/* Main Split View */}
      <div className="flex-grow-1 overflow-hidden p-3">
        <Row className="h-100 g-3">
          {/* Document Content Pane */}
          <Col lg={showRedactedSection ? 7 : 12} className="h-100 transition-all">
            <Card className="h-100 shadow-sm border-0">
              <Card.Header className="bg-white py-2 d-flex justify-content-between align-items-center">
                <small className="text-muted fw-bold text-uppercase">
                  {isOriginalView ? 'Source Document' : 'Processed Document'}
                </small>
                <div className="d-flex gap-2">
                  <Maximize size={14} className="text-muted cursor-pointer" />
                </div>
              </Card.Header>
              <Card.Body className="p-0 bg-secondary bg-opacity-10 overflow-hidden d-flex justify-content-center align-items-start pt-4 overflow-auto">
                <div className="document-container px-4 pb-4 w-100 d-flex justify-content-center">
                  {detectedExt === 'pdf' && (
                    <div className="pdf-shadow">
                      <PDFDocument 
                        file={currentPdfUrl} 
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="pdf-document"
                      >
                        {Array.from(new Array(numPages || 0), (_, index) => (
                          <Page 
                            key={`page_${index + 1}`} 
                            pageNumber={index + 1} 
                            scale={pdfScale}
                            className="mb-3"
                          />
                        ))}
                      </PDFDocument>
                      {!numPages && <div className="p-5 text-center"><Spinner animation="grow" /></div>}
                    </div>
                  )}

                  {(detectedExt === 'md' || detectedExt === 'markdown' || detectedExt === 'txt') && currentText && (
                    <div className="bg-white p-4 rounded shadow-sm mx-auto" style={{ width: '100%', maxWidth: '900px' }}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {detectedExt === 'txt' ? `\`\`\`text\n${currentText}\n\`\`\`` : currentText}
                      </ReactMarkdown>
                    </div>
                  )}

                  {(detectedExt === 'csv' || detectedExt === 'tsv') && currentText && (
                    <div className="bg-white p-4 rounded shadow-sm overflow-auto mx-auto" style={{ width: '100%', maxWidth: '900px' }}>
                       <Table striped bordered hover size="sm">
                         <tbody>
                            {currentText.split('\n').filter(l => l.trim()).map((row, rIdx) => (
                              <tr key={rIdx}>
                                {row.split(detectedExt === 'tsv' ? '\t' : ',').map((cell, cIdx) => (
                                  <td key={cIdx}>{cell}</td>
                                ))}
                              </tr>
                            ))}
                         </tbody>
                       </Table>
                    </div>
                  )}

                  {detectedExt === 'docx' && currentBlob && <DocxViewer blob={currentBlob} />}
                  {detectedExt === 'xlsx' && currentBlob && <ExcelViewer blob={currentBlob} />}
                  {detectedExt === 'pptx' && currentBlob && <PptxViewer blob={currentBlob} />}
                  
                  {detectedExt === 'image' && (
                    <div className="bg-white p-2 rounded shadow-sm">
                      <img src={currentPdfUrl} alt="Document" className="img-fluid rounded" />
                    </div>
                  )}

                  {!detectedExt && (
                    <div className="p-5 text-center bg-white rounded shadow-sm mx-auto" style={{ maxWidth: '500px' }}>
                      <Settings size={48} className="text-muted mb-3 opacity-50" />
                      <h5>Unsupported Preview</h5>
                      <p className="text-muted">Direct rendering is not available for this file type.</p>
                      <Button variant="primary" size="sm" as="a" href={currentPdfUrl} download={displayTitle}>
                        <Download size={14} className="me-2" /> Download File
                      </Button>
                    </div>
                  )}
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Analysis Sidebar */}
          {showRedactedSection && (
            <Col lg={5} className="h-100">
              <div className="d-flex flex-column h-100">
                <div className="flex-grow-1 overflow-hidden mb-3">
                  <MarkdownViewer 
                    content={documentContent.redactedContent} 
                    onClose={() => setShowRedactedSection(false)} 
                  />
                </div>
                <Card className="border-0 shadow-sm">
                  <Card.Body className="p-3">
                    <Stack direction="horizontal" gap={2}>
                      <Button variant="primary" className="flex-grow-1 d-flex align-items-center justify-content-center" onClick={handleCopy}>
                        <Copy size={16} className="me-2" /> Copy Summary
                      </Button>
                      <Button variant="outline-primary" className="flex-grow-1 d-flex align-items-center justify-content-center" onClick={handleDownload}>
                        <Download size={16} className="me-2" /> Download MD
                      </Button>
                    </Stack>
                  </Card.Body>
                </Card>
              </div>
            </Col>
          )}
        </Row>
      </div>
    </div>
  );
};

export default RedactionView;

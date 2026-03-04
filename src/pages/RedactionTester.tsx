import React, { useState, useCallback } from 'react';
import { Container, Row, Col, Card, Form, Button, ProgressBar, Alert, Badge } from 'react-bootstrap';
import { Upload, FileText, CheckCircle, Shield, ArrowRight, Download, Copy, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Reuse the same logic for tables as in RedactionView
const renderContent = (text: string) => {
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

const RedactionTester: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [redactedResult, setRedactedResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setRedactedResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setProgress(0);
    setError(null);

    // Simulate upload and redaction process
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Simulation delay
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      setProgress(100);
      
      // Mock result
      const mockResult = `
# Redaction Summary for ${file.name}

## Document Details
- **Filename**: ${file.name}
- **Type**: ${file.type || 'application/octet-stream'}
- **Size**: ${(file.size / 1024).toFixed(2)} KB
- **Status**: Successfully Analyzed

## Redacted Content Preview
This is a simulated redaction output. In a live environment, the system would process the file and identify PII (Personally Identifiable Information).

### Findings
- Found 12 sensitive entities.
- Successfully applied **REDACTIFY** masks to all matches.

[TABLE START]
<table>
  <thead>
    <tr>
      <th>Entity Type</th>
      <th>Occurrence</th>
      <th>Action</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Person Names</td>
      <td>4</td>
      <td>Masked with [NAME]</td>
    </tr>
    <tr>
      <td>Organizations</td>
      <td>3</td>
      <td>Masked with **REDACTED_COMPANY**</td>
    </tr>
    <tr>
      <td>Locations</td>
      <td>5</td>
      <td>Removed</td>
    </tr>
  </tbody>
</table>
[TABLE END]

### Sample Markdown Output
The document was processed into the following structure:

> **REDACTED_COMPANY_1** entered into an agreement with **NAME_1** on January 1st, 2024. 
> The terms of the deal are strictly confidential and governed by the laws of **REDACTED_LOCATION**.

---
*Note: This is a preview mode for testing redaction logic.*
      `;
      
      setRedactedResult(mockResult);
    } catch (err) {
      setError('Failed to process the file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setRedactedResult(null);
    setProgress(0);
    setError(null);
  };

  return (
    <div className="p-4 bg-light min-vh-100 overflow-auto">
      <Container>
        <div className="mb-4">
          <h3 className="fw-bold text-dark d-flex align-items-center gap-2">
            <Shield className="text-primary" />
            Redaction Tester
          </h3>
          <p className="text-muted">Upload any document to preview how our AI engine will parse and redact it into Markdown format.</p>
        </div>

        <Row className="g-4">
          <Col lg={redactedResult ? 4 : 12}>
            <Card className="border-0 shadow-sm">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-2 mb-3">
                  <Upload size={20} className="text-primary" />
                  <h5 className="mb-0 fw-bold">Upload File</h5>
                </div>

                {!file ? (
                  <div 
                    className="border border-2 border-dashed rounded-3 p-5 text-center transition-all hover-bg-light cursor-pointer"
                    onClick={() => document.getElementById('file-upload-input')?.click()}
                  >
                    <input 
                      type="file" 
                      id="file-upload-input" 
                      className="d-none" 
                      onChange={handleFileChange} 
                    />
                    <div className="mb-3">
                      <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-flex">
                        <Upload size={32} className="text-primary" />
                      </div>
                    </div>
                    <h6>Click to browse or drag & drop</h6>
                    <p className="text-muted small mb-0">PDF, DOCX, XLSX, images, or text files</p>
                  </div>
                ) : (
                  <div className="p-3 border rounded-3 bg-light">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <div className="d-flex align-items-center gap-3">
                        <div className="bg-white p-2 rounded shadow-sm">
                          <FileText size={24} className="text-primary" />
                        </div>
                        <div className="overflow-hidden">
                          <div className="fw-bold text-truncate" style={{ maxWidth: '200px' }}>{file.name}</div>
                          <div className="text-muted small">{(file.size / 1024).toFixed(1)} KB</div>
                        </div>
                      </div>
                      <Button variant="link" size="sm" className="text-danger p-0" onClick={handleReset} disabled={isUploading}>
                        <Trash2 size={18} />
                      </Button>
                    </div>

                    {isUploading ? (
                      <div className="mt-3">
                        <div className="d-flex justify-content-between small text-muted mb-1">
                          <span>Processing redaction...</span>
                          <span>{progress}%</span>
                        </div>
                        <ProgressBar now={progress} animated />
                      </div>
                    ) : !redactedResult ? (
                      <Button variant="primary" className="w-100 mt-3 d-flex align-items-center justify-content-center gap-2" onClick={handleUpload}>
                        Process Redaction <ArrowRight size={16} />
                      </Button>
                    ) : (
                      <Alert variant="success" className="mt-3 py-2 mb-0 d-flex align-items-center gap-2 small">
                        <CheckCircle size={16} /> Processed successfully
                      </Alert>
                    )}
                  </div>
                )}

                {error && <Alert variant="danger" className="mt-3 small">{error}</Alert>}
              </Card.Body>
            </Card>
          </Col>

          {redactedResult && (
            <Col lg={8}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2">
                    <Badge bg="primary">Preview</Badge>
                    <h5 className="mb-0 fw-bold">Markdown Result</h5>
                  </div>
                  <div className="d-flex gap-2">
                    <Button variant="outline-secondary" size="sm" className="d-flex align-items-center gap-1">
                      <Copy size={14} /> Copy
                    </Button>
                    <Button variant="outline-primary" size="sm" className="d-flex align-items-center gap-1">
                      <Download size={14} /> Download
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body className="p-4 markdown-body overflow-auto" style={{ maxHeight: '600px' }}>
                  {renderContent(redactedResult)}
                </Card.Body>
              </Card>
            </Col>
          )}
        </Row>
      </Container>
    </div>
  );
};

export default RedactionTester;

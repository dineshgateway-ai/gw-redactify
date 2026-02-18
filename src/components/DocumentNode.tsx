import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Document } from '../api/documentService';
import { 
  Folder, 
  FolderOpen, 
  FileText, 
  File, 
  ChevronRight, 
  ChevronDown,
  FileSpreadsheet, 
  FileImage, 
  FilePieChart, 
  FileCode 
} from 'lucide-react';
import { ListGroup, Collapse, Badge } from 'react-bootstrap';

interface DocumentNodeProps {
  document: Document;
  depth?: number;
}

const getFileIcon = (document: Document) => {
  const filename = (document.filename || document.name || document.original_filename || document.original_name || '').trim().toLowerCase();
  if (!filename) return <File size={16} className="text-secondary" />;
  
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  
  if (ext === 'pdf' || filename.includes('.pdf')) return <FileText size={16} className="text-danger" />;
  if (ext === 'docx' || ext === 'doc' || filename.includes('.docx') || filename.includes('.doc')) return <FileText size={16} className="text-primary" />;
  if (ext === 'pptx' || ext === 'ppt' || filename.includes('.pptx') || filename.includes('.ppt')) return <FilePieChart size={16} className="text-warning" />;
  if (ext === 'md' || ext === 'markdown' || filename.includes('.md') || filename.includes('.markdown')) return <FileCode size={16} className="text-info" />;
  if (ext === 'txt' || filename.includes('.txt')) return <FileText size={16} className="text-muted" />;
  if (ext === 'csv' || ext === 'tsv' || ext === 'xlsx' || ext === 'xls' || filename.includes('.xlsx') || filename.includes('.xls') || filename.includes('.csv')) return <FileSpreadsheet size={16} className="text-success" />;
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <FileImage size={16} className="text-purple" />;
  return <File size={16} className="text-secondary" />;
};

const DocumentNode: React.FC<DocumentNodeProps> = ({ document, depth = 0 }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isSelected = location.pathname === `/document/${document.id}`;
  
  const toggleOpen = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleFileClick = () => {
    navigate(`/document/${document.id}`);
  };

  const primaryName = document.name || document.original_name || document.original_filename || document.filename || 'Unnamed Item';

  const commonProps = {
    className: `border-0 py-2 px-3 d-flex align-items-center transition-all document-node ${isSelected ? 'selected' : ''}`,
    style: { 
      paddingLeft: `${(depth * 12) + 16}px`,
      cursor: 'pointer',
      backgroundColor: isSelected ? '#e7f0ff' : 'transparent'
    }
  };

  return (
    <>
      <ListGroup.Item 
        {...commonProps}
        action
        onClick={document.isFolder ? toggleOpen : handleFileClick}
      >
        <div className="me-2 d-flex align-items-center">
          {document.isFolder ? (
            <>
              {isOpen ? <ChevronDown size={14} className="me-1 text-muted" /> : <ChevronRight size={14} className="me-1 text-muted" />}
              {isOpen ? <FolderOpen size={18} className="text-warning" /> : <Folder size={18} className="text-warning" />}
            </>
          ) : (
            <div className="ms-3">
              {getFileIcon(document)}
            </div>
          )}
        </div>
        
        <div className="text-truncate flex-grow-1 small fw-medium" title={primaryName} style={{ color: isSelected ? '#0d6efd' : 'inherit' }}>
          {primaryName}
        </div>

        {!document.isFolder && isSelected && (
          <Badge bg="primary" pill className="ms-2" style={{ fontSize: '10px' }}>Active</Badge>
        )}
      </ListGroup.Item>

      {document.isFolder && document.children && (
        <Collapse in={isOpen}>
          <div>
            {document.children.map((child) => (
              <DocumentNode key={child.id} document={child} depth={depth + 1} />
            ))}
          </div>
        </Collapse>
      )}
    </>
  );
};

export default DocumentNode;

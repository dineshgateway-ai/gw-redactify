import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Badge, ListGroup, Collapse } from 'react-bootstrap';
import { Folder, FolderOpen, FileText, File, ChevronRight, FileSpreadsheet, FileImage, FilePieChart, FileCode } from 'lucide-react';
import { Document } from '../api/documentService';

interface DocumentNodeProps {
  document: Document;
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getFileIcon = (document: Document) => {
  const filename = (document.filename || document.name || document.original_filename || document.original_name || '').trim().toLowerCase();
  if (!filename) return <File size={18} className="icon-generic" />;
  
  const parts = filename.split('.');
  const ext = parts.length > 1 ? parts.pop() : '';
  
  if (ext === 'pdf' || filename.includes('.pdf')) return <FileText size={18} className="icon-pdf" />;
  if (ext === 'docx' || ext === 'doc' || filename.includes('.docx') || filename.includes('.doc')) return <FileText size={18} className="icon-word" />;
  if (ext === 'pptx' || ext === 'ppt' || filename.includes('.pptx') || filename.includes('.ppt')) return <FilePieChart size={18} className="icon-ppt" />;
  if (ext === 'md' || ext === 'markdown' || filename.includes('.md') || filename.includes('.markdown')) return <FileCode size={18} className="icon-markdown" />;
  if (ext === 'txt' || filename.includes('.txt')) return <FileText size={18} className="icon-txt" />;
  if (ext === 'csv' || ext === 'tsv' || ext === 'xlsx' || ext === 'xls' || filename.includes('.xlsx') || filename.includes('.xls') || filename.includes('.csv')) return <FileSpreadsheet size={18} className="icon-excel" />;
  if (ext && ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return <FileImage size={18} className="icon-image" />;
  return <File size={18} className="icon-generic" />;
};

const DocumentNode: React.FC<DocumentNodeProps> = ({ document }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isSelected = location.pathname === `/document/${document.id}`;
  
  const handleNodeClick = (_e: React.MouseEvent) => {
    if (document.isFolder) {
      setIsOpen(!isOpen);
    }
  };

  const handleLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const Icon = document.isFolder ? (
    isOpen ? <FolderOpen size={18} className="icon-folder" /> : <Folder size={18} className="icon-folder" />
  ) : (
    getFileIcon(document)
  );

  const className = `document-node-item ${document.isFolder ? 'folder' : 'file'} ${isSelected ? 'selected' : ''}`;
  
  const originalName = document.name || document.original_name || document.original_filename;
  const primaryName = originalName || document.filename || 'Unnamed Item';

  const nodeContent = (
    <div className="d-flex align-items-center w-100">
      {document.isFolder && (
        <span className={`folder-chevron me-2 ${isOpen ? 'rotate-90' : ''}`} style={{ transition: 'transform 0.2s' }}>
          <ChevronRight size={14} />
        </span>
      )}
      <span className="icon-container me-2 opacity-75">{Icon}</span>
      <div className="document-node-name text-truncate small" title={primaryName}>
        {primaryName}
      </div>
    </div>
  );

  return (
    <div className="document-node-wrapper mb-1">
      <div className={className} onClick={handleNodeClick} style={{ cursor: 'pointer', borderRadius: '4px' }}>
        {!document.isFolder ? (
          <Link to={`/document/${document.id}`} onClick={handleLinkClick} className="document-node-link text-decoration-none text-reset p-1 d-flex align-items-center">
            {nodeContent}
          </Link>
        ) : (
          <div className="document-node-folder-content p-1 d-flex align-items-center">
            {nodeContent}
          </div>
        )}
      </div>
      
      {document.isFolder && document.children && (
        <Collapse in={isOpen}>
          <div className="ms-3 border-start ps-1 mt-1">
            {document.children.map((child) => (
              <DocumentNode key={child.id} document={child} />
            ))}
          </div>
        </Collapse>
      )}
    </div>
  );
};

export default DocumentNode;

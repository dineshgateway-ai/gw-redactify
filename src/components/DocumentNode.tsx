import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Document } from '../api/documentService';
import { Folder, FolderOpen, FileText, File, ChevronRight, FileSpreadsheet, FileImage, FilePieChart, FileCode } from 'lucide-react';

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
  const displayDate = document.uploadDate ? new Date(document.uploadDate).toLocaleDateString() : 'N/A';
  const displaySize = document.size !== undefined ? formatBytes(document.size) : 'N/A';

  const metadata = (
    <div className="document-node-metadata">
      <p><strong>Path:</strong> {document.boxPath}</p>
      <p><strong>Size:</strong> {displaySize}</p>
      <p><strong>Upload Date:</strong> {displayDate}</p>
      <p><strong>ID:</strong> {document.id}</p>
    </div>
  );

  const originalName = document.name || document.original_name || document.original_filename;
  const primaryName = originalName || document.filename || 'Unnamed Item';
  const secondaryName = originalName ? document.filename : null;

  const nodeContent = (
    <>
      {document.isFolder && (
        <span className={`folder-chevron ${isOpen ? 'open' : ''}`}>
          <ChevronRight size={14} />
        </span>
      )}
      <span className="icon-container">{Icon}</span>
      <div className="document-node-name-container">
        <span className="document-node-name" title={primaryName}>{primaryName}</span>
        {secondaryName && (
          <span className="original-filename" title={secondaryName}>
            {secondaryName}
          </span>
        )}
      </div>
    </>
  );

  return (
    <li>
      <div className={className} onClick={handleNodeClick}>
        {!document.isFolder ? (
          <Link to={`/document/${document.id}`} onClick={handleLinkClick} className="document-node-link">
            {nodeContent}
          </Link>
        ) : (
          <div className="document-node-folder-content">
            {nodeContent}
          </div>
        )}
      </div>
      {metadata}
      
      {document.isFolder && document.children && isOpen && (
        <ul>
          {document.children.map((child) => (
            <DocumentNode key={child.id} document={child} />
          ))}
        </ul>
      )}
    </li>
  );
};

export default DocumentNode;

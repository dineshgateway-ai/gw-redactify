import React from 'react';
import { Document } from '../api/documentService';
import DocumentNode from './DocumentNode';
import { Folder } from 'lucide-react';

interface DocumentTreeViewProps {
  documents: Document[];
}

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({ documents }) => {
  return (
    <div className="document-tree-view">
      <div className="document-tree-header">
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <Folder size={18} />
          <strong>Documents</strong>
        </div>
      </div>
      <ul className="document-tree-root">
        {documents.map((doc) => (
          <DocumentNode key={doc.id} document={doc} />
        ))}
      </ul>
    </div>
  );
};

export default DocumentTreeView;

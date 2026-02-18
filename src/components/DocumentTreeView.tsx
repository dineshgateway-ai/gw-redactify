import React from 'react';
import { Document } from '../api/documentService';
import DocumentNode from './DocumentNode';
import { ListGroup } from 'react-bootstrap';

interface DocumentTreeViewProps {
  documents: Document[];
}

const DocumentTreeView: React.FC<DocumentTreeViewProps> = ({ documents }) => {
  return (
    <div className="document-tree-view">
      <ListGroup variant="flush" className="bg-transparent">
        {documents.map((doc) => (
          <DocumentNode key={doc.id} document={doc} />
        ))}
      </ListGroup>
    </div>
  );
};

export default DocumentTreeView;

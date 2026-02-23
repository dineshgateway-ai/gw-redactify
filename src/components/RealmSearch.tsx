import React, { useState } from 'react';
import k8sConfig from '../config/k8s-config.json';

interface RealmSearchProps {
  initialRealmId: string;
  initialNamespace?: string;
  initialCluster?: string;
  onSearch: (realmId: string, namespace: string, cluster: string) => void;
  isFetching: boolean;
}

const RealmSearch: React.FC<RealmSearchProps> = ({ 
  initialRealmId, 
  initialNamespace = 'gatewayai', 
  initialCluster = 'gw-dev',
  onSearch, 
  isFetching 
}) => {
  const [inputValue, setInputValue] = useState(initialRealmId);
  const [namespace, setNamespace] = useState(initialNamespace);
  const [cluster, setCluster] = useState(initialCluster);

  const handleSearch = () => {
    onSearch(inputValue, namespace, cluster);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isFetching) {
      handleSearch();
    }
  };

  return (
    <div className="realm-input-container" style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
      {/* <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="cluster-select">Cluster:</label>
        <select
          id="cluster-select"
          value={cluster}
          onChange={(e) => setCluster(e.target.value)}
          disabled={isFetching}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {k8sConfig.clusters.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div> */}

      {/* <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="namespace-select">Namespace:</label>
        <select
          id="namespace-select"
          value={namespace}
          onChange={(e) => setNamespace(e.target.value)}
          disabled={isFetching}
          style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #ccc' }}
        >
          {k8sConfig.namespaces.map(ns => (
            <option key={ns} value={ns}>{ns}</option>
          ))}
        </select>
      </div> */}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <label htmlFor="realm-id">Realm ID:</label>
        <input
          id="realm-id"
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter Realm ID"
          disabled={isFetching}
        />
      </div>

      <button onClick={handleSearch} disabled={isFetching} className="primary-button">
        {isFetching ? 'Fetching...' : 'Search'}
      </button>
    </div>
  );
};

export default RealmSearch;

import React, { useState } from 'react';

interface RealmSearchProps {
  initialRealmId: string;
  onSearch: (realmId: string) => void;
  isFetching: boolean;
}

const RealmSearch: React.FC<RealmSearchProps> = ({ initialRealmId, onSearch, isFetching }) => {
  const [inputValue, setInputValue] = useState(initialRealmId);

  const handleSearch = () => {
    onSearch(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isFetching) {
      handleSearch();
    }
  };

  return (
    <div className="realm-input-container">
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
      <button onClick={handleSearch} disabled={isFetching}>
        {isFetching ? 'Fetching...' : 'Search'}
      </button>
    </div>
  );
};

export default RealmSearch;

import React from 'react';
import PropTypes from 'prop-types';

const Sidebar = ({ repoList, currentRepo, onRepoSelect, loading }) => {
  const handleRepoClick = (repo) => {
    onRepoSelect(repo);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        仓库列表
      </div>
      <div className="sidebar-content">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : repoList.length > 0 ? (
          repoList.map(repo => (
            <div
              key={repo.id}
              className={`repo-list-item ${currentRepo && currentRepo.id === repo.id ? 'active' : ''}`}
              onClick={() => handleRepoClick(repo)}
            >
              <div className="repo-name">{repo.name}</div>
              <div className="repo-path" style={{ fontSize: '12px', color: '#666' }}>{repo.path}</div>
            </div>
          ))
        ) : (
          <div className="no-repos">没有找到仓库</div>
        )}
      </div>
    </div>
  );
};

Sidebar.propTypes = {
  repoList: PropTypes.array.isRequired,
  currentRepo: PropTypes.object,
  onRepoSelect: PropTypes.func.isRequired,
  loading: PropTypes.bool.isRequired
};

export default Sidebar;
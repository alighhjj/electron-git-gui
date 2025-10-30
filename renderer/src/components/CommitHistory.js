import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import gitAPI from '../../utils/gitAPI';
import notificationService from '../../utils/notification';

const CommitHistory = ({ currentRepo }) => {
  const [commits, setCommits] = useState([]);
  const [loading, setLoading] = useState(false);

  // 获取提交历史
  useEffect(() => {
    if (currentRepo) {
      fetchCommitHistory();
    } else {
      setCommits([]);
    }
  }, [currentRepo]);

  const fetchCommitHistory = async () => {
    if (!currentRepo) return;
    
    setLoading(true);
    try {
      const result = await gitAPI.getLog(currentRepo.path);
      if (result.success) {
        // Handle different data formats from simple-git
        let commitsArray = [];
        if (result.data && result.data.all) {
          // Standard format
          commitsArray = result.data.all;
        } else if (Array.isArray(result.data)) {
          // Direct array format
          commitsArray = result.data;
        } else {
          // Single commit or other format
          commitsArray = result.data ? [result.data] : [];
        }
        
        // Transform simple-git log format to our expected format
        const formattedCommits = commitsArray.map(commit => ({
          id: commit.hash || commit.commit,
          title: (commit.message || commit.body || '').split('\n')[0], // First line as title
          author: commit.author_name || commit.author || 'Unknown',
          date: new Date(commit.date || commit.time).toLocaleString('zh-CN'),
          message: commit.message || commit.body || 'No message'
        })).filter(commit => commit.id); // Filter out commits without ID
        
        setCommits(formattedCommits);
      } else {
        // 如果获取提交历史失败，仍然设置为空数组
        setCommits([]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!currentRepo) {
    return (
      <div className="commit-history">
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
          请选择一个仓库
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="commit-history">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          加载提交历史...
        </div>
      </div>
    );
  }

  return (
    <div className="commit-history">
      <h3 style={{ marginBottom: '15px' }}>提交历史</h3>
      {commits.length > 0 ? (
        commits.map(commit => (
          <div key={commit.id} className="commit-item">
            <div className="commit-header">
              <span className="commit-hash">{commit.id.substring(0, 7)}</span>
              <span className="commit-title">{commit.title}</span>
            </div>
            <div className="commit-meta">
              <span className="commit-author">作者: {commit.author}</span>
              <span className="commit-date">{commit.date}</span>
            </div>
            <div style={{ marginTop: '8px', fontSize: '14px', lineHeight: '1.5' }}>
              {commit.message}
            </div>
          </div>
        ))
      ) : (
        <div className="loading">暂无提交历史</div>
      )}
    </div>
  );
};

CommitHistory.propTypes = {
  currentRepo: PropTypes.object
};

export default CommitHistory;
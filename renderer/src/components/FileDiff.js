import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import gitAPI from '../../utils/gitAPI';

const FileDiff = ({ currentRepo, filePath }) => {
  const [diffContent, setDiffContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentRepo && filePath) {
      fetchFileDiff();
    } else {
      setDiffContent('');
      setError(null);
    }
  }, [currentRepo, filePath]);

  const fetchFileDiff = async () => {
    if (!currentRepo || !filePath) return;

    setLoading(true);
    setError(null);
    
    try {
      const result = await gitAPI.getDiff(currentRepo.path, filePath);
      if (result.success) {
        if (result.data && result.data.trim() !== '') {
          setDiffContent(result.data);
        } else {
          setDiffContent('// 文件没有差异或尚未暂存更改');
        }
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!filePath) {
    return (
      <div className="file-diff">
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
          请选择一个文件查看差异
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-diff">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          加载差异信息...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="file-diff">
        <div style={{ padding: '20px', color: '#d32f2f' }}>
          加载差异信息失败: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="file-diff" style={{ padding: '10px', fontFamily: 'monospace', fontSize: '14px', overflow: 'auto' }}>
      <div style={{ 
        backgroundColor: '#f8f8f8', 
        border: '1px solid #e1e4e8', 
        borderRadius: '4px',
        padding: '10px',
        whiteSpace: 'pre-wrap',
        wordWrap: 'break-word'
      }}>
        {diffContent || '// 没有可显示的差异'}
      </div>
    </div>
  );
};

FileDiff.propTypes = {
  currentRepo: PropTypes.shape({
    path: PropTypes.string.isRequired
  }),
  filePath: PropTypes.string
};

export default FileDiff;
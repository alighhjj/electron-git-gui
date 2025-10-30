import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import gitAPI from '../../utils/gitAPI';

const TagPushModal = ({ currentRepo, isOpen, onClose, onTagPushed }) => {
  const [tagInput, setTagInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [suggestedTag, setSuggestedTag] = useState('');

  // 组件加载时获取最新的tag并生成建议
  useEffect(() => {
    if (isOpen && currentRepo) {
      fetchAndSuggestTag();
    } else {
      setTagInput('');
      setError('');
    }
  }, [isOpen, currentRepo]);

  const fetchAndSuggestTag = async () => {
    setIsLoading(true);
    setError('');
    try {
      // 获取远程标签列表，需要先fetch
      await gitAPI.fetch(currentRepo.path);
      const result = await gitAPI.getTags(currentRepo.path);
      
      if (result.success) {
        let tags = result.data || [];
        // 过滤出有效的版本标签（以v开头后跟数字的格式）
        const versionTags = tags
          .filter(tag => /^v\d+\.\d+\.\d+$/.test(tag.trim()))
          .sort((a, b) => {
            // 比较版本号的函数
            const aParts = a.slice(1).split('.').map(Number); // 去掉'v'前缀并分割
            const bParts = b.slice(1).split('.').map(Number);
            
            for (let i = 0; i < 3; i++) {
              if (aParts[i] > bParts[i]) return -1;
              if (aParts[i] < bParts[i]) return 1;
            }
            return 0;
          });

        let nextTag = 'v1.0.0'; // 默认从v1.0.0开始
        
        if (versionTags.length > 0) {
          const latestTag = versionTags[0]; // 排序后第一个是最新版本
          const versionParts = latestTag.slice(1).split('.').map(Number); // 去掉'v'前缀
          
          // 简单地将最后一位版本号加1
          versionParts[2] += 1;
          nextTag = `v${versionParts.join('.')}`;
        }
        
        setSuggestedTag(nextTag);
        setTagInput(nextTag); // 设置输入框默认值为建议的标签
      } else {
        // 如果获取标签失败，也使用默认值
        setSuggestedTag('v1.0.0');
        setTagInput('v1.0.0');
      }
    } catch (err) {
      console.error('获取标签建议时出错:', err);
      setSuggestedTag('v1.0.0');
      setTagInput('v1.0.0');
      setError('获取远程标签失败，使用默认值 v1.0.0');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!tagInput.trim()) {
      setError('请输入标签名称');
      return;
    }

    // 验证标签格式
    if (!/^v\d+\.\d+\.\d+$/.test(tagInput.trim())) {
      setError('标签格式不正确，应为 vX.X.X 格式，如 v1.1.1');
      return;
    }

    setIsLoading(true);
    setError('');
    
    try {
      // 首先创建本地标签
      const createResult = await gitAPI.createTag(currentRepo.path, tagInput.trim());
      if (!createResult.success) {
        throw new Error(createResult.error || '创建标签失败');
      }

      // 然后推送标签到远程
      const pushResult = await gitAPI.pushTags(currentRepo.path, 'origin', tagInput.trim());
      if (!pushResult.success) {
        throw new Error(pushResult.error || '推送标签失败');
      }

      // 成功后调用回调
      onTagPushed && onTagPushed(tagInput.trim());
      onClose();
    } catch (err) {
      console.error('推送标签失败:', err);
      setError(err.message || '推送标签失败');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '500px' }}>
        <div className="modal-header">
          <h3>推送标签</h3>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label htmlFor="tagInput">版本标签:</label>
            <input
              id="tagInput"
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="输入标签名称，如 v1.1.1"
              className="form-input"
              disabled={isLoading}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ccc', 
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '5px',
              fontStyle: 'italic'
            }}>
              建议: {suggestedTag}
            </div>
          </div>
          
          {error && (
            <div className="error-message" style={{ 
              color: '#dc3545', 
              marginTop: '10px',
              padding: '8px',
              backgroundColor: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              {error}
            </div>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn-secondary" 
            onClick={onClose} 
            disabled={isLoading}
            style={{ marginRight: '10px' }}
          >
            取消
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleConfirm} 
            disabled={isLoading}
          >
            {isLoading ? '推送中...' : '确认推送'}
          </button>
        </div>
      </div>
    </div>
  );
};

TagPushModal.propTypes = {
  currentRepo: PropTypes.object.isRequired,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onTagPushed: PropTypes.func
};

export default TagPushModal;
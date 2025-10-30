import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import gitAPI from '../../utils/gitAPI';
import FileDiff from './FileDiff';

const FileChanges = ({ currentRepo }) => {
  const [repoStatus, setRepoStatus] = useState(null);
  const [unstagedFiles, setUnstagedFiles] = useState([]); // 未暂存文件
  const [stagedFiles, setStagedFiles] = useState([]);     // 已暂存文件
  const [selectedUnstagedFiles, setSelectedUnstagedFiles] = useState([]); // 选中的未暂存文件
  const [selectedStagedFiles, setSelectedStagedFiles] = useState([]);     // 选中的已暂存文件
  const [commitMessage, setCommitMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFileForDiff, setSelectedFileForDiff] = useState(null);
  const [diffViewVisible, setDiffViewVisible] = useState(false);

  // 获取仓库状态 - 使用防抖机制避免与父组件操作冲突
  useEffect(() => {
    // 延迟执行以避免与父组件的操作冲突
    const timer = setTimeout(() => {
      if (currentRepo) {
        fetchRepoStatus();
      } else {
        setRepoStatus(null);
        setUnstagedFiles([]);
        setStagedFiles([]);
      }
    }, 100); // 延迟100毫秒执行
    
    return () => clearTimeout(timer);
  }, [currentRepo]);

  const fetchRepoStatus = async () => {
    if (!currentRepo) return;
    
    setLoading(true);
    try {
      const result = await gitAPI.getStatus(currentRepo.path);
      if (result.success) {
        setRepoStatus(result.data);
        
        // 根据status结果将文件分类为已暂存和未暂存
        const status = result.data;
        
        console.log('Git status result:', status); // 调试信息
        
        // 根据simple-git的status响应格式进行文件分类
        // 在simple-git中，status.files数组包含了index和working_dir状态
        // index: 暂存区状态 ('A'=新增, 'M'=修改, 'D'=删除)
        // working_dir: 工作目录状态 ('M'=修改, 'D'=删除, '?'=未跟踪)
        
        // 已暂存文件：在index中有状态且在工作目录中无更改的文件
        const staged = status.files
          .filter(file => file.index !== ' ' && file.index !== undefined && file.working_dir === ' ')
          .map(file => ({
            path: file.path,
            status: 'staged',
            index: file.index,
            working_dir: file.working_dir
          }));

        // 未暂存文件：在工作目录中有更改的文件，或者单独列出的修改/新增/删除文件
        const unstaged = [
          // 从files数组中找出工作目录有更改的文件
          ...status.files
            .filter(file => file.working_dir !== ' ' && file.working_dir !== undefined)
            .map(file => ({
              path: file.path,
              status: 'unstaged',
              index: file.index,
              working_dir: file.working_dir
            })),
          // 添加单独列出的modified文件（如果它们未在files数组的index中）
          ...status.modified
            .filter(path => !status.files.some(f => f.path === path && f.index !== ' '))
            .map(path => ({
              path: path,
              status: 'modified',
              index: ' ',
              working_dir: 'M'
            })),
          // 添加单独列出的created文件（如果它们未在files数组的index中）
          ...status.created
            .filter(path => !status.files.some(f => f.path === path && f.index !== ' '))
            .map(path => ({
              path: path,
              status: 'created',
              index: ' ',
              working_dir: 'A'
            })),
          // 添加单独列出的deleted文件（如果它们未在files数组的index中）
          ...status.deleted
            .filter(path => !status.files.some(f => f.path === path && f.index !== ' '))
            .map(path => ({
              path: path,
              status: 'deleted',
              index: ' ',
              working_dir: 'D'
            }))
        ];
        
        console.log('Staged files:', staged); // 调试信息
        console.log('Unstaged files:', unstaged); // 调试信息
        
        // 去除重复的文件
        const uniqueUnstaged = unstaged.filter((file, index, self) =>
          index === self.findIndex(f => f.path === file.path)
        );
        
        setUnstagedFiles(uniqueUnstaged);
        setStagedFiles(staged);
        
        // 清空选择状态
        setSelectedUnstagedFiles([]);
        setSelectedStagedFiles([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnstagedFileToggle = (filePath) => {
    setSelectedUnstagedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter(file => file !== filePath) 
        : [...prev, filePath]
    );
  };

  const handleStagedFileToggle = (filePath) => {
    setSelectedStagedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter(file => file !== filePath) 
        : [...prev, filePath]
    );
  };

  const handleStageSelected = async () => {
    if (!currentRepo || selectedUnstagedFiles.length === 0) return;
    
    setLoading(true);
    try {
      // 暂存选中的未暂存文件
      for (const filePath of selectedUnstagedFiles) {
        const result = await gitAPI.add(currentRepo.path, filePath);
        if (!result.success) {
          break;
        }
      }
      fetchRepoStatus(); // 刷新状态
    } finally {
      setLoading(false);
    }
  };

  const handleUnstageSelected = async () => {
    if (!currentRepo || selectedStagedFiles.length === 0) return;
    
    setLoading(true);
    try {
      // 取消暂存选中的已暂存文件
      for (const filePath of selectedStagedFiles) {
        const result = await gitAPI.unstage(currentRepo.path, filePath);
        if (!result.success) {
          console.error(`取消暂存失败: ${filePath}`, result.error);
        }
      }
      fetchRepoStatus(); // 刷新状态
    } finally {
      setLoading(false);
    }
  };

  const handleStageAll = async () => {
    if (!currentRepo) return;
    
    setLoading(true);
    try {
      // 暂存所有未暂存文件
      const result = await gitAPI.add(currentRepo.path, '.');
      if (result.success) {
        fetchRepoStatus(); // 刷新状态
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnstageAll = async () => {
    if (!currentRepo || stagedFiles.length === 0) return;
    
    setLoading(true);
    try {
      // 通过循环取消暂存每个文件来实现全部取消暂存
      for (const fileObj of stagedFiles) {
        const result = await gitAPI.unstage(currentRepo.path, fileObj.path);
        if (!result.success) {
          console.error(`取消暂存失败: ${fileObj.path}`, result.error);
        }
      }
      console.log('取消暂存所有文件完成');
      fetchRepoStatus(); // 刷新状态
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!currentRepo || !commitMessage.trim() || stagedFiles.length === 0) return;
    
    setLoading(true);
    try {
      const result = await gitAPI.commit(currentRepo.path, commitMessage.trim());
      if (result.success) {
        setCommitMessage(''); // 清空提交信息
        fetchRepoStatus(); // 刷新状态
        setDiffViewVisible(false); // 隐藏diff视图
        
        // 提交成功后，通知父组件刷新仓库信息以更新推送按钮状态
        window.dispatchEvent(new CustomEvent('git-commit-completed'));
        
        // 提交成功提示
        alert('提交成功！');
      } else {
        alert('提交失败: ' + result.error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (filePath) => {
    // Toggle diff view for the selected file
    if (selectedFileForDiff === filePath) {
      setDiffViewVisible(!diffViewVisible);
    } else {
      setSelectedFileForDiff(filePath);
      setDiffViewVisible(true);
    }
  };

  // 渲染文件项的辅助函数
  const renderFileItem = (file, isSelected, onToggle, isStaged = false) => (
    <div 
      key={file.path}
      className={`file-change-item ${selectedFileForDiff === file.path ? 'selected' : ''}`}
      style={{
        cursor: 'pointer',
        border: selectedFileForDiff === file.path ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
        backgroundColor: selectedFileForDiff === file.path ? 'rgba(3, 102, 214, 0.05)' : 'inherit',
        marginBottom: '8px',
        borderRadius: '4px',
        fontSize: '13px'  // 缩小文件列表字体
      }}
      onClick={() => handleFileClick(file.path)}
    >
      <div className="file-change-header" style={{ padding: '8px 10px' }}>
        <span className="file-path">{file.path}</span>
        <span className={`file-status status-${file.index}`}>
          {file.index === 'M' && !isStaged && '已修改'}
          {file.index === 'M' && isStaged && '已暂存修改'}
          {file.index === 'A' && !isStaged && '新增'}
          {file.index === 'A' && isStaged && '已暂存新增'}
          {file.index === 'D' && !isStaged && '删除'}
          {file.index === 'D' && isStaged && '已暂存删除'}
          {file.index === '?' && '未跟踪'}
          {file.index === 'R' && '重命名'}
          {file.index === 'C' && '拷贝'}
          {!file.index && file.status === 'staged' && '已暂存'}
        </span>
      </div>
      <div style={{ padding: '0 10px 10px 10px' }}>
        <label>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation(); // Prevent triggering the click handler
              onToggle(file.path)
            }}
            style={{ marginRight: '8px' }}
          />
          {isStaged ? '取消暂存' : '添加到暂存区'}
        </label>
      </div>
    </div>
  );

  if (!currentRepo) {
    return (
      <div className="file-changes">
        <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
          请选择一个仓库
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="file-changes">
        <div style={{ padding: '20px', textAlign: 'center' }}>
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="file-changes" style={{ display: 'flex', flexDirection: diffViewVisible ? 'column' : 'column' }}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        flex: diffViewVisible ? '0 0 50%' : '1'
      }}>
        <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>文件变更</h3>
          <div style={{ display: 'flex', gap: '5px' }}>
            <button 
              className="btn btn-default" 
              onClick={handleStageAll} 
              disabled={loading || unstagedFiles.length === 0}
              title="暂存所有未暂存文件"
            >
              全部暂存
            </button>
            <button 
              className="btn btn-default" 
              onClick={handleUnstageAll} 
              disabled={loading || stagedFiles.length === 0}
              title="取消暂存所有文件"
            >
              全部取消暂存
            </button>
            <button 
              className="btn btn-primary" 
              onClick={handleStageSelected} 
              disabled={selectedUnstagedFiles.length === 0 || loading}
              title="暂存选中的未暂存文件"
            >
              暂存选中 ({selectedUnstagedFiles.length})
            </button>
            <button 
              className="btn btn-warning" 
              onClick={handleUnstageSelected} 
              disabled={selectedStagedFiles.length === 0 || loading}
              title="取消暂存选中的已暂存文件"
            >
              取消暂存选中 ({selectedStagedFiles.length})
            </button>
          </div>
        </div>

        {/* 左右分栏布局 */}
        <div style={{ 
          display: 'flex', 
          flex: 1, 
          overflow: 'hidden',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {/* 未暂存文件区 (左侧) */}
          <div style={{ 
            flex: 1, 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              marginBottom: '10px', 
              paddingBottom: '5px', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, color: '#e74c3c' }}>未暂存文件 ({unstagedFiles.length})</h4>
              <span style={{ fontSize: '12px', color: '#777' }}>工作目录中的更改</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, fontSize: '13px' }}>
              {unstagedFiles.length > 0 ? (
                unstagedFiles.map(file => 
                  renderFileItem(
                    file, 
                    selectedUnstagedFiles.includes(file.path), 
                    handleUnstagedFileToggle, 
                    false
                  )
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0', fontSize: '13px' }}>
                  没有未暂存的文件
                </div>
              )}
            </div>
          </div>

          {/* 已暂存文件区 (右侧) */}
          <div style={{ 
            flex: 1, 
            border: '1px solid var(--border-color)', 
            borderRadius: '4px',
            padding: '10px',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              marginBottom: '10px', 
              paddingBottom: '5px', 
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h4 style={{ margin: 0, color: '#27ae60' }}>已暂存文件 ({stagedFiles.length})</h4>
              <span style={{ fontSize: '12px', color: '#777' }}>准备提交的更改</span>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, fontSize: '13px' }}>
              {stagedFiles.length > 0 ? (
                stagedFiles.map(file => 
                  renderFileItem(
                    file, 
                    selectedStagedFiles.includes(file.path), 
                    handleStagedFileToggle, 
                    true
                  )
                )
              ) : (
                <div style={{ textAlign: 'center', color: '#999', padding: '20px 0', fontSize: '13px' }}>
                  没有已暂存的文件
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 提交面板 */}
        <div style={{ 
          marginTop: '10px', 
          padding: '15px', 
          border: '1px solid var(--border-color)', 
          borderRadius: '4px',
          backgroundColor: 'var(--secondary-color)'
        }}>
          <h4 style={{ marginBottom: '10px' }}>提交变更</h4>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <textarea
            className="form-input"
            placeholder="输入提交信息..."
            rows="3"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            style={{ 
              flex: 1, 
              resize: 'vertical', 
              width: '100%', 
              minHeight: '35px' // 设定为35px以与按钮匹配
            }}
            disabled={loading}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleCommit} 
              disabled={!commitMessage.trim() || loading || stagedFiles.length === 0}
              style={{ minWidth: '80px' }}
            >
              {loading ? '提交中...' : `提交 (${stagedFiles.length} 个文件)`}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Diff View */}
      {diffViewVisible && selectedFileForDiff && (
        <div style={{ 
          marginTop: '15px', 
          border: '1px solid var(--border-color)', 
          borderRadius: '4px',
          flex: '0 0 50%',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ 
            padding: '10px', 
            backgroundColor: 'var(--secondary-color)', 
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h4 style={{ margin: 0 }}>差异查看: {selectedFileForDiff}</h4>
            <button 
              className="btn btn-default"
              onClick={() => setDiffViewVisible(false)}
              style={{ padding: '2px 8px' }}
            >
              隐藏
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FileDiff currentRepo={currentRepo} filePath={selectedFileForDiff} />
          </div>
        </div>
      )}
    </div>
  );
};

FileChanges.propTypes = {
  currentRepo: PropTypes.shape({
    path: PropTypes.string.isRequired
  })
};

export default FileChanges;
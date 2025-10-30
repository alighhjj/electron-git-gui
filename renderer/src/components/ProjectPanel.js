import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import FileChanges from './FileChanges';
import CommitHistory from './CommitHistory';
import GitHubPanel from './GitHubPanel';
import SSHConfigModal from './SSHConfigModal';
import TagPushModal from './TagPushModal';
import gitAPI from '../../utils/gitAPI';
import notificationService from '../../utils/notification';

const ProjectPanel = ({ currentRepo }) => {
  const [activeTab, setActiveTab] = useState('changes'); // 'changes', 'history', 'github'
  const [repoInfo, setRepoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pullPushLoading, setPullPushLoading] = useState({ pull: false, push: false });
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);
  const [branches, setBranches] = useState([]);
  const [currentBranch, setCurrentBranch] = useState('');
  const [hasUnpushedCommits, setHasUnpushedCommits] = useState(false);
  const [showSSHConfig, setShowSSHConfig] = useState(false);
  const [showTagPushModal, setShowTagPushModal] = useState(false);

  // 获取仓库信息
  useEffect(() => {
    if (currentRepo) {
      fetchRepoInfo();
    } else {
      setRepoInfo(null);
      setBranches([]);
      setCurrentBranch('');
    }
    
    // 监听提交完成事件，以更新推送按钮状态
    const handleGitCommitCompleted = () => {
      if (currentRepo) {
        fetchRepoInfo();
      }
    };
    
    // 监听远程URL更新事件
    const handleRemoteUrlUpdated = (event) => {
      if (currentRepo && event.detail.currentRepo.path === currentRepo.path) {
        fetchRepoInfo();
      }
    };
    
    window.addEventListener('git-commit-completed', handleGitCommitCompleted);
    window.addEventListener('remote-url-updated', handleRemoteUrlUpdated);
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('git-commit-completed', handleGitCommitCompleted);
      window.removeEventListener('remote-url-updated', handleRemoteUrlUpdated);
    };
  }, [currentRepo]); // 仅当currentRepo变化时执行

  const fetchRepoInfo = async () => {
    if (!currentRepo) return;
    
    setLoading(true);
    try {
      // 获取当前分支
      const branch = await gitAPI.getCurrentBranch(currentRepo.path);
      setCurrentBranch(branch);
      
      // 获取origin远程仓库的URL
      let remoteUrl = null;
      try {
        // 直接获取origin的URL
        const remoteResult = await gitAPI.executeGitOperation('remote', currentRepo.path, 'get-url', 'origin');
        if (remoteResult.success) {
          remoteUrl = remoteResult.data?.trim(); // 如果数据格式正确
        } else if (remoteResult.error && (remoteResult.error.includes('No such remote') || remoteResult.error.includes('origin'))) {
          // 如果没有origin远程仓库，remoteUrl保持null
          console.log('仓库未配置origin远程仓库');
        }
      } catch (remoteError) {
        console.error('获取远程仓库URL失败:', remoteError);
        // 如果出错，也认为没有远程仓库
      }
      
      // 检查是否有未推送的提交
      let hasUnpushed = false;
      
      // 首先检查是否有本地提交
      let hasLocalCommits = false;
      try {
        const logResult = await gitAPI.getLog(currentRepo.path);
        if (logResult.success && logResult.data && Array.isArray(logResult.data.all)) {
          hasLocalCommits = logResult.data.all.length > 0;
        }
      } catch (logError) {
        console.error('获取提交历史失败:', logError);
        // 如果获取提交历史失败，检查是否有工作目录更改作为备用
        try {
          const statusResult = await gitAPI.getStatus(currentRepo.path);
          if (statusResult.success && statusResult.data) {
            const stagedFiles = statusResult.data.staged || [];
            const notStagedFiles = statusResult.data.not_staged || [];
            const untrackedFiles = statusResult.data.untracked || [];
            hasLocalCommits = (Array.isArray(stagedFiles) && stagedFiles.length > 0) ||
                             (Array.isArray(notStagedFiles) && notStagedFiles.length > 0) ||
                             (Array.isArray(untrackedFiles) && untrackedFiles.length > 0);
          }
        } catch (statusError) {
          console.error('检查仓库状态失败:', statusError);
        }
      }
      
      if (remoteUrl) {  // 有远程仓库
        if (hasLocalCommits) {
          // 如果有本地提交，很可能有未推送的内容
          // 尝试使用rev-list检查本地与远程的差异
          try {
            const result = await gitAPI.executeGitOperation('rev-list', currentRepo.path, '--count', `origin/${branch}..HEAD`);
            if (result.success) {
              const count = parseInt(result.data?.trim() || '0');
              hasUnpushed = count > 0;
            } else {
              // 如果rev-list失败，但已确认有本地提交，我们可以认为有未推送的内容
              hasUnpushed = true;
            }
          } catch (checkError) {
            // 即使rev-list失败，如果有本地提交，我们仍假设有未推送的内容
            hasUnpushed = hasLocalCommits;
          }
        } else {
          // 没有本地提交，确认没有未推送的内容
          hasUnpushed = false;
        }
      } else {
        // 没有远程仓库，如果有本地提交，则认为有"未推送"的内容
        hasUnpushed = hasLocalCommits;
      }

      setHasUnpushedCommits(hasUnpushed);
      
      setRepoInfo({
        branch: branch,
        ahead: 0, // 需要通过其他命令获取
        behind: 0,
        remoteUrl: remoteUrl
      });
      
      // 获取仓库状态
      const statusResult = await gitAPI.getStatus(currentRepo.path);
      if (statusResult.success) {
        // 更新仓库状态
      }
    } catch (error) {
      console.error('获取仓库信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePull = async () => {
    if (!currentRepo) return;
    
    setPullPushLoading(prev => ({ ...prev, pull: true }));
    try {
      // 获取远程仓库URL以确定协议类型
      const remoteUrlResult = await gitAPI.executeGitOperation('remote', currentRepo.path, 'get-url', 'origin');
      let protocolInfo = '';
      if (remoteUrlResult.success) {
        const remoteUrl = remoteUrlResult.data;
        if (remoteUrl.startsWith('https://')) {
          protocolInfo = ' (HTTPS)';
        } else if (remoteUrl.startsWith('git@')) {
          protocolInfo = ' (SSH)';
        }
      }
      
      const result = await gitAPI.pull(currentRepo.path);
      if (result.success) {
        notificationService.success(`拉取成功${protocolInfo}`);
        // 刷新界面
        fetchRepoInfo();
        if (activeTab === 'changes') {
          // FileChanges 组件会自动刷新
        }
      } else {
        // 如果拉取失败，显示错误
        notificationService.error(`拉取失败${protocolInfo}: ${result.error}`);
      }
    } catch (error) {
      console.error('拉取失败:', error);
      notificationService.error('拉取失败: ' + error.message);
    } finally {
      setPullPushLoading(prev => ({ ...prev, pull: false }));
    }
  };

  const handlePush = async () => {
    if (!currentRepo) return;
    
    setPullPushLoading(prev => ({ ...prev, push: true }));
    try {
      // 在推送之前，检查是否有配置远程仓库
      const remotesResult = await gitAPI.executeGitOperation('get-remotes', currentRepo.path);
      if (remotesResult.success && remotesResult.data && remotesResult.data.length > 0) {
        // 获取远程仓库URL以确定协议类型
        const remoteUrlResult = await gitAPI.executeGitOperation('remote', currentRepo.path, 'get-url', 'origin');
        let protocolInfo = '';
        if (remoteUrlResult.success) {
          const remoteUrl = remoteUrlResult.data;
          if (remoteUrl.startsWith('https://')) {
            protocolInfo = ' (HTTPS)';
          } else if (remoteUrl.startsWith('git@')) {
            protocolInfo = ' (SSH)';
          }
        }
        
        // 有远程仓库，执行推送
        const result = await gitAPI.push(currentRepo.path);
        if (result.success) {
          notificationService.success(`推送成功${protocolInfo}`);
          // 推送成功后，更新仓库信息以正确反映状态
          await fetchRepoInfo();
        } else {
          // 这里显示最终的错误
          notificationService.error(`推送失败${protocolInfo}: ${result.error}`);
        }
      } else {
        // 没有配置远程仓库，提示用户
        notificationService.error('没有配置远程仓库，无法推送。请先在GitHub面板中设置远程仓库地址。');
      }
    } catch (error) {
      console.error('推送失败:', error);
      notificationService.error('推送失败: ' + error.message);
    } finally {
      setPullPushLoading(prev => ({ ...prev, push: false }));
    }
  };

  const handleCommit = async () => {
    if (!currentRepo || !commitMessage.trim()) return;
    
    setIsCommitting(true);
    try {
      // 为保持一致，使用同样的方法添加所有更改的文件
      const addResult = await gitAPI.add(currentRepo.path, '.');
      if (!addResult.success) {
        alert('添加文件到暂存区失败: ' + addResult.error);
        return;
      }
      
      // 然后提交
      const commitResult = await gitAPI.commit(currentRepo.path, commitMessage);
      if (commitResult.success) {
        setCommitMessage(''); // 清空提交信息
        // 在提交后刷新仓库信息以更新推送按钮状态
        await fetchRepoInfo();
        
        // 提交成功后，触发自定义事件以通知其他组件（如FileChanges）刷新
        window.dispatchEvent(new CustomEvent('git-commit-completed'));
      } else {
        alert('提交失败: ' + commitResult.error);
      }
    } finally {
      setIsCommitting(false);
    }
  };

  const handleSSHConfig = () => {
    setShowSSHConfig(true);
  };

  const handleSSHKeyGenerated = (publicKey) => {
    // SSH密钥生成后的回调处理
    console.log('SSH密钥已生成:', publicKey.substring(0, 50) + '...');
  };

  if (!currentRepo) {
    return (
      <div className="project-panel">
        <div className="loading">请选择一个仓库</div>
      </div>
    );
  }

  return (
    <>
      <div className="project-panel" style={{ 
        display: 'flex', 
        flexDirection: 'column',
        height: '100%'
      }}>
      {/* 仓库信息栏 */}
      <div style={{ 
        padding: '10px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--secondary-color)',
        display: 'flex',
        alignItems: 'center'
      }}>
        <div style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          color: 'var(--primary-color)'
        }}>
          {currentRepo.name}
        </div>
        <div style={{ 
          marginLeft: 'auto', 
          fontSize: '14px', 
          display: 'flex', 
          gap: '15px',
          alignItems: 'center'
        }}>
          <div style={{
            maxWidth: '200px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
            padding: '2px 6px',
            fontSize: '12px',
            backgroundColor: 'var(--secondary-color)'
          }} title={repoInfo?.remoteUrl || '未配置远程仓库'}>
            <span style={{ color: repoInfo?.remoteUrl ? '#28a745' : '#dc3545' }}>
              {repoInfo?.remoteUrl ? repoInfo.remoteUrl : '无远程仓库'}
            </span>
          </div>
          <span>分支: <strong>{currentBranch || 'main'}</strong></span>
          <button 
            className="btn btn-default" 
            onClick={handlePull} 
            disabled={pullPushLoading.pull || loading}
            title="拉取远程更新"
          >
            {pullPushLoading.pull ? '拉取中...' : '拉取'}
          </button>
          <button 
            className="btn btn-warning"
            onClick={() => setShowTagPushModal(true)}
            title="推送标签"
          >
            推送标签
          </button>
          <button 
            className={`btn ${hasUnpushedCommits ? 'btn-success' : 'btn-default'}`} 
            onClick={handlePush} 
            disabled={pullPushLoading.push || loading || !hasUnpushedCommits}
            title={hasUnpushedCommits ? "推送到远程" : "没有需要推送的提交"}
          >
            {pullPushLoading.push ? '推送中...' : '推送'}
          </button>
          <button 
            className="btn btn-info" 
            onClick={handleSSHConfig}
            title="SSH配置"
          >
            SSH配置
          </button>
          <button 
            className="btn btn-secondary" 
            onClick={() => {
              // 触发返回首页的事件
              window.dispatchEvent(new CustomEvent('go-to-welcome'));
            }}
            title="返回首页"
          >
            返回首页
          </button>
        </div>
      </div>

      {/* 提交面板 */}
      <div style={{ 
        padding: '15px', 
        backgroundColor: 'white',
        borderBottom: '1px solid var(--border-color)'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: '10px',
          alignItems: 'center'  /* 垂直居中对齐 */
        }}>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="输入提交信息..."
            className="form-input"
            style={{ 
              flex: 1, 
              minHeight: '35px',  /* 与按钮高度一致 */
              resize: 'vertical'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleCommit} 
              disabled={!commitMessage.trim() || isCommitting}
              style={{ minWidth: '80px' }}
            >
              {isCommitting ? '提交中...' : '全部提交'}
            </button>
          </div>
        </div>
      </div>

      {/* 标签页导航 */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        {['changes', 'history', 'github'].map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-default'}`}
            style={{ 
              borderRadius: 0, 
              borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : 'none',
              marginRight: '2px'
            }}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'changes' && '文件变更'}
            {tab === 'history' && '提交历史'}
            {tab === 'github' && 'GitHub 操作'}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div style={{ 
        flex: 1, 
        overflow: 'auto',
        padding: '10px'
      }}>
        {activeTab === 'changes' && <FileChanges currentRepo={currentRepo} refreshTrigger={Date.now()} />}
        {activeTab === 'history' && <CommitHistory currentRepo={currentRepo} />}
        {activeTab === 'github' && <GitHubPanel currentRepo={currentRepo} />}
      </div>
    </div>
    
    {/* SSH配置模态框 */}
    {showSSHConfig && (
      <SSHConfigModal 
        currentRepo={currentRepo}
        isOpen={showSSHConfig}
        onClose={() => setShowSSHConfig(false)}
        onSSHKeyGenerated={handleSSHKeyGenerated}
      />
    )}
    
    {/* 标签推送模态框 */}
    {showTagPushModal && (
      <TagPushModal
        currentRepo={currentRepo}
        isOpen={showTagPushModal}
        onClose={() => setShowTagPushModal(false)}
        onTagPushed={(tagName) => {
          notificationService.success(`标签 ${tagName} 推送成功`);
        }}
      />
    )}
  </>
  );
};

ProjectPanel.propTypes = {
  currentRepo: PropTypes.object
};

export default ProjectPanel;
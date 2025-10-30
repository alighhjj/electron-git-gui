import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import CommitHistory from './CommitHistory';
import FileChanges from './FileChanges';
import gitAPI from '../../utils/gitAPI';
import notificationService from '../../utils/notification';

const MainPanel = ({ currentRepo }) => {
  const [activeTab, setActiveTab] = useState('changes'); // 'changes', 'history', 'branches'
  const [repoInfo, setRepoInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pullPushLoading, setPullPushLoading] = useState({ pull: false, push: false });
  const [branches, setBranches] = useState([]);
  const [newBranchName, setNewBranchName] = useState('');
  const [branchLoading, setBranchLoading] = useState(false);

  // 获取仓库信息
  useEffect(() => {
    if (currentRepo) {
      fetchRepoInfo();
      if (activeTab === 'branches') {
        fetchBranches();
      }
    } else {
      setRepoInfo(null);
      setBranches([]);
    }
  }, [currentRepo, activeTab]);

  const fetchRepoInfo = async () => {
    if (!currentRepo) return;
    
    setLoading(true);
    try {
      // Get current branch
      const branchResult = await gitAPI.getBranches(currentRepo.path);
      // Get commit ahead/behind info would require comparing with remote
      // For now, we'll just get the current branch name
      if (branchResult.success) {
        const currentBranch = branchResult.data.current;
        setRepoInfo({
          branch: currentBranch,
          ahead: 0, // Would need to get from git status or other command
          behind: 0
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    if (!currentRepo) return;
    
    setBranchLoading(true);
    try {
      const result = await gitAPI.getBranches(currentRepo.path);
      if (result.success) {
        // Transform the branches data to a more usable format
        const localBranches = result.data.all.filter(branch => !branch.includes('remotes/'));
        setBranches(localBranches.map(branchName => ({
          name: branchName,
          isCurrent: branchName === result.data.current
        })));
      }
    } finally {
      setBranchLoading(false);
    }
  };

  const handlePull = async () => {
    if (!currentRepo) return;
    
    setPullPushLoading(prev => ({ ...prev, pull: true }));
    try {
      const result = await gitAPI.pull(currentRepo.path);
      if (result.success) {
        // Refresh the UI
        if (activeTab === 'changes') {
          // The FileChanges component will automatically refresh status
        }
        if (activeTab === 'branches') {
          fetchBranches(); // Refresh branch list
        }
      }
    } finally {
      setPullPushLoading(prev => ({ ...prev, pull: false }));
    }
  };

  const handlePush = async () => {
    if (!currentRepo) return;
    
    setPullPushLoading(prev => ({ ...prev, push: true }));
    try {
      const result = await gitAPI.push(currentRepo.path);
      if (result.success) {
        // Notification is handled by gitAPI
      }
    } finally {
      setPullPushLoading(prev => ({ ...prev, push: false }));
    }
  };

  const handleCreateBranch = async () => {
    if (!currentRepo || !newBranchName.trim()) return;
    
    setBranchLoading(true);
    try {
      const result = await gitAPI.createBranch(currentRepo.path, newBranchName.trim());
      if (result.success) {
        setNewBranchName(''); // Clear input
        fetchBranches(); // Refresh branch list
      }
    } finally {
      setBranchLoading(false);
    }
  };

  const handleCheckoutBranch = async (branchName) => {
    if (!currentRepo || !branchName) return;
    
    setBranchLoading(true);
    try {
      const result = await gitAPI.checkout(currentRepo.path, branchName);
      if (result.success) {
        fetchRepoInfo(); // Refresh current branch info
        fetchBranches(); // Refresh branch list
      }
    } finally {
      setBranchLoading(false);
    }
  };

  if (!currentRepo) {
    return (
      <div className="main-panel">
        <div className="loading">请选择一个仓库</div>
      </div>
    );
  }

  return (
    <div className="main-panel">
      {/* 仓库信息栏 */}
      <div style={{ 
        padding: '10px', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--secondary-color)',
        display: 'flex',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0, fontSize: '16px' }}>{currentRepo.name}</h2>
        <div style={{ marginLeft: 'auto', fontSize: '14px', display: 'flex', gap: '15px' }}>
          <button 
            className="btn btn-default" 
            onClick={handlePull} 
            disabled={pullPushLoading.pull || loading}
            title="拉取远程更新"
          >
            {pullPushLoading.pull ? '拉取中...' : '拉取'}
          </button>
          <button 
            className="btn btn-default" 
            onClick={handlePush} 
            disabled={pullPushLoading.push || loading}
            title="推送到远程"
          >
            {pullPushLoading.push ? '推送中...' : '推送'}
          </button>
          <span>分支: {repoInfo?.branch || 'main'}</span>
          {repoInfo?.ahead > 0 && (
            <span style={{ color: 'var(--accent-color)' }}>前方提交: {repoInfo.ahead}</span>
          )}
          {repoInfo?.behind > 0 && (
            <span style={{ color: 'var(--danger-color)' }}>后方提交: {repoInfo.behind}</span>
          )}
        </div>
      </div>

      {/* 标签页导航 */}
      <div style={{ 
        display: 'flex', 
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--background-color)'
      }}>
        {['changes', 'history', 'branches'].map(tab => (
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
            {tab === 'branches' && '分支管理'}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'changes' && <FileChanges currentRepo={currentRepo} />}
        {activeTab === 'history' && <CommitHistory currentRepo={currentRepo} />}
        {activeTab === 'branches' && (
          <div style={{ padding: '20px' }}>
            <h3>分支管理</h3>
            
            {/* 创建新分支 */}
            <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="新分支名称"
                className="form-input"
                style={{ flex: 1 }}
                disabled={branchLoading}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleCreateBranch} 
                disabled={!newBranchName.trim() || branchLoading}
              >
                {branchLoading ? '创建中...' : '创建分支'}
              </button>
            </div>
            
            {/* 分支列表 */}
            {branchLoading ? (
              <div>加载分支列表...</div>
            ) : (
              <div>
                <h4>本地分支 ({branches.length})</h4>
                {branches.length > 0 ? (
                  <ul style={{ listStyle: 'none', padding: 0 }}>
                    {branches.map((branch, index) => (
                      <li 
                        key={index} 
                        style={{ 
                          padding: '10px', 
                          borderBottom: '1px solid var(--border-color)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span style={{ 
                          fontWeight: branch.isCurrent ? 'bold' : 'normal',
                          color: branch.isCurrent ? 'var(--accent-color)' : 'inherit'
                        }}>
                          {branch.name} {branch.isCurrent && '(当前)'}
                        </span>
                        {!branch.isCurrent && (
                          <button 
                            className="btn btn-default"
                            onClick={() => handleCheckoutBranch(branch.name)}
                            disabled={branchLoading}
                          >
                            切换
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>暂无分支</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

MainPanel.propTypes = {
  currentRepo: PropTypes.object
};

export default MainPanel;
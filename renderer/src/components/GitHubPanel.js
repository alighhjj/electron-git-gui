import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import gitAPI from '../../utils/gitAPI';

const GitHubPanel = ({ currentRepo }) => {
  const [remoteUrl, setRemoteUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloneUrl, setCloneUrl] = useState('');
  const [clonePath, setClonePath] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [hasRemote, setHasRemote] = useState(false);
  const [currentRemoteUrl, setCurrentRemoteUrl] = useState('');
  const [isHttpsUrl, setIsHttpsUrl] = useState(true); // 用来跟踪当前URL是否为HTTPS

  const handleAddRemote = async () => {
    if (!currentRepo || !remoteUrl || !remoteUrl.trim()) {
      alert('请输入远程仓库地址');
      return;
    }

    setLoading(true);
    try {
      // 首先检查是否已存在origin远程仓库
      const remotesResult = await gitAPI.executeGitOperation('get-remotes', currentRepo.path);
      let result;
      
      if (remotesResult.success && Array.isArray(remotesResult.data)) {
        // 检查是否已存在名为origin的远程仓库
        const originExists = remotesResult.data.some(remote => 
          (typeof remote === 'object' && remote.name === 'origin') || 
          (typeof remote === 'string' && remote === 'origin')
        );
        
        if (originExists) {
          // 如果origin已存在，更新其URL
          result = await gitAPI.executeGitOperation('set-remote-url', currentRepo.path, 'origin', remoteUrl.trim());
        } else {
          // 如果origin不存在，添加新的远程仓库
          result = await gitAPI.executeGitOperation('add-remote', currentRepo.path, 'origin', remoteUrl.trim());
        }
      } else {
        // 如果获取远程仓库列表失败，尝试直接添加（可能仓库是空的）
        result = await gitAPI.executeGitOperation('add-remote', currentRepo.path, 'origin', remoteUrl.trim());
      }
      
      if (result.success) {
        alert('远程仓库设置成功');
        setRemoteUrl(''); // 清空输入框
        // 更新hasRemote状态
        setHasRemote(true);
        
        // 触发自定义事件，通知其他组件远程URL已更新
        window.dispatchEvent(new CustomEvent('remote-url-updated', { 
          detail: { 
            currentRepo: currentRepo,
            newRemoteUrl: remoteUrl.trim()
          } 
        }));
      } else {
        // 检查错误信息是否为remote already exists
        if (result.error && result.error.includes('remote origin already exists')) {
          // 尝试设置远程仓库URL
          const updateResult = await gitAPI.executeGitOperation('set-remote-url', currentRepo.path, 'origin', remoteUrl.trim());
          if (updateResult.success) {
            alert('远程仓库URL更新成功');
            setRemoteUrl(''); // 清空输入框
            // 更新hasRemote状态
            setHasRemote(true);
            
            // 触发自定义事件，通知其他组件远程URL已更新
            window.dispatchEvent(new CustomEvent('remote-url-updated', { 
              detail: { 
                currentRepo: currentRepo,
                newRemoteUrl: remoteUrl.trim()
              } 
            }));
          } else {
            alert('设置远程仓库失败: ' + updateResult.error);
          }
        } else {
          alert('设置远程仓库失败: ' + result.error);
        }
      }
    } catch (error) {
      console.error('设置远程仓库失败:', error);
      alert('设置远程仓库失败: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async () => {
    if (!cloneUrl || !clonePath) {
      alert('请输入仓库URL和本地路径');
      return;
    }

    setCloneLoading(true);
    try {
      const result = await gitAPI.executeGitOperation('clone', '', cloneUrl, clonePath);
      if (result.success) {
        alert('仓库克隆成功！');
        setCloneUrl('');
        setClonePath('');
        
        // 将新克隆的仓库添加到最近仓库列表
        const repoName = clonePath.split(/[\/\\]/).pop();
        const newRepo = {
          id: Date.now(),
          name: repoName,
          path: clonePath,
          status: 'clean'
        };

        const savedRepos = localStorage.getItem('gitRepos');
        let recentRepos = [];
        if (savedRepos) {
          try {
            recentRepos = JSON.parse(savedRepos);
          } catch (e) {
            console.error('解析最近仓库列表失败:', e);
          }
        }

        const exists = recentRepos.some(repo => repo.path === clonePath);
        if (!exists) {
          const updatedList = [newRepo, ...recentRepos.slice(0, 4)]; // 保留最近的5个项目
          localStorage.setItem('gitRepos', JSON.stringify(updatedList));
        }
        
        // 克隆的仓库通常会自动配置远程仓库，检查并更新状态
        setTimeout(() => {
          if (currentRepo?.path === clonePath) {
            checkRemoteExists();
          }
        }, 1000); // 延迟检查，确保克隆完成
      } else {
        alert('克隆仓库失败: ' + result.error);
      }
    } catch (error) {
      console.error('克隆仓库失败:', error);
      alert('克隆仓库失败: ' + error.message);
    } finally {
      setCloneLoading(false);
    }
  };

  // 转换HTTPS URL为SSH URL
  const convertToSshUrl = (httpsUrl) => {
    if (!httpsUrl || !httpsUrl.startsWith('https://')) {
      return httpsUrl ? httpsUrl.trim() : httpsUrl;
    }
    
    try {
      // 将 https://github.com/username/repo.git 转换为 git@github.com:username/repo.git
      const trimmedUrl = httpsUrl.trim();
      const match = trimmedUrl.match(/^https:\/\/github\.com\/(.+?)\.git$/);
      if (match) {
        return `git@github.com:${match[1]}.git`;
      }
      
      // 更通用的处理方式
      const url = new URL(trimmedUrl);
      const path = url.pathname.replace(/^\//, ''); // 移除开头的斜杠
      return `git@${url.host}:${path}`;
    } catch (error) {
      console.error('转换URL失败:', error);
      return httpsUrl ? httpsUrl.trim() : httpsUrl;
    }
  };

  // 转换SSH URL为HTTPS URL
  const convertToHttpsUrl = (sshUrl) => {
    if (!sshUrl || !sshUrl.startsWith('git@')) {
      return sshUrl ? sshUrl.trim() : sshUrl;
    }
    
    try {
      // 将 git@github.com:username/repo.git 转换为 https://github.com/username/repo.git
      const trimmedSshUrl = sshUrl.trim();
      const match = trimmedSshUrl.match(/^git@(.+?):(.+?)\.git$/);
      if (match) {
        const [_, host, path] = match;
        return `https://${host}/${path}.git`;
      }
      return trimmedSshUrl;
    } catch (error) {
      console.error('转换URL失败:', error);
      return sshUrl ? sshUrl.trim() : sshUrl;
    }
  };

  // 切换远程仓库URL格式
  const toggleRemoteUrlFormat = async () => {
    if (!currentRepo || !currentRemoteUrl) {
      alert('没有配置远程仓库');
      return;
    }

    try {
      const newUrl = isHttpsUrl ? convertToSshUrl(currentRemoteUrl) : convertToHttpsUrl(currentRemoteUrl);
      
      if (!newUrl || !newUrl.trim()) {
        alert('URL格式转换失败');
        return;
      }

      setLoading(true);
      
      // 更新远程仓库URL，确保URL是经过trim的
      const result = await gitAPI.executeGitOperation('remote', currentRepo.path, 'set-url', 'origin', newUrl.trim());
      
      if (result.success) {
        // 刷新远程仓库信息以确保UI显示最新的URL
        await checkRemoteExists();
        
        // 触发自定义事件，通知其他组件远程URL已更新
        window.dispatchEvent(new CustomEvent('remote-url-updated', { 
          detail: { 
            currentRepo: currentRepo,
            newRemoteUrl: newUrl.trim()
          } 
        }));
        
        alert(`远程仓库URL已更新为${isHttpsUrl ? 'SSH' : 'HTTPS'}格式`);
      } else {
        alert(`更新远程仓库URL失败: ${result.error}`);
      }
    } catch (error) {
      console.error('切换URL格式失败:', error);
      alert(`切换URL格式失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 检查是否已有远程仓库并获取当前URL
  const checkRemoteExists = async () => {
    if (!currentRepo) {
      setHasRemote(false);
      setCurrentRemoteUrl('');
      return;
    }
    
    try {
      const remotesResult = await gitAPI.executeGitOperation('get-remotes', currentRepo.path);
      if (remotesResult.success && Array.isArray(remotesResult.data) && remotesResult.data.length > 0) {
        setHasRemote(true);
        
        // 获取origin远程仓库的URL
        const originRemote = remotesResult.data.find(remote => 
          (typeof remote === 'object' && remote.name === 'origin') || 
          (typeof remote === 'string' && remote === 'origin')
        );
        
        if (originRemote && typeof originRemote === 'object') {
          const urlResult = await gitAPI.executeGitOperation('remote', currentRepo.path, 'get-url', 'origin');
          if (urlResult.success) {
            const url = urlResult.data ? urlResult.data.trim() : '';
            setCurrentRemoteUrl(url);
            setIsHttpsUrl(url.startsWith('https://'));
          }
        } else if (typeof originRemote === 'string') {
          const urlResult = await gitAPI.executeGitOperation('remote', currentRepo.path, 'get-url', 'origin');
          if (urlResult.success) {
            const url = urlResult.data ? urlResult.data.trim() : '';
            setCurrentRemoteUrl(url);
            setIsHttpsUrl(url.startsWith('https://'));
          }
        }
      } else {
        setHasRemote(false);
        setCurrentRemoteUrl('');
      }
    } catch (error) {
      console.error('检查远程仓库失败:', error);
      setHasRemote(false);
      setCurrentRemoteUrl('');
    }
  };

  useEffect(() => {
    checkRemoteExists();
  }, [currentRepo]);

  return (
    <div className="github-panel">
      <div style={{ marginBottom: '20px' }}>
        <h3>远程仓库管理</h3>
        
        {hasRemote ? (
          <div style={{ 
            padding: '15px', 
            backgroundColor: '#f8f9fa', 
            border: '1px solid #dee2e6', 
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <label style={{ flex: '0 0 120px', fontWeight: 'bold' }}>当前远程URL:</label>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <code 
                  style={{ 
                    flex: 1, 
                    padding: '5px 10px', 
                    backgroundColor: 'white', 
                    border: '1px solid #ddd', 
                    borderRadius: '3px',
                    wordBreak: 'break-all'
                  }}
                >
                  {currentRemoteUrl}
                </code>
                <button 
                  className="btn btn-secondary"
                  onClick={() => {
                    // 使用更兼容的方式复制到剪贴板
                    const textArea = document.createElement('textarea');
                    textArea.value = currentRemoteUrl;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    alert('远程URL已复制到剪贴板');
                  }}
                  title="复制远程URL"
                >
                  复制
                </button>
              </div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <div>
                <span style={{ 
                  padding: '4px 8px', 
                  borderRadius: '4px', 
                  backgroundColor: isHttpsUrl ? '#f8d7da' : '#d4edda',
                  color: isHttpsUrl ? '#721c24' : '#155724'
                }}>
                  {isHttpsUrl ? 'HTTPS (端口 443)' : 'SSH (端口 22)'}
                </span>
                {isHttpsUrl && (
                  <span style={{ marginLeft: '10px', color: '#6c757d', fontSize: '12px' }}>
                    提示: HTTPS可能被防火墙阻止，建议切换到SSH
                  </span>
                )}
              </div>
              
              <button 
                className="btn btn-default" 
                onClick={toggleRemoteUrlFormat}
                disabled={loading}
                title={`切换到${isHttpsUrl ? 'SSH' : 'HTTPS'}格式`}
              >
                {loading ? '切换中...' : `切换到${isHttpsUrl ? 'SSH' : 'HTTPS'}格式`}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
              <input
                type="text"
                value={remoteUrl}
                onChange={(e) => setRemoteUrl(e.target.value)}
                placeholder="输入远程仓库URL (如: https://github.com/username/repo.git 或 git@github.com:username/repo.git)"
                className="form-input"
                style={{ flex: 1 }}
                disabled={hasRemote}
              />
              <button 
                className="btn btn-primary" 
                onClick={handleAddRemote} 
                disabled={loading || !remoteUrl || hasRemote}
              >
                {loading ? '设置中...' : '设置远程仓库'}
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>克隆仓库</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <input
            type="text"
            value={cloneUrl}
            onChange={(e) => setCloneUrl(e.target.value)}
            placeholder="输入要克隆的仓库URL"
            className="form-input"
            disabled={cloneLoading}
          />
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="text"
              value={clonePath}
              onChange={(e) => setClonePath(e.target.value)}
              placeholder="选择本地克隆路径"
              className="form-input"
              style={{ flex: 1 }}
              disabled={cloneLoading}
            />
            <button 
              className="btn btn-default"
              onClick={async () => {
                // 打开文件选择对话框
                if (window.electronAPI) {
                  try {
                    const result = await window.electronAPI.openFileDialog();
                    if (result.success && result.path) {
                      setClonePath(result.path);
                    }
                  } catch (error) {
                    console.error('选择路径失败:', error);
                  }
                }
              }}
              disabled={cloneLoading}
            >
              选择路径
            </button>
          </div>
          
          <button 
            className="btn btn-primary" 
            onClick={handleClone} 
            disabled={cloneLoading || !cloneUrl || !clonePath}
          >
            {cloneLoading ? '克隆中...' : '克隆仓库'}
          </button>
        </div>
      </div>


    </div>
  );
};

GitHubPanel.propTypes = {
  currentRepo: PropTypes.object
};

export default GitHubPanel;
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

const SSHConfigModal = ({ currentRepo, isOpen, onClose, onSSHKeyGenerated }) => {
  const [sshStatus, setSshStatus] = useState({ exists: false, publicKey: '', loading: true });
  const [isGenerating, setIsGenerating] = useState(false);
  const [email, setEmail] = useState('');
  const [repoRemoteUrl, setRepoRemoteUrl] = useState('');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      checkSSHKey();
      if (currentRepo) {
        fetchRemoteUrl();
      }
    }
  }, [isOpen, currentRepo]);

  const checkSSHKey = async () => {
    try {
      setSshStatus({ exists: false, publicKey: '', loading: true });
      const result = await window.electronAPI.sshOperation('check-ssh-key');
      if (result.success) {
        setSshStatus({
          exists: result.exists,
          publicKey: result.publicKey || '',
          loading: false
        });
      } else {
        setSshStatus({ exists: false, publicKey: '', loading: false });
      }
    } catch (error) {
      console.error('检查SSH密钥失败:', error);
      setSshStatus({ exists: false, publicKey: '', loading: false });
    }
  };

  const handleGenerateKey = async () => {
    if (!email) {
      alert('请输入邮箱地址');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await window.electronAPI.sshOperation('generate-ssh-key', email);
      if (result.success) {
        alert(`SSH密钥生成成功！\n\n公钥:\n${result.publicKey}\n\n请将此公钥添加到您的Git托管平台账户中。`);
        setSshStatus({ exists: true, publicKey: result.publicKey, loading: false });
        if (onSSHKeyGenerated) {
          onSSHKeyGenerated(result.publicKey);
        }
      } else {
        alert('SSH密钥生成失败: ' + result.error);
      }
    } catch (error) {
      console.error('生成SSH密钥失败:', error);
      alert('生成SSH密钥失败: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板！');
    }).catch(err => {
      console.error('复制失败:', err);
      // 如果浏览器不支持，显示提示让用户手动复制
      prompt('请手动复制以下内容:', text);
    });
  };

  const fetchRemoteUrl = async () => {
    if (!currentRepo) return;
    
    try {
      const result = await window.electronAPI.gitOperation('remote', currentRepo.path, 'get-url', 'origin');
      if (result.success) {
        setRepoRemoteUrl(result.data);
      }
    } catch (error) {
      console.error('获取远程仓库URL失败:', error);
    }
  };

  // 转换HTTPS URL为SSH URL
  const convertToSshUrl = (httpsUrl) => {
    if (!httpsUrl || !httpsUrl.startsWith('https://')) {
      return httpsUrl;
    }
    
    try {
      // 将 https://github.com/username/repo.git 转换为 git@github.com:username/repo.git
      const match = httpsUrl.match(/^https:\/\/github\.com\/(.+?)\.git$/);
      if (match) {
        return `git@github.com:${match[1]}.git`;
      }
      
      // 更通用的处理方式
      const url = new URL(httpsUrl);
      const path = url.pathname.replace(/^\//, ''); // 移除开头的斜杠
      return `git@${url.host}:${path}`;
    } catch (error) {
      console.error('转换URL失败:', error);
      return httpsUrl;
    }
  };

  // 转换SSH URL为HTTPS URL
  const convertToHttpsUrl = (sshUrl) => {
    if (!sshUrl || !sshUrl.startsWith('git@')) {
      return sshUrl;
    }
    
    try {
      // 将 git@github.com:username/repo.git 转换为 https://github.com/username/repo.git
      const match = sshUrl.match(/^git@(.+?):(.+?)\.git$/);
      if (match) {
        const [_, host, path] = match;
        return `https://${host}/${path}.git`;
      }
      return sshUrl;
    } catch (error) {
      console.error('转换URL失败:', error);
      return sshUrl;
    }
  };

  const convertRemoteToSsh = async () => {
    if (!currentRepo || !repoRemoteUrl) {
      alert('没有配置远程仓库');
      return;
    }

    if (!repoRemoteUrl.startsWith('https://')) {
      alert('当前远程仓库URL已经是SSH格式或无效格式');
      return;
    }

    const sshUrl = convertToSshUrl(repoRemoteUrl);
    if (!sshUrl || sshUrl === repoRemoteUrl) {
      alert('URL格式转换失败');
      return;
    }

    setIsConverting(true);
    try {
      // 更新远程仓库URL为SSH格式
      const result = await window.electronAPI.gitOperation('remote', currentRepo.path, 'set-url', 'origin', sshUrl);
      
      if (result.success) {
        setRepoRemoteUrl(sshUrl);
        
        // 检查并尝试添加host到known_hosts
        const host = new URL(`https://${sshUrl.split('@')[1].split(':')[0]}`).hostname;
        const checkResult = await window.electronAPI.sshOperation('ssh-check-known-hosts', host);
        
        if (!checkResult.hasHostEntry) {
          if (confirm(`检测到首次连接到 ${host}，是否自动添加到known_hosts文件中以避免验证错误？`)) {
            const addResult = await window.electronAPI.sshOperation('ssh-add-known-host', host);
            if (addResult.success) {
              console.log(`成功添加 ${host} 到 known_hosts`);
            } else {
              console.error('添加known_hosts失败:', addResult.error);
            }
          }
        }
        
        alert(`远程仓库URL已成功转换为SSH格式:\n${sshUrl}\n\n如果这是首次连接到该主机，可能需要添加主机密钥到known_hosts文件。`);
      } else {
        alert(`更新远程仓库URL失败: ${result.error}`);
      }
    } catch (error) {
      console.error('转换远程仓库URL失败:', error);
      alert(`转换远程仓库URL失败: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  const addGitHubToKnownHosts = async () => {
    try {
      const result = await window.electronAPI.sshOperation('ssh-add-known-host', 'github.com');
      if (result.success) {
        alert('GitHub主机密钥已成功添加到known_hosts文件中');
      } else {
        alert(`添加GitHub主机密钥失败: ${result.error}`);
      }
    } catch (error) {
      console.error('添加GitHub主机密钥失败:', error);
      alert(`添加GitHub主机密钥失败: ${error.message}`);
    }
  };

  const addGitLabToKnownHosts = async () => {
    try {
      const result = await window.electronAPI.sshOperation('ssh-add-known-host', 'gitlab.com');
      if (result.success) {
        alert('GitLab主机密钥已成功添加到known_hosts文件中');
      } else {
        alert(`添加GitLab主机密钥失败: ${result.error}`);
      }
    } catch (error) {
      console.error('添加GitLab主机密钥失败:', error);
      alert(`添加GitLab主机密钥失败: ${error.message}`);
    }
  };

  const checkKnownHosts = async () => {
    try {
      // 检查github.com是否存在于known_hosts中
      const result = await window.electronAPI.sshOperation('ssh-check-known-hosts', 'github.com');
      if (result.hasHostEntry) {
        alert(`GitHub主机(github.com)已在known_hosts文件中`);
      } else {
        const response = confirm(`GitHub主机(github.com)不在known_hosts文件中。\n是否现在添加？`);
        if (response) {
          addGitHubToKnownHosts();
        }
      }
    } catch (error) {
      console.error('检查known_hosts失败:', error);
      alert(`检查known_hosts失败: ${error.message}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'white',
        padding: '25px',
        borderRadius: '8px',
        minWidth: '500px',
        maxWidth: '800px',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        fontSize: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>SSH密钥配置</h2>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.8em', 
              cursor: 'pointer',
              color: '#666',
              lineHeight: '1',
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="关闭"
          >
            ×
          </button>
        </div>

        {sshStatus.loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            检查SSH密钥状态...
          </div>
        ) : (
          <>
            {sshStatus.exists ? (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>SSH密钥已存在</h3>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '14px', display: 'block', marginBottom: '5px' }}>当前SSH公钥:</label>
                  <div style={{
                    border: '1px solid #ccc',
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    maxHeight: '100px',
                    overflow: 'auto',
                    marginTop: '5px'
                  }}>
                    {sshStatus.publicKey}
                  </div>
                  <button 
                    onClick={() => copyToClipboard(sshStatus.publicKey)}
                    style={{ 
                      marginTop: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    复制公钥
                  </button>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>如何使用SSH密钥</h4>
                  <ol style={{ textAlign: 'left', fontSize: '14px', paddingLeft: '20px', lineHeight: '1.5' }}>
                    <li style={{ marginBottom: '5px' }}>复制上面的公钥</li>
                    <li style={{ marginBottom: '5px' }}>登录到您的Git托管平台（如GitHub、GitLab等）</li>
                    <li style={{ marginBottom: '5px' }}>进入SSH密钥设置页面</li>
                    <li style={{ marginBottom: '5px' }}>添加新的SSH密钥，粘贴上面复制的公钥</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ fontSize: '18px', marginBottom: '10px' }}>未找到SSH密钥</h3>
                <p style={{ fontSize: '14px', lineHeight: '1.5', marginBottom: '15px' }}>
                  您需要生成SSH密钥以便使用SSH协议进行Git操作。
                </p>
                
                <div style={{ marginBottom: '15px' }}>
                  <label htmlFor="email" style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
                    邮箱地址:
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="例如: git@example.com"
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      boxSizing: 'border-box',
                      fontSize: '14px'
                    }}
                  />
                </div>
                
                <button 
                  onClick={handleGenerateKey}
                  disabled={isGenerating}
                  style={{ 
                    padding: '10px 20px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: isGenerating ? 'not-allowed' : 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {isGenerating ? '生成中...' : '生成SSH密钥'}
                </button>
              </div>
            )}
            
            <div style={{ borderTop: '1px solid #eee', paddingTop: '15px' }}>
              <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>关于SSH配置</h4>
              <div style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.5' }}>
                <p>
                  SSH（Secure Shell）是一种安全协议，用于加密网络连接。
                  在Git中使用SSH协议可以避免每次操作时输入用户名和密码。
                </p>
                <ul style={{ paddingLeft: '20px', margin: '10px 0' }}>
                  <li style={{ marginBottom: '5px' }}>SSH密钥由公钥和私钥组成</li>
                  <li style={{ marginBottom: '5px' }}>公钥需要添加到Git托管平台</li>
                  <li style={{ marginBottom: '5px' }}>私钥保存在本地，用于身份验证</li>
                  <li style={{ marginBottom: '5px' }}>使用SSH可以提高安全性并避免频繁认证</li>
                </ul>
                
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h5 style={{ fontSize: '14px', marginBottom: '8px' }}>解决主机验证问题</h5>
                  <p style={{ marginBottom: '10px', fontSize: '13px' }}>
                    如果遇到"Host key verification failed"错误，可以尝试以下方法：
                  </p>
                  <button 
                    onClick={checkKnownHosts}
                    style={{ 
                      padding: '6px 12px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      marginRight: '10px',
                      marginBottom: '5px'
                    }}
                  >
                    检查GitHub主机验证
                  </button>
                  <button 
                    onClick={addGitHubToKnownHosts}
                    style={{ 
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      marginRight: '10px',
                      marginBottom: '5px'
                    }}
                  >
                    添加GitHub到known_hosts
                  </button>
                  <button 
                    onClick={addGitLabToKnownHosts}
                    style={{ 
                      padding: '6px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      marginBottom: '5px'
                    }}
                  >
                    添加GitLab到known_hosts
                  </button>
                </div>
              </div>
            </div>

            {currentRepo && repoRemoteUrl && (
              <div style={{ borderTop: '1px solid #eee', paddingTop: '15px', marginTop: '15px' }}>
                <h4 style={{ fontSize: '16px', marginBottom: '10px' }}>仓库远程URL配置</h4>
                <div style={{ textAlign: 'left', fontSize: '14px', lineHeight: '1.5', marginBottom: '10px' }}>
                  <p><strong>当前远程URL:</strong></p>
                  <div style={{
                    border: '1px solid #ccc',
                    padding: '10px',
                    backgroundColor: '#f5f5f5',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    lineHeight: '1.4',
                    maxHeight: '60px',
                    overflow: 'auto',
                    marginTop: '5px'
                  }}>
                    {repoRemoteUrl}
                  </div>
                  <p style={{ marginTop: '10px' }}>
                    <strong>当前协议:</strong> {repoRemoteUrl.startsWith('https://') ? 'HTTPS' : repoRemoteUrl.startsWith('git@') ? 'SSH' : '未知'}
                  </p>
                </div>
                
                {repoRemoteUrl.startsWith('https://') && (
                  <button 
                    onClick={convertRemoteToSsh}
                    disabled={isConverting}
                    style={{ 
                      padding: '8px 16px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: isConverting ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isConverting ? '转换中...' : '转换为SSH格式'}
                  </button>
                )}
                
                {!repoRemoteUrl.startsWith('https://') && (
                  <p style={{ color: '#28a745', fontWeight: 'bold', fontSize: '14px' }}>
                    当前已使用SSH协议，无需转换
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

SSHConfigModal.propTypes = {
  currentRepo: PropTypes.object,
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSSHKeyGenerated: PropTypes.func
};

export default SSHConfigModal;
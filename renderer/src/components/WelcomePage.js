import React from 'react';
import PropTypes from 'prop-types';

const WelcomePage = ({ recentRepos, onOpenRepository, onRepoSelect }) => {
  const handleOpenLocalProject = async () => {
    if (window.electronAPI) {
      try {
        // 通过主进程打开文件选择对话框
        const result = await window.electronAPI.openFileDialog();
        if (result.success && result.path) {
          onOpenRepository(result.path);
        }
      } catch (error) {
        console.error('打开文件对话框失败:', error);
        alert('打开文件夹失败，请重试');
      }
    } else {
      alert('Electron API 未加载，请在 Electron 环境中运行此应用');
    }
  };

  const handleRecentRepoClick = (repo) => {
    onRepoSelect(repo);
  };

  return (
    <div className="welcome-page">
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '28px', marginBottom: '30px', color: 'var(--primary-color)' }}>
          欢迎使用 Electron Git GUI
        </h1>
        
        <p style={{ 
          fontSize: '16px', 
          marginBottom: '40px', 
          maxWidth: '600px',
          color: '#666'
        }}>
          一个简单易用的 Git 图形界面工具，帮助您管理本地和远程仓库
        </p>
        
        <button 
          className="btn btn-primary"
          style={{
            fontSize: '18px',
            padding: '15px 30px',
            marginBottom: '15px',
            minWidth: '250px'
          }}
          onClick={handleOpenLocalProject}
        >
          打开本地项目
        </button>
        
        <button 
          className="btn btn-default"
          style={{
            fontSize: '16px',
            padding: '12px 25px',
            minWidth: '250px'
          }}
          onClick={async () => {
            if (window.electronAPI) {
              try {
                // 打开文件夹选择对话框以选择新仓库的位置
                const result = await window.electronAPI.openFolderDialog();
                if (result.success && result.path) {
                  // 通知父组件以初始化仓库模式打开此路径
                  // 我们将使用onOpenRepository并将路径传递给父组件进行初始化
                  onOpenRepository(result.path);
                }
              } catch (error) {
                console.error('选择文件夹失败:', error);
                alert('选择文件夹失败，请重试');
              }
            } else {
              alert('Electron API 未加载，请在 Electron 环境中运行此应用');
            }
          }}
        >
          初始化新仓库
        </button>

        {/* 最近项目列表 */}
        {recentRepos.length > 0 && (
          <div style={{
            marginTop: '50px',
            width: '100%',
            maxWidth: '600px'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px'
            }}>
              <h2 style={{ color: 'var(--primary-color)' }}>最近的项目</h2>
              <button 
                className="btn btn-warning"
                style={{
                  padding: '4px 10px',
                  fontSize: '14px'
                }}
                onClick={() => {
                  if (window.confirm('确定要清除所有最近的项目吗？此操作无法撤销。')) {
                    // 清除本地存储中的最近项目
                    localStorage.removeItem('gitRepos');
                    // 通过更新父组件的 state 来刷新最近项目列表
                    window.dispatchEvent(new CustomEvent('recent-repos-cleared'));
                  }
                }}
              >
                清空列表
              </button>
            </div>
            <div className="recent-repos-list">
              {recentRepos.map(repo => (
                <div
                  key={repo.id}
                  className="repo-list-item"
                  style={{
                    padding: '12px 15px',
                    cursor: 'pointer',
                    borderRadius: '4px',
                    marginBottom: '8px',
                    backgroundColor: 'white',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => handleRecentRepoClick(repo)}
                >
                  <div>
                    <div className="repo-name" style={{ fontWeight: 'bold' }}>{repo.name}</div>
                    <div className="repo-path" style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {repo.path}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

WelcomePage.propTypes = {
  recentRepos: PropTypes.array.isRequired,
  onOpenRepository: PropTypes.func.isRequired,
  onRepoSelect: PropTypes.func.isRequired
};

export default WelcomePage;
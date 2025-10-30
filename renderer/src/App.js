import React, { useState, useEffect } from 'react';
import ProjectPanel from './components/ProjectPanel';
import WelcomePage from './components/WelcomePage';
import gitAPI from '../utils/gitAPI';
import { ensureNodeModulesInGitignore } from '../utils/gitignoreHelper';

const App = () => {
  const [currentRepo, setCurrentRepo] = useState(null);
  const [recentRepos, setRecentRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState('1.0.0');

  // 加载最近的仓库列表
  useEffect(() => {
    const savedRepos = localStorage.getItem('gitRepos');
    if (savedRepos) {
      try {
        const parsedRepos = JSON.parse(savedRepos);
        // 只设置最近仓库列表，不要自动尝试访问它们
        setRecentRepos(parsedRepos);
      } catch (e) {
        console.error('解析最近仓库列表失败:', e);
        setRecentRepos([]);
      }
    }
    
    // 获取应用版本信息
    const fetchAppVersion = async () => {
      try {
        if (window.electronAPI && window.electronAPI.getAppInfo) {
          const appInfo = await window.electronAPI.getAppInfo();
          setAppVersion(appInfo.version);
        } else {
          setAppVersion('1.0.0'); // 默认版本
        }
      } catch (error) {
        console.error('获取应用版本失败:', error);
        setAppVersion('1.0.0'); // 默认版本
      }
    };
    
    fetchAppVersion();
    
    setLoading(false);

    // 监听主进程发送的仓库选择事件
    if (window.electronAPI) {
      window.electronAPI.onRepositorySelected((repoPath) => {
        handleOpenRepository(repoPath);
      });
      
      // 监听初始化仓库事件
      window.electronAPI.onInitializeRepository((repoPath) => {
        handleInitializeRepository(repoPath);
      });
    }

    // 监听返回首页事件
    const handleGoToWelcome = () => {
      setCurrentRepo(null);
    };
    
    // 监听清除最近项目列表事件
    const handleRecentReposCleared = () => {
      setRecentRepos([]);
    };

    window.addEventListener('go-to-welcome', handleGoToWelcome);
    window.addEventListener('recent-repos-cleared', handleRecentReposCleared);

    // 清理事件监听器
    return () => {
      window.removeEventListener('go-to-welcome', handleGoToWelcome);
      window.removeEventListener('recent-repos-cleared', handleRecentReposCleared);
    };
  }, []);

  const handleOpenRepository = async (repoPath) => {
    // 首先确保 .gitignore 包含 node_modules/
    try {
      await ensureNodeModulesInGitignore(repoPath);
    } catch (error) {
      console.error('处理 .gitignore 文件时出错:', error);
      // 即使 .gitignore 处理失败，也继续处理仓库打开操作
    }

    // 验证是否为有效的 Git 仓库
    try {
      const isValidRepo = await gitAPI.isGitRepository(repoPath);
      if (!isValidRepo) {
        const result = window.confirm('所选目录不是Git仓库，是否要初始化为Git仓库？');
        if (result) {
          await handleInitializeRepository(repoPath);
          return;
        } else {
          alert('请选择一个有效的Git仓库目录');
          return;
        }
      }
    } catch (error) {
      console.error('验证仓库失败:', error);
      const result = window.confirm('无法验证仓库，是否尝试初始化为Git仓库？');
      if (result) {
        await handleInitializeRepository(repoPath);
        return;
      } else {
        return;
      }
    }

    // 添加到最近仓库列表
    const repoName = repoPath.split(/[\/\\]/).pop();
    const newRepo = {
      id: Date.now(),
      name: repoName,
      path: repoPath,
      status: 'clean'
    };

    // 检查是否已存在
    const exists = recentRepos.some(repo => repo.path === repoPath);
    if (!exists) {
      const updatedList = [newRepo, ...recentRepos.slice(0, 4)]; // 保留最近的5个项目
      setRecentRepos(updatedList);
      localStorage.setItem('gitRepos', JSON.stringify(updatedList));
    }

    setCurrentRepo(newRepo);
  };

  // 处理从最近项目列表中选择的仓库
  const handleRecentRepoSelect = async (repo) => {
    // 首先确保 .gitignore 包含 node_modules/
    try {
      await ensureNodeModulesInGitignore(repo.path);
    } catch (error) {
      console.error('处理 .gitignore 文件时出错:', error);
      // 即使 .gitignore 处理失败，也继续处理仓库打开操作
    }

    // 验证是否为有效的 Git 仓库
    try {
      const isValidRepo = await gitAPI.isGitRepository(repo.path);
      if (!isValidRepo) {
        alert('所选目录不再是有效的Git仓库');
        // 从最近仓库列表中移除这个项目
        const updatedList = recentRepos.filter(r => r.path !== repo.path);
        setRecentRepos(updatedList);
        localStorage.setItem('gitRepos', JSON.stringify(updatedList));
        return;
      }
    } catch (error) {
      console.error('验证仓库失败:', error);
      alert('无法验证仓库的有效性');
      // 从最近仓库列表中移除这个项目
      const updatedList = recentRepos.filter(r => r.path !== repo.path);
      setRecentRepos(updatedList);
      localStorage.setItem('gitRepos', JSON.stringify(updatedList));
      return;
    }

    setCurrentRepo(repo);
  };

  const handleInitializeRepository = async (repoPath) => {
    try {
      const result = await gitAPI.init(repoPath);
      if (result.success) {
        // 仓库初始化成功后，确保 .gitignore 包含 node_modules/
        try {
          await ensureNodeModulesInGitignore(repoPath);
        } catch (error) {
          console.error('处理 .gitignore 文件时出错:', error);
          // 即使 .gitignore 处理失败，也继续流程
        }

        // 添加新初始化的仓库到最近列表
        const repoName = repoPath.split(/[\/\\]/).pop();
        const newRepo = {
          id: Date.now(),
          name: repoName,
          path: repoPath,
          status: 'clean'
        };

        const updatedList = [newRepo, ...recentRepos.slice(0, 4)]; // 保留最近的5个项目
        setRecentRepos(updatedList);
        localStorage.setItem('gitRepos', JSON.stringify(updatedList));
        setCurrentRepo(newRepo);
        
        alert('仓库初始化成功');
      } else {
        alert('仓库初始化失败: ' + result.error);
      }
    } catch (error) {
      console.error('初始化仓库失败:', error);
      alert('初始化仓库失败: ' + error.message);
    }
  };

  return (
    <div className="app-container">
      {/* 顶部工具栏 */}
      <div className="toolbar">
        <div className="toolbar-title">Electron Git GUI</div>
      </div>

      {/* 主内容区域 */}
      <div className="main-content">
        {currentRepo ? (
          <ProjectPanel currentRepo={currentRepo} />
        ) : (
          <WelcomePage 
            recentRepos={recentRepos}
            onOpenRepository={handleOpenRepository}
            onRepoSelect={handleRecentRepoSelect}
          />
        )}
      </div>

      {/* 状态栏 */}
      <div className="status-bar">
        <span>{currentRepo ? `仓库: ${currentRepo.name}` : '请选择一个仓库'}</span>
        <span style={{ marginLeft: 'auto' }}>
          Git GUI v{appVersion}
        </span>
      </div>
    </div>
  );
};

export default App;
const { contextBridge, ipcRenderer } = require('electron');

// 将渲染进程与主进程安全地连接起来
contextBridge.exposeInMainWorld('electronAPI', {
  // Git操作相关API
  gitOperation: (operation, repoPath, ...args) => ipcRenderer.invoke('git-operation', operation, repoPath, ...args),
  
  // SSH操作相关API
  sshOperation: (operation, ...args) => ipcRenderer.invoke('ssh-operation', operation, ...args),
  
  // 文件系统操作相关API
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
  // 获取应用信息
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  
  // 监听仓库选择事件
  onRepositorySelected: (callback) => ipcRenderer.on('repository-selected', (event, repoPath) => callback(repoPath)),
  
  // 监听仓库初始化事件
  onInitializeRepository: (callback) => ipcRenderer.on('initialize-repository', (event, repoPath) => callback(repoPath)),
  
  // Handle .gitignore operations
  ensureNodeModulesInGitignore: (repoPath) => ipcRenderer.invoke('ensure-node-modules-gitignore', repoPath)
});
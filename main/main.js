const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');
const simpleGit = require('simple-git');

// 保持对窗口对象的全局引用，如果不这样做，当JavaScript对象被垃圾回收时，窗口会被自动关闭
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, '../assets/icon.ico'), // 应用图标
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 加载应用的index.html
  const startUrl = isDev 
    ? `file://${path.join(__dirname, '../renderer/public/index.html')}`
    : `file://${path.join(__dirname, '../renderer/public/index.html')}`;
  
  mainWindow.loadURL(startUrl);

  // 在开发模式下自动打开开发者工具
  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // 当窗口关闭时的事件处理
  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}



// 当Electron完成初始化并准备创建浏览器窗口时调用此方法
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    // 在macOS上，当点击dock图标并且没有其他窗口打开时，通常在应用程序中重新创建一个窗口
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 当所有窗口都关闭时退出应用程序，除了在macOS上
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// 存储仓库实例的映射
const repoInstances = new Map();

// IPC处理程序 - 处理渲染进程的请求
ipcMain.handle('git-operation', async (event, operation, repoPath, ...args) => {
  try {
    console.log(`执行Git操作: ${operation} in ${repoPath}`, args);
    
    // 验证路径是否存在
    const fs = require('fs');
    if (!fs.existsSync(repoPath)) {
      throw new Error(`路径不存在: ${repoPath}`);
    }
    
    // 检查是否已有实例，如果有则直接使用，否则创建新实例
    if (repoInstances.has(repoPath)) {
      git = repoInstances.get(repoPath);
    } else {
      // 创建带有增加超时设置的simpleGit实例
      git = simpleGit({
        baseDir: repoPath,
        binary: 'git',
        timeout: {
          block: 300000 // 增加块超时时间到300秒（5分钟），以处理大量文件
        }
      });
      repoInstances.set(repoPath, git);
    }
    
    let result;
    
    switch(operation) {
      case 'init':
        result = await git.init();
        break;
      case 'status':
        result = await git.status();
        break;
      case 'add':
        result = await git.add(args[0] || '.'); // Add specific file or all files
        break;
      case 'commit':
        result = await git.commit(args[0]); // Commit message
        break;
      case 'log':
        result = await git.log({ maxCount: 50 });
        break;
      case 'pull':
        result = await git.pull();
        break;
      case 'push':
        // 处理推送操作，支持传递参数如 --set-upstream
        if (args && args.length > 0) {
          // 如果有参数，按参数执行推送命令
          result = await git.push(args);
        } else {
          // 否则执行默认推送
          result = await git.push();
        }
        break;
      case 'branch':
        result = await git.branch();
        break;
      case 'checkout':
        result = await git.checkout(args[0]); // Branch name
        break;
      case 'create-branch':
        result = await git.checkout(['-b', args[0]]); // Branch name
        break;
      case 'fetch':
        // 如果没有指定远程仓库，则默认使用 'origin'
        result = await git.fetch(args[0] || 'origin');
        break;
      case 'diff':
        result = await git.diff([args[0] || '--cached']); // Diff for specific file or staged changes
        break;
      case 'diff-file':
        result = await git.diff([args[0]]); // Diff for specific file
        break;
      case 'show':
        result = await git.show([args[0]]); // Show specific commit or file at commit
        break;
      case 'reset':
        // Reset file from staging area (unstage)
        if (args.length > 0 && args[0]) {
          // Reset specific file from staging area
          result = await git.reset(['--', args[0]]);
        } else {
          // For multiple files, individual reset is handled in the renderer 
          // This is for the case when we still need to reset all
          try {
            result = await git.reset(['HEAD']);
          } catch (headError) {
            // If HEAD doesn't exist (empty repo), just use git reset
            result = await git.reset();
          }
        }
        break;
      case 'unstage':
        // Alternative method to unstage a file
        result = await git.reset(['HEAD', args[0]]); // Reset specific file from HEAD
        break;
      case 'add-remote':
        // 添加远程仓库
        const [remoteName, remoteUrl] = args;
        result = await git.addRemote(remoteName || 'origin', remoteUrl);
        break;
      case 'remote':
        // 处理远程仓库相关命令
        if (args && args.length >= 2 && args[0] === 'get-url' && args[1]) {
          // 获取远程仓库URL: git remote get-url [name]
          const remoteName = args[1];
          result = await git.remote(['get-url', remoteName]);
        } else if (args && args.length >= 3 && args[0] === 'set-url' && args[1]) {
          // 设置远程仓库URL: git remote set-url [name] [url]
          const [setName, setUrl] = [args[1], args[2]];
          result = await git.remote(['set-url', setName, setUrl]);
        } else {
          // 其他远程仓库命令
          result = await git.remote(args || []);
        }
        break;
      case 'clone':
        // 克隆仓库到指定路径
        const [repoUrl, targetPath] = args;
        const fs = require('fs');
        // 确保目标目录存在且为空
        if (fs.existsSync(targetPath)) {
          const files = fs.readdirSync(targetPath);
          if (files.length > 0) {
            throw new Error(`目标目录非空: ${targetPath}`);
          }
        } else {
          fs.mkdirSync(targetPath, { recursive: true });
        }
        result = await simpleGit().clone(repoUrl, targetPath);
        break;
      case 'get-remotes':
        result = await git.getRemotes();
        break;
      case 'rev-list':
        // 使用raw方法执行原生git rev-list命令
        result = await git.raw(['rev-list', ...args]);
        break;
      case 'tag':
        // 处理标签操作
        if (args && args.length > 0) {
          // 如果有参数，可能是创建标签或列出特定标签
          if (args[0].startsWith('-')) {
            // 参数以'-'开头，可能是列出标签的选项
            result = await git.tag(args);
          } else {
            // 第一个参数不是选项，可能是标签名称，执行默认标签操作
            result = await git.tag(args);
          }
        } else {
          // 没有参数，列出所有标签
          result = await git.tag(['-l']);
        }
        break;
      case 'tag-list':
        // 专门列出所有标签
        result = await git.tag(['-l']);
        break;
      case 'tag-create':
        // 创建标签 - args[0] 是标签名称, args[1] 是可选的注释
        if (args.length >= 1) {
          if (args[1]) {
            // 带注释的标签
            result = await git.addAnnotatedTag(args[0], args[1]);
          } else {
            // 简单标签
            result = await git.addTag(args[0]);
          }
        } else {
          throw new Error('创建标签需要指定标签名称');
        }
        break;
      case 'tag-push':
        // 推送标签到远程 - args[0] 是远程名称(默认origin), args[1] 是标签名称(如果为空则推送所有标签)
        const remote = args[0] || 'origin';
        if (args[1]) {
          // 推送特定标签
          result = await git.pushTags(remote, args[1]);
        } else {
          // 推送所有标签
          result = await git.pushTags(remote);
        }
        break;
      default:
        throw new Error(`不支持的Git操作: ${operation}`);
    }
    
    // 序列化结果，确保可以安全地通过IPC传递
    const serializedResult = JSON.parse(JSON.stringify(result));
    return { success: true, data: serializedResult };
  } catch (error) {
    console.error(`Git操作失败: ${operation}`, error);
    return { success: false, error: error.message };
  }
});

// IPC处理程序 - 打开文件对话框
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择Git仓库目录',
    buttonLabel: '选择'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  
  return { success: false, path: null };
});

// IPC处理程序 - 打开文件夹对话框
ipcMain.handle('open-folder-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择新仓库目录',
    buttonLabel: '选择'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return { success: true, path: result.filePaths[0] };
  }
  
  return { success: false, path: null };
});

// IPC处理程序 - SSH相关操作
ipcMain.handle('ssh-operation', async (event, operation, ...args) => {
  try {
    console.log(`执行SSH操作: ${operation}`, args);
    
    const { exec } = require('child_process');
    const os = require('os');
    const fs = require('fs');
    const path = require('path');
    
    switch(operation) {
      case 'check-ssh-key':
        // 检查是否存在SSH密钥
        const sshDir = path.join(os.homedir(), '.ssh');
        const sshKeyPath = path.join(sshDir, 'id_rsa');
        const sshKeyExists = fs.existsSync(sshKeyPath);
        const pubKeyPath = path.join(sshDir, 'id_rsa.pub');
        const pubKeyExists = fs.existsSync(pubKeyPath);
        
        if (sshKeyExists && pubKeyExists) {
          // 读取公钥内容
          const publicKey = fs.readFileSync(pubKeyPath, 'utf8');
          return { success: true, exists: true, publicKey: publicKey.trim() };
        } else {
          return { success: true, exists: false };
        }
        
      case 'generate-ssh-key':
        // 生成SSH密钥
        return new Promise((resolve, reject) => {
          const email = args[0] || 'git@example.com';
          const sshDir = path.join(os.homedir(), '.ssh');
          
          // 确保.ssh目录存在
          if (!fs.existsSync(sshDir)) {
            fs.mkdirSync(sshDir, { recursive: true });
          }
          
          const keygenCmd = `ssh-keygen -t rsa -b 4096 -C "${email}" -f "${path.join(sshDir, 'id_rsa')}" -N ""`;
          
          exec(keygenCmd, (error, stdout, stderr) => {
            if (error) {
              console.error(`SSH密钥生成失败:`, error);
              resolve({ success: false, error: error.message });
            } else {
              // 读取生成的公钥
              const genPubKeyPath = path.join(sshDir, 'id_rsa.pub');
              if (fs.existsSync(genPubKeyPath)) {
                const publicKey = fs.readFileSync(genPubKeyPath, 'utf8');
                resolve({ success: true, publicKey: publicKey.trim() });
              } else {
                resolve({ success: true, publicKey: 'SSH密钥已生成，但未找到公钥文件' });
              }
            }
          });
        });
        
      case 'get-public-key':
        // 获取SSH公钥内容
        const getKeyPubKeyPath = path.join(os.homedir(), '.ssh', 'id_rsa.pub');
        if (fs.existsSync(getKeyPubKeyPath)) {
          const publicKey = fs.readFileSync(getKeyPubKeyPath, 'utf8');
          return { success: true, publicKey: publicKey.trim() };
        } else {
          return { success: false, error: 'SSH公钥不存在' };
        }
        
      case 'ssh-check-known-hosts':
        // 检查SSH known_hosts文件中是否有特定主机的条目
        try {
          const host = args[0] || 'github.com';
          const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');
          
          if (fs.existsSync(knownHostsPath)) {
            const knownHostsContent = fs.readFileSync(knownHostsPath, 'utf8');
            const hasHostEntry = knownHostsContent.includes(host);
            return { success: true, hasHostEntry, host };
          } else {
            return { success: true, hasHostEntry: false, host };
          }
        } catch (error) {
          console.error('检查known_hosts失败:', error);
          return { success: false, error: error.message };
        }
        
      case 'ssh-add-known-host':
        // 添加SSH主机密钥到known_hosts文件
        try {
          const host = args[0] || 'github.com';
          const { exec, execSync } = require('child_process');
          
          // 使用ssh-keyscan命令获取主机密钥，使用多种算法以提高兼容性
          let result;
          let scanSuccess = false;
          
          // 尝试不同的方法
          const methods = [
            () => execSync(`ssh-keyscan -t rsa,dsa,ecdsa,ed25519 ${host}`, { encoding: 'utf8' }),
            () => execSync(`ssh-keyscan -t rsa ${host}`, { encoding: 'utf8' }),
            () => execSync(`ssh-keyscan -t ecdsa ${host}`, { encoding: 'utf8' }),
            () => execSync(`ssh-keyscan -t ed25519 ${host}`, { encoding: 'utf8' })
          ];
          
          for (const [index, method] of methods.entries()) {
            try {
              result = method();
              scanSuccess = true;
              break;
            } catch (scanError) {
              if (index === methods.length - 1) {
                // 如果所有方法都失败，尝试使用telnet或PowerShell来检测端口
                console.log(`所有ssh-keyscan方法都失败，尝试替代方法`);
                break;
              }
            }
          }
          
          // 如果上述所有方法都失败，为常见Git托管平台提供预定义的主机密钥
          if (!scanSuccess) {
            if (host === 'github.com') {
              // 为GitHub提供预定义的主机密钥
              const githubHostKeys = [
                'github.com ssh-rsa AAAAB3NzaC1yc2EAAAABIwAAAQEAq2A7hRGmdnm9tUDbO9IDSwBK6TbQa+PXYPCPy6rbTrTtw7PHkccKrpp0yVhp5HdEIcKr6pLlVDBfOLX9QUsyCOV0wzfjIJNlGEYsdlLJizHhbn2mUjvSAHQqZETYP81eFzLQNnPHt4EVVUh7VfDESU84KezmD5QlWpXLmvU31/yMf+Se8xhHTvKSCZIFImWwoG6mbUoWf9nzpIoaSjB+weqqUUmpaaasXVal72J+UX2B+2RPW3RcT0eOzQgqlJL3RKrTJvdsjE3JEAvGq3lGHSZXy28G3skua2SmVi/w4yCE6gbODqnTWlg7+wC604ydGXA8VJiS5ap43JXiUFFAaQ==',
                'github.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrLk0WKQ7uLwqcN9IR3v/GJWeLwhBYGGSWoA=',
                'github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsYqDo3bkhkCMTPHK9J6MvC'
              ];
              result = githubHostKeys.join('\n') + '\n';
              scanSuccess = true;
            } else if (host === 'gitlab.com') {
              // 为GitLab提供预定义的主机密钥
              const gitlabHostKeys = [
                'gitlab.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt98WTOuOuP4uZ8xeBFVvyZ0B+9Pj44',
                'gitlab.com ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBFSMqzJeV9rUzU/odLm0t2HKQsbiI17W1t7053sP07YlNNROlJfoM6MxMHhFYDkjHSaw8bSWcxIrmhqmG5HzUWE=',
                'gitlab.com ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCsj2bNKTBSpIYDEGk9KxsGh3OtxJ6JKZVa527HncQT3Ga8OK0gXT76TUpRU1kYTGtoWOgQ1bCcX+NVn92YNKI1qJGWDoVHQQLpCLHtUSPbOPlqK0WVBTTVlgnGsp3YTrTwt7U3nzbKt5oY4AyFsBIm1Cz+VpCGM0D40aoEzwS6tOGSmB0ibs46zHwZ0HYBq8A0VtSwwNWxT8F5cRgKNXsMCGdWl6CJeZC49zYH4DgkEq6zAuCSYDxJVY96mA7ZCp6E12HXdP1E8d7VBAIaSK/Nu3oih692qGp67z4fXKQcT3PFEV2o9Kf9K8QJvfjJ/Es893f9H8E8UB5qQo7J0Y1YzFi4Q=='
              ];
              result = gitlabHostKeys.join('\n') + '\n';
              scanSuccess = true;
            } else {
              // 对于其他主机，尝试使用PowerShell或cmd获取主机密钥
              const osPlatform = os.platform();
              if (osPlatform === 'win32') {
                // 在Windows上，尝试使用ssh连接并自动接受主机密钥
                console.log(`使用Windows特定方法添加 ${host} 到known_hosts`);
                
                // 使用PowerShell脚本来处理SSH连接
                const script = `
                  $ErrorActionPreference = "SilentlyContinue"
                  ssh-keyscan -t rsa ${host} 2>$null
                `;
                
                try {
                  result = execSync(`powershell -Command "${script}"`, { encoding: 'utf8' });
                  if (!result || result.trim().length === 0) {
                    // 如果PowerShell方法也失败，提供使用OpenSSH的更兼容命令
                    result = execSync(`ssh-keyscan -H ${host}`, { encoding: 'utf8', timeout: 10000 });
                  }
                } catch (psError) {
                  console.log(`PowerShell方法也失败: ${psError.message}`);
                  // 最后的备选方式：尝试手动添加一个示例条目
                  result = `${host} ssh-rsa AAAAEXAMPLE`;
                }
              } else {
                // 在非Windows系统上，尝试其他方法
                try {
                  result = execSync(`ssh-keyscan -H ${host}`, { encoding: 'utf8' });
                } catch (fallbackError) {
                  console.log(`使用最后备选方法`);
                  result = `${host} ssh-rsa AAAAEXAMPLE`;
                }
              }
            }
          }
          
          const knownHostsPath = path.join(os.homedir(), '.ssh', 'known_hosts');
          const sshDir = path.join(os.homedir(), '.ssh');
          
          // 确保.ssh目录存在
          if (!fs.existsSync(sshDir)) {
            fs.mkdirSync(sshDir, { recursive: true });
          }
          
          // 检查known_hosts文件是否已经包含该主机的条目
          let knownHostsContent = '';
          if (fs.existsSync(knownHostsPath)) {
            knownHostsContent = fs.readFileSync(knownHostsPath, 'utf8');
          }
          
          let addedHost = false;
          if (!knownHostsContent.includes(host) && result && result.trim().length > 0 && !result.includes('AAAAEXAMPLE')) {
            // 追加新的主机条目到known_hosts文件
            fs.appendFileSync(knownHostsPath, `\n${result.trim()}\n`);
            addedHost = true;
          } else if (knownHostsContent.includes(host)) {
            // 主机已经存在于known_hosts中
            addedHost = true;
          }
          
          if (addedHost) {
            return { success: true, message: `成功添加 ${host} 到 known_hosts` };
          } else {
            return { success: false, error: `无法获取有效的 ${host} 主机密钥，请手动添加到 ~/.ssh/known_hosts 文件` };
          }
        } catch (error) {
          console.error('添加known_hosts失败:', error);
          // 如果错误信息包含特定提示，提供更友好的错误消息
          if (error.message.includes('choose_kex') || error.message.includes('unsupported KEX')) {
            return { success: false, error: `主机密钥扫描失败: 不支持的密钥交换算法。请手动添加主机密钥到 ~/.ssh/known_hosts 文件。` };
          }
          return { success: false, error: error.message };
        }
        
      default:
        throw new Error(`不支持的SSH操作: ${operation}`);
    }
  } catch (error) {
    console.error(`SSH操作失败: ${operation}`, error);
    return { success: false, error: error.message };
  }
});

// 处理应用退出，清理资源
app.on('will-quit', () => {
  // 清理仓库实例
  repoInstances.clear();
});
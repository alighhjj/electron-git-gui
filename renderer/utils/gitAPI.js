/**
 * Git API服务 - 与主进程通信以执行Git操作
 */
import notificationService from './notification';

class GitAPI {
  /**
   * 通用Git操作执行方法
   * @param {string} operation - Git操作类型
   * @param {string} repoPath - 仓库路径
   * @param {...any} args - 操作参数
   * @returns {Promise} 操作结果
   */
  async executeGitOperation(operation, repoPath, ...args) {
    // 在控制台打印Git操作信息
    console.log(`执行Git操作: ${operation} in ${repoPath}`, args.length > 0 ? args : '');
    try {
      const result = await window.electronAPI.gitOperation(operation, repoPath, ...args);
      
      // 对于 'log' 操作，如果错误是"没有提交"，我们也视为成功但返回空结果
      if (!result.success && operation === 'log' && result.error && 
          result.error.includes("does not have any commits yet")) {
        console.log(`Git操作成功 (特殊处理): ${operation} in ${repoPath}`);
        return { success: true, data: { all: [], total: 0 } };
      }
      
      if (!result.success) {
        // 仅在非静默模式下显示错误通知
        const errorMsg = result.error || `Git操作失败: ${operation}`;
        notificationService.error(`Git操作失败 (${operation}): ${errorMsg}`);
        console.error(`Git操作失败: ${operation} in ${repoPath}`, errorMsg);
        return result;
      }
      
      console.log(`Git操作成功: ${operation} in ${repoPath}`);
      return result;
    } catch (error) {
      const errorMsg = `执行Git操作 (${operation}) 时发生错误: ${error.message}`;
      notificationService.error(errorMsg);
      console.error(errorMsg, error);
      
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查目录是否为 Git 仓库
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 检查结果
   */
  async isGitRepository(repoPath) {
    try {
      const result = await this.getStatus(repoPath);
      return result.success;
    } catch (error) {
      console.error('检查Git仓库失败:', error);
      return false;
    }
  }

  /**
   * 初始化仓库
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 操作结果
   */
  async init(repoPath) {
    console.log(`执行Git操作: init in ${repoPath}`);
    const result = await this.executeGitOperation('init', repoPath);
    if (result.success) {
      notificationService.success('仓库初始化成功');
      console.log(`Git操作成功: init in ${repoPath}`);
    } else {
      console.error(`Git操作失败: init in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 获取仓库状态
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 仓库状态信息
   */
  async getStatus(repoPath) {
    console.log(`执行Git操作: status in ${repoPath}`);
    const result = this.executeGitOperation('status', repoPath);
    result.then(res => {
      if (res.success) {
        console.log(`Git操作成功: status in ${repoPath}`);
      } else {
        console.error(`Git操作失败: status in ${repoPath}`, res.error);
      }
    });
    return result;
  }

  /**
   * 添加文件到暂存区
   * @param {string} repoPath - 仓库路径
   * @param {string} files - 要添加的文件路径，可以是单个文件或'.'表示所有文件
   * @returns {Promise} 操作结果
   */
  async add(repoPath, files = '.') {
    console.log(`执行Git操作: add in ${repoPath} with files: ${files}`);
    const result = await this.executeGitOperation('add', repoPath, files);
    if (result.success) {
      notificationService.success('文件添加到暂存区成功');
      console.log(`Git操作成功: add in ${repoPath}`);
    } else {
      console.error(`Git操作失败: add in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 提交变更
   * @param {string} repoPath - 仓库路径
   * @param {string} message - 提交信息
   * @returns {Promise} 操作结果
   */
  async commit(repoPath, message) {
    console.log(`执行Git操作: commit in ${repoPath} with message: ${message}`);
    const result = await this.executeGitOperation('commit', repoPath, message);
    if (result.success) {
      notificationService.success('提交成功');
      console.log(`Git操作成功: commit in ${repoPath}`);
    } else {
      console.error(`Git操作失败: commit in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 获取提交历史
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 提交历史
   */
  async getLog(repoPath) {
    console.log(`执行Git操作: log in ${repoPath}`);
    // 首先检查仓库状态，确定是否已经有提交
    const statusResult = await this.getStatus(repoPath);
    if (!statusResult.success) {
      console.error(`Git操作失败: log in ${repoPath} (获取状态失败)`);
      return statusResult;  // 如果状态获取失败，直接返回错误
    }
    
    // 检查是否有提交
    try {
      // 使用 silent 选项以避免显示错误通知
      const result = await this.executeGitOperation('log', repoPath);
      if (result.success) {
        console.log(`Git操作成功: log in ${repoPath}`);
      } else {
        console.error(`Git操作失败: log in ${repoPath}`, result.error);
      }
      return result;
    } catch (error) {
      console.error(`Git操作失败: log in ${repoPath}`, error.message);
      // 如果是"没有提交"的错误，返回空列表而不是错误
      if (error.message && error.message.includes("does not have any commits yet")) {
        console.log(`Git操作成功 (特殊处理): log in ${repoPath} (no commits)`);
        return { success: true, data: { all: [] } };
      }
      throw error; // 其他错误继续抛出
    }
  }

  /**
   * 拉取远程更新
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 操作结果
   */
  async pull(repoPath) {
    console.log(`执行Git操作: pull in ${repoPath}`);
    const result = await this.executeGitOperation('pull', repoPath);
    if (result.success) {
      notificationService.success('拉取成功');
      console.log(`Git操作成功: pull in ${repoPath}`);
    } else {
      console.error(`Git操作失败: pull in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 推送到远程仓库
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 操作结果
   */
  async push(repoPath) {
    console.log(`执行Git操作: push in ${repoPath}`);
    let result = await this.executeGitOperation('push', repoPath);
    
    // 如果推送失败是因为没有上游分支，尝试设置上游分支
    if (!result.success && result.error && 
        (result.error.includes('no upstream branch') || 
         result.error.includes('set-upstream') ||
         result.error.includes('setUpstream') ||
         (result.error.includes('current branch') && result.error.includes('has no upstream')))) {
      console.log(`检测到没有上游分支，尝试设置上游分支...`);
      
      try {
        // 获取当前分支名称
        const branchResult = await this.getCurrentBranch(repoPath);
        if (branchResult) {
          const branchName = branchResult;
          // 使用 --set-upstream 参数推送
          result = await this.executeGitOperation('push', repoPath, '--set-upstream', 'origin', branchName);
        } else {
          console.error('无法获取当前分支名称');
          result = { success: false, error: '无法确定当前分支' };
        }
      } catch (error) {
        console.error(`设置上游分支失败:`, error);
        result = { success: false, error: error.message };
      }
    }
    
    // 只有在最终结果是成功时才显示成功通知
    if (result.success) {
      console.log(`Git操作成功: push in ${repoPath}`);
    } else {
      console.error(`Git操作失败: push in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 获取分支列表
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 分支列表
   */
  async getBranches(repoPath) {
    console.log(`执行Git操作: branch in ${repoPath}`);
    const result = this.executeGitOperation('branch', repoPath);
    result.then(res => {
      if (res.success) {
        console.log(`Git操作成功: branch in ${repoPath}`);
      } else {
        console.error(`Git操作失败: branch in ${repoPath}`, res.error);
      }
    });
    return result;
  }

  /**
   * 切换分支
   * @param {string} repoPath - 仓库路径
   * @param {string} branchName - 分支名称
   * @returns {Promise} 操作结果
   */
  async checkout(repoPath, branchName) {
    console.log(`执行Git操作: checkout in ${repoPath} to branch: ${branchName}`);
    const result = await this.executeGitOperation('checkout', repoPath, branchName);
    if (result.success) {
      notificationService.success(`已切换到分支: ${branchName}`);
      console.log(`Git操作成功: checkout in ${repoPath} to branch: ${branchName}`);
    } else {
      console.error(`Git操作失败: checkout in ${repoPath} to branch: ${branchName}`, result.error);
    }
    return result;
  }

  /**
   * 创建新分支
   * @param {string} repoPath - 仓库路径
   * @param {string} branchName - 新分支名称
   * @returns {Promise} 操作结果
   */
  async createBranch(repoPath, branchName) {
    console.log(`执行Git操作: create-branch in ${repoPath} with name: ${branchName}`);
    const result = await this.executeGitOperation('create-branch', repoPath, branchName);
    if (result.success) {
      notificationService.success(`分支创建成功: ${branchName}`);
      console.log(`Git操作成功: create-branch in ${repoPath} with name: ${branchName}`);
    } else {
      console.error(`Git操作失败: create-branch in ${repoPath} with name: ${branchName}`, result.error);
    }
    return result;
  }

  /**
   * 获取远程更新
   * @param {string} repoPath - 仓库路径
   * @param {string} remoteName - 远程仓库名称，默认为'origin'
   * @returns {Promise} 操作结果
   */
  async fetch(repoPath, remoteName = 'origin') {
    console.log(`执行Git操作: fetch in ${repoPath}${remoteName ? ` from ${remoteName}` : ''}`);
    const result = await this.executeGitOperation('fetch', repoPath, remoteName);
    if (result.success) {
      notificationService.success('获取远程更新成功');
      console.log(`Git操作成功: fetch in ${repoPath}`);
    } else {
      console.error(`Git操作失败: fetch in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 获取差异信息
   * @param {string} repoPath - 仓库路径
   * @param {string} file - 文件路径
   * @returns {Promise} 差异信息
   */
  async getDiff(repoPath, file) {
    console.log(`执行Git操作: diff-file in ${repoPath} for file: ${file}`);
    const result = this.executeGitOperation('diff-file', repoPath, file);
    result.then(res => {
      if (res.success) {
        console.log(`Git操作成功: diff-file in ${repoPath} for file: ${file}`);
      } else {
        console.error(`Git操作失败: diff-file in ${repoPath} for file: ${file}`, res.error);
      }
    });
    return result;
  }

  /**
   * 取消暂存文件
   * @param {string} repoPath - 仓库路径
   * @param {string} file - 文件路径，如果为空则取消暂存所有文件
   * @returns {Promise} 操作结果
   */
  async unstage(repoPath, file = null) {
    if (file) {
      console.log(`执行Git操作: reset specific file in ${repoPath} for: ${file}`);
      const result = await this.executeGitOperation('reset', repoPath, file);
      if (result.success) {
        console.log(`Git操作成功: reset specific file in ${repoPath} for: ${file}`);
      } else {
        console.error(`Git操作失败: reset specific file in ${repoPath} for: ${file}`, result.error);
      }
      return result;
    } else {
      console.log(`执行Git操作: reset all in ${repoPath}`);
      const result = await this.executeGitOperation('reset', repoPath); // 此时应该不传参数，因为我们修改了main.js为默认使用HEAD
      if (result.success) {
        console.log(`Git操作成功: reset all in ${repoPath}`);
      } else {
        console.error(`Git操作失败: reset all in ${repoPath}`, result.error);
      }
      return result;
    }
  }

  /**
   * 显示特定提交或文件内容
   * @param {string} repoPath - 仓库路径
   * @param {string} identifier - 提交哈希或文件路径
   * @returns {Promise} 提交或文件内容
   */
  async show(repoPath, identifier) {
    console.log(`执行Git操作: show in ${repoPath} for: ${identifier}`);
    const result = this.executeGitOperation('show', repoPath, identifier);
    result.then(res => {
      if (res.success) {
        console.log(`Git操作成功: show in ${repoPath} for: ${identifier}`);
      } else {
        console.error(`Git操作失败: show in ${repoPath} for: ${identifier}`, res.error);
      }
    });
    return result;
  }

  /**
   * 获取当前分支名称
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 当前分支名称
   */
  async getCurrentBranch(repoPath) {
    console.log(`执行Git操作: getCurrentBranch in ${repoPath}`);
    try {
      const result = await this.getBranches(repoPath);
      if (result.success) {
        const branchName = result.data.current || 'main';
        console.log(`Git操作成功: getCurrentBranch in ${repoPath}, current: ${branchName}`);
        return branchName;
      }
      console.error(`Git操作失败: getCurrentBranch in ${repoPath}, using default: main`);
      return 'main'; // 默认分支名
    } catch (error) {
      console.error('获取当前分支失败:', error);
      return 'main';
    }
  }

  /**
   * 获取标签列表
   * @param {string} repoPath - 仓库路径
   * @returns {Promise} 标签列表
   */
  async getTags(repoPath) {
    console.log(`执行Git操作: get tags in ${repoPath}`);
    const result = await this.executeGitOperation('tag-list', repoPath);
    if (result.success) {
      console.log(`获取标签成功: get tags in ${repoPath}`);
      // 将返回的标签字符串按行分割并过滤空行
      if (typeof result.data === 'string') {
        const tags = result.data.split('\n').filter(tag => tag.trim() !== '');
        result.data = tags;
      }
    } else {
      console.error(`Git操作失败: get tags in ${repoPath}`, result.error);
    }
    return result;
  }

  /**
   * 创建标签
   * @param {string} repoPath - 仓库路径
   * @param {string} tagName - 标签名称
   * @param {string} message - 标签注释（可选）
   * @returns {Promise} 操作结果
   */
  async createTag(repoPath, tagName, message = null) {
    console.log(`执行Git操作: create tag ${tagName} in ${repoPath}`);
    let result;
    if (message) {
      result = await this.executeGitOperation('tag-create', repoPath, tagName, message);
    } else {
      result = await this.executeGitOperation('tag-create', repoPath, tagName);
    }
    if (result.success) {
      notificationService.success(`标签创建成功: ${tagName}`);
      console.log(`Git操作成功: create tag in ${repoPath} with name: ${tagName}`);
    } else {
      console.error(`Git操作失败: create tag in ${repoPath} with name: ${tagName}`, result.error);
    }
    return result;
  }

  /**
   * 推送标签到远程仓库
   * @param {string} repoPath - 仓库路径
   * @param {string} remoteName - 远程仓库名称，默认为'origin'
   * @param {string} tagName - 标签名称，如果为空则推送所有标签
   * @returns {Promise} 操作结果
   */
  async pushTags(repoPath, remoteName = 'origin', tagName = null) {
    console.log(`执行Git操作: push tags in ${repoPath}, remote: ${remoteName}, tag: ${tagName || 'all'}`);
    const result = await this.executeGitOperation('tag-push', repoPath, remoteName, tagName);
    if (result.success) {
      if (tagName) {
        notificationService.success(`标签推送成功: ${tagName}`);
      } else {
        notificationService.success('所有标签推送成功');
      }
      console.log(`Git操作成功: push tags in ${repoPath}`);
    } else {
      console.error(`Git操作失败: push tags in ${repoPath}`, result.error);
    }
    return result;
  }
}

// 创建单例实例
const gitAPI = new GitAPI();

export default gitAPI;
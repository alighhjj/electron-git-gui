/**
 * 通知服务 - 提供用户通知功能
 */

class NotificationService {
  constructor() {
    this.container = null;
    this.createNotificationContainer();
  }

  // 创建通知容器
  createNotificationContainer() {
    if (!document.querySelector('#notification-container')) {
      const container = document.createElement('div');
      container.id = 'notification-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        max-width: 400px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      `;
      document.body.appendChild(container);
      this.container = container;
    } else {
      this.container = document.querySelector('#notification-container');
    }
  }

  // 显示通知
  show(message, type = 'info', duration = 5000) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
      background: ${type === 'error' ? '#fee' : type === 'success' ? '#efe' : '#eef'};
      border: 1px solid ${type === 'error' ? '#fcc' : type === 'success' ? '#cfc' : '#ccf'};
      border-radius: 4px;
      padding: 12px 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
      animation: slideIn 0.3s ease-out;
    `;

    const messageEl = document.createElement('span');
    messageEl.textContent = message;
    messageEl.style.flex = '1';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 0;
      margin-left: 10px;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.onclick = () => this.remove(notification);

    notification.appendChild(messageEl);
    notification.appendChild(closeBtn);

    this.container.appendChild(notification);

    // 自动移除通知
    if (duration > 0) {
      setTimeout(() => {
        this.remove(notification);
      }, duration);
    }

    return notification;
  }

  // 显示成功通知
  success(message, duration = 5000) {
    return this.show(message, 'success', duration);
  }

  // 显示错误通知
  error(message, duration = 7000) {
    return this.show(message, 'error', duration);
  }

  // 显示信息通知
  info(message, duration = 5000) {
    return this.show(message, 'info', duration);
  }

  // 移除通知
  remove(notification) {
    if (notification && notification.parentNode) {
      notification.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  // 清除所有通知
  clearAll() {
    while (this.container.firstChild) {
      this.container.removeChild(this.container.firstChild);
    }
  }
}

// 创建单例实例
const notificationService = new NotificationService();

// 添加CSS动画
if (!document.querySelector('#notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

export default notificationService;
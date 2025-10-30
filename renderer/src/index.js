import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css'; // 导入CSS样式

// 获取根元素并渲染应用
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
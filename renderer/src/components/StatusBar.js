import React from 'react';
import PropTypes from 'prop-types';

const StatusBar = ({ currentRepo }) => {
  const [statusMessage, setStatusMessage] = React.useState('就绪');

  // 模拟状态更新
  React.useEffect(() => {
    if (currentRepo) {
      setStatusMessage(`仓库: ${currentRepo.name}`);
    } else {
      setStatusMessage('请选择一个仓库');
    }
  }, [currentRepo]);

  return (
    <div className="status-bar">
      <span>{statusMessage}</span>
      <span style={{ marginLeft: 'auto' }}>
        Git GUI v1.0.0
      </span>
    </div>
  );
};

StatusBar.propTypes = {
  currentRepo: PropTypes.object
};

export default StatusBar;
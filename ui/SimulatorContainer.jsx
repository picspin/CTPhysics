import React from 'react';
import { Card } from 'antd';

const SimulatorContainer = ({ title, children, className = '' }) => {
  return (
    <div className={`mt-6 ${className}`}>
      <Card title={title} bordered className="simulator-container" styles={{ body: { padding: 16 } }}>
        {children}
      </Card>
    </div>
  );
};

export default SimulatorContainer;
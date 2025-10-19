import React from 'react';
import { ClipLoader, BeatLoader, PulseLoader, RotateLoader } from 'react-spinners';
import './LoadingSpinner.css';

export function LoadingSpinner({ 
  type = 'clip', 
  size = 40, 
  color = '#007bff', 
  loading = true,
  text = 'Loading...',
  className = ''
}) {
  const spinnerProps = {
    color,
    loading,
    size,
    className: `loading-spinner ${className}`
  };

  const renderSpinner = () => {
    switch (type) {
      case 'beat':
        return <BeatLoader {...spinnerProps} />;
      case 'pulse':
        return <PulseLoader {...spinnerProps} />;
      case 'rotate':
        return <RotateLoader {...spinnerProps} />;
      default:
        return <ClipLoader {...spinnerProps} />;
    }
  };

  return (
    <div className="loading-container">
      {renderSpinner()}
      {text && <p className="loading-text">{text}</p>}
    </div>
  );
}

export function ButtonSpinner({ loading, children, ...props }) {
  return (
    <button {...props} disabled={loading}>
      {loading ? (
        <div className="button-spinner">
          <ClipLoader size={16} color="#fff" />
        </div>
      ) : (
        children
      )}
    </button>
  );
}

export function InlineSpinner({ size = 16, color = '#007bff' }) {
  return (
    <div className="inline-spinner">
      <ClipLoader size={size} color={color} />
    </div>
  );
}

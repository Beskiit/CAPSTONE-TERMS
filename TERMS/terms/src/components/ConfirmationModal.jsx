import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ConfirmationModal.css';

export function ConfirmationModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Confirm Action",
  message = "Are you sure you want to continue?",
  confirmText = "Yes, Continue",
  cancelText = "Cancel",
  type = "warning" // warning, danger, info, success
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return '⚠️';
      case 'success':
        return '✅';
      case 'info':
        return 'ℹ️';
      default:
        return '⚠️';
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="modal-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className={`modal-content modal-${type}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon">
                {getIcon()}
              </div>
              <h3 className="modal-title">{title}</h3>
            </div>
          </div>
          
          <div className="modal-body">
            <p className="modal-message">{message}</p>
          </div>
          
          <div className="modal-footer">
            <button
              className="btn btn-cancel"
              onClick={onClose}
            >
              {cancelText}
            </button>
            <button
              className={`btn btn-confirm btn-${type}`}
              onClick={handleConfirm}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ImageUploadConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileCount = 0,
  fileSize = 0 
}) {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Upload Images"
      message={`You are about to upload ${fileCount} image(s) (${formatFileSize(fileSize)}). Do you want to continue?`}
      confirmText="Upload Images"
      cancelText="Cancel"
      type="info"
    />
  );
}

export function SubmissionConfirmation({ 
  isOpen, 
  onClose, 
  onConfirm, 
  submissionType = "report"
}) {
  return (
    <ConfirmationModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="Submit Report"
      message={`Are you sure you want to submit this ${submissionType}? Once submitted, you won't be able to make changes.`}
      confirmText="Submit Report"
      cancelText="Cancel"
      type="warning"
    />
  );
}

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './ConfirmationModal.css';
import './CoordinatorDeadlineActionModal.css';

export function CoordinatorDeadlineActionModal({ 
  isOpen, 
  onClose, 
  onSetAsReport, 
  onAccessDirectly,
  deadlineTitle = "Untitled Report"
}) {
  if (!isOpen) return null;

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
          className="modal-content coordinator-action-modal"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div className="modal-header-content">
              <div className="modal-icon">
                📋
              </div>
              <h3 className="modal-title">Report Action</h3>
            </div>
          </div>
          
          <div className="modal-body">
            <p className="modal-message">
              <strong>{deadlineTitle}</strong>
            </p>
            <p className="modal-description">
              Choose how you want to proceed with this report assignment.
            </p>
          </div>
          
          <div className="modal-footer coordinator-action-buttons">
            <button
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary btn-set-report"
              onClick={() => {
                onSetAsReport();
                onClose();
              }}
            >
              Set as Report to Teachers
            </button>
            <button
              className="btn btn-primary btn-access-direct"
              onClick={() => {
                onAccessDirectly();
                onClose();
              }}
            >
              Access Directly
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}


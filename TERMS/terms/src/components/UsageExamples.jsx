import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { SkeletonCard, SkeletonTable, SkeletonForm, SkeletonImageGrid, SkeletonReportCard } from './SkeletonLoader';
import { LoadingSpinner, ButtonSpinner, InlineSpinner } from './LoadingSpinner';
import { ConfirmationModal, ImageUploadConfirmation, SubmissionConfirmation } from './ConfirmationModal';
import './UsageExamples.css';

// Example: How to use skeleton loading in your existing components
export function ExampleSkeletonUsage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Simulate data loading
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setData({ title: "Sample Data", description: "This is loaded data" });
      setLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="skeleton-example">
        <h2>Loading Reports...</h2>
        <SkeletonReportCard />
        <SkeletonReportCard />
        <SkeletonReportCard />
      </div>
    );
  }

  return (
    <div className="example-section">
      <h2>Reports Loaded</h2>
      <p>{data.description}</p>
    </div>
  );
}

// Example: How to use toast notifications
export function ExampleToastUsage() {
  const handleSuccess = () => {
    toast.success('Report submitted successfully!');
  };

  const handleError = () => {
    toast.error('Failed to submit report. Please try again.');
  };

  const handleLoading = () => {
    const loadingToast = toast.loading('Submitting report...');
    
    // Simulate API call
    setTimeout(() => {
      toast.dismiss(loadingToast);
      toast.success('Report submitted successfully!');
    }, 2000);
  };

  return (
    <div className="example-section">
      <div className="toast-button-group">
        <button className="example-button" onClick={handleSuccess}>Show Success Toast</button>
        <button className="example-button" onClick={handleError}>Show Error Toast</button>
        <button className="example-button" onClick={handleLoading}>Show Loading Toast</button>
      </div>
    </div>
  );
}

// Example: How to use confirmation modals
export function ExampleConfirmationUsage() {
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const handleConfirm = () => {
    toast.success('Action confirmed!');
  };

  const handleImageUpload = () => {
    toast.success('Images uploaded successfully!');
  };

  const handleSubmit = () => {
    toast.success('Report submitted successfully!');
  };

  return (
    <div className="example-section">
      <div className="modal-button-group">
        <button className="example-button" onClick={() => setShowModal(true)}>Show Confirmation</button>
        <button className="example-button" onClick={() => setShowImageModal(true)}>Upload Images</button>
        <button className="example-button" onClick={() => setShowSubmitModal(true)}>Submit Report</button>
      </div>

      <ConfirmationModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onConfirm={handleConfirm}
        title="Delete Report"
        message="Are you sure you want to delete this report? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />

      <ImageUploadConfirmation
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onConfirm={handleImageUpload}
        fileCount={3}
        fileSize={2048000} // 2MB
      />

      <SubmissionConfirmation
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        submissionType="accomplishment report"
      />
    </div>
  );
}

// Example: How to use loading spinners
export function ExampleLoadingUsage() {
  const [loading, setLoading] = useState(false);
  const [buttonLoading, setButtonLoading] = useState(false);

  const handleAsyncAction = async () => {
    setButtonLoading(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setButtonLoading(false);
    toast.success('Action completed!');
  };

  if (loading) {
    return <LoadingSpinner text="Loading page content..." />;
  }

  return (
    <div className="loading-example">
      <h2>Loading Examples</h2>
      
      <div className="button-spinner-container">
        <ButtonSpinner 
          loading={buttonLoading}
          onClick={handleAsyncAction}
          className="form-button"
        >
          {buttonLoading ? 'Processing...' : 'Click Me'}
        </ButtonSpinner>
      </div>

      <div className="inline-spinner-container">
        <p>Inline loading: <InlineSpinner /> Processing...</p>
      </div>
    </div>
  );
}

// Example: How to integrate with your existing AccomplishmentReport component
export function ExampleAccomplishmentReportIntegration() {
  const [saving, setSaving] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  const handleSubmit = async () => {
    setSaving(true);
    
    try {
      // Your existing submission logic here
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      
      toast.success('Report submitted successfully!');
      setShowSubmitModal(false);
    } catch (error) {
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="integration-example">
      <h2>Accomplishment Report</h2>
      
      <div className="integration-form">
        <p>Your existing form content here</p>
      </div>
      
      <button 
        onClick={() => setShowSubmitModal(true)}
        disabled={saving}
        className={`form-button ${saving ? 'loading-disabled' : ''}`}
      >
        {saving ? 'Submitting...' : 'Submit Report'}
      </button>

      <SubmissionConfirmation
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        onConfirm={handleSubmit}
        submissionType="accomplishment report"
      />
    </div>
  );
}

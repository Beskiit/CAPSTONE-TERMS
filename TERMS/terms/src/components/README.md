# UI Components Documentation

This document explains how to use the skeleton loading, toast notifications, and confirmation modals in your project.

## 🚀 Quick Start

### 1. Toast Notifications

```jsx
import toast from 'react-hot-toast';

// Success notification
toast.success('Report submitted successfully!');

// Error notification
toast.error('Failed to submit report. Please try again.');

// Loading notification
const loadingToast = toast.loading('Submitting report...');
// Later: toast.dismiss(loadingToast);
```

### 2. Skeleton Loading

```jsx
import { SkeletonCard, SkeletonTable, SkeletonForm } from './components/SkeletonLoader';

// Show skeleton while loading
{loading ? <SkeletonCard /> : <ActualContent />}
```

### 3. Confirmation Modals

```jsx
import { ConfirmationModal, ImageUploadConfirmation, SubmissionConfirmation } from './components/ConfirmationModal';

<ConfirmationModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  onConfirm={handleConfirm}
  title="Delete Report"
  message="Are you sure you want to delete this report?"
  type="danger"
/>
```

## 📦 Components Overview

### ToastProvider
- **Purpose**: Global toast notification system
- **Location**: Already added to App.jsx
- **Usage**: Import `toast` from 'react-hot-toast' and use anywhere

### SkeletonLoader Components
- **SkeletonCard**: For card-based content
- **SkeletonTable**: For table data
- **SkeletonForm**: For form layouts
- **SkeletonImageGrid**: For image galleries
- **SkeletonReportCard**: For report cards

### LoadingSpinner Components
- **LoadingSpinner**: Full-page or section loading
- **ButtonSpinner**: Loading state for buttons
- **InlineSpinner**: Small inline loading indicator

### ConfirmationModal Components
- **ConfirmationModal**: Generic confirmation dialog
- **ImageUploadConfirmation**: For image uploads
- **SubmissionConfirmation**: For report submissions

## 🎨 Customization

### Skeleton Colors
```jsx
<SkeletonTheme baseColor="#f3f3f3" highlightColor="#ecebeb">
  <SkeletonCard />
</SkeletonTheme>
```

### Toast Styling
Toast styles are configured in `ToastProvider.jsx`. Modify the `toastOptions` to customize appearance.

### Modal Types
- `warning`: Yellow/orange theme
- `danger`: Red theme
- `info`: Blue theme
- `success`: Green theme

## 🔧 Integration Examples

### In Your Existing AccomplishmentReport Component

```jsx
import toast from 'react-hot-toast';
import { SkeletonReportCard } from '../components/SkeletonLoader';
import { SubmissionConfirmation } from '../components/ConfirmationModal';

function AccomplishmentReport() {
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Show skeleton while loading
  if (loading) {
    return <SkeletonReportCard />;
  }

  const handleSubmit = async () => {
    const loadingToast = toast.loading('Submitting report...');
    
    try {
      // Your existing submission logic
      await submitReport();
      toast.dismiss(loadingToast);
      toast.success('Report submitted successfully!');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Failed to submit report. Please try again.');
    }
  };

  return (
    <div>
      {/* Your existing form content */}
      
      <button onClick={() => setShowSubmitModal(true)}>
        Submit Report
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
```

### In Your Existing Form Components

```jsx
import { ButtonSpinner } from '../components/LoadingSpinner';
import { ImageUploadConfirmation } from '../components/ConfirmationModal';

function MyForm() {
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  return (
    <form>
      {/* Your form fields */}
      
      <ButtonSpinner 
        loading={uploading}
        onClick={handleSubmit}
        type="submit"
      >
        {uploading ? 'Uploading...' : 'Upload Images'}
      </ButtonSpinner>

      <ImageUploadConfirmation
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onConfirm={handleImageUpload}
        fileCount={selectedFiles.length}
        fileSize={totalFileSize}
      />
    </form>
  );
}
```

## 🎯 Best Practices

### 1. Skeleton Loading
- Use skeleton loading for initial page loads
- Match skeleton structure to actual content
- Show skeleton for at least 200ms to avoid flicker

### 2. Toast Notifications
- Use success toasts for completed actions
- Use error toasts for failures
- Use loading toasts for long operations
- Keep messages concise and actionable

### 3. Confirmation Modals
- Use for destructive actions (delete, submit)
- Use for expensive operations (upload, process)
- Provide clear, specific messages
- Use appropriate modal types (danger, warning, info)

### 4. Loading States
- Show loading state immediately when action starts
- Disable buttons during loading
- Provide clear loading messages
- Use appropriate spinner types for context

## 🚨 Common Patterns

### Form Submission with Loading
```jsx
const [submitting, setSubmitting] = useState(false);

const handleSubmit = async (e) => {
  e.preventDefault();
  setSubmitting(true);
  
  try {
    await submitForm();
    toast.success('Form submitted successfully!');
  } catch (error) {
    toast.error('Submission failed. Please try again.');
  } finally {
    setSubmitting(false);
  }
};

return (
  <form onSubmit={handleSubmit}>
    <ButtonSpinner loading={submitting} type="submit">
      {submitting ? 'Submitting...' : 'Submit'}
    </ButtonSpinner>
  </form>
);
```

### Data Loading with Skeleton
```jsx
const [loading, setLoading] = useState(true);
const [data, setData] = useState(null);

useEffect(() => {
  loadData().then(result => {
    setData(result);
    setLoading(false);
  });
}, []);

if (loading) {
  return <SkeletonTable rows={5} />;
}

return <DataTable data={data} />;
```

### Image Upload with Confirmation
```jsx
const [showUploadModal, setShowUploadModal] = useState(false);
const [selectedFiles, setSelectedFiles] = useState([]);

const handleFileSelect = (files) => {
  setSelectedFiles(files);
  setShowUploadModal(true);
};

const handleUpload = async () => {
  const loadingToast = toast.loading('Uploading images...');
  
  try {
    await uploadFiles(selectedFiles);
    toast.dismiss(loadingToast);
    toast.success('Images uploaded successfully!');
  } catch (error) {
    toast.dismiss(loadingToast);
    toast.error('Upload failed. Please try again.');
  }
};
```

## 🎨 Styling

All components come with default styling that matches your project's design. You can customize them by:

1. Modifying the CSS files in the components directory
2. Using CSS classes to override styles
3. Passing custom className props to components

## 📱 Responsive Design

All components are responsive and work well on mobile devices. The modals will adapt to smaller screens, and skeleton loading will maintain proper proportions across different screen sizes.

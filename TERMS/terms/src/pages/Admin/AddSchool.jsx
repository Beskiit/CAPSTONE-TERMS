import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import './AddSchool.css';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AddSchool({ isOpen, onRequestClose, onSchoolAdded }) {
  // Provide a default function if onRequestClose is not provided
  const handleRequestClose = onRequestClose || (() => {
    console.log("onRequestClose not provided, using default");
    // Try to close the modal by hiding it
    const modal = document.querySelector('.add-school-modal');
    const overlay = document.querySelector('.add-school-overlay');
    if (modal && overlay) {
      modal.style.display = 'none';
      overlay.style.display = 'none';
    }
  });
  const [schoolName, setSchoolName] = useState('');
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchSchools();
    }
  }, [isOpen]);

  const fetchSchools = async () => {
    setLoadingSchools(true);
    try {
      const response = await fetch(`${API_BASE}/admin/schools`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchools(data);
    } catch (err) {
      console.error("Error fetching schools:", err);
      setError("Failed to load schools.");
    } finally {
      setLoadingSchools(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!schoolName.trim()) {
      setError('Please enter a school name');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/admin/schools`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ school_name: schoolName.trim() })
      });

      if (response.ok) {
        const newSchool = await response.json();
        setSchools(prevSchools => [...prevSchools, newSchool]); // Update local state
        onSchoolAdded && onSchoolAdded(newSchool);
        setSchoolName('');
        setError(''); // Clear any previous errors
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add school');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSchoolName('');
    setError('');
    handleRequestClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleRequestClose}
      className="add-school-modal"
      overlayClassName="add-school-overlay"
      contentLabel="Add School Modal"
    >
      <div className="modal-header">
        <h2>School Management</h2>
        <button 
          className="close-button" 
          onClick={handleClose}
          aria-label="Close"
        >
          ×
        </button>
      </div>
      
      {/* Add School Form */}
      <div className="add-school-section">
        <h3>Add New School</h3>
        <form onSubmit={handleSubmit} className="add-school-form">
          <div className="form-group">
            <label htmlFor="schoolName">School Name:</label>
            <input
              type="text"
              id="schoolName"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
              placeholder="Enter school name"
              disabled={loading}
              required
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button 
              type="button" 
              onClick={handleClose}
              className="btn btn-cancel"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add School'}
            </button>
          </div>
        </form>
      </div>

      <hr />

      {/* Existing Schools List */}
      <div className="schools-list-section">
        <h3>Existing Schools ({schools.length})</h3>
        {loadingSchools ? (
          <div className="loading">Loading schools...</div>
        ) : schools.length === 0 ? (
          <div className="no-schools">No schools found.</div>
        ) : (
          <div className="schools-table">
            <table className="schools-list-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>School Name</th>
                  <th>School Number</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, index) => (
                  <tr key={school.school_id} className="read-only-row">
                    <td>{index + 1}</td>
                    <td className="school-name-cell">{school.school_name}</td>
                    <td>{school.school_number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default AddSchool;
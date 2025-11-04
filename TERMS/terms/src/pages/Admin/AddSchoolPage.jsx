import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/shared/SidebarAdmin';
import Header from '../../components/shared/Header';
import Breadcrumb from '../../components/Breadcrumb';
import AddSchool from './AddSchool';
import Modal from 'react-modal';
import './AddSchool.css';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AddSchoolPage() {
  const navigate = useNavigate();
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [showAddSchool, setShowAddSchool] = useState(false);

  useEffect(() => {
      const fetchUser = async () => {
        try {
          const res = await fetch(`${API_BASE}/auth/me`, {
            credentials: "include",
          });
          if (!res.ok) return;
          const data = await res.json();
          setUser(data);
        } catch (err) {
          console.error("Failed to fetch user:", err);
        }
      };
      fetchUser();
    }, []);

  useEffect(() => {
    // ensure the element id matches your index.html (#root is default in Vite)
    Modal.setAppElement("#root");
  }, []);

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/schools`, { credentials: "include" });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchools(data);
    } catch (err) {
      console.error("Error fetching schools:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolAdded = (newSchool) => {
    console.log("New school added:", newSchool);
    setSchools(prevSchools => [...prevSchools, newSchool]);
  };

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Add School" />
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <h2>School Management</h2>
          </div>

          <div className="add-user-container">
            <button className="add-user-btn" type="button" onClick={() => setShowAddSchool(true)}>
              <span className="add-user-text">Add School</span>
            </button>
          </div>

        {/* Add School Modal */}
        <AddSchool
          isOpen={showAddSchool}
          onRequestClose={() => {
            console.log("AddSchoolPage onRequestClose called, showAddSchool:", showAddSchool);
            setShowAddSchool(false);
          }}
          onSchoolAdded={handleSchoolAdded}
        />

          <div className="content">
            {loading ? (
              <div>Loading...</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>School Name</th>
                    <th>School Number</th>
                  </tr>
                </thead>
                <tbody>
                  {schools.map((school, index) => (
                    <tr key={school.school_id}>
                      <td>{index + 1}</td>
                      <td className="file-cell">
                        <span className="file-name">{school.school_name}</span>
                      </td>
                      <td>
                        <span className="school-number">{school.school_number}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default AddSchoolPage;

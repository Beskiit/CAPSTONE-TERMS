import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Breadcrumb from '../../components/Breadcrumb.jsx';
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ClassificationOfGradesReport.css';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ClassificationOfGradesReport() {
    const [openPopup, setOpenPopup] = useState(false);

    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";

    
    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include", // important so session cookie is sent
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
        <div className="dashboard-container">
            {isTeacher ? (
                    <Sidebar activeLink="Classification of Grades" />
                ) : (
                    <SidebarCoordinator activeLink="Classification of Grades" />
                )}
            <div className="dashboard-content">
                <Breadcrumb />
                <div className="dashboard-main">
                    <h2>Classification Of Grades</h2>
                </div>
                <div className="content">
                    <div className="buttons">
                        <button>Generate Template</button>
                        <button onClick={() => setOpenPopup(true)}>Import File</button>
                        {openPopup && (
                            <div className="modal-overlay">
                                <div className="import-popup">
                                    <div className="popup-header">
                                        <h2>Import File</h2>
                                        <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                                    </div>
                                    <hr />
                                    <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                                        <label htmlFor="fileInput" className="file-upload-label">
                                            Click here to upload a file
                                        </label>
                                        <input id="fileInput" type="file" style={{ display: 'none' }} />
                                        <button type="submit">Upload</button>
                                    </form>
                                </div>
                            </div>
                        )}
                        <button>Export</button>
                        <button>Submit</button>
                    </div>
                </div>
            </div>
        </div>
        </>
    )
}

export default ClassificationOfGradesReport;
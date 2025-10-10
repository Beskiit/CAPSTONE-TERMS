import React from "react";
import { BrowserRouter, Routes, Route, useNavigate, Link } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import './ClassificationOfGrades.css';
import { useEffect, useState } from 'react';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ClassificationOfGrades() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);

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
            <Sidebar activeLink="Classification of Grades"/>
            <div className="dashboard-content">
                <div className="dashboard-main">
                    <h2>Classification Of Grades</h2>
                </div>
                <div className="content">
                    <table className="report-table">
                        <thead>
                            <tr>
                                <th className="first-th">Reports</th>
                                <th>Type</th>
                                <th>Start Date</th>
                                <th>Due Date</th>
                                <th>Submitted</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr onClick={() => navigate('/ClassificationOfGradesInstruction')}>
                                <td className="first-td">Classified Grades</td>
                                <td>Teacher</td>
                                <td>2023-10-01</td>
                                <td>2023-10-15</td>
                                <td>Yes</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        </>
    )
}

export default ClassificationOfGrades;
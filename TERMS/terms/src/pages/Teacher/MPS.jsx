import React, {useEffect, useState} from "react";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import SidebarCoordinator from '../../components/shared/SidebarCoordinator.jsx';
import './Accomplishment.css';

function LAEMPL() {

    const navigate = useNavigate();

    const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";

    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("https://terms-api.kiri8tives.com/auth/me", {
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
                    <Sidebar activeLink="MPS" />
                ) : (
                    <SidebarCoordinator activeLink="MPS" />
                )}
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>MPS</h2>
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
                                <tr onClick={() => navigate('/MPSInstruction')}>
                                    <td className="first-td">MPS</td>
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

export default LAEMPL;
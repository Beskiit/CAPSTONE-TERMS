import React from "react";
import Sidebar from "../../components/shared/SidebarTeacher";
import "./SubmittedReport.css";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function SubmittedReport() {
    const navigate = useNavigate();

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
    return(
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
                        <h2>Submitted Report</h2>
                    </div>
                    <div className="content">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Report Title</th>
                                    <th>School Year</th>
                                    <th>Quarter</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr onClick={() => navigate("/")}>
                                    <td className="file-cell">
                                    <span className="file-name">MPS</span>
                                    </td>
                                    <td>2023–2024</td>
                                    <td>1st Quarter</td>
                                </tr>
                            </tbody>

                        </table>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default SubmittedReport;
import React from "react";
import Sidebar from "../../components/shared/SidebarPrincipal";
import "./ForApproval.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ForApproval() {
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
    return(
        <>
            <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                <Sidebar activeLink="For Approval" />
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>Submitted Report</h2>
                    </div>
                    <div className="content">
                        <table className="report-table">
                            <thead>
                                <tr>
                                    <th>Report Title</th>
                                    <th>Submitted By</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr onClick={() => navigate("/ForApprovalData")}>
                                    <td className="file-cell">
                                    <span className="file-name">Accomplishment Report</span>
                                    </td>
                                    <td>Tristan Labjata</td>
                                    <td>May 06, 2026</td>
                                </tr>
                            </tbody>

                        </table>
                    </div>
                </div>
            </div> 
        </>
    )
}

export default ForApproval;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Breadcrumb from "../../components/Breadcrumb.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./Accomplishment.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function LAEMPL() {
  const navigate = useNavigate();

  // ✅ define user state BEFORE you use it
  const [user, setUser] = useState(null);

  // fallback role from LS until server responds
  const roleLS = (localStorage.getItem("role") || "").toLowerCase();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (res.status === 401) {
          navigate("/"); // not logged in
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, [navigate]);

  // prefer role from server, fallback to LS
  const role = (user?.role || roleLS).toLowerCase();
  const isTeacher = role === "teacher";

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="MPS" />
        ) : (
          <SidebarCoordinator activeLink="LAEMPL" />
        )}
        <div className="dashboard-content">
          <Breadcrumb />
          <div className="dashboard-main">
            <h2>LAEMPL</h2>
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
                <tr onClick={() => navigate("/LAEMPLInstruction")}>
                  <td className="first-td">LAEMPL</td>
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
  );
}

export default LAEMPL;

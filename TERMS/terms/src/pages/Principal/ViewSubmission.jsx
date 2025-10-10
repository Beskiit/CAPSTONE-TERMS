import React, {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import Header from "../../components/shared/Header.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function ViewSubmission() {
    const navigate = useNavigate();

  // ✅ define user state BEFORE you use it
  const [user, setUser] = useState(null);

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

  const role = (user?.role || "").toLowerCase();
  const isPrincipal = role === "principal";

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isPrincipal ? (
          <Sidebar activeLink="View Report" />
        ) : (
          <SidebarCoordinator activeLink="View Report" />
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
                          <tr onClick={() => navigate("/SubmissionData")}>
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
  );
}

export default ViewSubmission;
import React, {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../components/shared/SidebarPrincipal.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import Header from "../../components/shared/Header.jsx";

function ViewSubmission() {
    const navigate = useNavigate();

  // ✅ define user state BEFORE you use it
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5000/auth/me", {
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
            <h2>View Submission</h2>
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

export default ViewSubmission;
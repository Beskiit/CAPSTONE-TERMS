import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarCoordinator.jsx";
import "./UpcomingDeadline.css";

const API_BASE = (import.meta.env.VITE_API_BASE || "http://localhost:5000").replace(/\/$/, "");

function UpcomingDeadline() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upcomingSubmissions, setUpcomingSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Load logged-in user
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (res.ok) {
          const userData = await res.json();
          setUser(userData);
        }
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Fetch upcoming deadline submissions
  useEffect(() => {
    const fetchUpcomingSubmissions = async () => {
      if (!user?.user_id) return;
      
      try {
        setLoadingSubmissions(true);
        
        const res = await fetch(`${API_BASE}/reports/upcoming-deadline/${user.user_id}`, {
          credentials: "include"
        });
        
        if (!res.ok) {
          console.error("Failed to fetch upcoming submissions:", res.status);
          setUpcomingSubmissions([]);
          return;
        }
        
        const data = await res.json();
        console.log('🔍 [DEBUG] Upcoming submissions:', data);
        setUpcomingSubmissions(data);
      } catch (err) {
        console.error("Error fetching upcoming submissions:", err);
        setUpcomingSubmissions([]);
      } finally {
        setLoadingSubmissions(false);
      }
    };

    if (user?.user_id) {
      fetchUpcomingSubmissions();
    }
  }, [user?.user_id]);

  const handleSubmissionClick = (submission) => {
    // Redirect to SetReport with pre-filled data
    navigate(`/SetReport?reportId=${submission.report_assignment_id}&isPrincipalReport=true&submissionId=${submission.submission_id}`);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Upcoming Deadline" />
        
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Upcoming Deadlines</h2>
            <p className="page-description">
              Reports assigned by principals that need to be scheduled for teachers.
            </p>

            {loadingSubmissions ? (
              <p>Loading upcoming submissions...</p>
            ) : upcomingSubmissions.length === 0 ? (
              <p>No upcoming deadlines found.</p>
            ) : (
              <div className="upcoming-table-container">
                <table className="upcoming-table">
                  <thead>
                    <tr>
                      <th>Assignment Title</th>
                      <th>Category</th>
                      <th>Teacher</th>
                      <th>Assigned By</th>
                      <th>School Year</th>
                      <th>Quarter</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingSubmissions.map((submission) => (
                      <tr key={submission.submission_id}>
                        <td className="assignment-title">
                          {submission.assignment_title || 'N/A'}
                        </td>
                        <td className="category">
                          {submission.category_name || 'N/A'}
                        </td>
                        <td className="teacher">
                          {submission.submitted_by_name || 'N/A'}
                        </td>
                        <td className="assigned-by">
                          {submission.given_by_name || 'N/A'}
                        </td>
                        <td className="school-year">
                          {submission.school_year || 'N/A'}
                        </td>
                        <td className="quarter">
                          {submission.quarter_name || 'N/A'}
                        </td>
                        <td className="actions">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleSubmissionClick(submission)}
                            title="Set schedule for this teacher"
                          >
                            Set Schedule
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default UpcomingDeadline;

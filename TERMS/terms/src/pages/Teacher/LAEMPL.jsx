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
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deadlines, setDeadlines] = useState([]);
  const [loadingDeadlines, setLoadingDeadlines] = useState(false);

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
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  // prefer role from server, fallback to LS
  const role = (user?.role || roleLS).toLowerCase();
  const isTeacher = role === "teacher";
  const isCoordinator = role === "coordinator";
  const isPrincipal = role === "principal";

  // Fetch data depending on role
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.user_id) return;
      try {
        setLoadingDeadlines(true);
        let url = '';
        if (isTeacher || isCoordinator) {
          url = `${API_BASE}/reports/status/user/${user.user_id}/upcoming`;
        } else {
          // Principal: show LAEMPL & MPS assignments created by them
          url = `${API_BASE}/reports/status/principal/${user.user_id}/assignments/accomplishment`;
        }
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) {
          setDeadlines([]);
          return;
        }
        let data = await res.json();
        // Filter for LAEMPL & MPS reports (category_id = 1, sub_category_id = 3)
        const filtered = (data || []).filter(d => 
          (d?.category_id === 1 && d?.sub_category_id === 3) ||
          (d?.category_name?.toLowerCase().includes('laempl') || d?.category_name?.toLowerCase().includes('mps')) ||
          (d?.sub_category_name?.toLowerCase().includes('laempl') || d?.sub_category_name?.toLowerCase().includes('mps'))
        );
        
        // For coordinators, also fetch their own assignments (LAEMPL & MPS only)
        if (isCoordinator) {
          try {
            // Fetch all reports given to coordinator
            const ownAssignmentsRes = await fetch(`${API_BASE}/reports/given_to/${user.user_id}`, {
              credentials: "include"
            });
            
            if (ownAssignmentsRes.ok) {
              const allOwnReports = await ownAssignmentsRes.json();
              
              // Filter for LAEMPL & MPS reports only (category_id = 1, sub_category_id = 3)
              const laemplMpsOwnReports = allOwnReports.filter(report => 
                (report?.category_id === 1 && report?.sub_category_id === 3) ||
                (report?.category_name?.toLowerCase().includes('laempl') || report?.category_name?.toLowerCase().includes('mps')) ||
                (report?.sub_category_name?.toLowerCase().includes('laempl') || report?.sub_category_name?.toLowerCase().includes('mps'))
              );
              
              // For each report, fetch assignment details to check if it's coordinator's own assignment
              const assignmentChecks = await Promise.all(
                laemplMpsOwnReports.map(async (report) => {
                  try {
                    const assignmentRes = await fetch(`${API_BASE}/reports/assignment/${report.report_assignment_id}`, {
                      credentials: "include"
                    });
                    if (assignmentRes.ok) {
                      const assignmentData = await assignmentRes.json();
                      return {
                        report,
                        assignment: assignmentData
                      };
                    }
                  } catch (err) {
                    console.warn(`Failed to fetch assignment ${report.report_assignment_id}:`, err);
                  }
                  return null;
                })
              );
              
              // Filter to only include coordinator's own assignments:
              // 1. The coordinator created it (given_by = coordinator_id)
              // 2. It's the coordinator's own assignment (parent_report_assignment_id IS NULL)
              // 3. Category is LAEMPL & MPS (category_id = 1, sub_category_id = 3)
              const coordinatorOwnAssignments = assignmentChecks
                .filter(item => item && item.assignment)
                .filter(item => {
                  const assignment = item.assignment;
                  const isCoordinatorCreated = Number(assignment.given_by) === Number(user.user_id);
                  const isOwnAssignment = !assignment.parent_report_assignment_id;
                  const isLAEMPLMPS = Number(assignment.category_id) === 1 && Number(assignment.sub_category_id) === 3;
                  return isCoordinatorCreated && isOwnAssignment && isLAEMPLMPS;
                })
                .map(item => {
                  // Format the report to match the structure expected by the component
                  const report = item.report;
                  const assignment = item.assignment;
                  return {
                    submission_id: report.submission_id,
                    report_assignment_id: report.report_assignment_id,
                    title: assignment.title || report.assignment_title,
                    category_name: assignment.category_name || report.category_name || 'LAEMPL & MPS',
                    sub_category_name: assignment.sub_category_name || report.sub_category_name,
                    given_by_name: assignment.given_by_name || report.given_by_name,
                    from_date: assignment.from_date || report.from_date,
                    to_date: assignment.to_date || report.to_date,
                    instruction: assignment.instruction || report.instruction,
                    recipients_count: 1, // Coordinator's own assignment has only coordinator as assignee
                    status: report.status,
                    category_id: assignment.category_id || report.category_id,
                    sub_category_id: assignment.sub_category_id || report.sub_category_id
                  };
                });
              
              // Combine with regular deadlines, avoiding duplicates
              const seenIds = new Set(filtered.map(d => d.submission_id || d.report_assignment_id));
              const uniqueOwnAssignments = coordinatorOwnAssignments.filter(d => {
                const key = d.submission_id || d.report_assignment_id;
                return key && !seenIds.has(key);
              });
              
              // Combine both lists
              setDeadlines([...filtered, ...uniqueOwnAssignments]);
            }
          } catch (err) {
            console.warn('Failed to fetch coordinator own assignments:', err);
            setDeadlines(filtered);
          }
        } else {
          setDeadlines(filtered);
        }
      } catch (e) {
        console.error('Failed to load data:', e);
        setDeadlines([]);
      } finally {
        setLoadingDeadlines(false);
      }
    };

    fetchData();
  }, [user?.user_id, isTeacher, isCoordinator]);

  const onRowClick = (d) => {
    // Navigate to LAEMPL instruction page
    navigate('/LAEMPLInstruction', {
      state: {
        id: d?.submission_id,
        submission_id: d?.submission_id,
        report_assignment_id: d?.report_assignment_id,
        title: d?.title,
        instruction: d?.instruction,
        from_date: d?.from_date,
        to_date: d?.to_date,
        number_of_submission: d?.number_of_submission,
        allow_late: d?.allow_late,
        recipients_count: d?.recipients_count,
        fromReports: true
      }
    });
  };

  if (loading) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-main">
          <h2>LAEMPL</h2>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

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
                  <th className="first-th">Report Title</th>
                  <th>Report Category</th>
                  <th>Created By</th>
                  <th>Start Date</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {loadingDeadlines && (
                  <tr>
                    <td className="first-td" colSpan="5">Loading…</td>
                  </tr>
                )}
                {!loadingDeadlines && deadlines.length === 0 && (
                  <tr>
                    <td className="first-td" colSpan="5">No LAEMPL & MPS deadlines.</td>
                  </tr>
                )}
                {!loadingDeadlines && deadlines
                  .filter(d => {
                    // For principals, only show assignments with 2+ recipients (consolidation eligible)
                    if (isPrincipal) return Number(d?.recipients_count || 0) >= 2;
                    return true;
                  })
                  .map((d) => (
                    <tr key={`${d.submission_id}-${d.report_assignment_id}`} onClick={() => onRowClick(d)}>
                      <td className="first-td">{d?.title || d?.assignment_title || 'Untitled'}</td>
                      <td>{d?.category_name || ''} {d?.sub_category_name ? `(${d.sub_category_name})` : ''}</td>
                      <td>{d?.given_by_name || ''}</td>
                      <td>{d?.from_date || ''}</td>
                      <td>{d?.to_date || ''}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default LAEMPL;

import React, {useEffect, useState} from "react";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Breadcrumb from '../../components/Breadcrumb.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import SidebarCoordinator from '../../components/shared/SidebarCoordinator.jsx';
import SidebarPrincipal from '../../components/shared/SidebarPrincipal.jsx';
import './Accomplishment.css';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function Accomplishment() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [deadlines, setDeadlines] = useState([]);
    const [loadingDeadlines, setLoadingDeadlines] = useState(false);

    const role = (user?.role || "").toLowerCase();
    const isTeacher = role === "teacher";
    const isPrincipal = role === "principal";
    const isCoordinator= role === "coordinator";

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
                    // Principal/Coordinator: show Accomplishment assignments created by them
                    url = `${API_BASE}/reports/status/principal/${user.user_id}/assignments/accomplishment`;
                }
                const res = await fetch(url, { credentials: "include" });
                if (!res.ok) {
                    setDeadlines([]);
                    return;
                }
                const data = await res.json();
                const filtered = isTeacher
                  ? (data || []).filter(d => (d?.category_name || '').toLowerCase() === 'accomplishment report')
                  : (data || []);
                setDeadlines(filtered);
            } catch (e) {
                console.error('Failed to load data:', e);
                setDeadlines([]);
            } finally {
                setLoadingDeadlines(false);
            }
        };

        fetchData();
    }, [user?.user_id, isTeacher]);

    const onRowClick = (d) => {
        // Always show Instruction first; ensure-submission occurs on Prepare Report
        navigate('/AccomplishmentReportInstruction', {
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

    return (
        <>
        <Header userText={user ? user.name : "Guest"} />
            <div className="dashboard-container">
                {isTeacher ? (
                    <Sidebar activeLink="Accomplishment Report" />
                ) : isCoordinator ? (
                    <SidebarCoordinator activeLink="Accomplishment Report" />
                ) : isPrincipal ? (
                    <SidebarPrincipal activeLink="Accomplishment Report" />
                ) : null}
                <div className="dashboard-content">
                    <Breadcrumb />
                    <div className="dashboard-main">
                        <h2>Accomplishment Report</h2>
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
                                        <td className="first-td" colSpan="5">No Accomplishment Report deadlines.</td>
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
                                        <td>{d?.category_name || ''}</td>
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
    )
}

export default Accomplishment;
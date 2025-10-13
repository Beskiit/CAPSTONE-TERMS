import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Instruction.css";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function MPSInstruction() {
  const navigate = useNavigate();
  const { search, state } = useLocation();

  // ✅ always resolve the id, even on hard reloads
  const qsId = new URLSearchParams(search).get("id");
  const submissionId = qsId ?? state?.submission_id ?? state?.id;

  const title = state?.title;
  const instruction = state?.instruction;
  const fromDate = state?.from_date;
  const toDate = state?.to_date;
  const attempts = state?.number_of_submission;
  const allowLate = state?.allow_late;

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
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
  }, []);

  const role = (user?.role || "").toLowerCase();
  const isTeacher = role === "teacher";

  if (loading) return <p>Loading...</p>;

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        {isTeacher ? <Sidebar activeLink="MPS" /> : <SidebarCoordinator activeLink="MPS" />}
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>MPS</h2>
          </div>
          <div className="content">
            <h3 className="header">Instructions</h3>
            <p className="instruction">{instruction || "No instruction provided."}</p>
            <button
              className="instruction-btn"
              onClick={() => navigate(`/MPSReport?id=${submissionId || ""}`)}
            >
              + Prepare Report
            </button>
          </div>
        </div>
        <div className="dashboard-sidebar">
          <div className="report-card">
            <h3 className="report-card-header">{title || "Report"}</h3>
            <p className="report-card-text">Start Date: {fromDate || "—"}</p>
            <p className="report-card-text">Due Date: {toDate || "—"}</p>
          </div>
          <div className="report-card">
            <h3 className="report-card-header">Submission</h3>
            <p className="report-card-text">Submissions: {attempts ?? "—"}</p>
            <p className="report-card-text">
              Allow late submissions: {Number(allowLate) ? "Yes" : "No"}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default MPSInstruction;

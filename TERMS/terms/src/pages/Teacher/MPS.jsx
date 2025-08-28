import React from "react";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import SidebarCoordinator from '../../components/shared/SidebarCoordinator.jsx';
import './Accomplishment.css';

function LAEMPL() {

    const navigate = useNavigate();

    const role = (localStorage.getItem("role") || "").toLowerCase();
    const isTeacher = role === "teacher";

    return(
        <>
           <Header />
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
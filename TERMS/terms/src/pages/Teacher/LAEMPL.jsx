import React from "react";
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import './Accomplishment.css';

function LAEMPL() {

    const navigate = useNavigate();
    return(
        <>
           <Header />
            <div className="dashboard-container">
                <Sidebar activeLink="LAEMPL"/>
                <div className="dashboard-content">
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
                                <tr onClick={() => navigate('/LAEMPLReport')}>
                                    <td className="first-td">Accomplishment Report</td>
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
import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../shared/Header.jsx';
import Sidebar from "../shared/Sidebar.jsx";
import './ClassificationOfGradesReport.css';

function ClassificationOfGradesReport() {
    return(
        <>
        <Header />
        <div className="dashboard-container">
            <Sidebar activeLink="Classification of Grades"/>
            <div className="dashboard-content">
                <div className="dashboard-main">
                    <h2>Classification Of Grades</h2>
                </div>
                <div className="content">
                    <div className="buttons">
                        <button>Generate Report</button>
                        <button>Import File</button>
                        <button>Export</button>
                        <button>Submit</button>
                    </div>
                    
                </div>
            </div>
        </div>
        </>
    )
}

export default ClassificationOfGradesReport;
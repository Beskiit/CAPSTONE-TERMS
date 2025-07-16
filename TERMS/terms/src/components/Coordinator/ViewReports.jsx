import "./ViewReports.css";
import React from 'react'
import { useState } from 'react'
import Header from '../shared/Header.jsx';
import Sidebar from '../shared/Sidebar.jsx';

function ViewReports(){
    const [openPopup, setOpenPopup] = useState(false);

    return (
        <>
        <Header />
        <div className="dashboard-container">
            <Sidebar activeLink="View Reports"/>
            <div className="dashboard-content">
                <div className="dashboard-main">
                    <h2>View Reports</h2>
                    <div className="report-schedule">
                        <button className="report-button" onClick={() => setOpenPopup(true)}>+ Set Report Schedule</button>
                    </div>
                    {
                        <div className="set-report-schedule popup" style={{ display: openPopup ? 'block' : 'none' }}>
                            <div className="popup-header">
                                <h2>Set Report Schedule</h2>
                                <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                            </div>
                            
                            <hr />
                            <form action="">
                                <span>Title:</span>
                                <input type="text" placeholder="Enter report title" />
                                <div>
                                    <span>Category:</span>
                                    <input type="text" />
                                    <span>Select Teacher:</span>
                                    <input type="text" />
                                </div>
                                <span>Start Date:</span>
                                <input type="date" />
                                <span>Due Date:</span>
                                <input type="date" />
                                <span>Instructions:</span>
                                <textarea placeholder="Enter instructions for the report"></textarea>
                                <button>Set Schedule</button>
                            </form>
                        </div>
                    }
                </div>
            </div>
        </div>
        </>
        
    )
}

export default ViewReports;
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
                        <div className="set-report-schedule-container">
                        <div className="set-report-schedule popup" style={{ display: openPopup ? 'block' : 'none' }}>
                            <div className="popup-header">
                                <h2>Set Report Schedule</h2>
                                <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                            </div>
                            
                            <hr />
                            <form className="schedule-form">
                            <div className="form-row">
                                <label>Title:</label>
                                <input type="text" placeholder="Enter report title" />
                                <label></label>
                                <label></label>
                            </div>

                            <div className="form-row">
                                <label>Category:</label>
                                <select>
                                <option>Select Category</option>
                                </select>

                                <label>Select Teacher:</label>
                                <select>
                                <option>Select Teacher</option>
                                </select>
                            </div>

                            <div className="form-row">
                                <label>Start Date:</label>
                                <input type="date" />

                                <label>Due Date:</label>
                                <input type="date" />
                            </div>

                            <div className="form-row-ins textarea-row">
                                <label>Instructions:</label>
                                <textarea placeholder="Enter instructions for the report"></textarea>
                            </div>

                            <div className="form-actions">
                                <button>Set Schedule</button>
                            </div>
                            </form>
                        </div>
                        </div>
                    }
                </div>
            </div>
        </div>
        </>
        
    )
}

export default ViewReports;
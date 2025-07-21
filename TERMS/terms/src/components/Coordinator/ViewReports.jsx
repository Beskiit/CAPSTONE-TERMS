import "./ViewReports.css";
import React from 'react'
import { useState } from 'react'
import Header from '../shared/Header.jsx';
import Sidebar from '../shared/Sidebar.jsx';

function ViewReports(){
    const [openPopup, setOpenPopup] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');

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
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">Select Category</option>
                                    <option value="student">Student Reports</option>
                                    <option value="teacher">Teacher Reports</option>
                                </select>

                                <label>Select Teacher:</label>
                                <select>
                                    <option>Select Teacher</option>
                                </select>
                                </div>

                                {/* Sub-category shown in separate row */}
                                {selectedCategory && (
                                <div className="form-row">
                                    <label>Sub-Category:</label>
                                    <select
                                    value={selectedSubCategory}
                                    onChange={(e) => setSelectedSubCategory(e.target.value)}
                                    >
                                    <option value="">Select Sub-Category</option>
                                    {selectedCategory === "student" && (
                                        <>
                                        <option value="attendance">Attendance</option>
                                        <option value="grades">Grades</option>
                                        </>
                                    )}
                                    {selectedCategory === "teacher" && (
                                        <>
                                        <option value="schedule">Class Schedule</option>
                                        <option value="evaluation">Performance Evaluation</option>
                                        </>
                                    )}
                                    </select>
                                </div>
                                )}


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
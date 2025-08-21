import React from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import Header from '../../components/shared/Header.jsx';
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import './ClassificationOfGradesReport.css';

function ClassificationOfGradesReport() {
    const [openPopup, setOpenPopup] = useState(false);
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
                        <button onClick={() => setOpenPopup(true)}>Import File</button>
                        {openPopup && (
                            <div className="modal-overlay">
                                <div className="import-popup">
                                    <div className="popup-header">
                                        <h2>Import File</h2>
                                        <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                                    </div>
                                    <hr />
                                    <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                                        <label htmlFor="fileInput" className="file-upload-label">
                                            Click here to upload a file
                                        </label>
                                        <input id="fileInput" type="file" style={{ display: 'none' }} />
                                        <button type="submit">Upload</button>
                                    </form>
                                </div>
                            </div>
                        )}
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
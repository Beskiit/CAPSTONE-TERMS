import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./AccomplishmentReport.css";

function AccomplishmentReport() {
  const [openPopup, setOpenPopup] = useState(false);
  const navigate = useNavigate();

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isTeacher = role === "teacher";

  return (
    <>
      <Header />
      <div className="dashboard-container">
        {isTeacher ? (
          <Sidebar activeLink="Accomplishment Report" />
        ) : (
          <SidebarCoordinator activeLink="Accomplishment Report" />
        )}

        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Accomplishment Report</h2>
          </div>

          <div className="content">
            <div className="buttons">
              {/* Keep other actions; hide Upload Images button for teachers
                  because they now have an upload field in the form */}
              <button>Generate Report</button>

              {!isTeacher && (
                <button onClick={() => setOpenPopup(true)}>Upload Images</button>
              )}
              {openPopup && (
                <div className="modal-overlay">
                  <div className="import-popup">
                    <div className="popup-header">
                      <h2>Import File</h2>
                      <button
                        className="close-button"
                        onClick={() => setOpenPopup(false)}
                      >
                        X
                      </button>
                    </div>
                    <hr />
                    <form
                      className="import-form"
                      onSubmit={(e) => e.preventDefault()}
                    >
                      <label htmlFor="fileInput" className="file-upload-label">
                        Click here to upload a file
                      </label>
                      <input id="fileInput" type="file" style={{ display: "none" }} />
                      <button type="submit">Upload</button>
                    </form>
                  </div>
                </div>
              )}

              <button>Export</button>
              <button>Submit</button>
            </div>

            <div className="accomplishment-report-container">
              <h3>Activity Completion Report</h3>

              <form>
                {isTeacher ? (
                  <>
                    {/* TEACHER VIEW: only Upload Image(s) + Narrative */}
                    <div className="form-row">
                      <label htmlFor="teacherPictures">Upload Image(s):</label>
                      <input
                        type="file"
                        id="teacherPictures"
                        name="teacherPictures"
                        accept="image/*"
                        multiple
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="teacherNarrative">Narrative:</label>
                      <textarea
                        id="teacherNarrative"
                        name="teacherNarrative"
                        rows="6"
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* COORDINATOR VIEW: original full form */}
                    <div className="form-row">
                      <label htmlFor="activityName">Program/Activity Title:</label>
                      <input type="text" id="activityName" name="activityName" required />
                    </div>

                    <div className="form-row">
                      <label htmlFor="facilitators">Facilitator/s:</label>
                      <input type="text" id="facilitators" name="facilitators" required />
                    </div>

                    <div className="form-row">
                      <label htmlFor="objectives">Objectives:</label>
                      <input type="text" id="objectives" name="objectives" required />
                    </div>

                    <div className="form-row">
                      <label>Program/Activity Design:</label>
                      <div className="inner-form-row">
                        <div className="form-row">
                          <label htmlFor="date">Date:</label>
                          <input type="date" id="date" name="date" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="time">Time:</label>
                          <input type="text" id="time" name="time" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="venue">Venue:</label>
                          <input type="text" id="venue" name="venue" required />
                        </div>
                        <div className="form-row">
                          <label htmlFor="keyResult">Key Results:</label>
                          <input type="text" id="keyResult" name="keyResult" required />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="personsInvolved">Person/s Involved</label>
                      <input
                        type="text"
                        id="personsInvolved"
                        name="personsInvolved"
                        required
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="expenses">Expenses:</label>
                      <input type="text" id="expenses" name="expenses" required />
                    </div>

                    <div className="form-row">
                      <label htmlFor="pictures">Picture/s:</label>
                      <input type="text" id="pictures" name="pictures" required />
                    </div>

                    <div className="form-row">
                      <label htmlFor="narrative">Narrative:</label>
                      <textarea
                        id="teacherNarrative"
                        name="teacherNarrative"
                        rows="6"
                        required
                      />
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default AccomplishmentReport;

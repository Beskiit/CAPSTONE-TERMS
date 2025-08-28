import React, { useState } from "react";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import "./LAEMPLReport.css";

const TRAITS = ["Masipag","Matulungin","Masunurin","Magalang","Matapat","Matiyaga"];

const COLS = [
  { key: "m",        label: "Male" },
  { key: "f",        label: "Female" },
  { key: "total",     label: "Total no. of Pupils" },
  { key: "mean",     label: "Mean" },
  { key: "median",     label: "Median" },
  { key: "pl",     label: "PL" },
  { key: "mps", label: "MPS" },
  { key: "sd", label: "SD" },
  { key: "target", label: "Target" },
  { key: "hs", label: "HS" },
  { key: "ls", label: "LS" },
];

function LAEMPLReport() {
  const [openPopup, setOpenPopup] = useState(false);

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const isTeacher = role === "teacher";

  // initialize table data with zeros
  const [data, setData] = useState(() =>
    Object.fromEntries(
      TRAITS.map(t => [t, Object.fromEntries(COLS.map(c => [c.key, ""]))])
    )
  );

  const handleChange = (trait, colKey, value) => {
    setData(prev => ({
      ...prev,
      [trait]: { ...prev[trait], [colKey]: value.replace(/[^\d.-]/g, "") },
    }));
  };

  const totals = COLS.reduce((acc, c) => {
    acc[c.key] = TRAITS.reduce(
      (sum, t) => sum + (Number(data[t][c.key]) || 0),
      0
    );
    return acc;
  }, {});

  const [open, setOpen] = useState(false);
  const [openSec, setOpenSec] = useState(false);

  return (
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
            <div className="buttons">
              <button>Generate Template</button>
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
                      <input id="fileInput" type="file" style={{ display: "none" }} />
                      <button type="submit">Upload</button>
                    </form>
                  </div>
                </div>
              )}
              <button>Export</button>
            </div>

            {/* Drop down for qtr and section*/}
            <div className="dropdown-container">
              <div className="dropdown">
                <button className="dropdown-btn" onClick={() => setOpen(!open)}>
                  Select Quarter {open ? "▲" : "▼"}
                </button>

                {open && (
                  <div className="dropdown-content">
                    <button>1st Quarter</button>
                    <button>2nd Quarter</button>
                    <button>3rd Quarter</button>
                    <button>4th Quarter</button>
                  </div>
                )}
              </div>
                
                <div className="dropdown">
                <button className="dropdown-btn" onClick={() => setOpenSec(!openSec)}>
                  Select Section {openSec ? "▲" : "▼"}
                </button>

                {openSec && (
                  <div className="dropdown-content">
                    <button>Masipag</button>
                    <button>Matulungin</button>
                    <button>Masunurin</button>
                    <button>Magalang</button>
                    <button>Matapat</button>
                    <button>Matiyaga</button>
                  </div>
                )}
              </div>
            </div>

            {/* DYNAMIC TABLE */}
            <div className="table-wrap">
              <table className="laempl-table">
                <caption>Grade 1 - MPS</caption>
                <thead>
                  <tr>
                    <th scope="col" className="row-head"> </th>
                    {COLS.map(col => (
                      <th key={col.key} scope="col">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TRAITS.map(trait => (
                    <tr key={trait}>
                      <th scope="row" className="row-head">{trait}</th>
                      {COLS.map(col => (
                        <td key={col.key}>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={data[trait][col.key]}
                            onChange={(e) => handleChange(trait, col.key, e.target.value)}
                            className="cell-input"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr className="total-row">
                    <th scope="row" className="row-head">Total</th>
                    {COLS.map(col => (
                      <td key={col.key} className="total-cell">{totals[col.key]}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Submit button */}
            <div className="table-actions">
              <button type="submit">
                Submit</button>
            </div>

          </div>
        </div>
        <div className="dashboard-sidebar">
          <div className="report-card">
              <h3 className="report-card-header">This is where the name of the report go</h3>
              <p className="report-card-text">Start Date</p>
              <p className="report-card-text">Due Date</p>
          </div>
          <div className="report-card">
              <h3 className="report-card-header">Submission</h3>
              <p className="report-card-text">Submissions: "Number of submission"</p>
              <p className="report-card-text">Max. Attempts: "Number of Maximum Attempts"</p>
              <p className="report-card-text">Allow late submissions: "logiccc"</p>
          </div>
        </div> 
      </div>
    </>
  );
}

export default LAEMPLReport;

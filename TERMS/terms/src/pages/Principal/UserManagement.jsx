import React, { useState, useEffect } from "react";
import Sidebar from "../../components/shared/SidebarPrincipal";
import "./UserManagement.css";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Edit from "../../assets/edit.svg";
import Delete from "../../assets/delete.svg";
import Modal from "react-modal";

function UserManagement() {
  const navigate = useNavigate();
  const [openPopup, setOpenPopup] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openPopupAdd, setOpenPopupAdd] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // ensure the element id matches your index.html (#root is default in Vite)
    Modal.setAppElement("#root");
  }, []);

  const handleDelete = () => {
    // TODO: call your API to delete the user here
    console.log("User deleted!");
    setConfirmOpen(false);
  };

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5000/auth/me", {
          credentials: "include",
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };
    fetchUser();
  }, []);

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="User Management" />
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Submitted Report</h2>
          </div>

          <div className="add-user-container">
            <button className="add-user-btn" type="button" onClick={() => setOpenPopupAdd(true)}>
              <span className="add-user-text">Add User</span>
            </button>
          </div>

          <div className="content">
            <table className="report-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Creation Date</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                <tr>
                  <td className="file-cell">
                    <span className="file-name">Tristan Labjata</span>
                  </td>
                  <td>Coordinator</td>
                  <td>May 06, 2026</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setOpenPopup(true)}
                      title="Edit user"
                    >
                      <img src={Edit} alt="Edit" />
                    </button>

                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setConfirmOpen(true)}
                      title="Delete user"
                    >
                      <img src={Delete} alt="Delete" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* React-Modal confirmation */}
          <Modal
            isOpen={confirmOpen}
            onRequestClose={() => setConfirmOpen(false)}
            className="modal"
            overlayClassName="overlay"
            contentLabel="Confirm delete user"
          >
            <h2>Confirm Delete</h2>
            <p>Do you want to delete this user?</p>
            <div className="modal-actions">
              <button className="btn btn-danger" onClick={handleDelete}>Yes</button>
              <button className="btn" onClick={() => setConfirmOpen(false)}>Cancel</button>
            </div>
          </Modal>

          {/* Edit user (your custom overlay) */}
          {openPopup && (
            <div className="edit-user-overlay" onClick={() => setOpenPopup(false)}>
              <div className="edit-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Edit User</h2>
                  <button className="close-button" onClick={() => setOpenPopup(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <form className="user-form">
                  <div className="form-row">
                        <label>Name:</label>
                        <input type="text" placeholder="Full name" />
                    </div>
                    <div className="form-row">
                        <label>Role:</label>
                        <select>
                            <option value="" disabled selected>Select role</option>
                            <option value="teacher">Teacher</option>
                            <option value="coordinator">Coordinator</option>
                        </select>
                    </div>
                    <button className="action-btn">
                        Add User
                    </button>
                </form>
              </div>
            </div>
          )}

          {/* Add user (your custom overlay) */}
          {openPopupAdd && (
            <div className="edit-user-overlay" onClick={() => setOpenPopupAdd(false)}>
              <div className="edit-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Add User</h2>
                  <button className="close-button" onClick={() => setOpenPopupAdd(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <form className="user-form">
                    <div className="form-row">
                        <label>Name:</label>
                        <input type="text" placeholder="Full name" />
                    </div>
                    <div className="form-row">
                        <label>Role:</label>
                        <select>
                            <option value="" disabled selected>Select role</option>
                            <option value="teacher">Teacher</option>
                            <option value="coordinator">Coordinator</option>
                        </select>
                    </div>
                    <button className="action-btn">
                        Add User
                    </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default UserManagement;

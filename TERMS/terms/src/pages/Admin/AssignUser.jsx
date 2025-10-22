import React, { useState, useEffect } from "react";
import Sidebar from "../../components/shared/SidebarAdmin";
import "./AssignUser.css";
import { useNavigate } from "react-router-dom";
import Header from "../../components/shared/Header";
import Edit from "../../assets/edit.svg";
import Delete from "../../assets/delete.svg";
import Modal from "react-modal";

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function AssignUser() {
  const navigate = useNavigate();
  const [openPopupAdd, setOpenPopupAdd] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openPopupAssign, setOpenPopupAssign] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
        const res = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
        });
        if (!res.ok) return; // not logged in
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      }
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/users`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
        }
      } catch (err) {
        console.error("Failed to fetch users:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
    fetchUsers();
  }, []);

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
      <div className="dashboard-container">
        <Sidebar activeLink="Assign User/Principal" />
        <div className="dashboard-content">
          <div className="dashboard-main">
            <h2>Assign User</h2>
          </div>

          <div className="add-user-container">
            <button className="add-user-btn" type="button" onClick={() => setOpenPopupAssign(true)}>
              <span className="add-user-text">Assign User</span>
            </button>
          </div>

          <div className="content">
            {loading ? (
              <div>Loading...</div>
            ) : (
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>School</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {users.map((user, index) => (
                    <tr key={user.user_id}>
                      <td>{index + 1}</td>
                      <td className="file-cell">
                        <span className="file-name">{user.name}</span>
                      </td>
                      <td>
                        <span className="role-badge">{user.role}</span>
                      </td>
                      <td>
                        <span className="school-name">Tuktukan Elementary School</span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            type="button"
                            className="icon-btn edit-btn"
                            title="Edit user"
                          >
                            <img src={Edit} alt="Edit" />
                          </button>
                          <button
                            type="button"
                            className="icon-btn delete-btn"
                            onClick={() => setConfirmOpen(true)}
                            title="Delete user"
                          >
                            <img src={Delete} alt="Delete" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
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
          {openPopupAdd && (
            <div className="add-user-overlay add-school" onClick={() => setOpenPopupAdd(false)}>
              <div className="add-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Add School</h2>
                  <button className="close-button" onClick={() => setOpenPopupAdd(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <form className="user-form">
                  <div className="form-row">
                        <label>School Name:</label>
                        <input type="text" placeholder="Full name" />
                    </div>
                    <button className="action-btn">
                        Add School
                    </button>
                </form>
              </div>
            </div>
          )}

          {/* Add user (your custom overlay) */}
          {openPopupAssign && (
            <div className="edit-user-overlay" onClick={() => setOpenPopupAssign(false)}>
              <div className="edit-user-modal" onClick={(e) => e.stopPropagation()}>
                <div className="popup-header">
                  <h2>Assign Teacher</h2>
                  <button className="close-button" onClick={() => setOpenPopupAssign(false)} aria-label="Close">
                    ×
                  </button>
                </div>
                <hr />
                <div className="content">
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      <tr>
                        <td className="file-cell">
                          <span className="file-name">Airone Gamil</span>
                        </td>
                        <td>
                          <span className="status-txt">Unassigned</span>
                        </td>
                        <td>
                          <button className="btn-action">Assign</button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default AssignUser;

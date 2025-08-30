import "./ViewReports.css";
import React, { useState, useEffect  } from 'react';
import Header from '../../components/shared/Header.jsx';
import Sidebar from '../../components/shared/SidebarTeacher.jsx';
import axios from 'axios';

function ViewReports() {
    const [users, setUsers] = useState([]);
    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await axios.get('http://localhost:5000/users');
                // Only show users with role 'teacher'
                const teachers = response.data.filter(user => user.role === 'teacher');
                setUsers(teachers);
            } catch (error) {
                console.error('Error fetching users:', error);
            }
        };
        fetchUsers();
    }, []);
    const [openPopup, setOpenPopup] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedSubCategory, setSelectedSubCategory] = useState('');
    const [startDate, setStartDate] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [instruction, setInstruction] = useState('');
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);
    const [selectedTeacher, setSelectedTeacher] = useState('');

    const defaultGivenBy = 5;
    const defaultQuarter = 1;
    const defaultYear = 1;
    useEffect(() => {
        const fetchSubCategories = async () => {
            if (selectedCategory) {
                try {
                    const response = await axios.get(`http://localhost:5000/subcategories/${selectedCategory}`);
                    setSubCategories(response.data);
                } catch (error) {
                    console.error("Error fetching sub-categories:", error);
                }
            } else {
                setSubCategories([]);
            }
        };

        fetchSubCategories();
    }, [selectedCategory]);

    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const response = await axios.get("http://localhost:5000/categories");
                console.log("Fetched categories:", response.data); // Add this line

                setCategories(response.data);
            } catch (error) {
                console.error("Error fetching categories:", error);
            }
        };

        fetchCategories();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedCategory || !selectedSubCategory || !startDate || !dueDate) {
            alert("Please fill in all required fields.");
            return;
        }

        try {
            await axios.post("http://localhost:5000/reports", {
                category_id: selectedCategory,
                given_by: defaultGivenBy,
                quarter: defaultQuarter,
                year: defaultYear,
                from_date: startDate,        
                to_date: dueDate,
                instruction: instruction,
                is_given: 1,
                is_archived: 0,
                allow_late: 0
            });

            alert("Report schedule set successfully!");
            setOpenPopup(false);
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Failed to set report schedule.");
        }
    };

    useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("http://localhost:5000/auth/me", {
          credentials: "include", // important so session cookie is sent
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
                <Sidebar activeLink="View Reports" />
                <div className="dashboard-content">
                    <div className="dashboard-main">
                        <h2>View Reports</h2>
                        <div className="report-schedule">
                            <button className="report-button" onClick={() => setOpenPopup(true)}>+ Set Report Schedule</button>
                        </div>

                        <div className="set-report-schedule-container">
                            <div className="set-report-schedule popup" style={{ display: openPopup ? 'block' : 'none' }}>
                                <div className="popup-header">
                                    <h2>Set Report Schedule</h2>
                                    <button className="close-button" onClick={() => setOpenPopup(false)}>X</button>
                                </div>
                                <hr />
                                <form className="schedule-form" onSubmit={handleSubmit}>
                                    <div className="form-row">
                                        <label>Title:</label>
                                        <input type="text" placeholder="Enter report title" disabled />
                                    </div>

                                    <div className="form-row">
                               <label>Category:</label>
                                <select
                                    value={selectedCategory}
                                    onChange={(e) => setSelectedCategory(e.target.value)}
                                >
                                    <option value="">Select Category</option>
                                    {categories.map((category) => (
                                    <option key={category.category_id} value={category.category_id}>
                                        {category.category_name}
                                    </option>
                                    ))}
                                </select>

                               <label>Select Teacher:</label>
                                    <select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)}>
                                    <option value="">Select Teacher</option>
                                    {users.map(user => (
                                        <option key={user.user_id} value={user.user_id}>
                                        {user.name}
                                        </option>
                                    ))}
                                    </select>

                                </div>

                                    {selectedCategory && (
                                        <div className="form-row">
                                            <label>Sub-Category:</label>
                                            <select value={selectedSubCategory} onChange={(e) => setSelectedSubCategory(e.target.value)}>
                                                <option value="">Select Sub-Category</option>
                                                {subCategories.map((sub) => (
                                                    <option key={sub.sub_category_id} value={sub.sub_category_id}>
                                                        {sub.sub_category_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div className="form-row">
                                        <label>Start Date:</label>
                                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />

                                        <label>Due Date:</label>
                                        <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                                    </div>

                                    <div className="form-row-ins textarea-row">
                                        <label>Instructions:</label>
                                        <textarea
                                            placeholder="Enter instructions for the report"
                                            value={instruction}
                                            onChange={(e) => setInstruction(e.target.value)}
                                        ></textarea>
                                    </div>

                                    <div className="form-actions">
                                        <button type="submit">Set Schedule</button>
                                    </div>
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </>
    );
}

export default ViewReports;

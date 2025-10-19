import './App.css'
import { Routes, Route, useNavigate } from 'react-router-dom'
import depedLogo from './assets/deped-logo.png'
import EyeIcon from './assets/eye.svg'
import EyeOffIcon from './assets/eye-close.svg'
import UserIcon from './assets/user.svg'
import PasswordIcon from './assets/password.svg'
import React, { useState } from 'react'
import ToastProvider from './components/ToastProvider'

// Dashboard components
import DashboardTeacher from './pages/Teacher/DashboardTeacher.jsx'  
import DashboardCoordinator from './pages/Coordinator/DashboardCoordinator.jsx'  

// Page components
import ViewReports from './pages/Coordinator/ViewReports.jsx'
import ClassificationOfGrades from './pages/Teacher/ClassificationOfGrades.jsx'
import ClassificationOfGradesReport from './pages/Teacher/ClassificationOfGradesReport.jsx'
import AccomplishmentReport from './pages/Teacher/AccomplishmentReport.jsx'
import SetReport from './pages/Coordinator/SetReport.jsx'
import Accomplishment from './pages/Teacher/Accomplishment.jsx'
import LAEMPL from './pages/Teacher/LAEMPL.jsx'
import LAEMPLReport from './pages/Teacher/LAEMPLReport.jsx'
import MPS from './pages/Teacher/MPS.jsx'
import MPSReport from './pages/Teacher/MPSReport.jsx'
import LAEMPLInstruction from './pages/Teacher/LAEMPLInstruction.jsx'
import MPSInstruction from './pages/Teacher/MPSInstruction.jsx'
import AccomplishmentReportInstruction from './pages/Teacher/AccomplishmentReportInstruction.jsx'
import ClassificationOfGradesInstruction from './pages/Teacher/ClassificationOfGradesInstruction.jsx'
import Login from './pages/Login.jsx'
import DashboardPrincipal from './pages/Principal/DashboardPrincipal.jsx'
import ViewSubmission from './pages/Principal/ViewSubmission.jsx'
import SubmittedReport from './pages/Teacher/SubmittedReport.jsx'
import AssignedReport from './pages/Coordinator/AssignedReport.jsx'
import ViewSubmissionTeacher from './pages/Teacher/ViewSubmission.jsx'
import ForApproval from './pages/Principal/ForApproval.jsx'
import UserManagement from './pages/Principal/UserManagement.jsx'
import AssignedReportData from './pages/Coordinator/AssignedReportData.jsx'
import SubmissionData from './pages/Principal/SubmissionData.jsx'
import ForApprovalData from './pages/Principal/ForApprovalData.jsx'


function App() {
  return (
    <main>
      <ToastProvider />
      <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/DashboardTeacher" element={<DashboardTeacher />} />
          <Route path="/DashboardCoordinator" element={<DashboardCoordinator />} />
          <Route path="/ViewReports" element={<ViewReports />} />
          <Route path="/ClassificationOfGrades" element={<ClassificationOfGrades />} />
          <Route path="/ClassificationOfGradesReport" element={<ClassificationOfGradesReport />} />
          <Route path="/AccomplishmentReport" element={<AccomplishmentReport />} />
          <Route path="/SetReport" element={<SetReport />} />
          <Route path="/Accomplishment" element={<Accomplishment />} />
          <Route path="/LAEMPL" element={<LAEMPL />} />
          <Route path="/LAEMPLReport" element={<LAEMPLReport />} />
          <Route path="/MPS" element={<MPS />} />
          <Route path="/MPSReport" element={<MPSReport />} />
          <Route path="/LAEMPLInstruction" element={<LAEMPLInstruction />} />
          <Route path="/MPSInstruction" element={<MPSInstruction />} />
          <Route path="/AccomplishmentReportInstruction" element={<AccomplishmentReportInstruction />} />
          <Route path="/ClassificationOfGradesInstruction" element={<ClassificationOfGradesInstruction />} />
          <Route path="/DashboardPrincipal" element={<DashboardPrincipal />} />
          <Route path="/ViewSubmission" element={<ViewSubmission />} />
          <Route path="/SubmittedReport" element={<SubmittedReport />} />
          <Route path="/AssignedReport" element={<AssignedReport />} />
          <Route path="/ForApproval" element={<ForApproval />} />
          <Route path="/UserManagement" element={<UserManagement />} />
          <Route path="/AssignedReportData/:submissionId" element={<AssignedReportData />} />
          <Route path="/SubmissionData" element={<SubmissionData />} />
          <Route path="/ForApprovalData" element={<ForApprovalData />} />
          <Route path="/submission/:submissionId" element={<ViewSubmissionTeacher />} />
      </Routes>
    </main>
  )
}

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (username === '' || password === '') {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const apiBase = import.meta.env.VITE_API_BASE || 'https://terms-api.kiri8tives.com';
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/temp-auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store user info and token
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.user.role);
        
        // Navigate based on role
        switch (data.user.role) {
          case 'teacher':
            navigate('/DashboardTeacher');
            break;
          case 'coordinator':
            navigate('/DashboardCoordinator');
            break;
          case 'principal':
            navigate('/DashboardPrincipal');
            break;
          case 'admin':
            navigate('/DashboardCoordinator');
            break;
          default:
            navigate('/DashboardTeacher');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (error) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin}>
        <img className='deped-logo' src={depedLogo} alt="DepEd Logo" />
        
        <div className="test-accounts" style={{ 
          background: '#f0f8ff', 
          padding: '1rem', 
          margin: '1rem 0', 
          borderRadius: '8px',
          fontSize: '0.85rem' 
        }}>
          <h1>Test Push</h1>
          <h3>Test Accounts:</h3>
          <div><p>👨‍🏫 Teacher: teacher1 / teacher123</p></div>
          <div><p>👥 Coordinator: coordinator1 / coord123</p></div>
          <div><p>🏫 Principal: principal1 / principal123</p></div>
          <div><p>⚙️ Admin: admin1 / admin123</p></div>
        </div>
        
        {error && <div className="error-message" style={{ color: '#ff4444', marginBottom: '1em', textAlign: 'center' }}>{error}</div>}
        
        <div className="input-container">
          <div className="input-wrapper">
            <span className="input-icon"><img src={UserIcon} alt="User" /></span>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>
        
        <div className="input-container">
          <div className="input-wrapper">
            <span className="input-icon"><img src={PasswordIcon} alt="Password" /></span>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
              disabled={loading}
            >
              {showPassword ? <img style={{ height: "1em" }} src={EyeOffIcon} alt="Hide password" /> : <img style={{ height: "1em", paddingLeft: "1em" }} src={EyeIcon} alt="Show password" />}
            </button>
          </div>
        </div>
        
        <div className='login-button-container'>
          <button type="submit" className='login-button' disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </div>
      </form>
    </div>
  );
}



export default App

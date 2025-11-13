import './App.css'
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom'
import depedLogo from './assets/deped-logo.png'
import EyeIcon from './assets/eye.svg'
import EyeOffIcon from './assets/eye-close.svg'
import UserIcon from './assets/user.svg'
import PasswordIcon from './assets/password.svg'
import React, { useState } from 'react'
import ToastProvider from './components/ToastProvider'
import ProtectedRoute from './components/ProtectedRoute'

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
import AssignedReportData from './pages/Coordinator/AssignedReportData.jsx'
import SubmissionData from './pages/Principal/SubmissionData.jsx'
import ForApprovalData from './pages/Principal/ForApprovalData.jsx'
import ViewSubmissionData from './pages/Principal/ViewSubmissionData.jsx'
import LAEMPLMPSReports from './pages/Principal/LAEMPLMPSReports.jsx'
import ViewCoordinatorSubmissions from './pages/Principal/ViewCoordinatorSubmissions.jsx'
import UserManagement from './pages/Admin/UserManagement.jsx'
import AssignUser from './pages/Admin/AssignUser.jsx'
import AddSchool from './pages/Admin/AddSchool.jsx'
import AddSchoolPage from './pages/Admin/AddSchoolPage.jsx'


function App() {
  return (
    <main>
      <ToastProvider />
      <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          
          {/* Teacher Routes */}
          <Route path="/DashboardTeacher" element={<ProtectedRoute requiredRoles={['teacher']}><DashboardTeacher /></ProtectedRoute>} />
          <Route path="/ClassificationOfGrades" element={<ProtectedRoute requiredRoles={['teacher']}><ClassificationOfGrades /></ProtectedRoute>} />
          <Route path="/ClassificationOfGradesReport" element={<ProtectedRoute requiredRoles={['teacher']}><ClassificationOfGradesReport /></ProtectedRoute>} />
          <Route path="/AccomplishmentReport" element={<ProtectedRoute requiredRoles={['teacher']}><AccomplishmentReport /></ProtectedRoute>} />
          <Route path="/Accomplishment" element={<ProtectedRoute requiredRoles={['teacher']}><Accomplishment /></ProtectedRoute>} />
          <Route path="/LAEMPL" element={<ProtectedRoute requiredRoles={['teacher']}><LAEMPL /></ProtectedRoute>} />
          <Route path="/LAEMPLReport" element={<ProtectedRoute requiredRoles={['teacher']}><LAEMPLReport /></ProtectedRoute>} />
          <Route path="/MPS" element={<ProtectedRoute requiredRoles={['teacher']}><MPS /></ProtectedRoute>} />
          <Route path="/LAEMPLInstruction" element={<ProtectedRoute requiredRoles={['teacher', 'coordinator', 'principal', 'admin']}><LAEMPLInstruction /></ProtectedRoute>} />
          <Route path="/MPSInstruction" element={<ProtectedRoute requiredRoles={['teacher', 'coordinator', 'principal', 'admin']}><MPSInstruction /></ProtectedRoute>} />
          <Route path="/AccomplishmentReportInstruction" element={<ProtectedRoute requiredRoles={['teacher', 'coordinator', 'principal', 'admin']}><AccomplishmentReportInstruction /></ProtectedRoute>} />
          <Route path="/ClassificationOfGradesInstruction" element={<ProtectedRoute requiredRoles={['teacher', 'coordinator', 'principal', 'admin']}><ClassificationOfGradesInstruction /></ProtectedRoute>} />
          <Route path="/SubmittedReport" element={<ProtectedRoute requiredRoles={['teacher']}><SubmittedReport /></ProtectedRoute>} />
          <Route path="/submission/:submissionId" element={<ProtectedRoute requiredRoles={['teacher']}><ViewSubmissionTeacher /></ProtectedRoute>} />
          
          {/* Coordinator Routes */}
          <Route path="/DashboardCoordinator" element={<ProtectedRoute requiredRoles={['coordinator', 'principal', 'admin']}><DashboardCoordinator /></ProtectedRoute>} />
          <Route path="/ViewReports" element={<ProtectedRoute requiredRoles={['coordinator', 'principal', 'admin']}><ViewReports /></ProtectedRoute>} />
          <Route path="/SetReport" element={<ProtectedRoute requiredRoles={['coordinator', 'principal', 'admin']}><SetReport /></ProtectedRoute>} />
          <Route path="/AssignedReport" element={<ProtectedRoute requiredRoles={['coordinator', 'principal', 'admin']}><AssignedReport /></ProtectedRoute>} />
          <Route path="/AssignedReportData/:submissionId" element={<ProtectedRoute requiredRoles={['coordinator', 'principal', 'admin']}><AssignedReportData /></ProtectedRoute>} />
          
          {/* Principal Routes */}
          <Route path="/DashboardPrincipal" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><DashboardPrincipal /></ProtectedRoute>} />
          <Route path="/ViewSubmission" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><ViewSubmission /></ProtectedRoute>} />
          <Route path="/ForApproval" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><ForApproval /></ProtectedRoute>} />
          <Route path="/SubmissionData" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><SubmissionData /></ProtectedRoute>} />
          <Route path="/ForApprovalData" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><ForApprovalData /></ProtectedRoute>} />
          <Route path="/ViewSubmissionData" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><ViewSubmissionData /></ProtectedRoute>} />
          <Route path="/LAEMPLMPSReports" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><LAEMPLMPSReports /></ProtectedRoute>} />
          <Route path="/ViewCoordinatorSubmissions" element={<ProtectedRoute requiredRoles={['principal', 'admin']}><ViewCoordinatorSubmissions /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/UserManagement" element={<ProtectedRoute requiredRoles={['admin']}><UserManagement /></ProtectedRoute>} />
          <Route path="/AssignUser" element={<ProtectedRoute requiredRoles={['admin']}><AssignUser /></ProtectedRoute>} />
          <Route path="/AddSchool" element={<ProtectedRoute requiredRoles={['admin']}><AddSchoolPage /></ProtectedRoute>} />
          
          {/* Catch-all route - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
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
            navigate('/UserManagement');
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

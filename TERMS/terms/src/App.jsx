import './App.css'
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import depedLogo from './assets/deped-logo.png'
import EyeIcon from './assets/eye.svg'
import EyeOffIcon from './assets/eye-close.svg'
import UserIcon from './assets/user.svg'
import PasswordIcon from './assets/password.svg'
import React, { useState } from 'react'
import Dashboard from './components/Teacher/Dashboard.jsx'  
import ViewReports from './components/Coordinator/ViewReports.jsx'
import ClassificationOfGrades from './components/Teacher/ClassificationOfGrades.jsx'
import ClassificationOfGradesReport from './components/Teacher/ClassificationOfGradesReport.jsx'

function App() {
  return (
    <BrowserRouter>
      <main>
        <Routes>
          <Route path="/" element={<LoginForm />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/ViewReports" element={<ViewReports />} />
          <Route path="/ClassificationOfGrades" element={<ClassificationOfGrades />} />
          <Route path="/ClassificationOfGradesReport" element={<ClassificationOfGradesReport />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}

function Header() {
  return (
    <header>
      <img src={depedLogo} alt="DepEd Logo" />
      <h4 className='header-title'>Teacher's Management Report System</h4>
    </header>
  )
}

function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = (e) => {
    e.preventDefault();

    if (username === '' || password === '') {
      setError('Please fill in all fields');
      return;
    }

    if (username === 'teacher' || password === 'password') {
      navigate('/Dashboard');
      return;
    }else if(username === 'coordinator' || password === 'password123') {
      navigate('/ViewReports');
      return;
    }
  }

  return (
    <div className="login-container">
      <form onSubmit={handleLogin}>
        <img className='deped-logo' src={depedLogo} alt="DepEd Logo" />
        <div className="input-container">
          <div className="input-wrapper">
            <span className="input-icon"><img src={UserIcon} alt="User" /></span>
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            />
            <button
              type="button"
              className="password-toggle"
              onClick={togglePasswordVisibility}
            >
              {showPassword ? <img style={{ height: "1em" }} src={EyeOffIcon} alt="Hide password" /> : <img style={{ height: "1em", paddingLeft: "1em" }} src={EyeIcon} alt="Show password" />}
            </button>
          </div>
          <div className="forgot-password">
            <a href="/forgot-password">Forgot Password?</a>
          </div>
        </div>
        <div className='login-button-container'>
          <button type="submit" className='login-button'>Login</button>
        </div>
      </form>
    </div>
  );
}

export default App

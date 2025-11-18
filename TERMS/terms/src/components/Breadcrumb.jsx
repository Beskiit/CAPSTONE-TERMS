import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Breadcrumb.css';

const Breadcrumb = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Route to name mapping
  const routeNames = {
    '/DashboardTeacher': 'Dashboard',
    '/DashboardCoordinator': 'Dashboard',
    '/DashboardPrincipal': 'Dashboard',
    '/UserManagement': 'Dashboard',
    '/ClassificationOfGrades': 'Classification of Grades',
    '/ClassificationOfGradesReport': 'Classification of Grades Report',
    '/ClassificationOfGradesInstruction': 'Classification of Grades Instruction',
    '/AccomplishmentReport': 'Accomplishment Report',
    '/Accomplishment': 'Accomplishment',
    '/AccomplishmentReportInstruction': 'Accomplishment Report Instruction',
    '/LAEMPL': 'LAEMPL',
    '/LAEMPLReport': 'LAEMPL Report',
    '/LAEMPLInstruction': 'LAEMPL Instruction',
    '/MPS': 'MPS',
    '/MPSInstruction': 'MPS Instruction',
    '/SubmittedReport': 'Submitted Report',
    '/ViewReports': 'View Reports',
    '/SetReport': 'Set Report',
    '/AssignedReport': 'Assigned Report',
    '/ViewSubmission': 'View Submission',
    '/ForApproval': 'For Approval',
    '/SubmissionData': 'Submission Data',
    '/ForApprovalData': 'For Approval Data',
    '/ViewSubmissionData': 'View Submission Data',
    '/AssignUser': 'Assign User',
    '/AddSchool': 'Add School',
  };

  // Get dashboard route based on user role
  const getDashboardRoute = () => {
    if (!user) return '/DashboardTeacher';
    const role = (user.role || '').toLowerCase();
    switch (role) {
      case 'teacher':
        return '/DashboardTeacher';
      case 'coordinator':
        return '/DashboardCoordinator';
      case 'principal':
        return '/DashboardPrincipal';
      case 'admin':
        return '/UserManagement';
      default:
        return '/DashboardTeacher';
    }
  };

  // Don't show breadcrumb on login page or dashboard
  if (location.pathname === '/login' || location.pathname === '/') {
    return null;
  }

  // Check if current route is a dashboard
  const isDashboard = location.pathname === '/DashboardTeacher' || 
                      location.pathname === '/DashboardCoordinator' || 
                      location.pathname === '/DashboardPrincipal' || 
                      location.pathname === '/UserManagement';

  // Get current page name
  const currentPageName = routeNames[location.pathname] || 
                         location.pathname.split('/').pop().replace(/([A-Z])/g, ' $1').trim() ||
                         'Page';

  // Handle dynamic routes (e.g., /submission/:id, /AssignedReportData/:id)
  let displayName = currentPageName;
  if (location.pathname.startsWith('/submission/')) {
    const title = location.state && location.state.breadcrumbTitle;
    displayName = title ? `Submitted Report - ${title}` : 'Submitted Report Details';
  } else if (location.pathname.startsWith('/AssignedReportData/')) {
    const title = (location.state && (location.state.assignmentTitle || location.state.breadcrumbTitle)) || '';
    displayName = title ? `Assigned Report - ${title}` : 'Assigned Report Details';
  } else if (location.pathname.startsWith('/ViewSubmissionData')) {
    const title = location.state && location.state.breadcrumbTitle;
    displayName = title ? `View Report - ${title}` : 'View Report Details';
  } else if (location.pathname.startsWith('/ForApprovalData')) {
    const title = location.state && location.state.breadcrumbTitle;
    displayName = title ? `For Approval - ${title}` : 'For Approval Details';
  }

  const dashboardRoute = getDashboardRoute();
  const dashboardName = routeNames[dashboardRoute] || 'Dashboard';

  // Build hierarchical segments for specific flows
  const segments = [];
  const s = (location.state || {});

  const pushText = (label) => segments.push({ type: 'text', label });
  const pushLink = (label, to, state) => segments.push({ type: 'link', label, to, state });

  // Flows for accomplishment creation
  if (location.pathname === '/AccomplishmentReportInstruction') {
    if (s.fromAssignedReport) {
      pushLink('Assigned Report', '/AssignedReport');
    } else if (s.fromReports) {
      pushLink('Reports', '/Accomplishment');
      pushLink('Accomplishment', '/Accomplishment');
    }
    pushText('Accomplishment Report Instruction');
  } else if (location.pathname === '/LAEMPLInstruction') {
    if (s.fromAssignedReport) {
      pushLink('Assigned Report', '/AssignedReport');
    }
    pushText('LAEMPL Instruction');
  } else if (location.pathname === '/MPSInstruction') {
    if (s.fromAssignedReport) {
      pushLink('Assigned Report', '/AssignedReport');
    }
    pushText('MPS Instruction');
  } else if (location.pathname === '/ClassificationOfGradesInstruction') {
    if (s.fromAssignedReport) {
      pushLink('Assigned Report', '/AssignedReport');
    }
    pushText('Classification of Grades Instruction');
  } else if (location.pathname === '/AccomplishmentReport') {
    if (s.fromReports) {
      pushLink('Reports', '/Accomplishment');
      pushLink('Accomplishment', '/Accomplishment');
      pushLink('Accomplishment Report Instruction', '/AccomplishmentReportInstruction', {
        id: s.id || s.submission_id,
        submission_id: s.submission_id || s.id,
        title: s.breadcrumbTitle,
        instruction: s.instruction,
        from_date: s.from_date,
        to_date: s.to_date,
        number_of_submission: s.number_of_submission,
        allow_late: s.allow_late,
        fromReports: true
      });
    } else if (s.fromDeadline) {
      pushLink('Accomplishment Report Instruction', '/AccomplishmentReportInstruction', {
        id: s.id || s.submission_id,
        submission_id: s.submission_id || s.id,
        title: s.breadcrumbTitle,
        instruction: s.instruction,
        from_date: s.from_date,
        to_date: s.to_date,
        number_of_submission: s.number_of_submission,
        allow_late: s.allow_late,
        fromDeadline: true
      });
    }
    const t = s.breadcrumbTitle;
    pushText(t ? `Accomplishment Report - ${t}` : 'Accomplishment Report');
  } else if (location.pathname.startsWith('/submission/')) {
    // If coming from SubmittedReport, show it in breadcrumb
    if (s.fromSubmittedReport) {
      pushLink('Submitted Report', '/SubmittedReport');
    }
    const t = s.breadcrumbTitle;
    pushText(t ? `Submitted Report - ${t}` : 'Submitted Report Details');
  } else if (location.pathname.startsWith('/ViewSubmissionData')) {
    // If coming from ViewSubmission, show it in breadcrumb
    if (s.fromViewSubmission) {
      pushLink('View Submission', '/ViewSubmission');
    }
    const t = s.breadcrumbTitle;
    pushText(t ? `View Report - ${t}` : 'View Report Details');
  } else if (location.pathname.startsWith('/ForApprovalData')) {
    // If coming from For Approval list, show it in breadcrumb
    if (s.fromForApproval) {
      pushLink('For Approval', '/ForApproval');
    }
    const t = s.breadcrumbTitle;
    pushText(t ? `For Approval - ${t}` : 'For Approval Details');
  } else if (location.pathname.startsWith('/AssignedReportData/')) {
    // If coming from AssignedReport, show it in breadcrumb
    if (s.fromAssignedReport) {
      pushLink('Assigned Report', '/AssignedReport');
      
      // If coming from an instruction page, add it to the breadcrumb
      if (s.fromInstructionPage) {
        const instructionPageNames = {
          'AccomplishmentReportInstruction': 'Accomplishment Report Instruction',
          'LAEMPLInstruction': 'LAEMPL Instruction',
          'MPSInstruction': 'MPS Instruction',
          'ClassificationOfGradesInstruction': 'Classification of Grades Instruction'
        };
        const instructionName = instructionPageNames[s.fromInstructionPage] || s.fromInstructionPage;
        pushLink(instructionName, `/${s.fromInstructionPage}`, {
          ...s,
          fromAssignedReport: true
        });
      }
    }
    const t = s.assignmentTitle || s.breadcrumbTitle;
    pushText(t ? `Assigned Report - ${t}` : 'Assigned Report Details');
  } else if (location.pathname === '/SetReport') {
    // If there's a breadcrumbTitle in state, show "Set Report - {title}"
    if (s.breadcrumbTitle) {
      // If coming from AssignedReport, show it in breadcrumb
      if (s.fromAssignedReport) {
        pushLink('Assigned Report', '/AssignedReport');
        
        // If coming from an instruction page, add it to the breadcrumb
        if (s.fromInstructionPage) {
          const instructionPageNames = {
            'AccomplishmentReportInstruction': 'Accomplishment Report Instruction',
            'LAEMPLInstruction': 'LAEMPL Instruction',
            'MPSInstruction': 'MPS Instruction',
            'ClassificationOfGradesInstruction': 'Classification of Grades Instruction'
          };
          const instructionName = instructionPageNames[s.fromInstructionPage] || s.fromInstructionPage;
          pushLink(instructionName, `/${s.fromInstructionPage}`, {
            ...s,
            fromAssignedReport: true
          });
        }
      }
      pushText(`Set Report - ${s.breadcrumbTitle}`);
    } else {
      pushText('Set Report');
    }
  } else if (!isDashboard) {
    pushText(displayName);
  }

  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol className="breadcrumb-list">
        <li className="breadcrumb-item">
          <button 
            className="breadcrumb-link" 
            onClick={() => navigate(dashboardRoute)}
            aria-label="Go to Dashboard"
          >
            Dashboard
          </button>
        </li>
        {segments.map((seg, idx) => {
          const isLast = idx === segments.length - 1;
          return (
            <React.Fragment key={idx}>
              <li className="breadcrumb-separator">/</li>
              {isLast ? (
                <li className="breadcrumb-item breadcrumb-current" aria-current="page">{seg.label}</li>
              ) : seg.type === 'link' ? (
                <li className="breadcrumb-item">
                  <button
                    className="breadcrumb-link"
                    onClick={() => navigate(seg.to, seg.state ? { state: seg.state } : undefined)}
                  >
                    {seg.label}
                  </button>
                </li>
              ) : (
                <li className="breadcrumb-item">
                  <span className="breadcrumb-link">{seg.label}</span>
                </li>
              )}
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};

export default Breadcrumb;


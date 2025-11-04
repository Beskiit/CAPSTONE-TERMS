import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './SharedComponents.css';
import DepedLogo from '../../assets/deped-logo.png';
import Notification from '../../assets/notification-bell.svg';

const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");

function Header({ userText }) {
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [unread, setUnread] = useState(0);
	const [user, setUser] = useState(null);
	const dropdownRef = useRef(null);

	const fetchNotifications = async () => {
		try {
			setLoading(true);
			setError("");
			const res = await fetch(`${API_BASE}/notifications`, { credentials: 'include' });
			if (!res.ok) throw new Error('Failed to load notifications');
			let data = await res.json();
			if (!Array.isArray(data)) data = [];
			// Fallback for principals: derive notifications from for-approval queue when none exist
			const roleLower = (user?.role || '').toLowerCase();
			if (roleLower === 'principal' && data.length === 0) {
				try {
					const r = await fetch(`${API_BASE}/submissions/for-principal-approval`, { credentials: 'include' });
					if (r.ok) {
						const subs = await r.json();
						if (Array.isArray(subs) && subs.length) {
							data = subs.map(s => ({
								notification_id: `derived-${s.submission_id}`,
								title: `For approval: ${s.assignment_title || s.title}`,
								message: `Submitted by ${s.submitted_by_name || 'Teacher'}`,
								type: 'for_approval',
								ref_type: 'submission',
								ref_id: s.submission_id,
								is_read: 0,
								created_at: s.date_submitted || ''
							}));
						}
					}
				} catch {}
			}
			setItems(data);
			setUnread(data.filter(n => Number(n.is_read) === 0).length);
		} catch (e) {
			setError(e?.message || 'Error');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		// fetch current user once
		(async () => {
			try {
				const r = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
				if (r.ok) setUser(await r.json());
			} catch {}
		})();
		fetchNotifications();
		const onFocus = () => fetchNotifications();
		window.addEventListener('focus', onFocus);
		const intervalId = setInterval(fetchNotifications, 30000);
		return () => {
			window.removeEventListener('focus', onFocus);
			clearInterval(intervalId);
		};
	}, []);

	useEffect(() => {
		const onClickAway = (e) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
				setOpen(false);
			}
		};
		document.addEventListener('click', onClickAway);
		return () => document.removeEventListener('click', onClickAway);
	}, []);

	const markAllRead = async () => {
		try {
			await fetch(`${API_BASE}/notifications/read-all`, { method: 'POST', credentials: 'include' });
			setItems(prev => prev.map(n => ({ ...n, is_read: 1 })));
			setUnread(0);
		} catch {}
	};

	const onToggleOpen = () => {
		setOpen(o => {
			const next = !o;
			if (next) fetchNotifications();
			return next;
		});
	};

	const handleItemClick = async (notifId, isRead) => {
		try {
			await fetch(`${API_BASE}/notifications/${notifId}/read`, { method: 'PATCH', credentials: 'include' });
			setItems(prev => prev.map(n => n.notification_id === notifId ? { ...n, is_read: 1 } : n));
			if (!Number(isRead)) setUnread(prev => Math.max(0, prev - 1));
		} catch {}
	};

	// mirror DeadlineComponent detection
	const detectType = (raw) => {
		const title = (raw?.title || raw?.value || "").toLowerCase();
		const fields = raw?.fields || {};
		const explicit = (fields?.type || '').toLowerCase();
		if (explicit) return explicit;
		if (title.includes('laempl')) return 'laempl';
		if (title.includes('mps')) return 'mps';
		if (title.includes('accomplishment')) return 'accomplishment';
		if (title.includes('classification')) return 'cog';
		return 'generic';
	};

	const goToInstruction = (kind, state) => {
		if (kind === 'laempl')         return navigate('/LAEMPLInstruction', { state });
		if (kind === 'mps')            return navigate('/MPSInstruction', { state });
		if (kind === 'accomplishment') return navigate('/AccomplishmentReportInstruction', { state });
		if (kind === 'cog')            return navigate('/ClassificationOfGradesInstruction', { state });
		return navigate('/SubmittedReport');
	};

	const goToNotificationTarget = async (n) => {
		try {
			const userRole = (user?.role || '').toLowerCase();
			const openWithSubmission = async (submissionId) => {
				const r = await fetch(`${API_BASE}/submissions/${submissionId}`, { credentials: 'include' });
                if (!r.ok) return navigate(`/submission/${submissionId}`, { state: { breadcrumbTitle: `Submission ${submissionId}` } });
				const j = await r.json();
				const fields = j?.fields || {};
				const kind = detectType({ title: j?.value, fields });
				let ra = null;
				if (j?.report_assignment_id) {
					try {
						const raRes = await fetch(`${API_BASE}/reports/${j.report_assignment_id}`, { credentials: 'include' });
						if (raRes.ok) ra = await raRes.json();
					} catch {}
				}
				const state = {
					submission_id: submissionId,
					id: j?.report_assignment_id,
					title: j?.value || ra?.title,
					instruction: ra?.instruction ?? fields?.instruction,
					from_date: ra?.from_date ?? fields?.from_date,
					to_date: ra?.to_date ?? fields?.to_date,
					number_of_submission: j?.number_of_submission,
					allow_late: ra?.allow_late ?? fields?.allow_late,
				};

				// Special handling: when a coordinator submits an ACCOMPLISHMENT, review in ForApprovalData
                if ((n?.type || '').toLowerCase() === 'report_submitted' && kind === 'accomplishment') {
                    return navigate(`/ForApprovalData?id=${submissionId}`, { state: { breadcrumbTitle: (j?.value || ra?.title) } });
				}

				// When for_approval type arrives to principal, also prefer ForApprovalData
                if ((n?.type || '').toLowerCase() === 'for_approval' && userRole === 'principal' && kind === 'accomplishment') {
                    return navigate(`/ForApprovalData?id=${submissionId}`, { state: { breadcrumbTitle: (j?.value || ra?.title) } });
				}

				goToInstruction(kind, state);
			};

			if (n?.ref_type === 'submission' && n?.ref_id) {
				return openWithSubmission(n.ref_id);
			}

			if (n?.ref_type === 'report_assignment' && n?.ref_id) {
				const r = await fetch(`${API_BASE}/submissions/by-assignment/${n.ref_id}/mine`, { credentials: 'include' });
				if (r.ok) {
					const x = await r.json();
					if (x?.submission_id) return openWithSubmission(x.submission_id);
				}
			}
		} catch {
			/* ignore */
		}
	};

	return (
		<header>
			<div className="header-left">
				<img src={DepedLogo} alt="DepEd Logo" />
				<h2 className="header-title">Teacher's Report Management System</h2>
			</div>
			<div className="header-right">
				<h2 className="header-title">{userText}</h2>
				<div className="notif-wrap" ref={dropdownRef}>
					<button
						className="notif-btn"
						onClick={onToggleOpen}
						aria-label="Notifications"
					>
						<img src={Notification} alt="" />
						{unread > 0 && (<span className="notif-badge">{unread}</span>)}
					</button>
					{open && (
						<div className="notif-dropdown">
							<div className="notif-header">
								<span>Notifications</span>
								<button onClick={markAllRead}>Mark all read</button>
							</div>
							<div className="notif-body">
								{loading && <div className="notif-empty">Loading…</div>}
								{!!error && <div className="notif-empty">{error}</div>}
								{!loading && !error && items.length === 0 && (
									<div className="notif-empty">No notifications</div>
								)}
								{items.map((n) => (
									<div key={n.notification_id} className={`notif-item ${Number(n.is_read) ? '' : 'unread'}`} onClick={async () => { await handleItemClick(n.notification_id, n.is_read); await goToNotificationTarget(n); }}>
										<div className="notif-title">{n.title}</div>
										{n.message ? <div className="notif-msg">{n.message}</div> : null}
										<div className="notif-meta">{n.created_at}</div>
									</div>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}

export default Header; 
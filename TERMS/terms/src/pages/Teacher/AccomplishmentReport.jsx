import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Header from "../../components/shared/Header.jsx";
import Sidebar from "../../components/shared/SidebarTeacher.jsx";
import SidebarCoordinator from "../../components/shared/SidebarCoordinator.jsx";
import { ConfirmationModal, SubmissionConfirmation } from "../../components/ConfirmationModal";
import { normalizeImages, getImageUrl, debugImageUrl } from "../../utils/imageUtils.js";
import toast from "react-hot-toast";
import "./AccomplishmentReport.css";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ImageRun } from "docx";
import { saveAs } from "file-saver";

// Always strip trailing slash on base, then build our own paths.
const API_BASE = (import.meta.env.VITE_API_BASE || "https://terms-api.kiri8tives.com").replace(/\/$/, "");
const BASE = `${API_BASE}/submissions`; // <-- Updated to use submissions endpoint

// normalizeImages function moved to utils/imageUtils.js

function AccomplishmentReport() {
  const [openPopup, setOpenPopup] = useState(false);
  const navigate = useNavigate();

  // --- Determine submission id from route or query (fallback to 18) ---
  const { id: idFromRoute } = useParams();
  const [sp] = useSearchParams();
  const idFromQuery = sp.get("id");
  const submissionId = useMemo(
    () => idFromRoute || idFromQuery || "18",
    [idFromRoute, idFromQuery]
  );

  // --- Auth / role ---
  const [user, setUser] = useState(null);
  const role = (user?.role || "").toLowerCase();
  const isTeacher = role === "teacher";
  const [loadingUser, setLoadingUser] = useState(true);

  // --- Form state (shared) ---
  const [narrative, setNarrative] = useState("");
  const [title, setTitle] = useState("");

  // Clean up blob URLs from existingImages
  const cleanupBlobUrls = () => {
    setExistingImages(prev => prev.filter(img => {
      if (typeof img === 'string' && img.startsWith('blob:')) return false;
      if (typeof img === 'object' && img.url && img.url.startsWith('blob:')) return false;
      return true;
    }));
  };

  // Teacher/Coordinator uploads
  const [existingImages, setExistingImages] = useState([]); // {url, filename}[]
  const [newFiles, setNewFiles] = useState([]); // File[]
  const [imagesConsolidated, setImagesConsolidated] = useState(false); // Track if images were consolidated
  const [rejectionReason, setRejectionReason] = useState(""); // Store rejection reason

  // Coordinator-only fields (not required for save here)
  const [activity, setActivity] = useState({
    activityName: "",
    facilitators: "",
    objectives: "",
    date: "",
    time: "",
    venue: "",
    keyResult: "",
    personsInvolved: "",
    expenses: "",
    lessonLearned: "",
  });

  // UI
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // NEW: track submission status and alert visibility
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [reportAssignmentId, setReportAssignmentId] = useState(null); // <-- NEW
  const [showSubmittedAlert, setShowSubmittedAlert] = useState(true);
  const [showSubmitToast, setShowSubmitToast] = useState(false);
  const [showConsolidate, setShowConsolidate] = useState(false);
  const [peerGroups, setPeerGroups] = useState([]); // [{title, images, submissions}]

  // AI Summary
  const [aiSummary, setAiSummary] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [prevNarrative, setPrevNarrative] = useState("");

  // Confirmation Modals
  const [showCoordinatorModal, setShowCoordinatorModal] = useState(false);
  const [showPrincipalModal, setShowPrincipalModal] = useState(false);

  // --- Load user for role guard ---
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setUser(data);
      } catch (err) {
        console.error("Failed to fetch user:", err);
      } finally {
        setLoadingUser(false);
      }
    })();
  }, []);

  // --- Load submission data ---
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setError("");
        setSuccess("");

        const res = await fetch(`${BASE}/${submissionId}`, { credentials: "include" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`GET ${submissionId} failed: ${res.status} ${text}`);
        }
        const data = await res.json();

        const n =
          data?.narrative ??
          data?.fields?._answers?.narrative ??
          data?.fields?.narrative ??
          data?.fields?.text ??
          "";

        const t =
          data?.title ??
          data?.fields?._answers?.title ??
          data?.assignment_title ??
          "";

        const imgs =
          data?.images ??
          data?.fields?._answers?.images ??
          data?.fields?.images ??
          data?.fields?.photos ??
          [];

        const statusFromApi =
          data?.status ??
          data?.fields?.status ??
          null;

        if (!alive) return;
        setNarrative(String(n || ""));
        setTitle(String(t || ""));
        
        // Only set images if they haven't been consolidated recently
        if (!imagesConsolidated) {
          setExistingImages(normalizeImages(imgs));
        }
        
        setSubmissionStatus(statusFromApi);
        setReportAssignmentId(data?.report_assignment_id ?? null); // <-- NEW

        // Prefill coordinator fields from the _answers object
        const answers = data?.fields?._answers || {};
        console.log('Loading submission data:', {
          fields: data?.fields,
          answers: answers,
          assignment_title: data?.assignment_title
        });
        
        setActivity((prev) => ({
          ...prev,
          activityName: answers.activityName || "",
          facilitators: answers.facilitators || "",
          objectives: answers.objectives || "",
          date: answers.date || "",
          time: answers.time || "",
          venue: answers.venue || "",
          keyResult: answers.keyResult || "",
          personsInvolved: answers.personsInvolved || "",
          expenses: answers.expenses || "",
          lessonLearned: answers.lessonLearned || "",
        }));

        // Load rejection reason if the submission was rejected
        const rejectionReason = data?.fields?.rejection_reason || answers.rejection_reason || "";
        console.log('Loading rejection reason:', {
          submissionStatus: statusFromApi,
          dataFields: data?.fields,
          answers: answers,
          rejectionReason: rejectionReason,
          isRejected: statusFromApi === 4
        });
        setRejectionReason(rejectionReason);

      } catch (e) {
        if (!alive) return;
        setError(e.message || "Failed to load submission");
      }
    })();
    return () => {
      alive = false;
    };
  }, [submissionId]);

  // Auto-hide submit toast after a short delay
  useEffect(() => {
    if (!showSubmitToast) return;
    const timer = setTimeout(() => setShowSubmitToast(false), 5000);
    return () => clearTimeout(timer);
  }, [showSubmitToast]);

  // Clean up blob URLs on component mount
  useEffect(() => {
    cleanupBlobUrls();
  }, []);

  // --- Handlers ---
  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setNewFiles((prev) => prev.concat(files));
    e.target.value = "";
  };

  const removeNewFileAt = (idx) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  // Validation function
  const validateForm = () => {
    const errors = [];
    
    // Check if narrative is empty or too short
    if (!narrative || narrative.trim().length < 10) {
      errors.push("Narrative must be at least 10 characters long");
    }
    
    // Check if there are no images (both existing and new)
    if (existingImages.length === 0 && newFiles.length === 0) {
      errors.push("At least one image is required");
    }
    
    return errors;
  };

  const onSubmit = async (e) => {
    e?.preventDefault?.();

    // Allow editing if status is 4 (rejected) - rejected reports can be edited
    if (isTeacher && submissionStatus >= 2 && submissionStatus !== 4) {
      setError("This report has already been submitted to the coordinator.");
      return;
    }

    // Validate form before saving
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      toast.error(validationErrors.join(". "));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fd = new FormData();
      fd.append("narrative", narrative);
      fd.append("title", title);
      
      // Include existing images (including consolidated ones) in the submission
      if (existingImages.length > 0) {
        fd.append("existingImages", JSON.stringify(existingImages));
      }
      
      for (const f of newFiles) fd.append("images", f);

      const res = await fetch(`${BASE}/${submissionId}/formdata`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`PATCH ${submissionId} failed: ${res.status} ${text}`);
      }

      // Get the updated submission data from the server response
      const responseData = await res.json().catch(() => ({}));
      console.log('Save response data:', responseData);
      
      if (newFiles.length) {
        // The server should have processed the uploads and returned proper URLs
        // If the server returns image URLs, use those; otherwise use blob URLs temporarily
        if (responseData.images && Array.isArray(responseData.images)) {
          console.log('Server returned images:', responseData.images);
          const serverImages = responseData.images.slice(-newFiles.length); // Get the newly uploaded images
          console.log('Using server images:', serverImages);
          setExistingImages((prev) => prev.concat(serverImages));
        } else {
          console.log('No server images returned, using blob URLs as fallback');
          // Fallback to blob URLs if server doesn't return proper URLs
          const appended = newFiles.map((f) => ({
            url: URL.createObjectURL(f),
            filename: f.name,
          }));
          setExistingImages((prev) => prev.concat(appended));
        }
        setNewFiles([]);
        setImagesConsolidated(false); // Reset flag when new images are added
      }

      setSuccess("Saved!");
      toast.success("Report saved successfully!");
    } catch (e2) {
      setError(e2.message || "Save failed");
      toast.error(e2.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onSubmitToCoordinator = async () => {
    // Allow resubmission for rejected reports (status 4)
    if (submissionStatus >= 2 && submissionStatus !== 4) {
      setError("This report is already submitted to the coordinator.");
      return;
    }

    // Validate form before submitting to coordinator
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      toast.error(validationErrors.join(". "));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fd = new FormData();
      fd.append("narrative", narrative);
      fd.append("title", title);
      fd.append("status", "2");
      
      // Include existing images (including consolidated ones) in the submission
      if (existingImages.length > 0) {
        fd.append("existingImages", JSON.stringify(existingImages));
      }
      
      for (const f of newFiles) fd.append("images", f);

      const res = await fetch(`${BASE}/${submissionId}/formdata`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Submit failed: ${res.status} ${text}`);
      }

      // Get the updated submission data from the server response
      const responseData = await res.json().catch(() => ({}));

      // Capture values that are being sent to the coordinator for display
      const imagesCount = newFiles.length;

      if (newFiles.length) {
        // Use server URLs if available, otherwise fallback to blob URLs
        if (responseData.images && Array.isArray(responseData.images)) {
          const serverImages = responseData.images.slice(-newFiles.length);
          setExistingImages((prev) => prev.concat(serverImages));
        } else {
          const appended = newFiles.map((f) => ({ url: URL.createObjectURL(f), filename: f.name }));
          setExistingImages((prev) => prev.concat(appended));
        }
        setNewFiles([]);
        setImagesConsolidated(false); // Reset flag when new images are added
      }

      setSuccess("Report submitted to coordinator successfully!");
      setSubmissionStatus(2);
      setShowSubmitToast(true);
      toast.success("Report submitted to coordinator successfully!");

      // Show an alert summarizing what was passed to the coordinator
      try {
        const payloadPreview = {
          submissionId,
          status: 2,
          narrativePreview: (narrative || "").slice(0, 100),
          imagesCount,
          reportAssignmentId,
        };
        console.log(`Submitted to Coordinator:`, payloadPreview);
      } catch (_) {
        // no-op if alert construction fails
      }
    } catch (e2) {
      setError(e2.message || "Submit failed");
      toast.error(e2.message || "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  const handleCoordinatorConfirmation = () => {
    setShowCoordinatorModal(true);
  };

  const handleCoordinatorSubmit = async () => {
    setShowCoordinatorModal(false);
    await onSubmitToCoordinator();
  };

  const onGenerate = () => {
    alert("Generate Report: hook this to your generator when ready.");
  };
  // Export functionality for Word document
  // --- REPLACE YOUR exportToWord WITH THIS VERSION (2 images per row) ---
const exportToWord = async (submissionData) => {
  if (!submissionData || !submissionData.fields) {
    alert("No data available to export");
    return;
  }

  const fields = submissionData.fields;
  const answers = fields._answers || {};
  const activity = answers;

  // Normalize orientation via canvas (browser applies EXIF on decode)
  const normalizeImageForDocx = async (imageUrl, targetHeight = 150, maxWidth = 220) => {
    try {
      const res = await fetch(imageUrl, { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);

      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = objUrl;
      });

      const aspect = img.width && img.height ? img.width / img.height : 4 / 3;
      const height = targetHeight;
      const width = Math.min(Math.round(aspect * height), maxWidth);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      const outBlob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.92));
      URL.revokeObjectURL(objUrl);
      if (!outBlob) return null;

      return { buffer: new Uint8Array(await outBlob.arrayBuffer()), width, height };
    } catch (e) {
      console.error("normalizeImageForDocx error:", e);
      return null;
    }
  };

  // Build absolute URLs for stored images
  const imageItems = (answers.images || [])
    .map((img) => {
      if (typeof img === "string") return `${API_BASE}/uploads/accomplishments/${img}`;
      if (img?.url) return img.url.startsWith("/") ? `${API_BASE}${img.url}` : img.url;
      if (img?.filename) return `${API_BASE}/uploads/accomplishments/${img.filename}`;
      return null;
    })
    .filter(Boolean);

  const normalized = await Promise.all(imageItems.map((u) => normalizeImageForDocx(u, 150, 220)));
  const validImages = normalized.filter(Boolean);

  // === Build a small inner table: 2 images per row ===
  const makeTwoPerRowImageTable = () => {
    if (!validImages.length) {
      return new Paragraph({
        children: [new TextRun({ text: "No images provided", italics: true })],
      });
    }

    const rows = [];
    const gapWidthDXA = 240; // ~ 0.17 inch gap (tweak as needed)

    for (let i = 0; i < validImages.length; i += 2) {
      const left = validImages[i];
      const right = validImages[i + 1]; // may be undefined for odd count

      const cells = [
        new TableCell({
          borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new ImageRun({ data: left.buffer, transformation: { width: left.width, height: left.height } })],
            }),
          ],
        }),
      ];

      if (right) {
        // gap cell
        cells.push(
          new TableCell({
            width: { size: gapWidthDXA, type: WidthType.DXA },
            borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
            children: [new Paragraph({})],
          })
        );
        // right image cell
        cells.push(
          new TableCell({
            borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new ImageRun({ data: right.buffer, transformation: { width: right.width, height: right.height } })],
              }),
            ],
          })
        );
      }

      rows.push(new TableRow({ children: cells }));
    }

    return new Table({
      rows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: { top: { size: 0 }, bottom: { size: 0 }, left: { size: 0 }, right: { size: 0 } },
      alignment: AlignmentType.CENTER,
    });
  };

  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({ children: [new TextRun({ text: "Republic of the Philippines", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Department of Education", bold: true, size: 24 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Region III", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Schools Division of Bulacan", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ children: [new TextRun({ text: "Tuktukan Elementary School", bold: true, size: 20 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "ACTIVITY COMPLETION REPORT 2024-2025", bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),

            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    new TableCell({
                      width: { size: 30, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Title:", bold: true })] })],
                    }),
                    new TableCell({
                      width: { size: 70, type: WidthType.PERCENTAGE },
                      children: [new Paragraph({ children: [new TextRun({ text: activity.activityName || "Not provided" })] })],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Facilitator/s:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.facilitators || "Not provided" })] })] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Objectives:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.objectives || "Not provided" })] })] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Program/Activity Design:", bold: true })] })] }),
                    new TableCell({
                      children: [
                        new Paragraph({ children: [new TextRun({ text: `Date: ${activity.date || "Not provided"}` })] }),
                        new Paragraph({ children: [new TextRun({ text: `Time: ${activity.time || "Not provided"}` })] }),
                        new Paragraph({ children: [new TextRun({ text: `Venue: ${activity.venue || "Not provided"}` })] }),
                        new Paragraph({ children: [new TextRun({ text: `Key Results: ${activity.keyResult || "Not provided"}` })] }),
                      ],
                    }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Person/s Involved:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.personsInvolved || "Not provided" })] })] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Expenses:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.expenses || "Not provided" })] })] }),
                  ],
                }),
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Lessons Learned/Recommendation:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: activity.lessonLearned || "Not provided" })] })] }),
                  ],
                }),

                // Picture/s row (2 images per row)
                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Picture/s:", bold: true })] })] }),
                    new TableCell({ children: [makeTwoPerRowImageTable()] }),
                  ],
                }),

                new TableRow({
                  children: [
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Narrative:", bold: true })] })] }),
                    new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: answers.narrative || "No narrative provided" })] })] }),
                  ],
                }),
              ],
            }),

            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Activity Completion Report prepared by:", bold: true })] }),
            new Paragraph({ text: "" }),
            new Paragraph({ children: [new TextRun({ text: "Name: [Signature Name]", bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: "Position: [Position Title]", bold: true })] }),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const fileName = `Activity_Completion_Report_${activity.activityName?.replace(/[^a-zA-Z0-9]/g, "_") || "Report"}.docx`;
    saveAs(blob, fileName);
  } catch (err) {
    console.error("Error generating Word document:", err);
    alert("Error generating document. Please try again.");
  }
};
  const onSubmitToPrincipal = async () => {
    // Allow resubmission for rejected reports (status 4)
    if (submissionStatus >= 2 && submissionStatus !== 4) {
      setError("This report is already submitted to the principal.");
      return;
    }

    // Validate form before submitting to principal
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(". "));
      toast.error(validationErrors.join(". "));
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const fd = new FormData();
      fd.append("narrative", narrative);
      fd.append("title", title);
      fd.append("status", "2"); // Set status to completed (ready for principal review)
      
      // Add coordinator activity data
      fd.append("activityName", activity.activityName);
      fd.append("facilitators", activity.facilitators);
      fd.append("objectives", activity.objectives);
      fd.append("date", activity.date);
      fd.append("time", activity.time);
      fd.append("venue", activity.venue);
      fd.append("keyResult", activity.keyResult);
      fd.append("personsInvolved", activity.personsInvolved);
      fd.append("expenses", activity.expenses);
      fd.append("lessonLearned", activity.lessonLearned);
      
      // Include existing images (including consolidated ones) in the submission
      if (existingImages.length > 0) {
        fd.append("existingImages", JSON.stringify(existingImages));
      }
      
      for (const f of newFiles) fd.append("images", f);

      const res = await fetch(`${BASE}/${submissionId}/formdata`, {
        method: "PATCH",
        body: fd,
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Submit to principal failed: ${res.status} ${text}`);
      }

      if (newFiles.length) {
        const appended = newFiles.map((f) => ({ url: URL.createObjectURL(f), filename: f.name }));
        setExistingImages((prev) => prev.concat(appended));
        setNewFiles([]);
        setImagesConsolidated(false); // Reset flag when new images are added
      }

      setSuccess("Report submitted to principal successfully!");
      setSubmissionStatus(2);
      setShowSubmitToast(true);
      toast.success("Report submitted to principal successfully!");
    } catch (e2) {
      setError(e2.message || "Submit to principal failed");
      toast.error(e2.message || "Submit to principal failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePrincipalConfirmation = () => {
    setShowPrincipalModal(true);
  };

  const handlePrincipalSubmit = async () => {
    setShowPrincipalModal(false);
    await onSubmitToPrincipal();
  };

  const onSubmitFinal = () => onSubmit(); // reuse for now

  const openConsolidate = async () => {
    setError("");
    setSuccess("");
    try {
      // Use report_assignment_id so we fetch peers from the correct assignment
      const url = reportAssignmentId
        ? `${API_BASE}/reports/accomplishment/${submissionId}/peers?ra=${encodeURIComponent(reportAssignmentId)}`
        : `${API_BASE}/reports/accomplishment/${submissionId}/peers`;
      
      console.log("[Consolidate] DEBUG - Request details:");
      console.log("- submissionId:", submissionId);
      console.log("- reportAssignmentId:", reportAssignmentId);
      console.log("- URL:", url);
      
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Failed to load peers: ${res.status} ${txt}`);
      }
      const data = await res.json();
      try {
        console.log("[Consolidate] peers response:", data);
        console.log("[Consolidate] peers response (pretty):\n" + JSON.stringify(data, null, 2));
        console.log("[Consolidate] response length:", Array.isArray(data) ? data.length : "not an array");
      } catch (_) { /* noop */ }
      
      setPeerGroups(Array.isArray(data) ? data : []);
      setShowConsolidate(true);
    } catch (e) {
setError(e.message || "Failed to load peers");
    }
  };

  const consolidateByTitle = async (title) => {
    try {
      const res = await fetch(`${API_BASE}/reports/accomplishment/${submissionId}/consolidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Consolidate failed: ${res.status} ${txt}`);
      }
      const out = await res.json();
      console.log('Consolidate response:', out);
      console.log('Consolidate images:', out.images);
      console.log('Normalized images:', normalizeImages(out.images || []));
      
      const normalizedImages = normalizeImages(out.images || []);
      setExistingImages(normalizedImages);
      setImagesConsolidated(true); // Mark that images were consolidated
      console.log('Set existingImages to:', normalizedImages);
      setSuccess(`Consolidated ${out.count || (out.images||[]).length} images into this report.`);
      setShowConsolidate(false);
    } catch (e) {
      setError(e.message || "Consolidate failed");
    }
  };

  const summarizePeers = async (groupTitle) => {
		try {
			setAiLoading(true);
			setAiSummary("");
			setError("");
			// find group
			const g = peerGroups.find(pg => pg.title === groupTitle);
			const narratives = (g?.submissions || []).map(s => {
				const f = parseFields(s);
				return String(f.narrative || f.text || "");
			}).filter(t => t && t.trim());
			if (!narratives.length && !reportAssignmentId && !(g?.submissions?.[0]?.report_assignment_id)) {
				setError("No narratives found in this group to summarize.");
				setAiLoading(false);
				return;
			}
			const payload = {
				narratives,
				report_assignment_id: reportAssignmentId || (g?.submissions?.[0]?.report_assignment_id)
			};
			const r = await fetch(`${API_BASE}/ai/summarize`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});
			if (!r.ok) {
				let msg = '';
				try { const j = await r.json(); msg = j?.error || JSON.stringify(j); } catch { msg = await r.text().catch(()=> ''); }
				throw new Error(msg || `AI summarize failed (${r.status})`);
			}
			const j = await r.json();
			setAiSummary(j.summary || "");
		} catch (e) {
			setError(e.message || 'AI summarize failed');
		} finally {
			setAiLoading(false);
		}
	};

	const insertSummaryIntoNarrative = () => {
		setPrevNarrative(narrative);
		setNarrative(aiSummary);
	};

	const undoInsertSummary = () => {
		if (prevNarrative) setNarrative(prevNarrative);
	};

  // Helper: safely parse submission.fields which may be a JSON string
  const parseFields = (s) => {
    let f = s?.fields;
    if (typeof f === 'string') { try { f = JSON.parse(f); } catch { f = {}; } }
    if (!f || typeof f !== 'object') f = {};
    return f;
  };

  if (loadingUser) {
    return (
      <div className="dashboard-content">
        <div className="dashboard-main">
          <h2>Accomplishment Report</h2>
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header userText={user ? user.name : "Guest"} />
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
            {isTeacher ? (
              <>
                <div className="buttons">
                  <button onClick={onGenerate}>Generate Report</button>

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
                        <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                          <label htmlFor="fileInput" className="file-upload-label">
                            Click here to upload a file
                          </label>
                          <input
                            id="fileInput"
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleFiles}
                          />
                          <button type="submit">Upload</button>
                        </form>
                      </div>
                    </div>
                  )}

                  <button onClick={() => exportToWord(submission)}>Export</button>
                  <button onClick={onSubmit} disabled={saving || (submissionStatus >= 2 && submissionStatus !== 4)}>
                    {saving ? "Saving…" : "Save Draft"}
                  </button>
                  <button
                    onClick={handleCoordinatorConfirmation}
                    disabled={saving || (submissionStatus >= 2 && submissionStatus !== 4)}
                    className="submit-button"
                  >
                    {saving ? "Submitting…" : "Submit to Coordinator"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="buttons">
                  <button onClick={onGenerate}>Generate Report</button>
                  <button onClick={() => setOpenPopup(true)}>Upload Images</button>
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
                        <form className="import-form" onSubmit={(e) => e.preventDefault()}>
                          <label htmlFor="fileInput" className="file-upload-label">
                            Click here to upload a file
                          </label>
                          <input
                            id="fileInput"
                            type="file"
                            multiple
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={handleFiles}
                          />
                          <button type="submit">Upload</button>
                        </form>
                      </div>
                    </div>
                  )}

                  <button onClick={exportToWord}>Export</button>
                  <button onClick={handlePrincipalConfirmation} disabled={saving || (submissionStatus >= 2 && submissionStatus !== 4)}>
                    {saving ? "Submitting…" : "Submit to Principal"}
                  </button>
                  <button onClick={openConsolidate}>Consolidate</button>
                </div>
              </>
            )}

            <div className="accomplishment-report-container">
              <h3>Activity Completion Report</h3>

              {isTeacher && submissionStatus >= 2 && submissionStatus !== 4 && showSubmittedAlert && (
                <div
                  className="alert info"
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    border: "1px solid #93c5fd",
                    background: "#dbeafe",
                    color: "#1e40af",
                    borderRadius: 8,
                    fontSize: 14
                  }}
                >
                  <span>
                    ✅ This submission has been <strong>sent to the Coordinator</strong>. Further edits are disabled.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSubmittedAlert(false)}
                    style={{
                      marginLeft: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "#1e40af"
                    }}
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}

              {isTeacher && submissionStatus === 4 && showSubmittedAlert && (
                <div
                  className="alert warning"
                  style={{
                    marginBottom: 12,
                    padding: "12px 16px",
                    border: "1px solid #dc2626",
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 8,
                    fontSize: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", marginBottom: "8px", display: "flex", alignItems: "center" }}>
                        ⚠️ <span style={{ marginLeft: "6px" }}>Report Rejected</span>
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        This submission has been <strong>rejected</strong>. Please review the feedback below and make necessary changes. You can now edit this report.
                      </div>
                      {rejectionReason ? (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#7f1d1d"
                        }}>
                          <strong>Feedback:</strong> {rejectionReason}
                        </div>
                      ) : (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#7f1d1d"
                        }}>
                          <strong>No specific feedback provided.</strong> Please review the report and make necessary improvements.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSubmittedAlert(false)}
                      style={{
                        marginLeft: 12,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 16,
                        color: "#991b1b",
                        padding: "4px"
                      }}
                      aria-label="Dismiss"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}

              {!isTeacher && submissionStatus >= 2 && submissionStatus !== 4 && showSubmittedAlert && (
                <div
                  className="alert info"
                  style={{
                    marginBottom: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    border: "1px solid #93c5fd",
                    background: "#dbeafe",
                    color: "#1e40af",
                    borderRadius: 8,
                    fontSize: 14
                  }}
                >
                  <span>
                    ✅ This submission has been <strong>sent to the Principal</strong> for approval. Further edits are disabled.
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSubmittedAlert(false)}
                    style={{
                      marginLeft: 12,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 16,
                      color: "#1e40af"
                    }}
                    aria-label="Dismiss"
                    title="Dismiss"
                  >
                    ×
                  </button>
                </div>
              )}

              {!isTeacher && submissionStatus === 4 && showSubmittedAlert && (
                <div
                  className="alert warning"
                  style={{
                    marginBottom: 12,
                    padding: "12px 16px",
                    border: "1px solid #dc2626",
                    background: "#fef2f2",
                    color: "#991b1b",
                    borderRadius: 8,
                    fontSize: 14
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "bold", marginBottom: "8px", display: "flex", alignItems: "center" }}>
                        ⚠️ <span style={{ marginLeft: "6px" }}>Report Rejected by Principal</span>
                      </div>
                      <div style={{ marginBottom: "8px" }}>
                        This submission has been <strong>rejected by the Principal</strong>. Please review the feedback below and make necessary changes. You can now edit this report.
                      </div>
                      {rejectionReason ? (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#7f1d1d"
                        }}>
                          <strong>Principal's Feedback:</strong> {rejectionReason}
                        </div>
                      ) : (
                        <div style={{
                          padding: "8px 12px",
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          fontSize: "13px",
                          color: "#7f1d1d"
                        }}>
                          <strong>No specific feedback provided.</strong> Please review the report and make necessary improvements.
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSubmittedAlert(false)}
                      style={{
                        marginLeft: 12,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontSize: 16,
                        color: "#991b1b",
                        padding: "4px"
                      }}
                      aria-label="Dismiss"
                      title="Dismiss"
                    >
                      ×
                    </button>
                  </div>
                </div>
              )}


              <form onSubmit={onSubmit}>
                {isTeacher ? (
                  <>
                    {/* TEACHER VIEW */}
                    <div className="form-row">
                      <label htmlFor="teacherTitle">Title:</label>
                      <input 
                        type="text" 
                        id="teacherTitle"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        required 
                        disabled={submissionStatus >= 2 && submissionStatus !== 4} 
                      />
                    </div>
                    <div className="form-row">
                      <label htmlFor="teacherPictures">Upload Image(s):</label>
                      <input
                        type="file"
                        id="teacherPictures"
                        name="teacherPictures"
                        accept="image/*"
                        multiple
                        onChange={handleFiles}
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    {(existingImages.length > 0 || newFiles.length > 0) && (
                      <div className="thumbs">
                        {existingImages.map((img, index) => (
                          <div key={img.url + img.filename} className="thumb">
                            <img src={img.url} alt={img.filename} />
                            <button
                              type="button"
                              className="remove-image-btn"
                              onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== index))}
                              title="Remove image"
                            >
                              X
                            </button>
                          </div>
                        ))}
                        {newFiles.map((f, i) => (
                          <div key={`new-${i}`} className="thumb">
                            <img src={URL.createObjectURL(f)} alt={f.name} />
                            <div className="thumb-meta">
                              <button
                                type="button"
                                className="btn tiny"
                                onClick={() => removeNewFileAt(i)}
                                disabled={submissionStatus >= 2 && submissionStatus !== 4}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-row">
                      <label htmlFor="teacherNarrative">Narrative:</label>
                      <textarea
                        id="teacherNarrative"
                        name="teacherNarrative"
                        rows="6"
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* COORDINATOR VIEW */}
                    <div className="form-row">
                      <label htmlFor="activityName">Program/Activity Title:</label>
                      <input
                        type="text"
                        id="activityName"
                        name="activityName"
                        value={activity.activityName}
                        onChange={(e) => setActivity((p) => ({ ...p, activityName: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="facilitators">Facilitator/s:</label>
                      <input
                        type="text"
                        id="facilitators"
                        name="facilitators"
                        value={activity.facilitators}
                        onChange={(e) => setActivity((p) => ({ ...p, facilitators: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="objectives">Objectives:</label>
                      <input
                        type="text"
                        id="objectives"
                        name="objectives"
                        value={activity.objectives}
                        onChange={(e) => setActivity((p) => ({ ...p, objectives: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <label>Program/Activity Design:</label>
                      <div className="inner-form-row">
                        <div className="form-row">
                          <label htmlFor="date">Date:</label>
                          <input
                            type="date"
                            id="date"
                            name="date"
                            value={activity.date}
                            onChange={(e) => setActivity((p) => ({ ...p, date: e.target.value }))}
                            required
                            disabled={submissionStatus >= 2 && submissionStatus !== 4}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="time">Time:</label>
                          <input
                            type="text"
                            id="time"
                            name="time"
                            value={activity.time}
                            onChange={(e) => setActivity((p) => ({ ...p, time: e.target.value }))}
                            required
                            disabled={submissionStatus >= 2 && submissionStatus !== 4}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="venue">Venue:</label>
                          <input
                            type="text"
                            id="venue"
                            name="venue"
                            value={activity.venue}
                            onChange={(e) => setActivity((p) => ({ ...p, venue: e.target.value }))}
                            required
                            disabled={submissionStatus >= 2 && submissionStatus !== 4}
                          />
                        </div>
                        <div className="form-row">
                          <label htmlFor="keyResult">Key Results:</label>
                          <input
                            type="text"
                            id="keyResult"
                            name="keyResult"
                            value={activity.keyResult}
                            onChange={(e) => setActivity((p) => ({ ...p, keyResult: e.target.value }))}
                            required
                            disabled={submissionStatus >= 2 && submissionStatus !== 4}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-row">
                      <label htmlFor="personsInvolved">Person/s Involved</label>
                      <input
                        type="text"
                        id="personsInvolved"
                        name="personsInvolved"
                        value={activity.personsInvolved}
                        onChange={(e) => setActivity((p) => ({ ...p, personsInvolved: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="expenses">Expenses:</label>
                      <input
                        type="text"
                        id="expenses"
                        name="expenses"
                        value={activity.expenses}
                        onChange={(e) => setActivity((p) => ({ ...p, expenses: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="lessonLearned">Lesson Learned/Recommendation:</label>
                      <textarea
                        id="lessonLearned"
                        name="lessonLearned"
                        rows="4"
                        value={activity.lessonLearned}
                        onChange={(e) => setActivity((p) => ({ ...p, lessonLearned: e.target.value }))}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                        placeholder="Enter lessons learned and recommendations from this activity"
                      />
                    </div>

                    <div className="form-row">
                      <label htmlFor="coordPictures">Picture/s:</label>
                      <input
                        type="file"
                        id="coordPictures"
                        name="coordPictures"
                        accept="image/*"
                        multiple
                        onChange={handleFiles}
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    {(existingImages.length > 0 || newFiles.length > 0) && (
                      <div className="thumbs">
                        {existingImages
                          .filter(img => {
                            // Filter out blob URLs from display
                            if (typeof img === 'string' && img.startsWith('blob:')) return false;
                            if (typeof img === 'object' && img.url && img.url.startsWith('blob:')) return false;
                            return true;
                          })
                          .map((img, index) => {
                            // Use proper image URL and unique key
                            const imageUrl = getImageUrl(img);
                            const uniqueKey = img.filename || `img-${index}`;
                            
                            console.log('Displaying image:', { img, imageUrl, uniqueKey });
                            
                            return (
                              <div key={uniqueKey} className="thumb">
                                <img 
                                  src={imageUrl} 
                                  alt={img.filename}
                                  onError={(e) => {
                                    console.error('Image failed to load:', imageUrl);
                                    console.error('Image object:', img);
                                  }}
                                />
                                <button
                                  type="button"
                                  className="remove-image-btn"
                                  onClick={() => setExistingImages(prev => prev.filter((_, i) => i !== index))}
                                  title="Remove image"
                                >
                                  ×
                                </button>
                              </div>
                            );
                          })}
                        {newFiles.map((f, i) => (
                          <div key={`new-${i}-${f.name}`} className="thumb">
                            <img src={URL.createObjectURL(f)} alt={f.name} />
                            <div className="thumb-meta">
                              <button
                                type="button"
                                className="btn tiny"
                                onClick={() => removeNewFileAt(i)}
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="form-row">
                      <label htmlFor="narrative">Narrative:</label>
                      <textarea
                        id="narrative"
                        name="narrative"
                        rows="6"
                        value={narrative}
                        onChange={(e) => setNarrative(e.target.value)}
                        required
                        disabled={submissionStatus >= 2 && submissionStatus !== 4}
                      />
                    </div>

                    <div className="form-row">
                      <button className="btn primary" disabled={saving || (submissionStatus >= 2 && submissionStatus !== 4)}>
                        {saving ? "Saving…" : "Save Changes"}
                      </button>
                    </div>
                  </>
                )}

                {isTeacher && (
                  <div className="form-row">
                    <button className="btn primary" disabled={saving || (submissionStatus >= 2 && submissionStatus !== 4)}>
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {showConsolidate && (
        <div className="modal-overlay">
          <div className="import-popup" style={{ maxWidth: 800, width: "90%" }}>
            <div className="popup-header">
              <h2>Consolidate Accomplishment Reports</h2>
              <button className="close-button" onClick={() => setShowConsolidate(false)}>X</button>
            </div>
            <hr />
            {!!error && (
              <div style={{ marginBottom: 10, color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', padding: 8, borderRadius: 6 }}>
                {error}
              </div>
            )}
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {peerGroups.length === 0 ? (
                <p style={{ opacity: 0.8 }}>No submitted peer reports to consolidate.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Title</th>
                      <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #e5e7eb" }}>Images</th>
                      <th style={{ padding: 8, borderBottom: "1px solid #e5e7eb" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {peerGroups.map((g, i) => {
                      const extractNarrative = (submission) => {
                        const f = parseFields(submission) || {};
                        const form = f._form || {};
                        const inner = form.fields || {};
                        const t = submission?.narrative
                          || submission?.text
                          || f.narrative
                          || f.text
                          || form.narrative
                          || form.text
                          || inner.narrative
                          || inner.text
                          || "";
                        return String(t).trim();
                      };

                      const hasNarr = (g?.submissions || []).some(s => !!extractNarrative(s));

                      const narrativeCount = (g?.submissions || []).reduce((count, s) => {
                        return count + (extractNarrative(s) ? 1 : 0);
                      }, 0);

                      // Calculate image count from all submissions in this group
                      const imageCount = (g?.submissions || []).reduce((count, s) => {
                        const f = parseFields(s) || {};
                        const answers = f._answers || {};
                        const images = answers.images || [];
                        console.log('Submission images:', { submission: s, fields: f, answers, images });
                        return count + images.length;
                      }, 0);

                      const narrativePreviews = (g?.submissions || []).map((s) => {
                        const t = extractNarrative(s);
                        if (!t) return "";
                        const trimmed = t.replace(/\s+/g, " ");
                        return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
                      }).filter(Boolean);
                      return (
                        <tr key={g.title + i}>
                          <td style={{ padding: 8, verticalAlign: "top" }}>
                            <strong>{g.title}</strong>
                            <div style={{ opacity: 0.7, fontSize: 12 }}>
                              {(g.submissions?.length || 0)} submission(s)
                              {narrativeCount ? ` \u2022 ${narrativeCount} narrative(s)` : ""}
                            </div>
                            {narrativePreviews.length > 0 && (
                              <div style={{ marginTop: 6, maxHeight: 96, overflowY: 'auto', paddingRight: 4 }}>
                                {narrativePreviews.slice(0, 3).map((p, idx) => (
                                  <div key={idx} style={{ fontSize: 12, color: '#334155', lineHeight: 1.4, marginBottom: 4 }}>
                                    — {p}
                                  </div>
                                ))}
                                {narrativePreviews.length > 3 && (
                                  <div style={{ fontSize: 12, color: '#64748b' }}>…and {narrativePreviews.length - 3} more</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: 8 }}>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                              {(g?.submissions || []).map((s, sIdx) => {
                                const f = parseFields(s) || {};
                                const answers = f._answers || {};
                                const images = (answers.images || []).filter(img => {
                                  // Filter out blob URLs (temporary local URLs) from peer groups display
                                  if (typeof img === 'string' && img.startsWith('blob:')) return false;
                                  if (typeof img === 'object' && img.url && img.url.startsWith('blob:')) return false;
                                  return true;
                                });
                                return images.map((img, imgIdx) => {
                                  const imageUrl = getImageUrl(img);
                                  if (!imageUrl) return null;
                                  
                                  return (
                                    <img 
                                      key={`${sIdx}-${imgIdx}`} 
                                      src={imageUrl} 
                                      alt={`Image ${imgIdx + 1}`} 
                                      style={{ width: 100, height: 75, objectFit: "cover", borderRadius: 4, border: "1px solid #e5e7eb" }}
                                      onError={(e) => {
                                        console.error('Image failed to load:', imageUrl);
                                        debugImageUrl(img, `Peer Group ${sIdx}-${imgIdx}`);
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  );
                                });
                              }).flat()}
                            </div>
                          </td>
                          <td style={{ padding: 8, width: 260, textAlign: "right", display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            <button className="btn" onClick={() => summarizePeers(g.title)} disabled={aiLoading || !hasNarr} title={!hasNarr ? 'No narratives to summarize in this group' : undefined}>{aiLoading ? 'Summarizing…' : 'AI Summary'}</button>
                            <button className="btn primary" onClick={() => consolidateByTitle(g.title)}>Consolidate Images ({imageCount})</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {aiSummary && (
              <div style={{ marginTop: 12, background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>AI Summary Preview</strong>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn" onClick={undoInsertSummary}>Undo</button>
                    <button className="btn primary" onClick={insertSummaryIntoNarrative}>Insert into Narrative</button>
                  </div>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{aiSummary}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={showCoordinatorModal}
        onClose={() => setShowCoordinatorModal(false)}
        onConfirm={handleCoordinatorSubmit}
        title="Submit to Coordinator"
        message={submissionStatus === 4 ? 
          "Are you sure you want to resubmit this report to the coordinator? This will send the updated report for review." :
          "Are you sure you want to submit this report to the coordinator? Once submitted, you won't be able to make changes."
        }
        confirmText={submissionStatus === 4 ? "Resubmit to Coordinator" : "Submit to Coordinator"}
        cancelText="Cancel"
        type="warning"
      />

      <ConfirmationModal
        isOpen={showPrincipalModal}
        onClose={() => setShowPrincipalModal(false)}
        onConfirm={handlePrincipalSubmit}
        title="Submit to Principal"
        message={submissionStatus === 4 ? 
          "Are you sure you want to resubmit this report to the principal? This will send the updated report for review." :
          "Are you sure you want to submit this report to the principal? Once submitted, you won't be able to make changes."
        }
        confirmText={submissionStatus === 4 ? "Resubmit to Principal" : "Submit to Principal"}
        cancelText="Cancel"
        type="warning"
      />
    </>
  );
}

export default AccomplishmentReport;

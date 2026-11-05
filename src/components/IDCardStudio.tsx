import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Printer,
  Download,
  RefreshCw,
  Search,
  Filter,
  CreditCard,
  Sparkles,
  Shield,
  Check,
  Grid
} from 'lucide-react';
import { Student, School, SchoolClass, Section } from '../types';
import { supabaseService } from '../services/supabaseService';

interface IDCardStudioProps {
  school: School;
  students: Student[];
  classes: SchoolClass[];
  sections: Section[];
  onStudentsUpdated: () => void;
}

export const IDCardStudio: React.FC<IDCardStudioProps> = ({
  school,
  students,
  classes,
  sections,
  onStudentsUpdated
}) => {
  const [selectedStudentId, setSelectedStudentId] = useState<string>(students[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [printMode, setPrintMode] = useState<'single' | 'batch_a4'>('single');
  const [qrCodeDataUrls, setQrCodeDataUrls] = useState<Record<string, string>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateSuccess, setRegenerateSuccess] = useState(false);

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch =
      student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.admission_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.roll_number.includes(searchQuery);
    const matchesClass = selectedClassId === 'all' || student.class_id === selectedClassId;
    return matchesSearch && matchesClass;
  });

  const activeStudent = students.find(s => s.id === selectedStudentId) || filteredStudents[0];

  // Generate QR code data URLs for students using qrcode library
  useEffect(() => {
    const generateQRs = async () => {
      const urls: Record<string, string> = {};
      for (const student of students) {
        if (student.qr_token) {
          try {
            const url = await QRCode.toDataURL(student.qr_token, {
              width: 256,
              margin: 1,
              color: {
                dark: '#18181B',
                light: '#FFFFFF'
              },
              errorCorrectionLevel: 'M'
            });
            urls[student.id] = url;
          } catch (err) {
            console.error('QR generation error for student:', student.id, err);
          }
        }
      }
      setQrCodeDataUrls(urls);
    };

    if (students.length > 0) {
      generateQRs();
    }
  }, [students]);

  const handleRegenerateQR = async () => {
    if (!activeStudent || isRegenerating) return;
    setIsRegenerating(true);
    setRegenerateSuccess(false);

    try {
      const res = await supabaseService.regenerateQRToken(activeStudent.id);
      if (res.success) {
        setRegenerateSuccess(true);
        onStudentsUpdated();
        setTimeout(() => setRegenerateSuccess(false), 2500);
      }
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleDownloadSingleCard = () => {
    if (!activeStudent) return;
    const canvas = document.createElement('canvas');
    const width = 1012; // 3.375" * 300 DPI
    const height = 638; // 2.125" * 300 DPI
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Header banner
    ctx.fillStyle = '#18181B';
    ctx.fillRect(0, 0, width, 140);

    // Accent line
    ctx.fillStyle = '#EA580C';
    ctx.fillRect(0, 136, width, 8);

    // School Name & Header Text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(school.name.toUpperCase(), 36, 60);

    ctx.fillStyle = '#D4D4D8';
    ctx.font = '18px "DM Sans", sans-serif';
    ctx.fillText(`ACADEMIC YEAR ${school.academic_year} · OFFICIAL STUDENT IDENTIFICATION`, 36, 100);

    // Student Info
    ctx.fillStyle = '#18181B';
    ctx.font = 'bold 38px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(activeStudent.full_name, 280, 220);

    ctx.fillStyle = '#52525B';
    ctx.font = '22px "DM Sans", sans-serif';
    ctx.fillText(`STUDENT ID: ${activeStudent.admission_number}`, 280, 270);
    ctx.fillText(`CLASS: ${activeStudent.class_name || 'Class'} (${activeStudent.section_name || 'A'})`, 280, 310);
    ctx.fillText(`ROLL NUMBER: #${activeStudent.roll_number}`, 280, 350);
    ctx.fillText(`VALID THRU: JUNE 2027`, 280, 390);

    // Photo placeholder / border
    ctx.strokeStyle = '#D4D4D8';
    ctx.lineWidth = 4;
    ctx.strokeRect(36, 170, 210, 260);
    ctx.fillStyle = '#F4F4F5';
    ctx.fillRect(38, 172, 206, 256);

    // QR Code
    const qrImg = new Image();
    const qrUrl = qrCodeDataUrls[activeStudent.id];
    if (qrUrl) {
      qrImg.src = qrUrl;
      qrImg.onload = () => {
        ctx.drawImage(qrImg, width - 240, 180, 200, 200);

        // Footer
        ctx.fillStyle = '#F4F4F5';
        ctx.fillRect(0, height - 70, width, 70);
        ctx.fillStyle = '#71717A';
        ctx.font = '16px "DM Sans", sans-serif';
        ctx.fillText(`Security Token: ${activeStudent.token_preview || 'xxxx'} · Issued by ${school.name}`, 36, height - 28);

        // Download trigger
        const link = document.createElement('a');
        link.download = `ID_Badge_${activeStudent.admission_number}_${activeStudent.full_name.replace(/\s+/g, '_')}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      };
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Studio Header & Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Institutional ID Card Studio</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              CR80 Standard
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Prestige academic badges with cryptographically secured QR codes and print-ready A4 sheets.
          </p>
        </div>

        {/* View Mode & Print Action */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Print Mode Segmented Button */}
          <div className="flex bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs">
            <button
              onClick={() => setPrintMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                printMode === 'single'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>Single Preview</span>
            </button>
            <button
              onClick={() => setPrintMode('batch_a4')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold transition ${
                printMode === 'batch_a4'
                  ? 'bg-white text-stone-900 shadow-xs'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>A4 Batch Sheet (8 Cards)</span>
            </button>
          </div>

          {printMode === 'single' ? (
            <>
              <button
                onClick={handleDownloadSingleCard}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PNG</span>
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Card</span>
              </button>
            </>
          ) : (
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print A4 Sheet (8 Badges)</span>
            </button>
          )}
        </div>
      </div>

      {/* SINGLE CARD PREVIEW MODE */}
      {printMode === 'single' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
          {/* Left Student Selector Sidebar */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-stone-200 p-4 space-y-3">
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
                <input
                  type="text"
                  placeholder="Search student by name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-stone-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Class Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-stone-200 rounded-lg bg-stone-50 text-stone-700"
                >
                  <option value="all">All Classes</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student List */}
            <div className="divide-y divide-stone-100 max-h-[460px] overflow-y-auto pr-1">
              {filteredStudents.map(student => {
                const isSelected = activeStudent?.id === student.id;
                return (
                  <button
                    key={student.id}
                    onClick={() => setSelectedStudentId(student.id)}
                    className={`w-full text-left p-2.5 rounded-lg transition flex items-center gap-3 ${
                      isSelected
                        ? 'bg-orange-50 text-orange-950 border border-orange-200'
                        : 'hover:bg-stone-50 text-stone-800'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg bg-stone-100 border border-stone-200 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-stone-500">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        student.full_name.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold truncate">{student.full_name}</p>
                      <p className="text-[11px] text-stone-500 truncate">
                        ID: {student.admission_number} · #{student.roll_number}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right ID Badge Live Interactive Card Preview */}
          <div className="lg:col-span-8 flex flex-col items-center justify-center bg-stone-100/70 rounded-2xl border border-stone-200 p-6 sm:p-10 relative">
            {activeStudent ? (
              <div className="space-y-6 flex flex-col items-center">
                {/* Prestige Institutional ID Card (CR80 Aspect Ratio) */}
                <div
                  id="cr80-single-preview"
                  className="w-[380px] sm:w-[480px] h-[240px] sm:h-[300px] bg-white rounded-2xl shadow-xl border border-stone-300 overflow-hidden flex flex-col justify-between relative"
                  style={{
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)'
                  }}
                >
                  {/* Top Academy Banner */}
                  <div className="bg-stone-900 px-5 py-3 text-white flex items-center justify-between border-b-4 border-orange-600 relative overflow-hidden">
                    {/* Subtle Security Guilloche Pattern overlay */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:8px_8px]" />

                    <div className="flex items-center gap-2.5 z-10">
                      <div className="w-8 h-8 rounded-md bg-stone-800 border border-stone-700 flex items-center justify-center text-orange-500 font-bold">
                        <Shield className="w-4 h-4 text-orange-500" />
                      </div>
                      <div>
                        <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wide font-display">
                          {school.name}
                        </h3>
                        <p className="text-[9px] text-stone-300 font-medium tracking-wider">
                          EST. 1984 · ACCREDITED INSTITUTION
                        </p>
                      </div>
                    </div>

                    <span className="text-[10px] font-mono tracking-widest text-orange-400 font-semibold z-10">
                      CR80-SEC
                    </span>
                  </div>

                  {/* Body Details Split */}
                  <div className="px-5 py-3 flex-1 flex items-center justify-between gap-4">
                    {/* Student Photo */}
                    <div className="w-24 sm:w-28 h-32 sm:h-36 rounded-xl bg-stone-100 border-2 border-stone-300 overflow-hidden shrink-0 shadow-xs flex items-center justify-center">
                      {activeStudent.photo_url ? (
                        <img
                          src={activeStudent.photo_url}
                          alt={activeStudent.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-xl font-bold text-stone-400">
                          {activeStudent.full_name.slice(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>

                    {/* Student Information */}
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div>
                        <h4 className="text-sm sm:text-base font-bold text-stone-900 leading-tight font-display truncate">
                          {activeStudent.full_name}
                        </h4>
                        <p className="text-[10px] sm:text-[11px] font-semibold text-orange-700 tracking-wider">
                          STUDENT IDENTIFICATION
                        </p>
                      </div>

                      <div className="space-y-0.5 text-[11px] sm:text-xs text-stone-700">
                        <p><span className="text-stone-400 font-medium">ID:</span> <strong className="font-mono">{activeStudent.admission_number}</strong></p>
                        <p><span className="text-stone-400 font-medium">Class:</span> <strong>{activeStudent.class_name} ({activeStudent.section_name})</strong></p>
                        <p><span className="text-stone-400 font-medium">Roll No:</span> <strong className="font-mono">#{activeStudent.roll_number}</strong></p>
                        <p><span className="text-stone-400 font-medium">Academic Year:</span> <strong>{school.academic_year}</strong></p>
                      </div>

                      <div className="pt-1 text-[9px] text-stone-400 border-t border-stone-100">
                        Valid Thru: June 2027 · Property of {school.name}
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="w-20 sm:w-24 h-20 sm:h-24 bg-white p-1 rounded-xl border border-stone-200 shrink-0 flex items-center justify-center shadow-2xs">
                      {qrCodeDataUrls[activeStudent.id] ? (
                        <img
                          src={qrCodeDataUrls[activeStudent.id]}
                          alt="Student QR Code"
                          className="w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-100 rounded flex items-center justify-center text-[9px] text-stone-400">
                          Generating QR...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Bottom Signature & Disclaimer Strip */}
                  <div className="bg-stone-50 px-5 py-1.5 border-t border-stone-200 flex items-center justify-between text-[9px] text-stone-500">
                    <span className="font-mono">Preview: {activeStudent.token_preview || 'xxxx'}</span>
                    <span className="italic font-medium">Dean of Student Affairs</span>
                  </div>
                </div>

                {/* Card Action Badges: Token Regeneration & Revocation */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleRegenerateQR}
                    disabled={isRegenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
                    <span>{isRegenerating ? 'Regenerating...' : 'Regenerate QR Token'}</span>
                  </button>

                  {regenerateSuccess && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 animate-in fade-in">
                      <Check className="w-4 h-4" /> New token active. Old token revoked.
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-stone-500">No student selected.</p>
            )}
          </div>
        </div>
      )}

      {/* BATCH A4 PRINT SHEET (Screen preview & @media print layout) */}
      {printMode === 'batch_a4' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-xs text-amber-900 flex items-center justify-between no-print">
            <div>
              <strong>A4 Batch Print Layout</strong>: 8 CR80 standard credit-card sized badges (85.6mm &times; 53.98mm) per printed page.
            </div>
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition"
            >
              Print Now (Ctrl/Cmd + P)
            </button>
          </div>

          {/* Printable 8-Card Grid Layout */}
          <div className="print-page-a4 bg-white p-6 rounded-2xl border border-stone-300 shadow-md">
            <div className="grid grid-cols-2 gap-4">
              {filteredStudents.slice(0, 8).map(student => (
                <div
                  key={student.id}
                  className="cr80-card-print border-2 border-stone-300 rounded-xl overflow-hidden bg-white flex flex-col justify-between shadow-2xs relative"
                >
                  {/* Badge Header */}
                  <div className="bg-stone-900 px-3 py-1.5 text-white flex items-center justify-between border-b-2 border-orange-600">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-orange-500" />
                      <span className="text-[10px] font-bold uppercase truncate max-w-[170px]">
                        {school.name}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-stone-300">
                      {school.academic_year}
                    </span>
                  </div>

                  {/* Badge Body */}
                  <div className="px-3 py-2 flex items-center justify-between gap-2 flex-1">
                    {/* Photo */}
                    <div className="w-16 h-20 bg-stone-100 rounded-md border border-stone-300 overflow-hidden shrink-0 flex items-center justify-center font-bold text-xs text-stone-400">
                      {student.photo_url ? (
                        <img src={student.photo_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        student.full_name.slice(0, 2).toUpperCase()
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0 space-y-0.5 text-[9px] text-stone-800">
                      <p className="font-bold text-[11px] truncate text-stone-900">
                        {student.full_name}
                      </p>
                      <p><span className="text-stone-400">ID:</span> <strong className="font-mono">{student.admission_number}</strong></p>
                      <p><span className="text-stone-400">Class:</span> <strong>{student.class_name} ({student.section_name})</strong></p>
                      <p><span className="text-stone-400">Roll:</span> <strong className="font-mono">#{student.roll_number}</strong></p>
                    </div>

                    {/* QR Code */}
                    <div className="w-16 h-16 bg-white p-0.5 rounded border border-stone-200 shrink-0">
                      {qrCodeDataUrls[student.id] && (
                        <img
                          src={qrCodeDataUrls[student.id]}
                          alt="QR"
                          className="w-full h-full"
                        />
                      )}
                    </div>
                  </div>

                  {/* Badge Footer */}
                  <div className="bg-stone-50 px-3 py-1 border-t border-stone-200 flex items-center justify-between text-[8px] text-stone-500">
                    <span className="font-mono">Token: {student.token_preview || 'xxxx'}</span>
                    <span className="italic">Authorized Badge</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

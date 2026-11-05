import React, { useState } from 'react';
import { Layers, Plus, Users, DoorOpen, Trash2, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { School, SchoolClass, Section, Student } from '../types';
import { supabaseService } from '../services/supabaseService';

interface ClassesViewProps {
  school: School;
  classes: SchoolClass[];
  sections: Section[];
  students: Student[];
  onDataUpdated: () => void;
}

export const ClassesView: React.FC<ClassesViewProps> = ({
  school,
  classes,
  sections,
  students,
  onDataUpdated
}) => {
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [selectedClassIdForSection, setSelectedClassIdForSection] = useState(classes[0]?.id || '');

  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionRoom, setNewSectionRoom] = useState('');
  const [modalError, setModalError] = useState('');

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setModalError('');
    const res = await supabaseService.addClass(
      school.id,
      newClassName.trim(),
      newClassGrade ? Number(newClassGrade) : undefined
    );
    if (!res.success) {
      setModalError(res.message);
      return;
    }
    setNewClassName('');
    setNewClassGrade('');
    setShowAddClassModal(false);
    onDataUpdated();
  };

  const handleCreateSection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    setModalError('');
    const res = await supabaseService.addSection(
      school.id,
      selectedClassIdForSection,
      newSectionName.trim(),
      newSectionRoom.trim()
    );
    if (!res.success) {
      setModalError(res.message);
      return;
    }
    setNewSectionName('');
    setNewSectionRoom('');
    setShowAddSectionModal(false);
    onDataUpdated();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 space-y-6">
      {/* Header */}
      <div className="bg-white p-5 rounded-xl border border-stone-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <span>Academic Classes & Sections</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {classes.length} Classes
            </span>
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Configure homerooms, assign student cohorts, and manage classrooms.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedClassIdForSection(classes[0]?.id || '');
              setShowAddSectionModal(true);
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold rounded-lg border border-stone-200 transition"
          >
            <Plus className="w-4 h-4 text-orange-600" />
            <span>Add Section</span>
          </button>

          <button
            onClick={() => setShowAddClassModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Class</span>
          </button>
        </div>
      </div>

      {/* Classes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {classes.map(cls => {
          const classSections = sections.filter(s => s.class_id === cls.id);
          const classStudents = students.filter(s => s.class_id === cls.id);

          return (
            <div key={cls.id} className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600 font-bold text-sm">
                    {cls.grade_level || cls.name.slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-stone-900 font-display">
                      {cls.name}
                    </h3>
                    <p className="text-[11px] text-stone-400">
                      {classStudents.length} Students Total
                    </p>
                  </div>
                </div>

                <span className="text-xs font-semibold px-2.5 py-1 bg-stone-100 rounded-md text-stone-700">
                  {classSections.length} {classSections.length === 1 ? 'Section' : 'Sections'}
                </span>
              </div>

              {/* Sections List */}
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-stone-400">
                  Assigned Sections
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {classSections.map(sec => {
                    const secStudents = students.filter(s => s.section_id === sec.id);
                    return (
                      <div
                        key={sec.id}
                        className="p-3 rounded-lg border border-stone-200 bg-stone-50/70 hover:bg-white hover:border-orange-300 transition flex items-center justify-between"
                      >
                        <div>
                          <p className="text-xs font-bold text-stone-900">{sec.name}</p>
                          <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                            <DoorOpen className="w-3 h-3 text-stone-400" />
                            <span>{sec.room_number || 'Room TBD'}</span>
                          </p>
                        </div>
                        <span className="text-xs font-mono font-semibold text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {secStudents.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD CLASS MODAL */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold font-display">Create Class</h3>
              <button onClick={() => setShowAddClassModal(false)} className="text-stone-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateClass} className="p-5 space-y-3">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {modalError}
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Class Name *</label>
                <input
                  type="text"
                  required
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Grade 11 or Kindergarten"
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Grade Level (Number)</label>
                <input
                  type="number"
                  value={newClassGrade}
                  onChange={(e) => setNewClassGrade(e.target.value)}
                  placeholder="e.g. 11"
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddClassModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-md shadow-xs"
                >
                  Create Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SECTION MODAL */}
      {showAddSectionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
              <h3 className="text-base font-bold font-display">Add Section</h3>
              <button onClick={() => setShowAddSectionModal(false)} className="text-stone-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSection} className="p-5 space-y-3">
              {modalError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                  {modalError}
                </div>
              )}
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Select Class *</label>
                <select
                  value={selectedClassIdForSection}
                  onChange={(e) => setSelectedClassIdForSection(e.target.value)}
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg bg-stone-50"
                >
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Section Name *</label>
                <input
                  type="text"
                  required
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  placeholder="e.g. Section C"
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase text-stone-600">Room Number</label>
                <input
                  type="text"
                  value={newSectionRoom}
                  onChange={(e) => setNewSectionRoom(e.target.value)}
                  placeholder="e.g. Science Wing 204"
                  className="w-full mt-1 px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowAddSectionModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600 hover:bg-stone-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white rounded-md shadow-xs"
                >
                  Add Section
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

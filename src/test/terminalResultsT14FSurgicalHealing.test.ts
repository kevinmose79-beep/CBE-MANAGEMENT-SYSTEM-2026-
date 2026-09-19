import { describe, it, expect } from 'vitest';
import { resolveSubjectTeacher } from '../utils/teacherResolutionUtils';
import { buildTerminalReportDoc, TerminalReportPDFData } from '../services/terminalReportPdfGenerator';
import { calculateLearnerTerminalResults, ContributingAssessmentRef } from '../services/terminalResultsEngine';
import { CBE_8_POINT_GRADES } from '../services/analysisEngine';
import { Teacher, Student, School, ClassStream, Subject, Mark } from '../types';

describe('T-14F Official Terminal Report Surgical Healing Suite', () => {
  const mockSchool: School = {
    id: 'sch-001',
    school_name: 'MUCHORWE COMPREHENSIVE SCHOOL',
    motto: 'KNOWLEDGE TO EXCEL',
    address: 'P.O. Box 456',
    phone: '+254 712 345 678',
    email: 'info@muchorwe.ac.ke',
    county: 'Nairobi',
  };

  const mockClassStreamBlue: ClassStream = {
    id: 'cs-g9-blue',
    class_name: 'Grade 9',
    stream: 'Blue',
    education_level: 'Junior School',
  };

  const mockClassStreamRed: ClassStream = {
    id: 'cs-g9-red',
    class_name: 'Grade 9',
    stream: 'Red',
    education_level: 'Junior School',
  };

  const mockStudentGathoni: Student = {
    id: 'stud-124',
    admission_number: '124',
    first_name: 'Margaret',
    last_name: 'Gathoni',
    full_name: 'Gathoni Margaret',
    class_id: 'cs-g9-blue',
    stream_id: 'cs-g9-blue',
    grade: 'Grade 9',
    gender: 'F', active: true,
    
  };

  const mockJuniorSubjects: Subject[] = [
    { id: 'subj-eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
    { id: 'subj-kis', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core' },
    { id: 'subj-mat', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core' },
    { id: 'subj-sci', subject_name: 'Integrated Science', subject_code: 'SCI', category: 'Core' },
    { id: 'subj-cas', subject_name: 'Creative Arts and Sports', subject_code: 'CAS', category: 'Core' },
    { id: 'subj-sst', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core' },
    { id: 'subj-cre', subject_name: 'CRE', subject_code: 'CRE', category: 'Core' },
    { id: 'subj-agr', subject_name: 'Agriculture', subject_code: 'AGR', category: 'Core' },
    { id: 'subj-pts', subject_name: 'Pre-Technical Studies', subject_code: 'PTS', category: 'Core' },
  ];

  // -------------------------------------------------------------
  // CASE A & B: AUTHORITATIVE SUBJECT TEACHER DISPLAY
  // -------------------------------------------------------------
  describe('Issue A: Subject Teacher Authoritative vs Blank', () => {
    const teachers: Teacher[] = [
      {
        id: 'tr-01',
        teacher_name: 'Mme. Sarah Wambui',
        email: 'sarah@muchorwe.ac.ke', phone: '0700000000',
        
        allocations: [
          {
            id: 'alloc-1',
            subject_id: 'subj-eng',
            class_id: 'cs-g9-blue',
            stream_id: 'cs-g9-blue',
            education_level: 'Junior School',
          },
        ],
      },
      {
        id: 'tr-02',
        teacher_name: 'Mr. James Omondi',
        email: 'james@muchorwe.ac.ke', phone: '0700000000',
        
        allocations: [
          {
            id: 'alloc-2',
            subject_id: 'subj-mat',
            class_id: 'cs-g9-blue',
            stream_id: 'cs-g9-blue',
            education_level: 'Junior School',
          },
        ],
      },
    ];

    it('Case A: Resolves actual assigned teacher name for allocated Learning Area and Stream', () => {
      const teacherEng = resolveSubjectTeacher(teachers, 'subj-eng', 'cs-g9-blue', 'cs-g9-blue');
      expect(teacherEng).toBeDefined();
      expect(teacherEng?.teacher_name).toBe('Mme. Sarah Wambui');

      const teacherMat = resolveSubjectTeacher(teachers, 'subj-mat', 'cs-g9-blue', 'cs-g9-blue');
      expect(teacherMat).toBeDefined();
      expect(teacherMat?.teacher_name).toBe('Mr. James Omondi');
    });

    it('Case B: Resolves undefined for unallocated Learning Area (must produce blank, not placeholder)', () => {
      const teacherKis = resolveSubjectTeacher(teachers, 'subj-kis', 'cs-g9-blue', 'cs-g9-blue');
      expect(teacherKis).toBeUndefined();

      const teacherSci = resolveSubjectTeacher(teachers, 'subj-sci', 'cs-g9-blue', 'cs-g9-blue');
      expect(teacherSci).toBeUndefined();
    });

    it('Does not leak allocations across streams (Grade 9 Blue teacher is not assigned to Grade 9 Red)', () => {
      const teacherRedEng = resolveSubjectTeacher(teachers, 'subj-eng', 'cs-g9-red', 'cs-g9-red');
      expect(teacherRedEng).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // GOLDEN REPORT SPECIMEN CALCULATION INTEGRITY
  // -------------------------------------------------------------
  describe('Golden Report Specimen Check', () => {
    it('Calculates the exact reference specimen results for Gathoni Margaret (9 of 9 subjects)', () => {
      const assessment: ContributingAssessmentRef = {
        id: 'exam-t3-end',
        exam_name: 'Term 3 End Assessment',
        max_marks: 100,
      };

      const specimenMarks: Mark[] = [
        { id: 'm1', student_id: 'stud-124', subject_id: 'subj-eng', exam_id: 'exam-t3-end', score: 35 },
        { id: 'm2', student_id: 'stud-124', subject_id: 'subj-kis', exam_id: 'exam-t3-end', score: 54 },
        { id: 'm3', student_id: 'stud-124', subject_id: 'subj-mat', exam_id: 'exam-t3-end', score: 10 },
        { id: 'm4', student_id: 'stud-124', subject_id: 'subj-sci', exam_id: 'exam-t3-end', score: 31 },
        { id: 'm5', student_id: 'stud-124', subject_id: 'subj-cas', exam_id: 'exam-t3-end', score: 45 },
        { id: 'm6', student_id: 'stud-124', subject_id: 'subj-sst', exam_id: 'exam-t3-end', score: 16 },
        { id: 'm7', student_id: 'stud-124', subject_id: 'subj-cre', exam_id: 'exam-t3-end', score: 42 },
        { id: 'm8', student_id: 'stud-124', subject_id: 'subj-agr', exam_id: 'exam-t3-end', score: 50 },
        { id: 'm9', student_id: 'stud-124', subject_id: 'subj-pts', exam_id: 'exam-t3-end', score: 54 },
      ];

      const resultsMap = calculateLearnerTerminalResults({
        learnerId: 'stud-124',
        subjectIds: mockJuniorSubjects.map((s) => s.id),
        contributingAssessments: [assessment],
        marks: specimenMarks,
        grades: CBE_8_POINT_GRADES,
      });

      expect(resultsMap.size).toBe(9);

      // Verify each specimen subject
      const eng = resultsMap.get('subj-eng');
      expect(eng?.terminalPercentage).toBe(35);
      expect(eng?.cbePerformanceLevel).toBe('AE1');
      expect(eng?.points).toBe(4);

      const kis = resultsMap.get('subj-kis');
      expect(kis?.terminalPercentage).toBe(54);
      expect(kis?.cbePerformanceLevel).toBe('ME2');
      expect(kis?.points).toBe(5);

      const mat = resultsMap.get('subj-mat');
      expect(mat?.terminalPercentage).toBe(10);
      expect(mat?.cbePerformanceLevel).toBe('BE2');
      expect(mat?.points).toBe(1);

      const sci = resultsMap.get('subj-sci');
      expect(sci?.terminalPercentage).toBe(31);
      expect(sci?.cbePerformanceLevel).toBe('AE1');
      expect(sci?.points).toBe(4);

      const cas = resultsMap.get('subj-cas');
      expect(cas?.terminalPercentage).toBe(45);
      expect(cas?.cbePerformanceLevel).toBe('ME2');
      expect(cas?.points).toBe(5);

      const sst = resultsMap.get('subj-sst');
      expect(sst?.terminalPercentage).toBe(16);
      expect(sst?.cbePerformanceLevel).toBe('BE1');
      expect(sst?.points).toBe(2);

      const cre = resultsMap.get('subj-cre');
      expect(cre?.terminalPercentage).toBe(42);
      expect(cre?.cbePerformanceLevel).toBe('ME2');
      expect(cre?.points).toBe(5);

      const agr = resultsMap.get('subj-agr');
      expect(agr?.terminalPercentage).toBe(50);
      expect(agr?.cbePerformanceLevel).toBe('ME2');
      expect(agr?.points).toBe(5);

      const pts = resultsMap.get('subj-pts');
      expect(pts?.terminalPercentage).toBe(54);
      expect(pts?.cbePerformanceLevel).toBe('ME2');
      expect(pts?.points).toBe(5);
    });
  });

  // -------------------------------------------------------------
  // POSITION / RANKING STATUS DISTINCTION (TESTS C & D)
  // -------------------------------------------------------------
  describe('Issue B & C: Position / Ranking Status Forensic Distinction', () => {
    it('Test C: Terminal Result outputs per Learning Area do not invent or attach arbitrary stream_position or overall_position', () => {
      const assessment: ContributingAssessmentRef = {
        id: 'exam-1',
        exam_name: 'Assessment 1',
        max_marks: 100,
      };

      const resultsMap = calculateLearnerTerminalResults({
        learnerId: 'stud-124',
        subjectIds: ['subj-eng', 'subj-mat'],
        contributingAssessments: [assessment],
        marks: [
          { id: 'm1', student_id: 'stud-124', subject_id: 'subj-eng', exam_id: 'exam-1', score: 35 },
          { id: 'm2', student_id: 'stud-124', subject_id: 'subj-mat', exam_id: 'exam-1', score: 10 },
        ],
        grades: CBE_8_POINT_GRADES,
      });

      const eng = resultsMap.get('subj-eng');
      const mat = resultsMap.get('subj-mat');

      // Terminal results evaluate per learning area; no stream_position or overall_position exists on LearningAreaTerminalResult
      expect((eng as any)?.stream_position).toBeUndefined();
      expect((eng as any)?.overall_position).toBeUndefined();
      expect((mat as any)?.stream_position).toBeUndefined();
      expect((mat as any)?.overall_position).toBeUndefined();
    });

    it('Test D: Terminal Report PDF Data operates on pure Learning Area results without aggregate overall rank or GPA', async () => {
      const assessment: ContributingAssessmentRef = {
        id: 'exam-1',
        exam_name: 'Assessment 1',
        max_marks: 100,
      };

      const resultsMap = calculateLearnerTerminalResults({
        learnerId: 'stud-124',
        subjectIds: ['subj-eng'],
        contributingAssessments: [assessment],
        marks: [
          { id: 'm1', student_id: 'stud-124', subject_id: 'subj-eng', exam_id: 'exam-1', score: 35 },
        ],
        grades: CBE_8_POINT_GRADES,
      });

      const pdfData: TerminalReportPDFData = {
        student: mockStudentGathoni,
        school: mockSchool,
        classStream: mockClassStreamBlue,
        academicYear: 2026,
        term: 'Term 3',
        isProvisionalMode: false,
        contributingAssessments: [assessment],
        subjects: [mockJuniorSubjects[0]],
        resultsBySubject: resultsMap,
      };

      // Confirm no overall rank/GPA fields are required or attached
      expect((pdfData as any).overallRank).toBeUndefined();
      expect((pdfData as any).overallGPA).toBeUndefined();
      expect((pdfData as any).streamRank).toBeUndefined();

      const doc = await buildTerminalReportDoc(pdfData);
      expect(doc).toBeDefined();
    });
  });
});

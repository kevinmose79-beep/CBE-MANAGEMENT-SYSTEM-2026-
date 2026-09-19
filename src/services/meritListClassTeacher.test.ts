import { describe, it, expect } from 'vitest';
import {
  resolveMeritListClassTeachers,
  downloadMeritListPDF,
} from './meritListExporter';
import { School, Examination, ClassStream, Teacher, Student, Subject, Mark, Grade } from '../types';

describe('Merit List Class Teacher Header Resolution & Rendering', () => {
  const mockSchool: School = {
    id: 'sch_1',
    school_name: 'MUCHORWE JUNIOR & PRIMARY SCHOOL',
    county: 'Bomet',
    sub_county: 'Chepalungu',
    email: 'info@muchorwe.ac.ke',
    phone: '0711223344',
  };

  const mockExam: Examination = {
    id: 'exam_1',
    exam_name: 'MID-TERM ASSESSMENT',
    term: 'Term 2',
    year: 2026,
    status: 'Published',
    exam_type: 'End-Term',
    max_marks: 100,
  };

  const mockTeachers: Teacher[] = [
    {
      id: 'tch_trixie',
      teacher_name: 'Trixie Mode',
      email: 'trixie@example.com',
      phone: '0711111111',
      is_class_teacher: true,
      class_teacher_of_id: 'stream_red',
    },
    {
      id: 'tch_jane',
      teacher_name: 'Jane Wanjiku',
      email: 'jane@example.com',
      phone: '0722222222',
      is_class_teacher: true,
      class_teacher_of_id: 'stream_blue',
    },
    {
      id: 'tch_maina',
      teacher_name: 'Mr. Maina',
      email: 'maina@example.com',
      phone: '0733333333',
      is_class_teacher: true,
      class_teacher_of_id: 'stream_alpha',
    },
  ];

  const mockClasses: ClassStream[] = [
    {
      id: 'cls_g9_red',
      class_name: 'Grade 9',
      stream: 'Red',
      stream_id: 'stream_red',
      class_teacher_id: 'tch_trixie',
    },
    {
      id: 'cls_g9_blue',
      class_name: 'Grade 9',
      stream: 'Blue',
      stream_id: 'stream_blue',
      class_teacher_id: 'tch_jane',
    },
    {
      id: 'cls_g9_green',
      class_name: 'Grade 9',
      stream: 'Green',
      stream_id: 'stream_green',
      class_teacher_id: undefined, // Unassigned
    },
    {
      id: 'cls_g8_alpha',
      class_name: 'Grade 8',
      stream: 'Alpha',
      stream_id: 'stream_alpha',
      class_teacher_id: 'tch_maina',
    },
  ];

  const mockStudents: Student[] = [
    {
      id: 'std_1',
      admission_number: 'ADM001',
      full_name: 'Alice Wambui',
      gender: 'F',
      class_id: 'cls_g9_red',
      stream_id: 'stream_red',
      active: true,
    },
    {
      id: 'std_2',
      admission_number: 'ADM002',
      full_name: 'Bob Omondi',
      gender: 'M',
      class_id: 'cls_g9_blue',
      stream_id: 'stream_blue',
      active: true,
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'subj_math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core' },
    { id: 'subj_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core' },
  ];

  const mockMarks: Mark[] = [
    { id: 'm_1', exam_id: 'exam_1', student_id: 'std_1', subject_id: 'subj_math', marks: 85, raw_score: 85 },
    { id: 'm_2', exam_id: 'exam_1', student_id: 'std_1', subject_id: 'subj_eng', marks: 78, raw_score: 78 },
    { id: 'm_3', exam_id: 'exam_1', student_id: 'std_2', subject_id: 'subj_math', marks: 90, raw_score: 90 },
    { id: 'm_4', exam_id: 'exam_1', student_id: 'std_2', subject_id: 'subj_eng', marks: 82, raw_score: 82 },
  ];

  const mockGrades: Grade[] = [];

  describe('resolveMeritListClassTeachers logic', () => {
    it('resolves the exact assigned class teacher for a specific stream (Red -> Trixie Mode)', () => {
      const info = resolveMeritListClassTeachers(
        mockClasses,
        mockTeachers,
        'all',
        'stream_red',
        'Grade 9'
      );

      expect(info.isAllStreams).toBe(false);
      expect(info.specificTeacherName).toBe('Trixie Mode');
      expect(info.summaryText).toBe('Trixie Mode');
      expect(info.streamTeachers).toEqual([
        { streamName: 'Red', teacherName: 'Trixie Mode' },
      ]);
    });

    it('isolates teachers: selecting Blue stream returns Jane Wanjiku, never Trixie Mode', () => {
      const info = resolveMeritListClassTeachers(
        mockClasses,
        mockTeachers,
        'all',
        'stream_blue',
        'Grade 9'
      );

      expect(info.isAllStreams).toBe(false);
      expect(info.specificTeacherName).toBe('Jane Wanjiku');
      expect(info.summaryText).toBe('Jane Wanjiku');
      expect(info.summaryText).not.toContain('Trixie Mode');
    });

    it('resolves "NOT ASSIGNED" for a specific stream without an assigned teacher', () => {
      const info = resolveMeritListClassTeachers(
        mockClasses,
        mockTeachers,
        'all',
        'stream_green',
        'Grade 9'
      );

      expect(info.isAllStreams).toBe(false);
      expect(info.specificTeacherName).toBe('NOT ASSIGNED');
      expect(info.summaryText).toBe('NOT ASSIGNED');
    });

    it('resolves stream-attributed teachers for "All Streams" across a grade in standard stream order', () => {
      const info = resolveMeritListClassTeachers(
        mockClasses,
        mockTeachers,
        'all',
        'all',
        'Grade 9'
      );

      expect(info.isAllStreams).toBe(true);
      expect(info.streamTeachers.length).toBe(3);
      expect(info.streamTeachers).toEqual([
        { streamName: 'BLUE', teacherName: 'Jane Wanjiku' },
        { streamName: 'GREEN', teacherName: 'NOT ASSIGNED' },
        { streamName: 'RED', teacherName: 'Trixie Mode' },
      ]);
      expect(info.summaryText).toBe(
        'BLUE — Jane Wanjiku | GREEN — NOT ASSIGNED | RED — Trixie Mode'
      );
    });

    it('handles fallback when teachers array is empty or undefined', () => {
      const info = resolveMeritListClassTeachers(
        mockClasses,
        [],
        'all',
        'stream_red',
        'Grade 9'
      );

      expect(info.isAllStreams).toBe(false);
      expect(info.specificTeacherName).toBe('NOT ASSIGNED');
    });
  });

  describe('PDF Generation End-to-End Execution with Class Teacher Header', () => {
    it('successfully generates Primary/Junior School Merit List PDF with specific stream teacher', async () => {
      await expect(
        downloadMeritListPDF({
          school: mockSchool,
          exam: mockExam,
          selectedClassId: 'all',
          selectedStreamId: 'stream_red',
          classes: mockClasses,
          teachers: mockTeachers,
          students: [mockStudents[0]],
          subjects: mockSubjects,
          marks: mockMarks,
          grades: mockGrades,
        })
      ).resolves.not.toThrow();
    });

    it('successfully generates Primary/Junior School Merit List PDF with All Streams teachers line', async () => {
      await expect(
        downloadMeritListPDF({
          school: mockSchool,
          exam: mockExam,
          selectedClassId: 'all',
          selectedStreamId: 'all',
          classes: mockClasses,
          teachers: mockTeachers,
          students: mockStudents,
          subjects: mockSubjects,
          marks: mockMarks,
          grades: mockGrades,
        })
      ).resolves.not.toThrow();
    });

    it('successfully generates Junior School Merit List PDF with specific stream teacher (Grade 8 Alpha)', async () => {
      await expect(
        downloadMeritListPDF({
          school: mockSchool,
          exam: mockExam,
          selectedClassId: 'all',
          selectedStreamId: 'stream_alpha',
          classes: mockClasses,
          teachers: mockTeachers,
          students: [mockStudents[0]],
          subjects: mockSubjects,
          marks: mockMarks,
          grades: mockGrades,
        })
      ).resolves.not.toThrow();
    });

    it('successfully generates Junior School Merit List PDF with All Streams teachers line', async () => {
      await expect(
        downloadMeritListPDF({
          school: mockSchool,
          exam: mockExam,
          selectedClassId: 'cls_g8_alpha',
          selectedStreamId: 'all',
          classes: mockClasses,
          teachers: mockTeachers,
          students: mockStudents,
          subjects: mockSubjects,
          marks: mockMarks,
          grades: mockGrades,
        })
      ).resolves.not.toThrow();
    });
  });
});

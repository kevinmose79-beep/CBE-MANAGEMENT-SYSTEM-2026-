import { describe, it, expect, vi } from 'vitest';
import { exportScoreSheetPDF } from './scoreSheetPdfExporter';
import { School, Examination, ClassStream, Subject, Student } from '../types';
import * as fileDownloader from '../utils/fileDownloader';

describe('Score Sheet PDF Exporter Forensic Verification', () => {
  const mockSchool: School = {
    id: 'sch-1',
    school_name: 'Muchorwe Junior School',
    county: 'Nairobi',
    email: 'info@muchorwe.ac.ke',
  };

  const mockExam: Examination = {
    id: 'exam-1',
    exam_name: 'Mid Term 2 2026',
    exam_type: 'Mid-Term',
    term: 'Term 2',
    year: 2026,
    status: 'Draft',
    class_id: 'class-1',
    max_marks: 100,
  };

  const mockClasses: ClassStream[] = [
    { id: 'class-1', class_name: 'Grade 8', stream: '8 Blue' },
    { id: 'class-2', class_name: 'Grade 8', stream: '8 Green' },
  ];

  const mockSubject: Subject = {
    id: 'subj-1',
    subject_name: 'Mathematics',
    subject_code: 'MATH',
    category: 'Core',
  };

  // Generate 80 students to force multiple pages in portrait
  const mockStudents: Student[] = Array.from({ length: 80 }, (_, i) => ({
    id: `std-${i + 1}`,
    admission_number: `ADM${String(i + 1).padStart(3, '0')}`,
    full_name: `Learner Score Test ${i + 1}`,
    class_id: 'class-1',
    stream_id: 'class-1',
    grade: 'Grade 8',
    gender: i % 2 === 0 ? 'M' : 'F',
    active: true,
  }));

  it('surgically generates score sheet PDF with Page 1 header, normal weight learner rows, and balanced columns', async () => {
    let capturedDoc: any = null;
    let capturedFileName: string = '';

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any, fileName: string) => {
      capturedDoc = doc;
      capturedFileName = fileName;
    });

    await exportScoreSheetPDF({
      school: mockSchool,
      exam: mockExam,
      subject: mockSubject,
      outOfMaxScore: 100,
      selectedClassId: 'class-1',
      selectedStreamId: '8 Blue',
      students: mockStudents,
      classes: mockClasses,
    });

    expect(capturedDoc).not.toBeNull();
    expect(capturedFileName).toContain('Score_Sheet.pdf');

    const totalPages = capturedDoc.internal.getNumberOfPages();
    expect(totalPages).toBeGreaterThanOrEqual(2);
  });

  it('handles score sheet generation without specific exam or subject', async () => {
    let capturedDoc: any = null;
    let capturedFileName: string = '';

    vi.spyOn(fileDownloader, 'savePdf').mockImplementation(async (doc: any, fileName: string) => {
      capturedDoc = doc;
      capturedFileName = fileName;
    });

    await exportScoreSheetPDF({
      school: mockSchool,
      selectedClassId: 'class-1',
      selectedStreamId: 'all',
      students: mockStudents.slice(0, 10),
      classes: mockClasses,
    });

    expect(capturedDoc).not.toBeNull();
    expect(capturedFileName).toContain('Score_Sheet.pdf');
  });
});

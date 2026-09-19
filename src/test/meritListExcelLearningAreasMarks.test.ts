import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import { downloadMeritListExcel, downloadMeritListCSV, MeritListData } from '../services/meritListExporter';
import { School, Examination, ClassStream, Student, Subject, Mark, Grade } from '../types';

let lastGeneratedSheetData: any[][] = [];
let lastGeneratedCols: any[] = [];

vi.mock('xlsx', async (importOriginal) => {
  const actual = await importOriginal<typeof import('xlsx')>();
  return {
    ...actual,
    utils: {
      ...actual.utils,
      aoa_to_sheet: (data: any[][]) => {
        lastGeneratedSheetData = data;
        const sheet = actual.utils.aoa_to_sheet(data);
        return sheet;
      },
      book_append_sheet: (wb: any, ws: any, name: string) => {
        if (ws && ws['!cols']) {
          lastGeneratedCols = ws['!cols'];
        }
        actual.utils.book_append_sheet(wb, ws, name);
      },
    },
    writeFile: vi.fn(),
  };
});

describe('Merit List Excel & CSV Learning Areas & Marks Formatting Audit', () => {
  beforeEach(() => {
    lastGeneratedSheetData = [];
    lastGeneratedCols = [];
  });

  const school: School = {
    id: 'sch_1',
    school_name: 'Muchorwe Comprehensive School',
    school_code: 'MCS001',
    county: 'Bomet',
    email: 'info@muchorwe.edu',
  };

  const exam: Examination = {
    id: 'ex_g9_term3',
    exam_name: 'Opener Assessment Term 3',
    term: 'Term 3',
    year: 2026,
    status: 'Draft',
    exam_type: 'Opener',
    max_marks: 100,
  };

  const classes: ClassStream[] = [
    { id: 'cls_g9_blue', class_name: 'Grade 9', stream: 'Blue', education_level: 'Junior School' },
    { id: 'cls_g9_red', class_name: 'Grade 9', stream: 'Red', education_level: 'Junior School' },
  ];

  const subjects: Subject[] = [
    { id: 'sb_eng', subject_code: 'ENG', subject_name: 'English', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_kis', subject_code: 'KIS', subject_name: 'Kiswahili', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_mat', subject_code: 'MATH', subject_name: 'Mathematics', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_sci', subject_code: 'INT-SCI', subject_name: 'Integrated Science', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_cas', subject_code: 'CAS', subject_name: 'Creative Arts & Sports', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_sst', subject_code: 'SST', subject_name: 'Social Studies', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_cre', subject_code: 'C.R.E', subject_name: 'C.R.E', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_agr', subject_code: 'AGN', subject_name: 'Agriculture', education_level: 'Junior School', category: 'Core' },
    { id: 'sb_pts', subject_code: 'PRE-TECH', subject_name: 'Pre-Technical Studies', education_level: 'Junior School', category: 'Core' },
  ];

  const grades: Grade[] = [
    { id: 'g1', grade_code: 'EE1', performance_level: 'EE', minimum_score: 90, maximum_score: 100, points: 8, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'g2', grade_code: 'EE2', performance_level: 'EE', minimum_score: 75, maximum_score: 89, points: 7, remarks: 'Exceeding Expectations', descriptor: 'Exceeding Expectations' },
    { id: 'g3', grade_code: 'ME1', performance_level: 'ME', minimum_score: 58, maximum_score: 74, points: 6, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'g4', grade_code: 'ME2', performance_level: 'ME', minimum_score: 41, maximum_score: 57, points: 5, remarks: 'Meeting Expectations', descriptor: 'Meeting Expectations' },
    { id: 'g5', grade_code: 'AE1', performance_level: 'AE', minimum_score: 31, maximum_score: 40, points: 4, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'g6', grade_code: 'AE2', performance_level: 'AE', minimum_score: 21, maximum_score: 30, points: 3, remarks: 'Approaching Expectations', descriptor: 'Approaching Expectations' },
    { id: 'g7', grade_code: 'BE1', performance_level: 'BE', minimum_score: 11, maximum_score: 20, points: 2, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
    { id: 'g8', grade_code: 'BE2', performance_level: 'BE', minimum_score: 1, maximum_score: 10, points: 1, remarks: 'Below Expectations', descriptor: 'Below Expectations' },
  ];

  const students: Student[] = [
    {
      id: 'st_1',
      admission_number: 'ADM-901',
      full_name: 'Faith Chebet',
      gender: 'F',
      class_id: 'cls_g9_blue',
      stream_id: 'cls_g9_blue',
      grade: 'Grade 9',
      active: true,
    },
    {
      id: 'st_2',
      admission_number: 'ADM-902',
      full_name: 'Kevin Kiprono',
      gender: 'M',
      class_id: 'cls_g9_blue',
      stream_id: 'cls_g9_blue',
      grade: 'Grade 9',
      active: true,
    },
  ];

  const marks: Mark[] = [
    // Faith Chebet marks (82 EE2 in English, 74 ME1 in Kiswahili, 95 EE1 in Math, etc.)
    { id: 'm1', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_eng', marks: 82, raw_score: 82, out_of: 100, special_status: 'Normal' },
    { id: 'm2', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_kis', marks: 74, raw_score: 74, out_of: 100, special_status: 'Normal' },
    { id: 'm3', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_mat', marks: 95, raw_score: 95, out_of: 100, special_status: 'Normal' },
    { id: 'm4', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_sci', marks: 88, raw_score: 88, out_of: 100, special_status: 'Normal' },
    { id: 'm5', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_cas', marks: 78, raw_score: 78, out_of: 100, special_status: 'Normal' },
    { id: 'm6', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_sst', marks: 68, raw_score: 68, out_of: 100, special_status: 'Normal' },
    { id: 'm7', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_cre', marks: 84, raw_score: 84, out_of: 100, special_status: 'Normal' },
    { id: 'm8', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_agr', marks: 76, raw_score: 76, out_of: 100, special_status: 'Normal' },
    { id: 'm9', student_id: 'st_1', exam_id: 'ex_g9_term3', subject_id: 'sb_pts', marks: 80, raw_score: 80, out_of: 100, special_status: 'Normal' },

    // Kevin Kiprono marks (with status X for Pre-Tech)
    { id: 'm10', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_eng', marks: 55, raw_score: 55, out_of: 100, special_status: 'Normal' },
    { id: 'm11', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_kis', marks: 60, raw_score: 60, out_of: 100, special_status: 'Normal' },
    { id: 'm12', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_mat', marks: 45, raw_score: 45, out_of: 100, special_status: 'Normal' },
    { id: 'm13', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_sci', marks: 50, raw_score: 50, out_of: 100, special_status: 'Normal' },
    { id: 'm14', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_cas', marks: 70, raw_score: 70, out_of: 100, special_status: 'Normal' },
    { id: 'm15', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_sst', marks: 48, raw_score: 48, out_of: 100, special_status: 'Normal' },
    { id: 'm16', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_cre', marks: 58, raw_score: 58, out_of: 100, special_status: 'Normal' },
    { id: 'm17', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_agr', marks: 52, raw_score: 52, out_of: 100, special_status: 'Normal' },
    { id: 'm18', student_id: 'st_2', exam_id: 'ex_g9_term3', subject_id: 'sb_pts', marks: null, raw_score: null, out_of: 100, special_status: 'X' },
  ];

  it('1. Excel Export generates all 9 Junior School learning areas with marks formatted as e.g. "82 EE2"', async () => {
    const exportData: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_g9_blue',
      selectedStreamId: 'cls_g9_blue',
      classes,
      teachers: [],
      students,
      subjects,
      marks,
      grades,
      generatedBy: 'Academic Dean',
    };

    await downloadMeritListExcel(exportData);

    expect(lastGeneratedSheetData.length).toBeGreaterThan(5);

    // Header row is index 4 (0-based)
    const headerRow = lastGeneratedSheetData[4];
    expect(headerRow).toContain('ENG');
    expect(headerRow).toContain('KIS');
    expect(headerRow).toContain('MATH');
    expect(headerRow).toContain('INT-SCI');
    expect(headerRow).toContain('CAS');
    expect(headerRow).toContain('SST');
    expect(headerRow).toContain('C.R.E');
      console.log('HEADER ROW:', headerRow);
    expect(headerRow).toContain('AGN');
    expect(headerRow).toContain('PRE-TECH');

    // Student 1 (Faith Chebet) row is index 5
    const faithRow = lastGeneratedSheetData[5];
    expect(faithRow[2]).toBe('FAITH CHEBET');

    // Find column index of ENG
    const engIdx = headerRow.indexOf('ENG');
    expect(engIdx).toBeGreaterThan(0);
    // English score was 82 -> EE2
    expect(faithRow[engIdx]).toBe('82 EE2');

    // Find column index of MATHS
    const mathIdx = headerRow.indexOf('MATH');
    // Math score was 95 -> EE1
    expect(faithRow[mathIdx]).toBe('95 EE1');

    // Find column index of KISW
    const kiswIdx = headerRow.indexOf('KIS');
    // Kiswahili score was 74 -> ME1
    expect(faithRow[kiswIdx]).toBe('74 ME1');

    // Student 2 (Kevin Kiprono)
    const kevinRow = lastGeneratedSheetData[6];
    expect(kevinRow[2]).toBe('KEVIN KIPRONO');

    // Pre-tech was status 'X' (Absent)
    const ptsIdx = headerRow.indexOf('PRE-TECH');
    expect(kevinRow[ptsIdx]).toBe('X');
    // Math was 45 -> ME2
    expect(kevinRow[mathIdx]).toBe('45 ME2');
  });

  it('2. Excel Export includes the Learning Area Performance Analysis breakdown section at the bottom', async () => {
    const exportData: MeritListData = {
      school,
      exam,
      selectedClassId: 'cls_g9_blue',
      selectedStreamId: 'cls_g9_blue',
      classes,
      teachers: [],
      students,
      subjects,
      marks,
      grades,
      generatedBy: 'Academic Dean',
    };

    await downloadMeritListExcel(exportData);

    const analysisHeaderRow = lastGeneratedSheetData.find((row) => row[0] === 'LEARNING AREA PERFORMANCE ANALYSIS');
    expect(analysisHeaderRow).toBeDefined();

    const columnHeadersRow = lastGeneratedSheetData.find((row) => row[0] === 'Learning Area Code');
    expect(columnHeadersRow).toBeDefined();
    expect(columnHeadersRow).toEqual([
      'Learning Area Code',
      'Learning Area Name',
      'Class Average (%)',
      'Performance Level',
      'Grade Code',
      'Avg Points',
    ]);
  });
});

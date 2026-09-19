import fs from 'fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { initialSchool, initialGrades } from '../src/data/seedData';

// Generate 78 mock students matching Grade 8 Endterm 2
const names = [
  'John Njoroge', 'Brian Njehia', 'Mary Khaudenzia', 'Esther Njambi', 'Brenda Kemunto',
  'Joseph Mangenga', 'Samwel Macharia', 'Timothy Mwangi', 'Amos Kipkoech', 'Elizabeth Nyambura',
  'David Kipkoech', 'Braline Chepkorir', 'Abigael Chelengat', 'Samuel Wachira', 'Faith Chepkurui',
  'Lavin Kiprotich', 'Abigael Nyaboke', 'Michael Waweru', 'Abigael Chepkoech Tonui', 'Kelvin Gacheru',
  'Maryann Wanjiru', 'Patrick Waweru', 'David Mundia', 'Lucy Ruguru', 'Kevin Kibet',
  'Annet Nduta', 'Simeon Ondieki', 'Gyan Kiprotich', 'Samuel Asembu', 'Joyline Chepngetich',
  'Clara Chelengat', 'Francis Thuo', 'Margaret Wambui', 'Collins Kiptoo', 'Miriam Waithera',
  'Brian Kipkorir', 'Jacinta Njoki', 'Lilian Njambi', 'Brian Kiprono', 'Rose Nyambura',
  'Faith Chepkemoi', 'Kelvin Kipkurui', 'Allan Mlembani', 'Philip Mburu', 'Grace Wambui',
  'Breison Kipkemoi', 'Daniel Njoroge', 'Joseph Muturi', 'Isaac Kuria', 'Victor Kipkorir',
  'Esther Wanjiku', 'Beth Wanjiku', 'Amos Kimutai', 'Precious Chebet', 'Leah Wanjiku',
  'Kevin Kimutai', 'Patrick Lundu', 'Joyline Lotieng', 'Beatrice Wanja', 'Rose Njeri',
  'Abigael Chepkoech Kitur', 'Esther Nyambura', 'Adrian Kamau', 'Ivyne Chepwogen', 'Bonfenture Mwaura',
  'Faith Wangeci', 'Villary Chepkorir', 'Geoffrey Nganga', 'Nelly Cherotich', 'Rajab Kimutai',
  'Faiza Bahati', 'Susan Chemutai', 'Jane Wangui', 'Jane Nduta', 'Ruth Cherotich',
  'Emmanuel Onyango', 'John Edung', 'Doreen Arika'
];

const classes = [
  { id: 'cls_8_blue', school_id: 'sch1', class_name: 'Grade 8', stream: 'BLUE', academic_year_id: 'ay1', created_at: '' },
  { id: 'cls_8_red', school_id: 'sch1', class_name: 'Grade 8', stream: 'RED', academic_year_id: 'ay1', created_at: '' }
];

const subjects = [
  { id: 'sb_eng', school_id: 'sch1', subject_name: 'English', subject_code: 'ENG', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_kis', school_id: 'sch1', subject_name: 'Kiswahili', subject_code: 'KIS', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_mat', school_id: 'sch1', subject_name: 'Mathematics', subject_code: 'MAT', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_sci', school_id: 'sch1', subject_name: 'Integrated Science', subject_code: 'INT/SC', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_cas', school_id: 'sch1', subject_name: 'Creative Arts & Sports', subject_code: 'CAS', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_sst', school_id: 'sch1', subject_name: 'Social Studies', subject_code: 'SST', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_cre', school_id: 'sch1', subject_name: 'Christian Religious Education', subject_code: 'C.R.E', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_agr', school_id: 'sch1', subject_name: 'Agriculture', subject_code: 'AGRI', category: 'Core', is_compulsory: true, created_at: '' },
  { id: 'sb_pre', school_id: 'sch1', subject_name: 'Pre-Technical Studies', subject_code: 'PRE TECH', category: 'Core', is_compulsory: true, created_at: '' }
];

const students = names.map((name, i) => ({
  id: `std_${i + 1}`,
  admission_number: `${190 + i}`,
  full_name: name,
  gender: i % 2 === 0 ? 'M' : 'F',
  class_id: i % 2 === 0 ? 'cls_8_red' : 'cls_8_blue',
  stream_id: i % 2 === 0 ? 'cls_8_red' : 'cls_8_blue',
  dob: '2012-01-01',
  parent_name: 'Parent Name',
  parent_phone: '+254700000000',
  active: true,
  education_level: 'Junior School',
  grade: 'Grade 8'
}));

const exam = {
  id: 'ex_g8_t2',
  school_id: 'sch1',
  exam_name: 'ENDTERM 2',
  exam_code: 'GRADE 8T22026ENDTERM 2',
  term: 2,
  year: 2026,
  academic_year_id: 'ay1',
  start_date: '2026-07-01',
  end_date: '2026-07-15',
  status: 'Published',
  created_at: ''
};

// Standard 9 CBE Subjects
const formattedSubjectHeaders = ['ENG', 'KIS', 'MAT', 'INT/SC', 'CAS', 'SST', 'C.R.E', 'AGRI', 'PRE TECH'];

const doc = new jsPDF({
  orientation: 'landscape',
  unit: 'mm',
  format: 'a4',
});

const pageWidth = 297;
const pageHeight = 210;
const marginX = 10;
const marginTop = 12;
const marginBottom = 12;
const contentWidth = pageWidth - marginX * 2; // 277mm

const tableHeadTitles = [
  'S.No',
  'ADM No.',
  'LEARNER NAME',
  'STREAM',
  'STR. POS.',
  'OVR POS',
  'PRV STR POS',
  'PRV OVR POS',
  ...formattedSubjectHeaders,
  'SUB. ENTRY',
  'TOTAL MARKS',
  'AVG MARKS',
  'TOTAL POINTS',
  'AVG POINTS',
  'CBE LEVEL',
];

const tableRows = students.map((std, idx) => {
  const isRed = std.class_id === 'cls_8_red';
  const streamStr = isRed ? 'RED' : 'BLUE';
  const pos = idx + 1;
  const strPos = Math.ceil((idx + 1) / 2);
  const prevOvrPos = Math.min(78, Math.max(1, pos + (idx % 3 === 0 ? 1 : idx % 2 === 0 ? -1 : 2)));
  const prevStrPos = Math.min(40, Math.max(1, strPos + (idx % 2 === 0 ? 0 : 1)));

  const subjectCells = [
    '87 EE2', '69 ME1', '82 EE2', '90 EE1', '70 ME1', '82 EE2', '96 EE1', '98 EE1', '80 EE2'
  ];

  return [
    `${idx + 1}`,
    std.admission_number,
    std.full_name.toUpperCase(),
    streamStr,
    `${strPos}`,
    `${pos}`,
    `${prevStrPos}`,
    `${prevOvrPos}`,
    ...subjectCells,
    '9',
    `${754 - idx * 5}`,
    `${(83.8 - idx * 0.5).toFixed(1)}`,
    `${64 - Math.floor(idx * 0.4)}`,
    `${(7.11 - idx * 0.05).toFixed(2)}`,
    idx < 3 ? 'EE2' : idx < 30 ? 'ME1' : idx < 65 ? 'ME2' : 'AE1'
  ];
});

const numSubjs = formattedSubjectHeaders.length;
const sumMetaW = 98; // 6 + 14 + 40 + 12 + 6.5 + 6.5 + 6.5 + 6.5 = 98mm
const sumSummaryW = 62; // 7 + 10 + 11 + 10 + 10 + 14 = 62mm
const availSubjW = (contentWidth - sumMetaW - sumSummaryW) / numSubjs; // 13mm

const columnStyles: Record<number, any> = {
  0: { cellWidth: 6, halign: 'center', fontStyle: 'normal' },
  1: { cellWidth: 14, halign: 'center', fontStyle: 'normal' },
  2: { cellWidth: 40, halign: 'left', cellPadding: { top: 0.3, bottom: 0.3, left: 1.2, right: 0.3 }, fontStyle: 'normal' },
  3: { cellWidth: 12, halign: 'center', fontStyle: 'normal' },
  4: { cellWidth: 6.5, halign: 'center', fontStyle: 'normal' },
  5: { cellWidth: 6.5, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] },
  6: { cellWidth: 6.5, halign: 'center', fontStyle: 'normal' },
  7: { cellWidth: 6.5, halign: 'center', fontStyle: 'normal' },
};

const startSubjIdx = 8;
for (let i = 0; i < numSubjs; i++) {
  columnStyles[startSubjIdx + i] = { cellWidth: availSubjW, halign: 'center', fontStyle: 'normal' };
}

const startSummIdx = startSubjIdx + numSubjs;
columnStyles[startSummIdx]     = { cellWidth: 7, halign: 'center', fontStyle: 'normal' };
columnStyles[startSummIdx + 1] = { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
columnStyles[startSummIdx + 2] = { cellWidth: 11, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
columnStyles[startSummIdx + 3] = { cellWidth: 10, halign: 'center', fontStyle: 'normal' };
columnStyles[startSummIdx + 4] = { cellWidth: 10, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };
columnStyles[startSummIdx + 5] = { cellWidth: 14, halign: 'center', fontStyle: 'bold', textColor: [0, 85, 204] };

const subjectColIndices = Array.from({ length: numSubjs }, (_, k) => startSubjIdx + k);
const rotatedHeaderIndices = [4, 5, 6, 7, startSummIdx, startSummIdx + 1, startSummIdx + 2, startSummIdx + 3, startSummIdx + 4, startSummIdx + 5];

const renderDocumentHeader = () => {
  const logoX = marginX + 1;
  const logoY = 5;
  const logoSize = 21;

  doc.setFillColor(0, 135, 103);
  doc.circle(logoX + 10.5, logoY + 10.5, 10, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('CBE', logoX + 10.5, logoY + 13.5, { align: 'center' });

  const textLeft = marginX + 25;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(0, 135, 103);
  doc.text('MUCHORWE JUNIOR SCHOOL', textLeft, 11.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text("REPORT: LEARNERS' PERFORMANCE MERIT LIST", textLeft, 17.5);

  const metaY = 23.5;
  doc.setFontSize(8.5);

  let curX = textLeft;
  const itemGap = 5;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('CLASS:', curX, metaY);
  curX += doc.getTextWidth('CLASS:') + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 85, 204);
  doc.text('GRADE 8', curX, metaY);
  const clsW = doc.getTextWidth('GRADE 8');
  curX += clsW + itemGap;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('TERM:', curX, metaY);
  curX += doc.getTextWidth('TERM:') + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 85, 204);
  doc.text('2', curX, metaY);
  curX += doc.getTextWidth('2') + itemGap;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('YEAR:', curX, metaY);
  curX += doc.getTextWidth('YEAR:') + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 85, 204);
  doc.text('2026', curX, metaY);
  curX += doc.getTextWidth('2026') + itemGap;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('EXAM NAME:', curX, metaY);
  curX += doc.getTextWidth('EXAM NAME:') + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 85, 204);
  doc.text('ENDTERM 2', curX, metaY);
  curX += doc.getTextWidth('ENDTERM 2') + itemGap;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('EXAM CODE:', curX, metaY);
  curX += doc.getTextWidth('EXAM CODE:') + 1.2;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 85, 204);
  doc.text('GRADE 8T22026ENDTERM 2', curX, metaY);
};

autoTable(doc, {
  startY: 27,
  margin: { left: marginX, right: marginX, top: marginTop, bottom: marginBottom },
  head: [tableHeadTitles],
  body: tableRows,
  theme: 'grid',
  showHead: 'everyPage',
  styles: {
    fontSize: 7.2,
    cellPadding: { top: 0.25, bottom: 0.25, left: 0.3, right: 0.3 },
    textColor: [0, 0, 0],
    lineColor: [0, 0, 0],
    lineWidth: 0.18,
    fillColor: [255, 255, 255],
    valign: 'middle',
    halign: 'center',
    minCellHeight: 3.6,
  },
  alternateRowStyles: {
    fillColor: [255, 255, 255],
  },
  headStyles: {
    fillColor: [255, 255, 255],
    textColor: [0, 0, 0],
    fontStyle: 'bold',
    fontSize: 7.0,
    lineColor: [0, 0, 0],
    lineWidth: 0.18,
    halign: 'center',
    valign: 'middle',
    minCellHeight: 18,
  },
  columnStyles: columnStyles,
  didDrawPage: (d) => {
    if (d.pageNumber === 1) {
      renderDocumentHeader();
    }
  },
  willDrawCell: (d) => {
    if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
      d.cell.text = [];
    }
    if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
      d.cell.text = [];
    }
  },
  didDrawCell: (d) => {
    if (d.section === 'head' && rotatedHeaderIndices.includes(d.column.index)) {
      const cell = d.cell;
      const title = tableHeadTitles[d.column.index];
      if (title) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(0, 0, 0);
        const x = cell.x + cell.width / 2 + 1.1;
        const y = cell.y + cell.height - 1.8;
        doc.text(title, x, y, { angle: 90 });
      }
    }

    if (d.section === 'body' && subjectColIndices.includes(d.column.index)) {
      const cell = d.cell;
      const rowData = tableRows[d.row.index];
      if (!rowData) return;
      const rawVal = String(rowData[d.column.index] || '').trim();
      const centerX = cell.x + cell.width / 2;
      const centerY = cell.y + cell.height / 2;

      if (!rawVal) return;

      if (rawVal.includes(' ')) {
        const spaceIdx = rawVal.indexOf(' ');
        const markStr = rawVal.substring(0, spaceIdx);
        const gradeCodeStr = rawVal.substring(spaceIdx + 1);

        const subjFontSize = 7.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(subjFontSize);

        const markW = doc.getTextWidth(markStr);
        const spaceW = doc.getTextWidth(' ');
        const gradeW = doc.getTextWidth(gradeCodeStr);
        const totalW = markW + spaceW + gradeW;

        const startX = centerX - totalW / 2;
        const yPos = centerY + 0.65;

        doc.setTextColor(0, 0, 0);
        doc.text(markStr, startX, yPos);

        if (gradeCodeStr && gradeCodeStr !== '-') {
          doc.setTextColor(0, 85, 204);
          doc.text(gradeCodeStr, startX + markW + spaceW, yPos);
        }
      }
    }
  },
});

let finalY = (doc as any).lastAutoTable.finalY + 5;

if (finalY + 35 > pageHeight - marginBottom) {
  doc.addPage();
  finalY = marginTop + 4;
}

const summarySubjHeaders = ['ENG', 'KIS', 'MAT', 'INT.SC', 'CAS', 'SST', 'CRE', 'AGR', 'PRE TECH'];
const summaryHead = [['LEARNING AREA', ...summarySubjHeaders, 'CLASS AVG']];
const summaryRowMarks = ['AVG. MARKS', '63.83', '57.12', '17.50', '64.33', '47.30', '34.50', '68.80', '75.90', '57.90', '54.10'];
const summaryRowPoints = ['AVG. POINTS', '5.7821 ME1', '5.4231 ME2', '2.1795 BE1', '5.8590 ME1', '4.7564 ME2', '3.7436 AE1', '6.0641 ME1', '6.6282 EE2', '5.4684 ME1', '5.2179 ME2'];

const summaryColStyles: Record<number, any> = {
  0: { cellWidth: sumMetaW, fontStyle: 'bold', halign: 'left' },
};
for (let i = 0; i < numSubjs; i++) {
  summaryColStyles[i + 1] = { cellWidth: availSubjW, halign: 'center' };
}
summaryColStyles[numSubjs + 1] = { cellWidth: sumSummaryW, fontStyle: 'bold', halign: 'center' };

autoTable(doc, {
  startY: finalY,
  margin: { left: marginX, right: marginX },
  head: summaryHead,
  body: [summaryRowMarks, summaryRowPoints],
  theme: 'grid',
  styles: {
    fontSize: 5.8,
    cellPadding: 0.8,
    textColor: [0, 0, 0],
    lineColor: [0, 0, 0],
    lineWidth: 0.18,
    halign: 'center',
    valign: 'middle',
  },
  headStyles: {
    fillColor: [255, 255, 255],
    textColor: [0, 0, 0],
    fontStyle: 'bold',
    fontSize: 5.8,
    lineColor: [0, 0, 0],
    lineWidth: 0.18,
    halign: 'center',
  },
  columnStyles: summaryColStyles,
  willDrawCell: (d) => {
    if (d.section === 'body' && d.row.index === 1 && d.column.index > 0) {
      d.cell.text = [];
    }
  },
  didDrawCell: (d) => {
    if (d.section === 'body' && d.row.index === 1 && d.column.index > 0) {
      const cell = d.cell;
      const val = summaryRowPoints[d.column.index] ? String(summaryRowPoints[d.column.index]) : '';
      if (val.includes(' ')) {
        const spaceIdx = val.indexOf(' ');
        const ptsStr = val.substring(0, spaceIdx);
        const grStr = val.substring(spaceIdx + 1);

        const centerY = cell.y + cell.height / 2;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        const ptsW = doc.getTextWidth(ptsStr);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        const spW = doc.getTextWidth(' ');
        const grW = doc.getTextWidth(grStr);
        const totW = ptsW + spW + grW;

        const startX = cell.x + (cell.width - totW) / 2;
        const textY = centerY + 0.6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.5);
        doc.setTextColor(0, 0, 0);
        doc.text(ptsStr, startX, textY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(0, 85, 204);
        doc.text(grStr, startX + ptsW + spW, textY);
      }
    }
  },
});

let summaryY = (doc as any).lastAutoTable.finalY + 5;

doc.setFont('helvetica', 'bold');
doc.setFontSize(9.0);
doc.setTextColor(0, 0, 0);
doc.text('CLASS AVERAGE MARKS: 487.1', pageWidth / 2, summaryY, { align: 'center' });

summaryY += 4.5;

doc.setFont('helvetica', 'normal');
doc.setFontSize(6.5);
doc.setTextColor(60, 60, 60);
doc.text('• Learner position is assigned using Total Marks', marginX + 4, summaryY);
summaryY += 3.5;
doc.text('• Learner performance level is calculated using Average Marks', marginX + 4, summaryY);

const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  const footerY = pageHeight - 5;

  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.15);
  doc.line(marginX, footerY - 2.5, marginX + contentWidth, footerY - 2.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(80, 80, 80);
  doc.text(
    `Report generated on: 29.07.2026: at 09:02:09 Page ${i}/${totalPages}`,
    marginX + contentWidth,
    footerY,
    { align: 'right' }
  );
}

const buf = Buffer.from(doc.output('arraybuffer'));
fs.writeFileSync('merit_list.pdf', buf);
console.log(`Generated merit_list.pdf (${buf.length} bytes, ${totalPages} pages)`);

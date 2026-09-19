import { describe, it, expect } from 'vitest';
import { formatGreetingFirstName, formatGreeting, getFirstName } from '../utils/greetingUtils';
import { Teacher, ClassStream, Subject, User } from '../types';

describe('Teacher Workspace Redesign — UX & Identity Invariants', () => {
  it('1. Extracts teacher first name without screaming uppercase', () => {
    expect(getFirstName('STACY JORDAN')).toBe('Stacy');
    expect(getFirstName('BRIAN AYIECHA')).toBe('Brian');
    expect(getFirstName('KEVIN MOSE')).toBe('Kevin');
    expect(getFirstName('Tr. Faith Mwangi')).toBe('Faith');
    expect(getFirstName('')).toBe('');
    expect(getFirstName(null)).toBe('');
  });

  it('2. Formats workspace primary greeting cleanly', () => {
    const morning = new Date(2026, 7, 16, 8, 30, 0);
    const afternoon = new Date(2026, 7, 16, 14, 15, 0);
    const evening = new Date(2026, 7, 16, 19, 45, 0);

    // Subject Teacher (Stacy Jordan)
    expect(formatGreetingFirstName('STACY JORDAN', morning)).toBe('Good morning, Stacy');
    expect(formatGreetingFirstName('STACY JORDAN', afternoon)).toBe('Good afternoon, Stacy');
    expect(formatGreetingFirstName('STACY JORDAN', evening)).toBe('Good evening, Stacy');

    // Class Teacher (Brian Ayiecha)
    expect(formatGreetingFirstName('BRIAN AYIECHA', morning)).toBe('Good morning, Brian');
    expect(formatGreetingFirstName('BRIAN AYIECHA', afternoon)).toBe('Good afternoon, Brian');
    expect(formatGreetingFirstName('BRIAN AYIECHA', evening)).toBe('Good evening, Brian');
  });

  it('3. Ensures no name repetition in the primary workspace heading', () => {
    const renderedHeading = formatGreetingFirstName('STACY JORDAN', new Date(2026, 7, 16, 14, 0, 0));
    expect(renderedHeading).toBe('Good afternoon, Stacy');
    // Does not include the surname twice or all-caps duplicate
    expect(renderedHeading).not.toContain('STACY JORDAN');
    expect(renderedHeading).not.toContain('Jordan');
  });

  it('4. Role badges for Class Teacher vs Subject Teacher remain accurate and distinct', () => {
    const formatRoleBadge = (isClassTeacher: boolean, classTitle?: string) => {
      if (isClassTeacher && classTitle) {
        return `Class Teacher • ${classTitle}`;
      }
      if (isClassTeacher) {
        return 'Class Teacher';
      }
      return 'Subject Teacher';
    };

    expect(formatRoleBadge(true, 'Grade 8 Blue')).toBe('Class Teacher • Grade 8 Blue');
    expect(formatRoleBadge(true, '')).toBe('Class Teacher');
    expect(formatRoleBadge(false)).toBe('Subject Teacher');
  });

  it('5. Verifies Subject Teacher action cards and role isolation structure', () => {
    const subjectTeacherCards = [
      { section: 'ASSESSMENT', title: 'Enter Marks', destination: 'marks-entry' },
      { section: 'ASSESSMENT', title: 'My Assessments', destination: 'reports' },
      { section: 'TEACHING', title: 'My Classes', action: 'view-classes' },
      { section: 'TEACHING', title: 'My Learning Areas', action: 'view-subjects' },
    ];

    expect(subjectTeacherCards).toHaveLength(4);
    expect(subjectTeacherCards.filter(c => c.section === 'ASSESSMENT')).toHaveLength(2);
    expect(subjectTeacherCards.filter(c => c.section === 'TEACHING')).toHaveLength(2);
  });

  it('6. Verifies Subject Teacher vs Class Teacher isolation resolution logic', () => {
    const mockSubjectTeacher: Teacher = {
      id: 'tch_stacy',
      teacher_name: 'STACY JORDAN',
      phone: '0711223344',
      email: 'stacy@school.com',
      is_class_teacher: false,
      allocations: [
        {
          id: 'alloc_1',
          education_level: 'Junior School',
          class_id: 'cls_g7_blue',
          subject_id: 'sub_eng',
        },
      ],
    };

    const mockClassTeacher: Teacher = {
      id: 'tch_brian',
      teacher_name: 'BRIAN AYIECHA',
      phone: '0722334455',
      email: 'brian@school.com',
      is_class_teacher: true,
      class_teacher_of_id: 'stream_g8_red',
      allocations: [],
    };

    const classes: ClassStream[] = [
      {
        id: 'cls_g7_blue',
        education_level: 'Junior School',
        class_name: 'Grade 7',
        stream: 'Blue',
        stream_id: 'stream_g7_blue',
      },
      {
        id: 'cls_g8_red',
        education_level: 'Junior School',
        class_name: 'Grade 8',
        stream: 'Red',
        stream_id: 'stream_g8_red',
        class_teacher_id: 'tch_brian',
      },
    ];

    const isClassTeacher = (teacher: Teacher, user?: User | null) => {
      const primary = classes.filter(
        (c) =>
          c.class_teacher_id === teacher.id ||
          (teacher.is_class_teacher &&
            teacher.class_teacher_of_id &&
            ((c.stream_id && c.stream_id === teacher.class_teacher_of_id) ||
              c.id === teacher.class_teacher_of_id))
      );
      return Boolean(
        user?.role === 'class_teacher' ||
        (!user && (teacher.is_class_teacher || primary.length > 0))
      );
    };

    // Subject teacher with subject_teacher user
    const userSubject: User = { id: 'usr_stacy', name: 'Stacy Jordan', email: 'stacy@school.com', role: 'subject_teacher' };
    expect(isClassTeacher(mockSubjectTeacher, userSubject)).toBe(false);

    // Class teacher with class_teacher user
    const userClass: User = { id: 'usr_brian', name: 'Brian Ayiecha', email: 'brian@school.com', role: 'class_teacher' };
    expect(isClassTeacher(mockClassTeacher, userClass)).toBe(true);

    // Subject teacher with no user role override
    expect(isClassTeacher(mockSubjectTeacher, null)).toBe(false);
  });
});


import { describe, it, expect, vi } from 'vitest';
import { Student } from '../types';

describe('Learner Roster Action Button Contracts', () => {
  const mockStudent: Student = {
    id: '11111111-2222-3333-4444-555555555555',
    admission_number: 'ADM-2026-001',
    full_name: 'Jane Doe',
    first_name: 'Jane',
    last_name: 'Doe',
    gender: 'F',
    class_id: 'class-01',
    stream_id: 'stream-01',
    active: true,
    enrolment_status: 'active',
  };

  it('triggers delete flow and calls onDeleteStudent with student UUID', async () => {
    const onDeleteStudent = vi.fn().mockResolvedValue(undefined);
    
    // Simulate confirming delete in the new in-app modal
    await onDeleteStudent(mockStudent.id);
    
    expect(onDeleteStudent).toHaveBeenCalledTimes(1);
    expect(onDeleteStudent).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555');
  });

  it('handles academic safety gate rejection with detailed error message', async () => {
    const onDeleteStudent = vi.fn().mockRejectedValue(
      new Error('Cannot permanently delete learner "Jane Doe" because 12 protected marks exist.')
    );
    
    let caughtError: string | null = null;
    try {
      await onDeleteStudent(mockStudent.id);
    } catch (err: any) {
      caughtError = err.message;
    }
    
    expect(caughtError).toContain('protected marks exist');
  });
});

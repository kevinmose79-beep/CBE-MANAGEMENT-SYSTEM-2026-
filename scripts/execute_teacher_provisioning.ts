import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { TEACHER_PLANS } from './forensic_dry_run';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase URL or Key missing');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const DEFAULT_PASSWORD = 'Teachers@2026';

async function executeProvisioning() {
  console.log('=================================================================');
  console.log('PHASE 4: SURGICAL EXECUTION — TEACHER PORTAL ACCOUNTS & ALLOCATIONS');
  console.log('=================================================================');

  // 1. Fetch reference maps
  const { data: classes } = await supabaseAdmin.from('classes').select('id, class_name');
  const { data: streams } = await supabaseAdmin.from('streams').select('id, class_id, stream_name, class_teacher_id');

  const streamMap = new Map<string, { stream_id: string; class_id: string }>();
  streams?.forEach(s => {
    const cls = classes?.find(c => c.id === s.class_id);
    if (cls) {
      streamMap.set(`${cls.class_name} ${s.stream_name}`, {
        stream_id: s.id,
        class_id: s.class_id
      });
    }
  });

  const targetSubjectConfigs: Record<string, string> = {
    'English': '823eba35-ac51-4ac8-be57-fcbeee88151c',
    'Kiswahili': 'f00b5334-fa16-4640-b19c-733ec4530318',
    'Mathematics': '4441b054-2d20-4d5c-852d-f31d16fbc145',
    'Integrated Science': 'b65c16d5-a38c-478e-ab46-085170ee31da',
    'Creative Arts and Sports': 'b2ee51ad-3d6e-458c-8a1e-f5b9b79a0d83',
    'Agriculture': 'fe17661a-9c3b-439e-9cb9-fd2f88279f56',
    'Pre-Technical Studies': '5d9beb86-1268-40cb-bae6-7f8e4b998ea2',
    'Christian Religious Education': 'e784b5fc-dab9-4105-bb49-fce1d1a84cf7',
    'Social Studies': 'dff8e7fc-bb0d-41c5-b451-e6b6f3361409'
  };

  const results: any[] = [];

  for (const plan of TEACHER_PLANS) {
    console.log(`\n-------------------------------------------------------------`);
    console.log(`Processing: ${plan.name} (${plan.email}) | Role: ${plan.role}`);
    console.log(`-------------------------------------------------------------`);

    let teacherId: string;
    let authUserId: string;

    if (plan.isExisting) {
      // --- EXISTING TEACHER: BRIAN AYIECHA ---
      console.log(`[UPDATE] Preserving existing teacher profile ${plan.existingTeacherId}...`);
      teacherId = plan.existingTeacherId!;

      // Fetch teacher & user details
      const { data: tRecord, error: tErr } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .eq('id', teacherId)
        .single();
      if (tErr || !tRecord) {
        throw new Error(`Failed to find existing teacher ${teacherId}: ${tErr?.message}`);
      }

      authUserId = tRecord.user_id;

      // Ensure teacher record is updated
      const { error: tUpdErr } = await supabaseAdmin
        .from('teachers')
        .update({
          is_class_teacher: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', teacherId);
      if (tUpdErr) throw new Error(`Failed to update teacher: ${tUpdErr.message}`);

      // Ensure user record is updated
      if (authUserId) {
        await supabaseAdmin
          .from('users')
          .update({
            role: 'class_teacher',
            teacher_id: teacherId,
            updated_at: new Date().toISOString()
          })
          .eq('id', authUserId);
      }

      // Ensure stream has Brian as class teacher
      if (plan.classTeacherStreamName) {
        const strm = streamMap.get(plan.classTeacherStreamName)!;
        const { error: strmErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: teacherId })
          .eq('id', strm.stream_id);
        if (strmErr) throw new Error(`Failed to assign stream class_teacher_id: ${strmErr.message}`);
        console.log(`Assigned stream ${plan.classTeacherStreamName} class_teacher_id to ${teacherId}`);
      }

    } else {
      // --- NEW TEACHER CREATION ---
      console.log(`[CREATE] Creating Supabase Auth user for ${plan.email}...`);

      // Check if auth user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      let existingAuth = existingUsers?.users?.find(u => u.email?.toLowerCase() === plan.email.toLowerCase());

      if (!existingAuth) {
        const { data: authCreated, error: authErr } = await supabaseAdmin.auth.admin.createUser({
          email: plan.email,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: {
            role: plan.role,
            name: plan.name,
            status: 'Active',
            force_password_change: false,
          }
        });

        if (authErr) {
          throw new Error(`Failed to create auth user for ${plan.email}: ${authErr.message}`);
        }
        authUserId = authCreated.user.id;
        console.log(`Created auth.users record: ${authUserId}`);
      } else {
        authUserId = existingAuth.id;
        console.log(`Found existing auth.users record: ${authUserId}`);
      }

      // Check / Create public.users record
      const { data: existingPublicUser } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authUserId)
        .maybeSingle();

      if (!existingPublicUser) {
        const { error: uErr } = await supabaseAdmin
          .from('users')
          .insert([{
            id: authUserId,
            name: plan.name,
            email: plan.email,
            role: plan.role,
            teacher_id: null,
            student_id: null
          }]);
        if (uErr) throw new Error(`Failed to insert public.users for ${plan.email}: ${uErr.message}`);
        console.log(`Created public.users record: ${authUserId}`);
      } else {
        await supabaseAdmin
          .from('users')
          .update({
            name: plan.name,
            email: plan.email,
            role: plan.role
          })
          .eq('id', authUserId);
        console.log(`Updated public.users record: ${authUserId}`);
      }

      // Check / Create public.teachers record
      const { data: existingTeacher } = await supabaseAdmin
        .from('teachers')
        .select('*')
        .eq('email', plan.email)
        .maybeSingle();

      if (!existingTeacher) {
        const { data: newTeacher, error: tErr } = await supabaseAdmin
          .from('teachers')
          .insert([{
            user_id: authUserId,
            teacher_name: plan.name,
            email: plan.email,
            is_class_teacher: plan.is_class_teacher
          }])
          .select()
          .single();

        if (tErr || !newTeacher) {
          throw new Error(`Failed to insert public.teachers for ${plan.email}: ${tErr?.message}`);
        }
        teacherId = newTeacher.id;
        console.log(`Created public.teachers record: ${teacherId}`);
      } else {
        teacherId = existingTeacher.id;
        await supabaseAdmin
          .from('teachers')
          .update({
            user_id: authUserId,
            teacher_name: plan.name,
            is_class_teacher: plan.is_class_teacher
          })
          .eq('id', teacherId);
        console.log(`Updated public.teachers record: ${teacherId}`);
      }

      // Link public.users.teacher_id
      await supabaseAdmin
        .from('users')
        .update({ teacher_id: teacherId })
        .eq('id', authUserId);

      // Link class teacher of stream if applicable
      if (plan.is_class_teacher && plan.classTeacherStreamName) {
        const strm = streamMap.get(plan.classTeacherStreamName)!;
        const { error: strmErr } = await supabaseAdmin
          .from('streams')
          .update({ class_teacher_id: teacherId })
          .eq('id', strm.stream_id);
        if (strmErr) throw new Error(`Failed to update streams.class_teacher_id: ${strmErr.message}`);
        console.log(`Assigned stream ${plan.classTeacherStreamName} class_teacher_id to ${teacherId}`);
      }
    }

    // --- ALLOCATIONS MANAGEMENT IN teacher_subjects ---
    console.log(`Configuring ${plan.allocations.length} allocations in teacher_subjects...`);

    // Fetch existing allocations for this teacher
    const { data: existingAllocs } = await supabaseAdmin
      .from('teacher_subjects')
      .select('*')
      .eq('teacher_id', teacherId);

    const allocationInserts: any[] = [];

    for (const alloc of plan.allocations) {
      const strm = streamMap.get(alloc.classStream)!;
      const subId = targetSubjectConfigs[alloc.subjectName];
      if (!subId) throw new Error(`Subject ID not found for ${alloc.subjectName}`);

      const alreadyExists = existingAllocs?.some(ea => 
        ea.subject_id === subId &&
        ea.class_id === strm.class_id &&
        ea.stream_id === strm.stream_id
      );

      if (!alreadyExists) {
        allocationInserts.push({
          teacher_id: teacherId,
          subject_id: subId,
          class_id: strm.class_id,
          stream_id: strm.stream_id
        });
      }
    }

    if (allocationInserts.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from('teacher_subjects')
        .insert(allocationInserts);
      if (insErr) {
        throw new Error(`Failed to insert allocations for ${plan.name}: ${insErr.message}`);
      }
      console.log(`Inserted ${allocationInserts.length} new allocations for ${plan.name}`);
    } else {
      console.log(`All ${plan.allocations.length} allocations already exist for ${plan.name}`);
    }

    results.push({
      teacher_name: plan.name,
      email: plan.email,
      role: plan.role,
      is_class_teacher: plan.is_class_teacher,
      class_stream: plan.classTeacherStreamName || 'None (Subject Teacher)',
      allocations_count: plan.allocations.length,
      teacher_id: teacherId,
      user_id: authUserId
    });
  }

  console.log('\n=================================================================');
  console.log('PHASE 4 EXECUTION COMPLETE — SUMMARY:');
  console.log('=================================================================');
  console.table(results);
}

executeProvisioning().catch(err => {
  console.error('\nEXECUTION FAILED:', err);
  process.exit(1);
});

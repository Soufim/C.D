/**
 * Idempotent seed: system roles, first administrator, core reference lists and (optionally)
 * bilingual demonstration data. Safe to run on every deployment; never overwrites user data.
 *
 *   npm run db:seed            (after npm run build && npm run db:migrate)
 */
import { randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, sql } from 'drizzle-orm';
import { hash } from '@node-rs/argon2';
import { DEFAULT_ROLES } from '@cdms/contracts';
import { loadEnv } from '../config/env';
import { createPool } from './database.module';
import * as s from './schema';

const argon = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export async function seed(opts: { demo?: boolean; adminPassword?: string; quiet?: boolean } = {}) {
  const env = loadEnv();
  const pool = createPool(env);
  const db = drizzle(pool, { schema: s });
  const log = (...a: unknown[]) => !opts.quiet && console.log(...a);
  const demo = opts.demo ?? env.SEED_DEMO_DATA;

  try {
    // ---------------------------------------------------------------- roles
    const roleIds: Record<string, string> = {};
    for (const [code, r] of Object.entries(DEFAULT_ROLES)) {
      const [row] = await db
        .insert(s.roles)
        .values({ code, nameEn: r.nameEn, nameAr: r.nameAr, permissions: r.permissions, isSystem: true })
        .onConflictDoNothing()
        .returning({ id: s.roles.id });
      const [existing] = await db.select({ id: s.roles.id }).from(s.roles).where(sql`lower(${s.roles.code}) = ${code}`);
      roleIds[code] = row?.id ?? existing.id;
      // The system administrator always receives newly introduced permissions.
      if (code === 'system_admin') await db.update(s.roles).set({ permissions: r.permissions }).where(eq(s.roles.id, roleIds[code]));
    }

    // ---------------------------------------------------------------- reference lists
    const lists: Record<string, { en: string; ar: string; items: [string, string, string][] }> = {
      sector: {
        en: 'Economic sector', ar: 'القطاع الاقتصادي',
        items: [['ENERGY', 'Electricity & energy', 'الكهرباء والطاقة'], ['ICT', 'Information & communication technology', 'تكنولوجيا المعلومات والاتصالات'], ['MANUF', 'Manufacturing', 'الصناعة'], ['CONST', 'Construction', 'التشييد والبناء'], ['TOUR', 'Tourism & hospitality', 'السياحة والضيافة'], ['AGRI', 'Agriculture', 'الزراعة']],
      },
      governorate: {
        en: 'Governorate', ar: 'المحافظة',
        items: [['CAI', 'Cairo', 'القاهرة'], ['GIZ', 'Giza', 'الجيزة'], ['ALX', 'Alexandria', 'الإسكندرية'], ['DK', 'Dakahlia', 'الدقهلية'], ['ASN', 'Aswan', 'أسوان'], ['SHR', 'Sharqia', 'الشرقية']],
      },
      institution_type: {
        en: 'Institution type', ar: 'نوع المؤسسة',
        items: [['TECH_SCHOOL', 'Technical secondary school', 'مدرسة ثانوية فنية'], ['ATS', 'Applied technology school', 'مدرسة تكنولوجيا تطبيقية'], ['TECH_COLLEGE', 'Technical college', 'كلية تكنولوجية'], ['TRAINING_CTR', 'Vocational training centre', 'مركز تدريب مهني'], ['DIRECTORATE', 'Central directorate', 'إدارة مركزية']],
      },
      program_type: {
        en: 'Programme type', ar: 'نوع البرنامج',
        items: [['DIPLOMA_3Y', 'Three-year technical diploma', 'دبلوم فني ثلاث سنوات'], ['DIPLOMA_5Y', 'Five-year advanced diploma', 'دبلوم فني متقدم خمس سنوات'], ['SHORT', 'Short course', 'دورة قصيرة'], ['APPRENTICE', 'Dual / apprenticeship', 'تعليم مزدوج / تلمذة صناعية']],
      },
    };
    for (const [code, l] of Object.entries(lists)) {
      await db.insert(s.referenceLists).values({ code, nameEn: l.en, nameAr: l.ar, isSystem: true }).onConflictDoNothing();
      const [list] = await db.select().from(s.referenceLists).where(sql`lower(${s.referenceLists.code}) = ${code}`);
      for (const [i, [c, en, ar]] of l.items.entries()) {
        await db.insert(s.referenceItems).values({ listId: list.id, code: c, labelEn: en, labelAr: ar, sortOrder: i * 10 }).onConflictDoNothing();
      }
    }

    // ---------------------------------------------------------------- administrator
    const generated: Record<string, string> = {};
    const adminEmail = env.SEED_ADMIN_EMAIL.toLowerCase();
    const [admin] = await db.select().from(s.users).where(sql`lower(${s.users.email}) = ${adminEmail}`);
    let adminId = admin?.id;
    if (!admin) {
      const password = opts.adminPassword ?? env.SEED_ADMIN_PASSWORD ?? randomBytes(12).toString('base64url');
      const [u] = await db
        .insert(s.users)
        .values({ email: adminEmail, fullNameEn: 'System Administrator', fullNameAr: 'مسؤول النظام', passwordHash: await hash(password, argon), locale: 'en', passwordChangedAt: new Date() })
        .returning();
      adminId = u.id;
      await db.insert(s.userRoles).values({ userId: u.id, roleId: roleIds.system_admin });
      generated[adminEmail] = password;
    }

    if (demo) {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.curricula);
      if (n === 0) await seedDemo(db, adminId!, roleIds, generated, opts.adminPassword ?? (env.NODE_ENV !== 'production' ? env.SEED_DEMO_PASSWORD || undefined : undefined));
    }

    if (Object.keys(generated).length) {
      log('\n=== Initial accounts (shown once — store securely and change after first login) ===');
      for (const [e, p] of Object.entries(generated)) log(`  ${e.padEnd(28)} ${p}`);
      log('');
    }
    log('Seed completed.');
    return generated;
  } finally {
    await pool.end();
  }
}

type Db = ReturnType<typeof drizzle<typeof s>>;

async function seedDemo(db: Db, adminId: string, roleIds: Record<string, string>, generated: Record<string, string>, fixedPassword?: string) {
  const by = { createdById: adminId, updatedById: adminId };

  // Institutions
  const [central, school, college] = await db
    .insert(s.institutions)
    .values([
      { code: 'MOE-TVET', nameEn: 'Central Directorate for Technical Education', nameAr: 'الإدارة المركزية للتعليم الفني', typeCode: 'DIRECTORATE', governorateCode: 'CAI', ...by },
      { code: 'ATS-CAI-01', nameEn: 'Cairo Applied Technology School (Electricity)', nameAr: 'مدرسة القاهرة للتكنولوجيا التطبيقية (كهرباء)', typeCode: 'ATS', governorateCode: 'CAI', ...by },
      { code: 'TC-ALX-01', nameEn: 'Alexandria Technical College', nameAr: 'الكلية التكنولوجية بالإسكندرية', typeCode: 'TECH_COLLEGE', governorateCode: 'ALX', ...by },
    ])
    .returning();
  await db.update(s.users).set({ institutionId: central.id }).where(eq(s.users.id, adminId));

  // Demo users (one per role) to demonstrate segregation of duties.
  const demoUsers: [string, string, string, string, string][] = [
    ['manager@cdms.local', 'Standards Manager', 'مدير المعايير', 'standards_manager', central.id],
    ['developer@cdms.local', 'Curriculum Developer', 'مطور المناهج', 'curriculum_developer', school.id],
    ['reviewer@cdms.local', 'Curriculum Reviewer', 'مراجع المناهج', 'reviewer', central.id],
    ['viewer@cdms.local', 'Read-only Viewer', 'مستعرض', 'viewer', college.id],
  ];
  const ids: Record<string, string> = {};
  for (const [email, en, ar, role, inst] of demoUsers) {
    const password = fixedPassword ?? randomBytes(12).toString('base64url');
    const [u] = await db.insert(s.users).values({ email, fullNameEn: en, fullNameAr: ar, passwordHash: await hash(password, argon), institutionId: inst, locale: 'ar', passwordChangedAt: new Date() }).onConflictDoNothing().returning();
    if (u) {
      await db.insert(s.userRoles).values({ userId: u.id, roleId: roleIds[role] });
      generated[email] = password;
      ids[role] = u.id;
    }
  }

  // Egyptian National Qualifications Framework (8 levels)
  const [enqf] = await db.insert(s.frameworks).values({ code: 'ENQF', nameEn: 'Egyptian National Qualifications Framework', nameAr: 'الإطار الوطني المصري للمؤهلات', versionLabel: '2024', status: 'published', ...by }).returning();
  const levelNames: [string, string][] = [
    ['Basic', 'أساسي'], ['Elementary', 'أولي'], ['Semi-skilled', 'شبه ماهر'], ['Skilled', 'ماهر'],
    ['Technician', 'فني'], ['Senior technician / Bachelor', 'فني أول / بكالوريوس'], ['Specialist / Master', 'أخصائي / ماجستير'], ['Expert / Doctorate', 'خبير / دكتوراه'],
  ];
  const levels = await db
    .insert(s.frameworkLevels)
    .values(levelNames.map(([en, ar], i) => ({
      frameworkId: enqf.id, level: i + 1, nameEn: en, nameAr: ar,
      knowledgeEn: `Knowledge descriptor for level ${i + 1}`, knowledgeAr: `واصف المعرفة للمستوى ${i + 1}`,
      skillsEn: `Skills descriptor for level ${i + 1}`, skillsAr: `واصف المهارات للمستوى ${i + 1}`,
      autonomyEn: `Autonomy and responsibility descriptor for level ${i + 1}`, autonomyAr: `واصف الاستقلالية والمسؤولية للمستوى ${i + 1}`, ...by,
    })))
    .returning();
  const L = (n: number) => levels.find((l) => l.level === n)!.id;

  // Occupational classification (ISCO-08 aligned)
  const occ = async (code: string, en: string, ar: string, level: typeof s.occupations.$inferInsert.level, parentId: string | null, isco: string, sector: string) =>
    (await db.insert(s.occupations).values({ code, titleEn: en, titleAr: ar, level, parentId, iscoCode: isco, sectorCode: sector, status: 'published', ...by }).returning())[0];
  const g7 = await occ('ISCO-7', 'Craft and related trades workers', 'الحرفيون والعاملون في المهن المرتبطة', 'major_group', null, '7', 'CONST');
  const g74 = await occ('ISCO-74', 'Electrical and electronic trades workers', 'العاملون في المهن الكهربائية والإلكترونية', 'sub_major_group', g7.id, '74', 'ENERGY');
  const g741 = await occ('ISCO-741', 'Electrical equipment installers and repairers', 'مركبو ومصلحو المعدات الكهربائية', 'minor_group', g74.id, '741', 'ENERGY');
  const g7411u = await occ('ISCO-7411', 'Building and related electricians', 'كهربائيو المباني ومن في حكمهم', 'unit_group', g741.id, '7411', 'ENERGY');
  const electrician = await occ('OCC-ELEC-BLD', 'Building electrician', 'كهربائي مباني', 'occupation', g7411u.id, '7411', 'ENERGY');
  const solar = await occ('OCC-ELEC-PV', 'Solar PV installation technician', 'فني تركيب أنظمة الطاقة الشمسية', 'occupation', g7411u.id, '7411', 'ENERGY');
  const g3 = await occ('ISCO-3', 'Technicians and associate professionals', 'الفنيون والمهنيون المساعدون', 'major_group', null, '3', 'ICT');
  const g35 = await occ('ISCO-35', 'Information and communications technicians', 'فنيو المعلومات والاتصالات', 'sub_major_group', g3.id, '35', 'ICT');
  const g351 = await occ('ISCO-351', 'ICT operations and user support technicians', 'فنيو تشغيل ودعم مستخدمي تكنولوجيا المعلومات', 'minor_group', g35.id, '351', 'ICT');
  const g3512 = await occ('ISCO-3512', 'ICT user support technicians', 'فنيو دعم مستخدمي تكنولوجيا المعلومات', 'unit_group', g351.id, '3512', 'ICT');
  const itSupport = await db.insert(s.occupations).values({ code: 'OCC-ICT-SUP', titleEn: 'IT support technician', titleAr: 'فني دعم تقني', level: 'occupation', parentId: g3512.id, iscoCode: '3512', sectorCode: 'ICT', status: 'draft', ...by }).returning().then((r) => r[0]);

  // Competency standards
  const comp = async (code: string, en: string, ar: string, type: typeof s.competencies.$inferInsert.type, lvl: number, status: 'published' | 'draft' = 'published') =>
    (await db.insert(s.competencies).values({
      code, titleEn: en, titleAr: ar, type, frameworkLevelId: L(lvl), status,
      performanceCriteriaEn: `1. Plans the task\n2. Performs ${en.toLowerCase()} to standard\n3. Verifies and documents the result`,
      performanceCriteriaAr: `١. يخطط للمهمة\n٢. ينفذ ${ar} وفق المعايير\n٣. يتحقق من النتيجة ويوثقها`, ...by,
    }).returning())[0];
  const cSafety = await comp('CMP-OSH-01', 'Apply occupational safety and health procedures', 'تطبيق إجراءات السلامة والصحة المهنية', 'core', 3);
  const cComm = await comp('CMP-GEN-01', 'Communicate effectively in the workplace', 'التواصل الفعال في بيئة العمل', 'generic', 3);
  const cDraw = await comp('CMP-ELEC-01', 'Interpret electrical drawings and specifications', 'قراءة وتفسير الرسومات والمواصفات الكهربائية', 'technical', 4);
  const cWire = await comp('CMP-ELEC-02', 'Install low-voltage wiring systems in buildings', 'تركيب نظم التوصيلات منخفضة الجهد بالمباني', 'technical', 4);
  const cTest = await comp('CMP-ELEC-03', 'Test and commission electrical installations', 'اختبار وتشغيل التركيبات الكهربائية', 'technical', 4);
  const cPv = await comp('CMP-ELEC-04', 'Install grid-connected photovoltaic systems', 'تركيب أنظمة الخلايا الشمسية المتصلة بالشبكة', 'technical', 4);
  const cDigital = await comp('CMP-DIG-01', 'Use digital tools for technical documentation', 'استخدام الأدوات الرقمية في التوثيق الفني', 'digital', 3);
  const cTrouble = await comp('CMP-ICT-01', 'Diagnose and resolve end-user hardware and software issues', 'تشخيص وحل مشكلات الأجهزة والبرمجيات للمستخدمين', 'technical', 4, 'draft');

  await db.insert(s.occupationCompetencies).values([
    ...[cSafety, cComm, cDraw, cWire, cTest, cDigital].map((c) => ({ occupationId: electrician.id, competencyId: c.id })),
    ...[cSafety, cDraw, cPv, cTest].map((c) => ({ occupationId: solar.id, competencyId: c.id })),
    ...[cComm, cDigital, cTrouble].map((c) => ({ occupationId: itSupport.id, competencyId: c.id })),
  ]);

  // Units
  const unit = async (code: string, en: string, ar: string, theory: number, practical: number, credits: number, comps: { id: string }[], los: [string, string][], status: 'published' | 'draft' = 'published') => {
    const [u] = await db.insert(s.units).values({
      code, titleEn: en, titleAr: ar, frameworkLevelId: L(4), theoryHours: theory, practicalHours: practical, creditHours: credits, status,
      descriptionEn: `This unit develops the knowledge and skills required to ${en.toLowerCase()}.`,
      descriptionAr: `تنمي هذه الوحدة المعارف والمهارات اللازمة لـ${ar}.`,
      assessmentEn: 'Written test (30%), practical assessment (60%), portfolio (10%).',
      assessmentAr: 'اختبار تحريري (٣٠٪)، تقييم عملي (٦٠٪)، ملف إنجاز (١٠٪).', ...by,
    }).returning();
    await db.insert(s.learningOutcomes).values(los.map(([en2, ar2], i) => ({ unitId: u.id, code: `LO${i + 1}`, textEn: en2, textAr: ar2, sortOrder: i })));
    if (comps.length) await db.insert(s.unitCompetencies).values(comps.map((c) => ({ unitId: u.id, competencyId: c.id })));
    return u;
  };
  const uSafety = await unit('UNT-OSH-101', 'Workplace safety for electrical work', 'السلامة المهنية في الأعمال الكهربائية', 20, 20, 2, [cSafety], [
    ['Identify electrical hazards and risk controls', 'تحديد المخاطر الكهربائية وطرق التحكم فيها'], ['Apply lock-out/tag-out procedures', 'تطبيق إجراءات العزل والتأمين'], ['Use personal protective equipment correctly', 'استخدام معدات الوقاية الشخصية بشكل صحيح'],
  ]);
  const uDraw = await unit('UNT-ELEC-110', 'Electrical drawing and specifications', 'الرسم الكهربائي والمواصفات', 30, 30, 3, [cDraw, cDigital], [
    ['Read architectural and electrical drawings', 'قراءة الرسومات المعمارية والكهربائية'], ['Prepare a bill of materials from drawings', 'إعداد قائمة المواد من الرسومات'],
  ]);
  const uWire = await unit('UNT-ELEC-120', 'Low-voltage installation practice', 'تطبيقات التركيبات منخفضة الجهد', 30, 90, 6, [cWire, cSafety], [
    ['Install conduits, cable trays and accessories', 'تركيب المواسير وحوامل الكابلات والملحقات'], ['Terminate and connect conductors to standard', 'إنهاء وتوصيل الموصلات وفق المعايير'], ['Install distribution boards', 'تركيب لوحات التوزيع'],
  ]);
  const uTest = await unit('UNT-ELEC-130', 'Testing and commissioning', 'الاختبار والتشغيل', 20, 40, 3, [cTest], [
    ['Perform insulation and continuity tests', 'إجراء اختبارات العزل والاستمرارية'], ['Complete commissioning reports', 'استكمال تقارير التشغيل'],
  ]);
  const uComm = await unit('UNT-GEN-101', 'Workplace communication', 'التواصل في بيئة العمل', 20, 10, 1.5, [cComm], [
    ['Communicate with supervisors and clients', 'التواصل مع المشرفين والعملاء'], ['Write short technical reports', 'كتابة تقارير فنية قصيرة'],
  ]);
  await unit('UNT-ELEC-210', 'Photovoltaic system installation', 'تركيب أنظمة الخلايا الشمسية', 30, 60, 4.5, [cPv, cSafety], [
    ['Size a small grid-connected PV system', 'تصميم نظام خلايا شمسية صغير متصل بالشبكة'], ['Mount modules and install inverters', 'تثبيت الألواح وتركيب العواكس'],
  ], 'draft');

  // Templates
  const [tpl] = await db.insert(s.templates).values({
    code: 'TPL-TVET-CBT', nameEn: 'Competency-based TVET curriculum', nameAr: 'منهج التعليم الفني القائم على الجدارات', kind: 'curriculum', status: 'published',
    descriptionEn: 'Standard structure for competency-based technical programmes.', descriptionAr: 'الهيكل القياسي للبرامج الفنية القائمة على الجدارات.',
    sections: [
      { key: 'rationale', titleEn: 'Programme rationale', titleAr: 'مبررات البرنامج', guidanceEn: 'Labour-market need and target learners.', guidanceAr: 'احتياج سوق العمل والفئة المستهدفة.', required: true },
      { key: 'entry_requirements', titleEn: 'Entry requirements', titleAr: 'شروط الالتحاق', required: true },
      { key: 'learning_strategies', titleEn: 'Teaching and learning strategies', titleAr: 'استراتيجيات التعليم والتعلم', required: true },
      { key: 'assessment', titleEn: 'Assessment strategy', titleAr: 'استراتيجية التقييم', required: true },
      { key: 'resources', titleEn: 'Facilities and resources', titleAr: 'التجهيزات والموارد', required: false },
      { key: 'work_based_learning', titleEn: 'Work-based learning', titleAr: 'التعلم القائم على العمل', required: false },
    ],
    ...by,
  }).returning();
  await db.insert(s.templates).values({ code: 'TPL-SHORT', nameEn: 'Short course outline', nameAr: 'مخطط دورة قصيرة', kind: 'curriculum', status: 'draft', sections: [{ key: 'overview', titleEn: 'Overview', titleAr: 'نظرة عامة', required: true }], ...by });

  // Curricula
  const section = (en: string, ar: string) => ({ en, ar });
  const [cur] = await db.insert(s.curricula).values({
    code: 'CUR-ELEC-BLD', titleEn: 'Building Electrical Installations — Technical Diploma', titleAr: 'دبلوم التركيبات الكهربائية للمباني',
    summaryEn: 'Three-year competency-based programme preparing building electricians.', summaryAr: 'برنامج قائم على الجدارات مدته ثلاث سنوات لإعداد كهربائي المباني.',
    occupationId: electrician.id, frameworkLevelId: L(4), institutionId: school.id, templateId: tpl.id, programTypeCode: 'DIPLOMA_3Y', durationMonths: 36,
    effectiveFrom: '2025-09-01', status: 'published', createdById: ids.curriculum_developer ?? adminId, updatedById: adminId,
    sections: {
      rationale: section('Growing demand for qualified electricians in new urban communities.', 'تزايد الطلب على الكهربائيين المؤهلين في المجتمعات العمرانية الجديدة.'),
      entry_requirements: section('Preparatory education certificate.', 'شهادة إتمام مرحلة التعليم الأساسي.'),
      learning_strategies: section('Workshop-based learning, projects and site visits.', 'التعلم في الورش والمشروعات والزيارات الميدانية.'),
      assessment: section('Continuous competency-based assessment with a final practical exam.', 'تقييم مستمر قائم على الجدارات مع اختبار عملي نهائي.'),
    },
  }).returning();
  await db.insert(s.curriculumUnits).values([uSafety, uDraw, uComm, uWire, uTest].map((u, i) => ({ curriculumId: cur.id, unitId: u.id, term: i < 3 ? 1 : 2, sortOrder: i, isMandatory: true })));
  await db.insert(s.workflowEvents).values([
    { entityType: 'curriculum', entityId: cur.id, action: 'create', toStatus: 'draft', actorId: ids.curriculum_developer ?? adminId },
    { entityType: 'curriculum', entityId: cur.id, action: 'submit', fromStatus: 'draft', toStatus: 'in_review', actorId: ids.curriculum_developer ?? adminId },
    { entityType: 'curriculum', entityId: cur.id, action: 'approve', fromStatus: 'in_review', toStatus: 'approved', actorId: ids.standards_manager ?? adminId, comment: 'Meets the standard.' },
    { entityType: 'curriculum', entityId: cur.id, action: 'publish', fromStatus: 'approved', toStatus: 'published', actorId: ids.standards_manager ?? adminId },
  ]);
  const [draft] = await db.insert(s.curricula).values({
    code: 'CUR-ICT-SUP', titleEn: 'IT Support Technician — Short Programme', titleAr: 'برنامج قصير لفني الدعم التقني', occupationId: itSupport.id,
    frameworkLevelId: L(4), institutionId: school.id, templateId: tpl.id, programTypeCode: 'SHORT', durationMonths: 6, status: 'draft',
    createdById: ids.curriculum_developer ?? adminId, updatedById: ids.curriculum_developer ?? adminId,
    sections: { rationale: section('Digital transformation increases the need for IT support.', '') },
  }).returning();
  await db.insert(s.curriculumUnits).values({ curriculumId: draft.id, unitId: uComm.id, term: 1, sortOrder: 0 });
  await db.insert(s.workflowEvents).values({ entityType: 'curriculum', entityId: draft.id, action: 'create', toStatus: 'draft', actorId: ids.curriculum_developer ?? adminId });
  void solar;
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

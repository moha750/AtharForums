# النشر والتشغيل

## ١. متغيّرات البيئة

| المتغيّر | أين تجده | سرّي؟ |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase ← Project Settings ← API | لا |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase ← API Keys ← Publishable key | لا |
| `NEXT_PUBLIC_SITE_URL` | نطاق الموقع النهائي | لا |

المشروع **لا يستخدم** `service_role` — لا تضِفه.

---

## ٢. خادم البريد (SMTP) — أهم خطوة

الرابط السحري هو طريقة الدخول الوحيدة. خادم البريد الافتراضي في Supabase
**تجريبي فقط: ٣-٤ رسائل في الساعة**، ورسائله تُحجب غالبًا في فلاتر البريد
المؤسسي.

**قبل التدشين يجب ضبط SMTP حقيقي:**

Supabase ← Project Settings ← Authentication ← SMTP Settings

| الحقل | القيمة |
|---|---|
| Sender email | `no-reply@hrsd.gov.sa` |
| Sender name | منتديات أثر |
| Host / Port / Username / Password | من تقنية المعلومات في الوزارة |

**الأفضل هو مُرحّل بريد الوزارة الداخلي**: الرسائل تأتي من نطاق موثوق فلا
تُحجب، وبيانات الموظفين لا تخرج لطرف ثالث. البديل (SES أو Resend) يحتاج
التحقق من النطاق عبر سجلات DNS — وهذا يمرّ بتقنية المعلومات أيضًا.

---

## ٣. روابط إعادة التوجيه في Supabase

Supabase ← Authentication ← URL Configuration

- **Site URL**: نطاق الموقع النهائي
- **Redirect URLs**: أضف `https://<النطاق>/**` و`http://localhost:3000/**`

بدون هذا يفشل الرابط السحري بعد النقر عليه.

---

## ٤. قالب رسالة الدخول

Supabase ← Authentication ← Email Templates ← Magic Link

يُنصح بقالب عربي بهوية أثر بدل القالب الإنجليزي الافتراضي. المتغيّر
`{{ .ConfirmationURL }}` هو رابط الدخول.

---

## ٥. النشر على Vercel

1. ارفع المستودع إلى GitHub.
2. Vercel ← New Project ← استورد المستودع.
3. أضف متغيّرات البيئة الثلاثة.
4. Deploy.
5. بعد صدور النطاق، حدّث `NEXT_PUBLIC_SITE_URL` و**Site URL/Redirect URLs** في
   Supabase، ثم أعد النشر.

---

## ٦. النشر على خادم أو Docker

البناء يُخرج `.next/standalone`:

```bash
npm run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
node .next/standalone/server.js   # PORT=3000
```

هذا ما يجعل المشروع قابلًا للنقل: إن طلبت الوزارة استضافة داخلية لاحقًا، لا
يحتاج الكود إعادة كتابة — تُنقل قاعدة البيانات إلى Postgres داخلي ويُشغَّل
الخادم كما هو.

---

## ٧. أول حساب مشرف

`bootstrap_admin_emails` في جدول `site_settings` يحدّد البُرد التي تحصل على
صلاحية `super_admin` تلقائيًا عند أول تسجيل دخول. القيمة الحالية:
`admin@hrsd.gov.sa`.

لإضافة مشرف آخر قبل أي تسجيل:

```sql
update public.site_settings
set bootstrap_admin_emails = array['admin@hrsd.gov.sa', 'name@hrsd.gov.sa']
where id;
```

وبعد التسجيل، يمكن للمشرف الأعلى ترقية غيره من لوحة التحكم.

---

## ٨. قائمة ما قبل التدشين

- [ ] SMTP مضبوط ومجرَّب برسالة حقيقية إلى بريد وزاري
- [ ] Site URL وRedirect URLs تشير إلى النطاق النهائي
- [ ] قالب رسالة الدخول بالعربية
- [ ] المنتديات المقترحة رُوجعت وعُدّلت ونُشرت
- [ ] تاريخ التدشين صحيح في الإعدادات
- [ ] تسجيل دخول تجريبي ببريد وزاري حقيقي من أوله لآخره
- [ ] محاولة تسجيل ببريد خارجي (يجب أن تُرفض)
- [ ] ترقية Supabase إلى Pro (نسخ احتياطي يومي، بلا إيقاف تلقائي)
- [ ] مراجعة الأمن السيبراني في الوزارة لسيادة البيانات
- [ ] إطفاء **الوضع التشويقي** من الإعدادات لحظة التدشين

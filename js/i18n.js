const STRINGS = {
  en: {
    appName: 'Paid & Signed',
    welcomeLead: 'Write down a payment, have it signed on this phone, and keep the PDF.',
    yourName: 'Your full name',
    yourNameHelp: 'Printed on every receipt as the person paying.',
    firstProject: 'Project name',
    firstProjectHelp: 'For example, our house. You can add more projects later.',
    projectPlaceholder: 'Our house',
    projects: 'My projects',
    newProject: 'New project',
    editProject: 'Edit project',
    projectName: 'Project name',
    errProjectName: 'Enter a name for the project.',
    errProjectExists: 'There is already a project with that name.',
    deleteProject: 'Delete project',
    switchProject: 'Switch project',
    waitingCount: '{n} waiting to be signed',
    save: 'Save',
    close: 'Close',
    currency: 'Currency',
    language: 'Language',
    start: 'Start',
    errYourName: 'Enter your name. It goes on every receipt.',

    paidSoFar: 'Paid so far',
    payments: 'Payments',
    people: 'People',
    newPayment: 'New payment',
    newPaymentTo: 'New payment to {name}',
    settings: 'Settings',
    waiting: 'Waiting for signature',
    signTag: 'Sign',
    emptyTitle: 'No payments yet',
    emptyBody: 'Tap New payment to write the first one.',
    emptyPeople: 'People you pay will be listed here with their totals.',
    noResults: 'No payments match that search.',
    search: 'Search by name or description',
    installTitle: 'Keep this on your Home Screen',
    installBody: 'In Safari, tap Share (it may be under the ••• menu), then More if you need it, then Add to Home Screen. Your receipts stay safe there and it works without internet.',
    gotIt: 'Got it',

    back: 'Back',
    cancel: 'Cancel',
    edit: 'Edit',
    newTitle: 'New payment',
    editTitle: 'Edit payment',

    amountPaid: 'Amount paid',
    date: 'Date',
    paidTo: 'Paid to',
    paidToPlaceholder: 'Name of the person receiving it',
    forWhat: 'What is it for?',
    forWhatPlaceholder: 'Building the starting wall',
    stage: 'Payment stage',
    stagePlaceholder: 'First payment',
    stage1: 'First payment',
    stage2: 'Second payment',
    stage3: 'Third payment',
    stageFinal: 'Final payment',
    method: 'Paid by',
    method_cash: 'Cash',
    method_transfer: 'Bank transfer',
    method_cheque: 'Cheque',
    method_other: 'Other',
    reference: 'Cheque or reference number',
    moreDetails: 'More details',
    agreedTotal: 'Total agreed with this person',
    agreedHelp: 'The receipt will show how much is left to pay.',
    recipientId: 'Their ID or phone number',
    notes: 'Notes',
    getSignatures: 'Get signatures',
    signLater: 'Save and sign later',
    errAmount: 'Enter the amount paid.',
    errName: 'Enter who received the payment.',
    errDate: 'Choose the date of the payment.',
    discardTitle: 'Discard this payment?',
    discardBody: 'What you typed will not be saved.',
    discard: 'Discard',
    keepEditing: 'Keep editing',

    stepOf: 'Signature {n} of 2',
    payerHeading: 'Your signature',
    payerBody: 'You are paying {recipient} on {date}.',
    recipientHeading: '{name}, please sign',
    recipientBody: 'I received this amount from {payer} on {date}.',
    forLine: 'For: {text}',
    signHere: 'Sign here',
    clear: 'Clear',
    remember: 'Remember my signature for next time',
    confirmPayer: 'Confirm and hand over',
    confirmRecipient: 'Confirm and finish',

    receiptNo: 'Receipt {n}',
    draft: 'Not signed',
    signedDone: 'Signed by both of you',
    sharePdf: 'Save or send the PDF',
    preparing: 'Preparing the PDF',
    shareHint: 'Choose Save to Files to upload it to your payments app, or send a copy on WhatsApp.',
    pdfFailed: 'The PDF could not be made. Close the app and open this receipt again.',
    deleteReceipt: 'Delete receipt',
    deletePayment: 'Delete payment',
    deleteSignedTitle: 'Delete receipt {n}?',
    deleteDraftTitle: 'Delete this payment?',
    deleteBody: 'This cannot be undone. PDFs you already saved are not affected.',
    keep: 'Keep it',

    receiptsCount: '{n} signed',
    remainingOf: '{remaining} left of {agreed}',
    savedSignature: 'Your saved signature',
    noSavedSignature: 'None saved. You can save one the next time you sign.',
    removeSignature: 'Remove saved signature',
    records: 'Your records',
    recordsBody: 'Everything stays on this phone and is never sent anywhere. Save a backup now and then, and keep it somewhere safe.',
    saveBackup: 'Save a backup',
    restoreBackup: 'Restore from a backup',
    exportCsv: 'Export list for Excel',
    restored: 'Added {n} receipts from the backup.',
    restoreFailed: 'That file is not a Paid & Signed backup.',
    storageFailed: 'This phone is blocking the app from saving. Turn off Private Browsing in Safari and open it again.',

    pdfTitle: 'Payment receipt',
    pdfReceiptNo: 'Receipt no.',
    pdfSignedOnPhone: 'Signed by hand on a phone screen',
    pdfAmount: 'Amount paid',
    pdfPaidBy: 'Paid by',
    pdfPaidTo: 'Paid to',
    pdfFor: 'For',
    pdfStage: 'Stage',
    pdfMethod: 'Payment method',
    pdfNotes: 'Notes',
    pdfDate: 'Date',
    pdfAgreed: 'Total agreed',
    pdfPaidToDate: 'Paid to date',
    pdfRemaining: 'Remaining',
    pdfStatement: 'I, {recipient}, confirm that I received the amount above from {payer} on {date}.',
    pdfSignRecipient: 'Received by',
    pdfSignPayer: 'Paid by',
    pdfSignedAt: 'Signed {when}',
    pdfNotSigned: 'Not signed yet',
  },

  he: {
    appName: 'שולם ונחתם',
    welcomeLead: 'רושמים תשלום, חותמים עליו בטלפון ושומרים PDF.',
    yourName: 'השם המלא שלך',
    yourNameHelp: 'יודפס בכל אישור בתור המשלם.',
    firstProject: 'שם הפרויקט',
    firstProjectHelp: 'למשל הבית שלנו. אפשר להוסיף עוד פרויקטים בהמשך.',
    projectPlaceholder: 'הבית שלנו',
    projects: 'הפרויקטים שלי',
    newProject: 'פרויקט חדש',
    editProject: 'עריכת פרויקט',
    projectName: 'שם הפרויקט',
    errProjectName: 'יש להזין שם לפרויקט.',
    errProjectExists: 'כבר יש פרויקט בשם הזה.',
    deleteProject: 'מחיקת הפרויקט',
    switchProject: 'החלפת פרויקט',
    waitingCount: 'ממתינים לחתימה: {n}',
    save: 'שמירה',
    close: 'סגירה',
    currency: 'מטבע',
    language: 'שפה',
    start: 'התחלה',
    errYourName: 'יש להזין שם. הוא מופיע בכל אישור.',

    paidSoFar: 'שולם עד כה',
    payments: 'תשלומים',
    people: 'אנשים',
    newPayment: 'תשלום חדש',
    newPaymentTo: 'תשלום חדש ל{name}',
    settings: 'הגדרות',
    waiting: 'ממתין לחתימה',
    signTag: 'לחתום',
    emptyTitle: 'אין עדיין תשלומים',
    emptyBody: 'לחצו על תשלום חדש כדי לרשום את הראשון.',
    emptyPeople: 'האנשים שמשלמים להם יופיעו כאן עם הסכום הכולל.',
    noResults: 'לא נמצאו תשלומים מתאימים.',
    search: 'חיפוש לפי שם או תיאור',
    installTitle: 'כדאי להוסיף למסך הבית',
    installBody: 'ב-Safari לחצו על "שיתוף" (אפשר למצוא אותו בתפריט •••), ואז על "הוספה למסך הבית" (אם צריך, תחת "עוד"). כך האישורים נשמרים והאפליקציה עובדת גם בלי אינטרנט.',
    gotIt: 'הבנתי',

    back: 'חזרה',
    cancel: 'ביטול',
    edit: 'עריכה',
    newTitle: 'תשלום חדש',
    editTitle: 'עריכת תשלום',

    amountPaid: 'הסכום ששולם',
    date: 'תאריך',
    paidTo: 'שולם ל',
    paidToPlaceholder: 'שם מקבל התשלום',
    forWhat: 'עבור מה?',
    forWhatPlaceholder: 'בניית הקיר הראשון',
    stage: 'שלב התשלום',
    stagePlaceholder: 'תשלום ראשון',
    stage1: 'תשלום ראשון',
    stage2: 'תשלום שני',
    stage3: 'תשלום שלישי',
    stageFinal: 'תשלום אחרון',
    method: 'אמצעי תשלום',
    method_cash: 'מזומן',
    method_transfer: 'העברה בנקאית',
    method_cheque: "צ'ק",
    method_other: 'אחר',
    reference: "מספר צ'ק או אסמכתא",
    moreDetails: 'פרטים נוספים',
    agreedTotal: 'הסכום הכולל שסוכם',
    agreedHelp: 'באישור תופיע היתרה לתשלום.',
    recipientId: 'תעודת זהות או טלפון',
    notes: 'הערות',
    getSignatures: 'מעבר לחתימות',
    signLater: 'שמירה וחתימה מאוחר יותר',
    errAmount: 'יש להזין את הסכום ששולם.',
    errName: 'יש להזין מי קיבל את התשלום.',
    errDate: 'יש לבחור את תאריך התשלום.',
    discardTitle: 'לבטל את התשלום הזה?',
    discardBody: 'מה שהוקלד לא יישמר.',
    discard: 'ביטול התשלום',
    keepEditing: 'המשך עריכה',

    stepOf: 'חתימה {n} מתוך 2',
    payerHeading: 'החתימה שלך',
    payerBody: 'תשלום ל{recipient} בתאריך {date}.',
    recipientHeading: '{name}, נא לחתום',
    recipientBody: 'קיבלתי את הסכום הזה מ{payer} בתאריך {date}.',
    forLine: 'עבור: {text}',
    signHere: 'לחתום כאן',
    clear: 'ניקוי',
    remember: 'לזכור את החתימה שלי לפעם הבאה',
    confirmPayer: 'אישור והעברת הטלפון',
    confirmRecipient: 'אישור וסיום',

    receiptNo: 'אישור {n}',
    draft: 'לא נחתם',
    signedDone: 'נחתם על ידי שני הצדדים',
    sharePdf: 'שמירה או שליחה של PDF',
    preparing: 'מכין PDF',
    shareHint: 'בחרו "שמירה בקבצים" כדי להעלות לאפליקציית התשלומים, או שלחו עותק בוואטסאפ.',
    pdfFailed: 'לא ניתן ליצור PDF. סגרו את האפליקציה ופתחו שוב את האישור.',
    deleteReceipt: 'מחיקת האישור',
    deletePayment: 'מחיקת התשלום',
    deleteSignedTitle: 'למחוק את אישור {n}?',
    deleteDraftTitle: 'למחוק את התשלום הזה?',
    deleteBody: 'לא ניתן לשחזר. קובצי PDF שכבר נשמרו לא יושפעו.',
    keep: 'להשאיר',

    receiptsCount: 'חתומים: {n}',
    remainingOf: 'נותרו {remaining} מתוך {agreed}',
    savedSignature: 'החתימה השמורה שלך',
    noSavedSignature: 'אין חתימה שמורה. אפשר לשמור בפעם הבאה שחותמים.',
    removeSignature: 'הסרת החתימה השמורה',
    records: 'הרשומות שלך',
    recordsBody: 'הכול נשמר בטלפון הזה ולא נשלח לשום מקום. מומלץ לשמור גיבוי מדי פעם במקום בטוח.',
    saveBackup: 'שמירת גיבוי',
    restoreBackup: 'שחזור מגיבוי',
    exportCsv: 'ייצוא הרשימה ל-Excel',
    restored: 'נוספו {n} אישורים מהגיבוי.',
    restoreFailed: 'הקובץ הזה אינו גיבוי של האפליקציה.',
    storageFailed: 'הטלפון חוסם את השמירה. כבו גלישה פרטית ב-Safari ופתחו שוב.',

    pdfTitle: 'אישור קבלת תשלום',
    pdfReceiptNo: 'מספר אישור',
    pdfSignedOnPhone: 'נחתם בכתב יד על מסך הטלפון',
    pdfAmount: 'הסכום ששולם',
    pdfPaidBy: 'המשלם',
    pdfPaidTo: 'המקבל',
    pdfFor: 'עבור',
    pdfStage: 'שלב',
    pdfMethod: 'אמצעי תשלום',
    pdfNotes: 'הערות',
    pdfDate: 'תאריך',
    pdfAgreed: 'סכום שסוכם',
    pdfPaidToDate: 'שולם עד כה',
    pdfRemaining: 'יתרה',
    pdfStatement: 'אני, {recipient}, מאשר/ת שקיבלתי את הסכום הנקוב לעיל מ{payer} בתאריך {date}.',
    pdfSignRecipient: 'חתימת המקבל',
    pdfSignPayer: 'חתימת המשלם',
    pdfSignedAt: 'נחתם ב-{when}',
    pdfNotSigned: 'טרם נחתם',
  },
};

const LOCALES = { en: 'en-GB', he: 'he-IL' };

export const LANGUAGES = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
];

export const CURRENCIES = [
  { code: 'ILS', symbol: '₪' },
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'JOD', symbol: 'JD' },
  { code: 'GBP', symbol: '£' },
];

export const isRtl = (lang) => lang === 'he';

export function translator(lang) {
  const table = STRINGS[lang] || STRINGS.he;
  return (key, values = {}) => {
    const text = table[key] ?? STRINGS.en[key] ?? key;
    return text.replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  };
}

export const symbolOf = (code) => CURRENCIES.find((c) => c.code === code)?.symbol ?? code;

const NUMBER = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const money = (n, currency) => {
  const symbol = symbolOf(currency);
  // Whole amounts stay clean. Anything with agorot shows both digits: 1,250.50
  const digits = Number.isInteger(n) ? NUMBER.format(n) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return symbol.length > 1 ? `${symbol} ${digits}` : `${symbol}${digits}`;
};

export const groupDigits = (n) => NUMBER.format(n);

export const receiptNumber = (n) => (n ? String(n).padStart(4, '0') : '');

function localDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const longDate = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'long', year: 'numeric' }).format(localDate(iso));

export const monthLabel = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', year: 'numeric' }).format(localDate(iso));

export const dateTime = (iso, lang) =>
  new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));

export function todayIso() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
